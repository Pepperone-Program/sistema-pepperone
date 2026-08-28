import { describe, expect, it } from 'vitest';
import { aggregateQuality, ndcgAt, precisionAt, reciprocalRank } from '../../src/search/SearchQualityMetrics';

describe('ranking quality metrics', () => {
  const item = { relevantIds: [10, 20], rankedIds: [99, 10, 20, 30, 40] };
  it('calculates precision, reciprocal rank and NDCG', () => {
    expect(precisionAt(item, 5)).toBe(0.4);
    expect(reciprocalRank(item)).toBe(0.5);
    expect(ndcgAt(item, 10)).toBeGreaterThan(0);
    expect(aggregateQuality([item])).toEqual(expect.objectContaining({ precision5: 0.4, mrr: 0.5 }));
  });
});
