import { getConnection, query } from '@database/connection';
import { CacheService } from '@services/CacheService';
import { DictionaryService } from './DictionaryService';
import { SearchCatalogReadiness } from './SearchCatalogReadiness';
import { SearchCatalogRepair, type SearchCatalogCoverage } from './SearchCatalogRepair';

export type SearchMaintenanceOrigin = 'manual' | 'cron' | 'script';

export type SearchMaintenanceResult = {
  empresaId: number;
  origin: SearchMaintenanceOrigin;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  skipped: boolean;
  synchronized: number;
  removed: number;
  productTypeTerms: number;
  before: SearchCatalogCoverage;
  coverage: SearchCatalogCoverage;
  error?: string;
};

export type SearchMaintenanceStatus = {
  empresaId: number;
  running: boolean;
  coverage: SearchCatalogCoverage;
  lastResult: SearchMaintenanceResult | null;
};

const activeRuns = new Map<number, Promise<SearchMaintenanceResult>>();
const lastResults = new Map<number, SearchMaintenanceResult>();

const lockName = (empresaId: number): string => `pepperone:search-maintenance:${empresaId}`;

const maintenanceError = (message: string, code: string, statusCode: number): Error & { code: string; statusCode: number } =>
  Object.assign(new Error(message), { code, statusCode });

export class SearchMaintenanceService {
  static async status(empresaId: number): Promise<SearchMaintenanceStatus> {
    const [coverage, lockRows] = await Promise.all([
      SearchCatalogRepair.inspect(empresaId),
      query('SELECT IS_USED_LOCK(?) lock_owner', [lockName(empresaId)]) as Promise<Array<{ lock_owner: number | null }>>,
    ]);
    return {
      empresaId,
      running: activeRuns.has(empresaId) || lockRows[0]?.lock_owner !== null,
      coverage,
      lastResult: lastResults.get(empresaId) || null,
    };
  }

  static async run(
    empresaId: number,
    origin: SearchMaintenanceOrigin,
    batchSize = Number(process.env.SEARCH_REBUILD_BATCH_SIZE || 250),
  ): Promise<SearchMaintenanceResult> {
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw maintenanceError('Empresa invalida para manutencao da busca', 'INVALID_EMPRESA', 400);
    }
    if (activeRuns.has(empresaId)) {
      throw maintenanceError('A manutencao da busca ja esta em execucao', 'SEARCH_MAINTENANCE_RUNNING', 409);
    }

    const promise = this.runLocked(empresaId, origin, batchSize);
    activeRuns.set(empresaId, promise);
    try {
      return await promise;
    } finally {
      activeRuns.delete(empresaId);
    }
  }

  private static async runLocked(
    empresaId: number,
    origin: SearchMaintenanceOrigin,
    batchSize: number,
  ): Promise<SearchMaintenanceResult> {
    const startedAtDate = new Date();
    const startedAt = startedAtDate.toISOString();
    const connection = await getConnection();
    let acquired = false;
    let before: SearchCatalogCoverage | null = null;
    let synchronized = 0;
    let removed = 0;
    let productTypeTerms = 0;

    try {
      const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 0) acquired', [lockName(empresaId)]) as unknown as [Array<{ acquired: number }>, unknown];
      acquired = Number(lockRows[0]?.acquired) === 1;
      if (!acquired) {
        throw maintenanceError('A manutencao da busca ja esta em execucao', 'SEARCH_MAINTENANCE_RUNNING', 409);
      }

      console.log(`[SearchMaintenance] inicio origin=${origin} empresa=${empresaId}`);
      before = await SearchCatalogRepair.inspect(empresaId);
      let coverage = before;

      if (!coverage.ready) {
        productTypeTerms = await DictionaryService.syncPublicProductTypes(empresaId);
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const repaired = await SearchCatalogRepair.repair(empresaId, batchSize);
          synchronized += repaired.synchronized;
          removed += repaired.removed;
          coverage = repaired.coverage;
          if (coverage.ready) break;
        }
        SearchCatalogReadiness.clearCache();
        await CacheService.invalidateNamespaces(['search', 'search-v2']);
      }

      if (!coverage.ready) {
        throw maintenanceError('A cobertura da busca continua incompleta apos o reparo', 'SEARCH_CATALOG_NOT_READY', 503);
      }

      const result: SearchMaintenanceResult = {
        empresaId,
        origin,
        startedAt,
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAtDate.getTime(),
        skipped: before.ready,
        synchronized,
        removed,
        productTypeTerms,
        before,
        coverage,
      };
      lastResults.set(empresaId, result);
      console.log(`[SearchMaintenance] fim origin=${origin} empresa=${empresaId} ready=${coverage.ready} synchronized=${synchronized} removed=${removed} elapsedMs=${result.elapsedMs}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (before) {
        const failed: SearchMaintenanceResult = {
          empresaId,
          origin,
          startedAt,
          finishedAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedAtDate.getTime(),
          skipped: false,
          synchronized,
          removed,
          productTypeTerms,
          before,
          coverage: await SearchCatalogRepair.inspect(empresaId).catch(() => before!),
          error: message,
        };
        lastResults.set(empresaId, failed);
      }
      console.error(`[SearchMaintenance] falha origin=${origin} empresa=${empresaId} error=${message}`);
      throw error;
    } finally {
      if (acquired) await connection.execute('SELECT RELEASE_LOCK(?)', [lockName(empresaId)]).catch(() => undefined);
      connection.release();
    }
  }
}
