import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  release: vi.fn(),
  query: vi.fn(),
  inspect: vi.fn(),
  repair: vi.fn(),
  syncTypes: vi.fn(),
  invalidate: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../../src/database/connection', () => ({
  getConnection: vi.fn(async () => ({ execute: mocks.execute, release: mocks.release })),
  query: mocks.query,
}));
vi.mock('../../src/search/SearchCatalogRepair', () => ({
  SearchCatalogRepair: { inspect: mocks.inspect, repair: mocks.repair },
}));
vi.mock('../../src/search/DictionaryService', () => ({
  DictionaryService: { syncPublicProductTypes: mocks.syncTypes },
}));
vi.mock('../../src/search/SearchCatalogReadiness', () => ({
  SearchCatalogReadiness: { clearCache: mocks.clearCache },
}));
vi.mock('../../src/services/CacheService', () => ({
  CacheService: { invalidateNamespaces: mocks.invalidate },
}));

import { SearchMaintenanceService } from '../../src/search/SearchMaintenanceService';

const healthy = { publicProducts: 10, publicDocuments: 10, validDocuments: 10, ready: true };
const incomplete = { publicProducts: 10, publicDocuments: 9, validDocuments: 9, ready: false };

describe('SearchMaintenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue([[{ acquired: 1 }], []]);
    mocks.invalidate.mockResolvedValue(undefined);
    mocks.syncTypes.mockResolvedValue(4);
  });

  afterEach(() => vi.restoreAllMocks());

  it('does not write when coverage is already healthy', async () => {
    mocks.inspect.mockResolvedValue(healthy);

    const result = await SearchMaintenanceService.run(1, 'cron');

    expect(result.skipped).toBe(true);
    expect(result.coverage.ready).toBe(true);
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(mocks.syncTypes).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it('repairs incomplete coverage and invalidates search caches', async () => {
    mocks.inspect.mockResolvedValue(incomplete);
    mocks.repair.mockResolvedValue({ synchronized: 1, removed: 2, coverage: healthy });

    const result = await SearchMaintenanceService.run(7, 'manual');

    expect(mocks.syncTypes).toHaveBeenCalledWith(7);
    expect(mocks.repair).toHaveBeenCalledWith(7, 250);
    expect(result).toMatchObject({ empresaId: 7, synchronized: 1, removed: 2, skipped: false });
    expect(mocks.clearCache).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith(['search', 'search-v2']);
  });

  it('rejects a run when the distributed lock is held', async () => {
    mocks.execute.mockResolvedValueOnce([[{ acquired: 0 }], []]);

    await expect(SearchMaintenanceService.run(1, 'manual')).rejects.toMatchObject({
      code: 'SEARCH_MAINTENANCE_RUNNING',
      statusCode: 409,
    });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it('keeps tenant ids isolated in inspection and repair', async () => {
    mocks.inspect.mockResolvedValue(incomplete);
    mocks.repair.mockResolvedValue({ synchronized: 1, removed: 0, coverage: healthy });

    await SearchMaintenanceService.run(23, 'manual');

    expect(mocks.inspect).toHaveBeenCalledWith(23);
    expect(mocks.repair).toHaveBeenCalledWith(23, 250);
  });

  it('releases the lock and reports a database inspection failure', async () => {
    mocks.inspect.mockRejectedValue(new Error('database unavailable'));

    await expect(SearchMaintenanceService.run(1, 'cron')).rejects.toThrow('database unavailable');
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.repair).not.toHaveBeenCalled();
  });
});
