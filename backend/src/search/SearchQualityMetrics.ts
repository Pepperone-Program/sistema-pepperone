export interface QualityCase { relevantIds: number[]; rankedIds: number[] }

export const precisionAt = (item: QualityCase, k: number): number => {
  if (k <= 0) return 0;
  const relevant = new Set(item.relevantIds);
  return item.rankedIds.slice(0, k).filter((id) => relevant.has(id)).length / k;
};

export const reciprocalRank = (item: QualityCase): number => {
  const relevant = new Set(item.relevantIds);
  const index = item.rankedIds.findIndex((id) => relevant.has(id));
  return index < 0 ? 0 : 1 / (index + 1);
};

export const ndcgAt = (item: QualityCase, k: number): number => {
  const relevant = new Set(item.relevantIds);
  const dcg = item.rankedIds.slice(0, k).reduce((sum, id, index) => sum + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0), 0);
  const idealCount = Math.min(k, item.relevantIds.length);
  const ideal = Array.from({ length: idealCount }, (_, index) => 1 / Math.log2(index + 2)).reduce((sum, value) => sum + value, 0);
  return ideal === 0 ? 0 : dcg / ideal;
};

export const aggregateQuality = (cases: QualityCase[]): object => {
  if (!cases.length) return { precision5: 0, precision10: 0, mrr: 0, ndcg10: 0 };
  const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
  return { precision5: average(cases.map((item) => precisionAt(item, 5))), precision10: average(cases.map((item) => precisionAt(item, 10))),
    mrr: average(cases.map(reciprocalRank)), ndcg10: average(cases.map((item) => ndcgAt(item, 10))) };
};
