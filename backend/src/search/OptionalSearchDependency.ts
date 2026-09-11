/** Bound optional work and coalesce it while pending, including after a timeout. */
export class OptionalSearchDependency {
  private static pending = new Map<string, Promise<unknown>>();
  private static retryAt = new Map<string, number>();
  private static activeGroups = new Map<string, string>();

  static async run<T>(key: string, work: () => Promise<T>, fallback: T, timeoutMs = 400, group = key): Promise<T> {
    if ((this.retryAt.get(group) || 0) > Date.now()) return fallback;
    if (this.activeGroups.has(group) && this.activeGroups.get(group) !== key) return fallback;
    this.retryAt.delete(group);
    let pending = this.pending.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = Promise.resolve().then(work).catch((error) => {
        this.retryAt.set(group, Date.now() + 30_000);
        console.warn('[Search] optional dependency unavailable', { group, message: String(error) });
        return fallback;
      }).finally(() => { this.pending.delete(key); this.activeGroups.delete(group); });
      this.pending.set(key, pending);
      this.activeGroups.set(group, key);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([pending, new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          this.retryAt.set(group, Date.now() + 30_000);
          resolve(fallback);
        }, timeoutMs);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
