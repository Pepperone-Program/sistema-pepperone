type RedisCommandResponse<T = unknown> = {
  result?: T;
  error?: string;
};

const CACHE_PREFIX = 'site-pep:v2';
const CATALOG_TTL_SECONDS = 30;
const bypassUntil = new Map<string, number>();
const productRelatedNamespaces = new Set([
  'categorias',
  'tipos-produtos',
  'datas-promocionais',
  'publicos-alvos',
]);

const getRedisConfig = (): { url?: string; token?: string } => ({
  url: process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, ''),
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const isEnabled = (): boolean => {
  const { url, token } = getRedisConfig();
  return Boolean(url && token);
};

const normalizePart = (value: string): string =>
  value
    .trim()
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9:_?&=.,/-]/g, '_');

export class CacheService {
  static buildKey(namespace: string, rawKey: string): string {
    return `${CACHE_PREFIX}:${normalizePart(namespace)}:${normalizePart(rawKey)}`;
  }

  static async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    return (await this.getOrSetWithStatus(key, loader, ttlSeconds)).value;
  }

  static async getOrSetWithStatus<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<{ value: T; cacheStatus: 'hit' | 'miss' | 'disabled' }> {
    if (!isEnabled()) {
      return { value: await loader(), cacheStatus: 'disabled' };
    }

    const started = performance.now();
    let redisMs = 0;
    const namespace = key.startsWith(`${CACHE_PREFIX}:`) ? key.slice(CACHE_PREFIX.length + 1).split(':')[0] : null;
    if (!namespace) return { value: await loader(), cacheStatus: 'disabled' };
    if ((bypassUntil.get(namespace) || 0) > Date.now()) {
      return { value: await loader(), cacheStatus: 'disabled' };
    }
    let version: string;
    try {
      version = (await this.command<string | null>(['GET', `${CACHE_PREFIX}:generation:${namespace}`])).result || '0';
      const cached = await this.command<string | null>(['GET', `${key}:g${version}`]);
      if (cached.result !== null && cached.result !== undefined) {
        this.logTiming(namespace, 'hit', performance.now() - started, 0, performance.now() - started);
        return { value: JSON.parse(cached.result) as T, cacheStatus: 'hit' };
      }
      redisMs = performance.now() - started;
    } catch (error) {
      console.warn('[CacheService] read failed', { namespace, message: error instanceof Error ? error.message : String(error) });
      redisMs = performance.now() - started;
      const value = await loader();
      this.logTiming(namespace, 'bypass', redisMs, performance.now() - started - redisMs, performance.now() - started);
      return { value, cacheStatus: 'disabled' };
    }

    const value = await loader();
    const databaseMs = performance.now() - started - redisMs;
    try {
      const current = (await this.command<string | null>(['GET', `${CACHE_PREFIX}:generation:${namespace}`])).result || '0';
      if (current === version && (bypassUntil.get(namespace) || 0) <= Date.now()) {
        const ttl = namespace === 'orcamentos'
          ? Math.max(ttlSeconds || CATALOG_TTL_SECONDS, 1)
          : Math.min(Math.max(ttlSeconds || CATALOG_TTL_SECONDS, 1), CATALOG_TTL_SECONDS);
        await this.command<string>(['SET', `${key}:g${version}`, JSON.stringify(value), 'EX', String(ttl)]);
      }
    } catch (error) {
      console.warn('[CacheService] set failed', { namespace, message: error instanceof Error ? error.message : String(error) });
    }
    this.logTiming(namespace, 'miss', performance.now() - started - databaseMs, databaseMs, performance.now() - started);
    return { value, cacheStatus: 'miss' };
  }

  private static logTiming(namespace: string, status: string, redisMs: number, databaseMs: number, totalMs: number): void {
    if (process.env.CACHE_TIMING_LOGS === 'true') {
      console.info('[CacheService] timing', {
        namespace, status,
        redisMs: Math.round(redisMs), databaseMs: Math.round(databaseMs), totalMs: Math.round(totalMs),
      });
    }
  }

  static async invalidateNamespace(namespace: string): Promise<void> {
    await this.invalidateNamespaces([namespace]);
  }

  // A committed database write must not be reported as failed because Redis is unavailable.
  static async invalidateAfterWrite(namespaces: string | string[]): Promise<void> {
    try {
      await this.invalidateNamespaces(Array.isArray(namespaces) ? namespaces : [namespaces]);
    } catch (error) {
      if ((error as { code?: string }).code !== 'CACHE_INVALIDATION_FAILED') throw error;
      // The browser uses a new cache key after a successful write. This protects
      // other reads handled by this process until old Redis entries expire.
    }
  }

  static async invalidateNamespaces(namespaces: string[]): Promise<void> {
    if (!isEnabled()) return;

    const expandedNamespaces = new Set<string>();

    for (const namespace of namespaces) {
      expandedNamespaces.add(namespace);
      if (productRelatedNamespaces.has(namespace)) {
        expandedNamespaces.add('produtos');
      }
      if (namespace === 'categorias' || namespace === 'subcategorias') {
        expandedNamespaces.add('tipos-produtos');
      }
    }

    const outcomes = await Promise.allSettled(Array.from(expandedNamespaces).map((namespace) =>
      this.command<number>(['INCR', `${CACHE_PREFIX}:generation:${normalizePart(namespace)}`])));
    const failure = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failure?.status === 'rejected') {
      for (const namespace of expandedNamespaces) {
        bypassUntil.set(normalizePart(namespace), Date.now() + CATALOG_TTL_SECONDS * 1000);
      }
      console.warn('[CacheService] invalidate failed', { namespaces: [...expandedNamespaces], message: String(failure.reason) });
      throw Object.assign(new Error('Dados salvos, mas a atualizacao do cache falhou. Consulte antes de repetir a operacao.'), {
        code: 'CACHE_INVALIDATION_FAILED', statusCode: 503,
      });
    }
    for (const namespace of expandedNamespaces) bypassUntil.delete(normalizePart(namespace));
  }

  private static async command<T>(command: string[]): Promise<RedisCommandResponse<T>> {
    const { url, token } = getRedisConfig();
    if (!url || !token) {
      return {};
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(500),
    });

    if (!response.ok) {
      throw new Error(`Upstash responded with ${response.status}`);
    }

    const body = (await response.json()) as RedisCommandResponse<T>;
    if (body.error) {
      throw new Error(body.error);
    }

    return body;
  }
}
