import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import {
  GenerateAiDescriptionService,
  MAX_BATCH_CONCURRENCY,
} from '@services/generativeAiDescriptionService';

type CliOptions = {
  empresaId: number;
  concurrency: number;
  limit?: number;
  startAfterId: number;
  dryRun: boolean;
};

function integerArg(name: string, fallback?: number): number | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`O argumento --${name} deve ser um número inteiro não negativo`);
  }
  return value;
}

function optionsFromCli(): CliOptions {
  const empresaId = integerArg(
    'empresa-id',
    Number(process.env.AI_DESCRIPTION_EMPRESA_ID || 1)
  ) as number;
  const requestedConcurrency = integerArg('concurrency', MAX_BATCH_CONCURRENCY) as number;
  const limit = integerArg('limit');
  const startAfterId = integerArg('after', 0) as number;

  if (empresaId <= 0) throw new Error('--empresa-id deve ser maior que zero');
  if (requestedConcurrency <= 0 || requestedConcurrency > MAX_BATCH_CONCURRENCY) {
    throw new Error(`--concurrency deve estar entre 1 e ${MAX_BATCH_CONCURRENCY}`);
  }
  if (limit === 0) throw new Error('--limit deve ser maior que zero');

  return {
    empresaId,
    concurrency: requestedConcurrency,
    limit,
    startAfterId,
    dryRun: process.argv.includes('--dry-run'),
  };
}

function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return 'calculando';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

async function run(): Promise<void> {
  const options = optionsFromCli();
  if (!process.env.DEEPSEEK_API_KEY?.trim() && !options.dryRun) {
    throw new Error('DEEPSEEK_API_KEY não está configurada em backend/.env');
  }

  const ids = await GenerateAiDescriptionService.listProductIds(
    options.empresaId,
    options.limit,
    options.startAfterId,
    undefined,
    true
  );

  console.log(JSON.stringify({
    evento: 'inicio',
    empresa_id: options.empresaId,
    produtos_publicados: ids.length,
    concorrencia: options.concurrency,
    provedor: 'deepseek',
    modelo_com_imagem: process.env.AI_DESCRIPTION_DEEPSEEK_VISION_MODEL
      || 'deepseek-v4-flash-vision-exp',
    dry_run: options.dryRun,
  }));

  if (options.dryRun || ids.length === 0) return;

  const startedAt = Date.now();
  const summary = await GenerateAiDescriptionService.generateAllProducts({
    empresaId: options.empresaId,
    concurrency: options.concurrency,
    limit: options.limit,
    startAfterId: options.startAfterId,
    publishedOnly: true,
    provider: 'deepseek',
    // O lote de 25 minutos não deve ficar horas parado em um item; falhas ficam no resumo.
    maxRetryWaitMs: 1,
    onProgress: (completed, total, item) => {
      const elapsedSeconds = (Date.now() - startedAt) / 1_000;
      const rate = completed / elapsedSeconds;
      console.log(JSON.stringify({
        evento: 'progresso',
        concluido: completed,
        total,
        produto_id: item.id_produto,
        sucesso: item.success,
        tentativas: item.attempts,
        taxa_por_segundo: Number(rate.toFixed(2)),
        eta: duration((total - completed) / rate),
        erro: item.error,
      }));
    },
  });

  const failedIds = summary.items
    .filter((item) => !item.success)
    .map((item) => item.id_produto);
  console.log(JSON.stringify({
    evento: 'fim',
    total: summary.total,
    sucesso: summary.success,
    falhas: summary.failed,
    retries: summary.retries,
    duracao: duration((Date.now() - startedAt) / 1_000),
    ids_com_falha: failedIds,
  }));

  if (summary.failed > 0) process.exitCode = 2;
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
