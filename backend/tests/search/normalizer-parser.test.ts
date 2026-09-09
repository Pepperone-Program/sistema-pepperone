import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery } from '../../src/search/QueryNormalizer';
import { buildSafeBooleanQuery } from '../../src/search/QueryTokenizer';
import { QueryParser } from '../../src/search/QueryParser';
import { buildCandidateBooleanQueries } from '../../src/search/CandidateRetriever';

describe('public product query interpretation', () => {
  it('normalizes unicode, accents, controls and whitespace', () => {
    expect(normalizeSearchQuery('  GARRAFA\u0000  TÉRMICA   500 ML ').normalized).toBe('garrafa termica 500 ml');
  });

  it.each([
    ['bloco com pauta', 'lined', true],
    ['bloco sem pauta', 'lined', false],
    ['garrafa parede dupla', 'double_wall', true],
    ['garrafa parede simples', 'double_wall', false],
  ])('parses phrase %s before stopwords', (query, key, value) => {
    const parsed = QueryParser.parse(query);
    expect(parsed.constraints).toContainEqual(expect.objectContaining({ key, value }));
  });

  it('does not reinterpret a token already consumed by an opposite phrase', () => {
    const withLines = QueryParser.parse('bloco com pauta').constraints.filter((item) => item.key === 'lined');
    const withoutLines = QueryParser.parse('bloco sem pauta').constraints.filter((item) => item.key === 'lined');
    expect(withLines).toHaveLength(1);
    expect(withLines[0].value).toBe(true);
    expect(withoutLines).toHaveLength(1);
    expect(withoutLines[0].value).toBe(false);
  });

  it('normalizes capacities and product intent', () => {
    const parsed = QueryParser.parse('garrafa térmica inox 0,5 l');
    expect(parsed.productType?.value).toBe('garrafa');
    expect(parsed.measurements.capacityMl).toBe(500);
    expect(parsed.materials).toContain('stainless_steel');
    expect(parsed.constraints).toContainEqual(expect.objectContaining({ key: 'thermal', value: true }));
  });

  it('does not confuse metalized finish with metal material', () => {
    expect(QueryParser.parse('caneta plastica metalizada').materials).toEqual(['plastic']);
  });

  it('interprets pauta aliases and kit composition quantities', () => {
    expect(QueryParser.parse('bloco pauta').constraints).toContainEqual(expect.objectContaining({ key: 'lined', value: true }));
    expect(QueryParser.parse('kit vinho duas taças').constraints).toContainEqual(expect.objectContaining({ key: 'contains:taca', value: 2 }));
  });

  it('uses an approved synonym as canonical product intent', () => {
    const parsed = QueryParser.parse('caderneta', [{ id: 1, term: 'Caderneta', normalizedTerm: 'caderneta', type: 'SYNONYM',
      canonicalValue: 'caderno', priority: 1, relationType: 'EXACT_SYNONYM', strength: 'STRONG' }]);
    expect(parsed.productType?.value).toBe('caderno');
    expect(parsed.positiveTerms).not.toContain('caderneta');
  });

  it('queries original and approved synonym independently', () => {
    const parsed = QueryParser.parse('garrafinha inox', [{ id: 1, term: 'Garrafinha', normalizedTerm: 'garrafinha', type: 'SYNONYM',
      canonicalValue: 'garrafa', priority: 1, relationType: 'EXACT_SYNONYM', strength: 'STRONG' }]);
    expect(buildCandidateBooleanQueries(parsed)).toEqual({ booleanQuery: '+garrafinha* +inox*', canonicalQuery: '+garrafa*' });
  });

  it('removes Portuguese connectors only from free terms', () => {
    expect(QueryParser.parse('kit para café com pauta').positiveTerms).toEqual(['cafe']);
    expect(QueryParser.parse('kit para café com pauta').constraints).toContainEqual(expect.objectContaining({ key: 'lined', value: true }));
  });

  it.each(["' OR 1=1 --", '++garrafa*', '"garrafa"', 'garrafa) (@@'])('builds safe boolean tokens for %s', (query) => {
    const normalized = normalizeSearchQuery(query);
    const booleanQuery = buildSafeBooleanQuery(normalized.tokens);
    expect(booleanQuery).not.toMatch(/[()"@~]/);
    expect(booleanQuery).not.toContain('--');
  });

  it('enforces input and token limits', () => {
    const normalized = normalizeSearchQuery('á '.repeat(1000));
    expect(normalized.original.length).toBeLessThanOrEqual(200);
    expect(normalized.tokens.length).toBeLessThanOrEqual(20);
  });
});
