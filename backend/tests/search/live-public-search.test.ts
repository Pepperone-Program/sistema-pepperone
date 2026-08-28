import { afterAll, describe, expect, it } from 'vitest';
import { closeDatabasePool } from '../../src/database/connection';
import { PublicSiteSearchService } from '../../src/search/PublicSiteSearchService';

describe.skipIf(process.env.SEARCH_LIVE_INTEGRATION !== 'true')('live public search relevance', () => {
  afterAll(closeDatabasePool);

  it.each(['bloco', 'garrafa', 'caneta metalica'])('returns relevant primary products first for %s', async (query) => {
    const result = await PublicSiteSearchService.search({ empresaId: 1, query, page: 1, limit: 10, sort: 'relevance', filters: {} });
    expect(result.items).toHaveLength(10);
    const primaryTerm = query.split(' ')[0];
    expect(result.items.slice(0, 5).every((product) => product.produto.toLocaleLowerCase('pt-BR').includes(primaryTerm))).toBe(true);
    expect(result.rankingVersion).toContain('v1');
  });

  it('ranks the requested phrase before contradictory products', async () => {
    const result = await PublicSiteSearchService.search({ empresaId: 1, query: 'bloco sem pauta', page: 1, limit: 10, sort: 'relevance', filters: {} });
    expect(result.items[0].produto.toLocaleLowerCase('pt-BR')).toContain('sem pauta');
    expect(result.items.slice(0, 5).some((product) => /com pauta/i.test(product.produto))).toBe(false);
  });

  it('does not return the explicit opposite for either lined-paper intent', async () => {
    const withLines = await PublicSiteSearchService.search({ empresaId: 1, query: 'bloco com pauta', page: 1, limit: 100, sort: 'relevance', filters: {} });
    const withoutLines = await PublicSiteSearchService.search({ empresaId: 1, query: 'bloco sem pauta', page: 1, limit: 100, sort: 'relevance', filters: {} });
    expect(withLines.items.some((product) => /sem pauta/i.test(product.produto))).toBe(false);
    expect(withoutLines.items.some((product) => /com pauta/i.test(product.produto))).toBe(false);
  });
});
