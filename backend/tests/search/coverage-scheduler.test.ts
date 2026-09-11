import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnabled = process.env.SEARCH_COVERAGE_CRON_ENABLED;
const originalExpression = process.env.SEARCH_COVERAGE_CRON_EXPRESSION;
const originalEmpresa = process.env.SEARCH_REBUILD_EMPRESA_ID;

describe('SearchCoverageScheduler config', () => {
  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.SEARCH_COVERAGE_CRON_ENABLED;
    else process.env.SEARCH_COVERAGE_CRON_ENABLED = originalEnabled;
    if (originalExpression === undefined) delete process.env.SEARCH_COVERAGE_CRON_EXPRESSION;
    else process.env.SEARCH_COVERAGE_CRON_EXPRESSION = originalExpression;
    if (originalEmpresa === undefined) delete process.env.SEARCH_REBUILD_EMPRESA_ID;
    else process.env.SEARCH_REBUILD_EMPRESA_ID = originalEmpresa;
    vi.resetModules();
  });

  it('is enabled every five minutes by default', async () => {
    delete process.env.SEARCH_COVERAGE_CRON_ENABLED;
    delete process.env.SEARCH_COVERAGE_CRON_EXPRESSION;
    const { SearchCoverageScheduler } = await import('../../src/search/SearchCoverageScheduler');
    expect(SearchCoverageScheduler.config()).toMatchObject({ enabled: true, expression: '*/5 * * * *' });
  });

  it('can be disabled explicitly', async () => {
    process.env.SEARCH_COVERAGE_CRON_ENABLED = 'false';
    const { SearchCoverageScheduler } = await import('../../src/search/SearchCoverageScheduler');
    expect(SearchCoverageScheduler.config().enabled).toBe(false);
  });

  it('falls back safely when the cron expression is invalid', async () => {
    process.env.SEARCH_COVERAGE_CRON_EXPRESSION = 'not-a-cron';
    const { SearchCoverageScheduler } = await import('../../src/search/SearchCoverageScheduler');
    expect(SearchCoverageScheduler.config().expression).toBe('*/5 * * * *');
  });
});
