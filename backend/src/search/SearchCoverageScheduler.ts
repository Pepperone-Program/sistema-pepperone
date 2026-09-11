import cron, { type ScheduledTask } from 'node-cron';
import { SearchMaintenanceService } from './SearchMaintenanceService';

const DEFAULT_EXPRESSION = '*/5 * * * *';

export type SearchCoverageSchedulerStatus = {
  enabled: boolean;
  expression: string;
  empresaId: number;
};

export class SearchCoverageScheduler {
  private static task: ScheduledTask | null = null;

  static config(): SearchCoverageSchedulerStatus {
    const configuredExpression = process.env.SEARCH_COVERAGE_CRON_EXPRESSION || DEFAULT_EXPRESSION;
    const expression = cron.validate(configuredExpression) ? configuredExpression : DEFAULT_EXPRESSION;
    return {
      enabled: process.env.SEARCH_COVERAGE_CRON_ENABLED !== 'false',
      expression,
      empresaId: Number(process.env.SEARCH_REBUILD_EMPRESA_ID || 1),
    };
  }

  static start(): ScheduledTask | null {
    if (this.task) return this.task;
    const config = this.config();
    const configuredExpression = process.env.SEARCH_COVERAGE_CRON_EXPRESSION || DEFAULT_EXPRESSION;
    if (!cron.validate(configuredExpression)) {
      console.warn(`[SearchCoverageScheduler] expressao invalida; usando ${DEFAULT_EXPRESSION}`);
    }
    if (!config.enabled) {
      console.log('[SearchCoverageScheduler] desabilitado');
      return null;
    }
    this.task = cron.schedule(config.expression, async () => {
      try {
        await SearchMaintenanceService.run(config.empresaId, 'cron');
      } catch (error) {
        if ((error as { code?: string }).code !== 'SEARCH_MAINTENANCE_RUNNING') {
          console.error('[SearchCoverageScheduler] falha', error);
        }
      }
    }, { noOverlap: true });
    console.log(`[SearchCoverageScheduler] ativo expression=${config.expression} empresa=${config.empresaId}`);
    return this.task;
  }

  static stop(): void {
    this.task?.stop();
    this.task = null;
  }
}
