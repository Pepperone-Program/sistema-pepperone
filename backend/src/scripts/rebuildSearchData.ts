import '../module-alias';
import { closeDatabasePool, query } from '@database/connection';
import { PRODUTO_COLUMNS } from '@models/selectColumns';
import { SearchDocumentService } from '@/search/SearchDocumentService';
import { SearchCatalogReadiness } from '@/search/SearchCatalogReadiness';
import { DictionaryService } from '@/search/DictionaryService';
import type { Produto } from '@/types/produto';

const batchSize = Math.min(Math.max(Number(process.env.SEARCH_REBUILD_BATCH_SIZE || 250), 10), 1000);
const empresaId = Number(process.env.SEARCH_REBUILD_EMPRESA_ID || 1);
const dryRun = process.argv.includes('--dry-run');
const startAfterArg = process.argv.find((arg) => arg.startsWith('--after='));

const run = async (): Promise<void> => {
  if (!dryRun) {
    const productTypeTerms = await DictionaryService.syncPublicProductTypes(empresaId);
    console.log(JSON.stringify({ empresaId, productTypeTerms }));
  }
  let afterId = Number(startAfterArg?.split('=')[1] || 0);
  let processed = 0;
  while (true) {
    const rows = await query(`SELECT ${PRODUTO_COLUMNS} FROM produtos WHERE id_empresa = ? AND id_produto > ? ORDER BY id_produto ASC LIMIT ?`, [empresaId, afterId, batchSize]) as Produto[];
    if (!rows.length) break;
    if (!dryRun) await SearchDocumentService.syncProducts(empresaId, rows);
    afterId = Number(rows[rows.length - 1].id_produto);
    processed += rows.length;
    console.log(JSON.stringify({ empresaId, processed, afterId, dryRun }));
  }
  if (!dryRun) {
    SearchCatalogReadiness.clearCache();
    await SearchCatalogReadiness.assertReady(empresaId);
    console.log(JSON.stringify({ empresaId, processed, searchCatalogReady: true }));
  }
};

run().then(closeDatabasePool).catch(async (error) => { console.error(error); await closeDatabasePool(); process.exit(1); });
