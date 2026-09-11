import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { SearchMaintenanceService } from '@/search/SearchMaintenanceService';

const empresaId = Number(process.argv[2] || process.env.SEARCH_REBUILD_EMPRESA_ID || 1);
const batchSize = Number(process.argv[3] || process.env.SEARCH_REBUILD_BATCH_SIZE || 250);

const run = async (): Promise<void> => {
  if (!Number.isInteger(empresaId) || empresaId <= 0) throw new Error('Informe um id_empresa válido');
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('Informe um tamanho de lote valido');
  console.log(`[search:repair-coverage] Iniciando empresa=${empresaId}, lote=${batchSize}`);
  const result = await SearchMaintenanceService.run(empresaId, 'script', batchSize);
  console.log(JSON.stringify(result, null, 2));
};

run()
  .then(closeDatabasePool)
  .catch(async (error) => {
    console.error(error);
    await closeDatabasePool();
    process.exit(1);
  });
