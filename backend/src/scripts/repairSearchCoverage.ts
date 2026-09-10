import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { DictionaryService } from '@/search/DictionaryService';
import { SearchCatalogReadiness } from '@/search/SearchCatalogReadiness';
import { SearchCatalogRepair } from '@/search/SearchCatalogRepair';

const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID || 1);
const batchSize = Number(process.argv[3] || process.env.SEARCH_REBUILD_BATCH_SIZE || 250);

const run = async (): Promise<void> => {
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe um id_empresa válido');
  const productTypeTerms = await DictionaryService.syncPublicProductTypes(empresaId);
  const before = await SearchCatalogRepair.inspect(empresaId);
  const result = await SearchCatalogRepair.repair(empresaId, batchSize);
  SearchCatalogReadiness.clearCache();
  await SearchCatalogReadiness.assertReady(empresaId);
  console.log(JSON.stringify({ empresaId, productTypeTerms, before, ...result }, null, 2));
};

run()
  .then(closeDatabasePool)
  .catch(async (error) => {
    console.error(error);
    await closeDatabasePool();
    process.exit(1);
  });
