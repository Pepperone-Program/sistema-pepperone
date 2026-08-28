interface TimingData { databaseMs?: number; parserMs?: number; rankingMs?: number; totalMs?: number; candidateCount?: number; resultCount?: number; fallback?: boolean }

export class SearchObservability {
  private static durations: number[] = [];
  private static errors = 0;
  private static zeroResults = 0;

  static log(searchId: string, empresaId: number, rankingVersion: string, data: TimingData): void {
    if (data.totalMs !== undefined) {
      this.durations.push(data.totalMs);
      if (this.durations.length > 1000) this.durations.shift();
    }
    if (data.resultCount === 0) this.zeroResults += 1;
    console.info('[ProductSearch]', { searchId, empresaId, rankingVersion, ...data });
  }

  static error(): void { this.errors += 1; }

  static snapshot(): object {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const percentile = (value: number): number => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] : 0;
    return { sampleSize: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99), errors: this.errors, zeroResults: this.zeroResults };
  }
}
