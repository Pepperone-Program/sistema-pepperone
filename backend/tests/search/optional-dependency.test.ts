import { describe, expect, it, vi } from 'vitest';
import { OptionalSearchDependency } from '../../src/search/OptionalSearchDependency';

describe('optional search dependencies', () => {
  it('bounds stalled work, coalesces concurrent calls and opens a circuit', async () => {
    vi.useFakeTimers();
    try {
      const work = vi.fn(() => new Promise<string>(() => {}));
      const a = OptionalSearchDependency.run('stalled', work, 'catalog');
      const b = OptionalSearchDependency.run('stalled', work, 'catalog');
      await vi.advanceTimersByTimeAsync(400);
      expect(await a).toBe('catalog');
      expect(await b).toBe('catalog');
      expect(await OptionalSearchDependency.run('stalled', work, 'catalog')).toBe('catalog');
      expect(work).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('does not queue distinct optional queries during an outage', async () => {
    const work = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await OptionalSearchDependency.run('one', work, [], 400, 'company-index')).toEqual([]);
    expect(await OptionalSearchDependency.run('two', work, [], 400, 'company-index')).toEqual([]);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
