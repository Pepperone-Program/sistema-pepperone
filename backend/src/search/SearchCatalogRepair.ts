import { SEARCH_DOCUMENT_VERSION } from '@config/search';
import { query } from '@database/connection';
import { PRODUTO_COLUMNS } from '@models/selectColumns';
import type { Produto } from '@/types/produto';
import { SearchDocumentService } from './SearchDocumentService';

const DEFAULT_BATCH_SIZE = 250;

export type SearchCatalogCoverage = {
  publicProducts: number;
  publicDocuments: number;
  validDocuments: number;
  ready: boolean;
};

export class SearchCatalogRepair {
  static async inspect(empresaId: number): Promise<SearchCatalogCoverage> {
    const rows = await query(`SELECT
      (SELECT COUNT(*) FROM produtos WHERE id_empresa = ? AND site = 'S' AND habilitado = 'S') public_products,
      (SELECT COUNT(*) FROM product_search_documents WHERE id_empresa = ? AND is_public = 1) public_documents,
      (SELECT COUNT(*) FROM produtos p INNER JOIN product_search_documents psd
        ON psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto
        WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S' AND psd.is_public = 1
          AND psd.document_version = ? AND psd.source_hash <> ''
          AND psd.updated_at >= COALESCE(p.data_modificacao, p.data_inclusao)) valid_documents`,
    [empresaId, empresaId, empresaId, SEARCH_DOCUMENT_VERSION]) as Array<{
      public_products: number;
      public_documents: number;
      valid_documents: number;
    }>;
    const result = rows[0];
    const publicProducts = Number(result?.public_products || 0);
    const publicDocuments = Number(result?.public_documents || 0);
    const validDocuments = Number(result?.valid_documents || 0);
    return {
      publicProducts,
      publicDocuments,
      validDocuments,
      ready: publicProducts === publicDocuments && publicProducts === validDocuments,
    };
  }

  static async repair(empresaId: number, batchSize: number = DEFAULT_BATCH_SIZE): Promise<{
    synchronized: number;
    removed: number;
    coverage: SearchCatalogCoverage;
  }> {
    const safeBatchSize = Math.min(Math.max(Math.trunc(batchSize), 10), 1000);
    let synchronized = 0;
    let removed = 0;

    while (true) {
      const products = await query(`SELECT ${PRODUTO_COLUMNS}
        FROM produtos p
        WHERE p.id_empresa = ?
          AND (
            (p.site = 'S' AND p.habilitado = 'S' AND NOT EXISTS (
              SELECT 1 FROM product_search_documents psd
              WHERE psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto
                AND psd.is_public = 1 AND psd.document_version = ? AND psd.source_hash <> ''
                AND psd.updated_at >= COALESCE(p.data_modificacao, p.data_inclusao)
            ))
            OR ((p.site <> 'S' OR p.habilitado <> 'S') AND EXISTS (
              SELECT 1 FROM product_search_documents psd
              WHERE psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto
                AND psd.is_public = 1
            ))
          )
        ORDER BY p.id_produto
        LIMIT ?`, [empresaId, SEARCH_DOCUMENT_VERSION, safeBatchSize]) as Produto[];
      if (!products.length) break;
      await SearchDocumentService.syncProducts(empresaId, products);
      synchronized += products.length;
    }

    while (true) {
      const orphanRows = await query(`SELECT psd.id_produto
        FROM product_search_documents psd
        LEFT JOIN produtos p ON p.id_empresa = psd.id_empresa AND p.id_produto = psd.id_produto
        WHERE psd.id_empresa = ? AND p.id_produto IS NULL
        ORDER BY psd.id_produto
        LIMIT ?`, [empresaId, safeBatchSize]) as Array<{ id_produto: number }>;
      if (!orphanRows.length) break;
      for (const row of orphanRows) {
        await SearchDocumentService.removeProduct(empresaId, Number(row.id_produto));
        removed += 1;
      }
    }

    return { synchronized, removed, coverage: await this.inspect(empresaId) };
  }
}
