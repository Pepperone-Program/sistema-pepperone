import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { DictionaryService } from '@/search/DictionaryService';
import { SearchCatalogRepair } from '@/search/SearchCatalogRepair';

const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID || 1);
const batchSize = Number(process.argv[3] || process.env.SEARCH_REBUILD_BATCH_SIZE || 250);

const run = async (): Promise<void> => {
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe um id_empresa válido');
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('Informe um tamanho de lote valido');
  const startedAt = Date.now();
  console.log(`[search:repair-coverage] Iniciando empresa=${empresaId}, lote=${batchSize}`);
  console.log('[search:repair-coverage] Sincronizando tipos publicos...');
  const productTypeTerms = await DictionaryService.syncPublicProductTypes(empresaId);
  console.log(`[search:repair-coverage] Tipos sincronizados: ${productTypeTerms}. Inspecionando cobertura...`);
  const before = await SearchCatalogRepair.inspect(empresaId);
  console.log(`[search:repair-coverage] Cobertura inicial: ${before.validDocuments}/${before.publicProducts} documentos validos.`);
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = await SearchCatalogRepair.repair(empresaId, batchSize, (progress) => {
      const action = progress.phase === 'synchronize' ? 'sincronizados' : 'orfaos removidos';
      console.log(`[search:repair-coverage] ${progress.processed} ${action} (lote ${progress.batchSize}, produtos ${progress.firstProductId}-${progress.lastProductId}).`);
    });
    console.log(`[search:repair-coverage] Cobertura apos tentativa ${attempt}: ${result.coverage.validDocuments}/${result.coverage.publicProducts} validos; ${result.coverage.publicDocuments} publicos.`);
    if (result.coverage.ready) break;
  }
  if (!result || !result.coverage.ready) {
    throw new Error('O catalogo continua mudando durante o reparo; interrompa o processo que altera os produtos e tente novamente');
  }
  console.log(JSON.stringify({ empresaId, productTypeTerms, before, ...result, elapsedMs: Date.now() - startedAt }, null, 2));
};

run()
  .then(closeDatabasePool)
  .catch(async (error) => {
    console.error(error);
    await closeDatabasePool();
    process.exit(1);
  });
