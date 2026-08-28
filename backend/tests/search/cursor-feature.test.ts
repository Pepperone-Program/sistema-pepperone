import { describe, expect, it } from 'vitest';
import { decodeSearchCursor, encodeSearchCursor } from '../../src/search/SearchCursorCodec';
import { isAdvancedSearchEnabled } from '../../src/search/SearchFeatureFlag';

describe('search rollout and cursor', () => {
  it('signs and verifies stable cursors', () => {
    const value = { version: 'v1', group: 0, matchedConstraints: 2, contradictions: 0, score: 123, productId: 10 };
    expect(decodeSearchCursor(encodeSearchCursor(value))).toEqual(value);
    expect(decodeSearchCursor(`${encodeSearchCursor(value)}x`)).toBeNull();
  });

  it('keeps percentage allocation deterministic', () => {
    process.env.SEARCH_RANKING_PERCENTAGE = '25';
    expect(isAdvancedSearchEnabled(1, 'session-a')).toBe(isAdvancedSearchEnabled(1, 'session-a'));
    process.env.SEARCH_RANKING_PERCENTAGE = '0';
    expect(isAdvancedSearchEnabled(1, 'session-a')).toBe(false);
  });
});
