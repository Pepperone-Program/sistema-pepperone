import { SearchCatalogRepair } from './SearchCatalogRepair';

const CACHE_MS = 60_000;
const state = new Map<number, { checkedAt: number; ready: boolean }>();
const repairs = new Map<number, Promise<boolean>>();

/** Prevents a missing or partial search-document rebuild from silently degrading public relevance. */
export class SearchCatalogReadiness {
  static async assertReady(empresaId: number): Promise<void> {
    const cached = state.get(empresaId);
    if (cached && Date.now() - cached.checkedAt < CACHE_MS) {
      if (cached.ready) return;
    }
    try {
      let coverage = await SearchCatalogRepair.inspect(empresaId);
      if (!coverage.ready) {
        let repair = repairs.get(empresaId);
        if (!repair) {
          repair = SearchCatalogRepair.repair(empresaId)
            .then((result) => result.coverage.ready)
            .finally(() => repairs.delete(empresaId));
          repairs.set(empresaId, repair);
        }
        await repair;
        coverage = await SearchCatalogRepair.inspect(empresaId);
      }
      const ready = coverage.ready;
      state.set(empresaId, { checkedAt: Date.now(), ready });
      if (!ready) throw Object.assign(new Error('Indice de busca ainda nao cobre todo o catalogo publico'), { code: 'SEARCH_CATALOG_NOT_READY', statusCode: 503 });
    } catch (error) {
      if ((error as { code?: string }).code === 'SEARCH_CATALOG_NOT_READY') throw error;
      throw Object.assign(new Error('Indice de busca indisponivel; execute a migracao e o rebuild antes de publicar a busca'), {
        code: 'SEARCH_CATALOG_NOT_READY', statusCode: 503,
      });
    }
  }

  static clearCache(): void { state.clear(); }
}
