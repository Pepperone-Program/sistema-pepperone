import { query } from '@database/connection';

const CACHE_MS = 60_000;
const state = new Map<number, { checkedAt: number; ready: boolean }>();

/** Prevents a missing or partial search-document rebuild from silently degrading public relevance. */
export class SearchCatalogReadiness {
  static async assertReady(empresaId: number): Promise<void> {
    const cached = state.get(empresaId);
    if (cached && cached.ready && Date.now() - cached.checkedAt < CACHE_MS) return;
    try {
      const rows = await query(`SELECT
        (SELECT COUNT(*) FROM produtos WHERE id_empresa = ? AND site = 'S' AND habilitado = 'S') public_products,
        (SELECT COUNT(*) FROM product_search_documents WHERE id_empresa = ? AND is_public = 1) public_documents,
        (SELECT COUNT(*) FROM produtos p LEFT JOIN product_search_documents psd
          ON psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto AND psd.is_public = 1
          WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S' AND psd.id_produto IS NULL) missing_documents`,
      [empresaId, empresaId, empresaId]) as Array<{ public_products: number; public_documents: number; missing_documents: number }>;
      const result = rows[0];
      const ready = Boolean(result) && Number(result.public_products) === Number(result.public_documents) && Number(result.missing_documents) === 0;
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
