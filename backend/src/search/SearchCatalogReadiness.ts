import { SearchCatalogRepair } from './SearchCatalogRepair';

const CACHE_MS = 60_000;
const state = new Map<number, { checkedAt: number; ready: boolean }>();

/** Prevents a missing or partial search-document rebuild from silently degrading public relevance. */
export class SearchCatalogReadiness {
  static async assertReady(empresaId: number): Promise<void> {
    const cached = state.get(empresaId);
    if (cached && Date.now() - cached.checkedAt < CACHE_MS) {
      if (cached.ready) return;
    }
    try {
      const coverage = await SearchCatalogRepair.inspect(empresaId);
      const ready = coverage.ready;
      state.set(empresaId, { checkedAt: Date.now(), ready });
      if (!ready) throw Object.assign(
        new Error('Indice de busca ainda nao cobre todo o catalogo publico; execute search:repair-coverage'),
        { code: 'SEARCH_CATALOG_NOT_READY', statusCode: 503 },
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'SEARCH_CATALOG_NOT_READY') throw error;
      throw Object.assign(new Error('Indice de busca indisponivel; execute a migracao e o rebuild antes de publicar a busca'), {
        code: 'SEARCH_CATALOG_NOT_READY', statusCode: 503,
      });
    }
  }

  static clearCache(): void { state.clear(); }
}
