import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../../src/services/CacheService';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('optional Redis cache', () => {
  it('aborts an unavailable Redis connection and still returns loader data', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://cache.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      const signal = options.signal!;
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
    })));
    const loader = vi.fn().mockResolvedValue({ items: [{ id_produto: 1 }] });
    expect(await CacheService.getOrSet('test', loader)).toEqual({ items: [{ id_produto: 1 }] });
    expect(loader).toHaveBeenCalledOnce();
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
