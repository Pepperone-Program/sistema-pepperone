import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../src/services/CacheService';

const values = new Map<string, string>();
const calls: string[][] = [];
let failIncr = false;

beforeEach(() => {
  values.clear();
  calls.length = 0;
  failIncr = false;
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    const command = JSON.parse(String(options.body)) as string[];
    calls.push(command);
    const [operation, key] = command;
    if (operation === 'INCR' && failIncr) return new Response(JSON.stringify({ error: 'unavailable' }));
    let result: string | number | null = null;
    if (operation === 'GET') result = values.get(key) ?? null;
    if (operation === 'SET') { values.set(key, command[2]); result = 'OK'; }
    if (operation === 'INCR') {
      result = Number(values.get(key) || 0) + 1;
      values.set(key, String(result));
    }
    return new Response(JSON.stringify({ result }));
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('generation based cache', () => {
  it('reads current data after invalidation without scanning keys', async () => {
    const key = CacheService.buildKey('categorias', '7:/api/v1/categorias');
    const loader = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    expect(await CacheService.getOrSet(key, loader)).toBe('old');
    expect(await CacheService.getOrSet(key, loader)).toBe('old');
    await CacheService.invalidateNamespace('categorias');
    expect(calls.some(([operation, key]) => operation === 'INCR' && key === 'site-pep:v2:generation:tipos-produtos')).toBe(true);
    expect(await CacheService.getOrSet(key, loader)).toBe('new');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(calls.some(([operation]) => operation === 'SCAN' || operation === 'DEL')).toBe(false);
    expect(calls.some(([operation, , , expiry, ttl]) => operation === 'SET' && expiry === 'EX' && ttl === '30')).toBe(true);
  });

  it('does not repopulate the current generation from an older read', async () => {
    const key = CacheService.buildKey('produtos', '7:/api/v1/produtos');
    let resolveOld!: (value: string) => void;
    const old = CacheService.getOrSet(key, () => new Promise<string>((resolve) => { resolveOld = resolve; }));
    await vi.waitFor(() => expect(typeof resolveOld).toBe('function'));
    await CacheService.invalidateNamespace('produtos');
    resolveOld('old');
    expect(await old).toBe('old');
    expect(await CacheService.getOrSet(key, async () => 'new')).toBe('new');
    expect(calls.filter(([operation]) => operation === 'SET')).toHaveLength(1);
  });

  it('reports invalidation failure after a write', async () => {
    failIncr = true;
    await expect(CacheService.invalidateNamespace('banners')).rejects.toMatchObject({
      code: 'CACHE_INVALIDATION_FAILED', statusCode: 503,
    });
  });
});
