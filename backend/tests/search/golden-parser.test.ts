import { describe, expect, it } from 'vitest';
import { QueryParser } from '../../src/search/QueryParser';
import { parserGoldenQueries } from '../fixtures/golden-search';

describe('150-query deterministic parser corpus', () => {
  it('parses every query deterministically without exceeding safety limits', () => {
    expect(parserGoldenQueries).toHaveLength(150);
    for (const item of parserGoldenQueries) {
      const first = QueryParser.parse(item.query);
      const second = QueryParser.parse(item.query);
      expect(first).toEqual(second);
      expect(first.constraints.length).toBeLessThanOrEqual(12);
      expect(first.tokens.length).toBeLessThanOrEqual(20);
    }
  });
});
