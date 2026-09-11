import { afterAll, describe, expect, it, vi } from 'vitest';
import { closeDatabasePool, query } from '../../src/database/connection';
import { PublicSiteSearchService } from '../../src/search/PublicSiteSearchService';
import { SearchAnalyticsService } from '../../src/search/SearchAnalyticsService';
import { CandidateRetriever } from '../../src/search/CandidateRetriever';
import { QueryParser } from '../../src/search/QueryParser';
import { ProductRankingEngine } from '../../src/search/ProductRankingEngine';
import { filterRelevantCandidates } from '../../src/search/SearchRelevanceFilter';

// This suite is strictly read-only against the configured database.
vi.spyOn(SearchAnalyticsService, 'record').mockResolvedValue(undefined);

describe.skipIf(process.env.SEARCH_LIVE_INTEGRATION !== 'true')('live public search relevance', () => {
  afterAll(closeDatabasePool);

  it.each(['caderno', 'bloco', 'garrafa', 'caneta metalica'])('returns relevant primary products first for %s', async (query) => {
    const result = await PublicSiteSearchService.search({ empresaId: 1, query, page: 1, limit: 10, sort: 'relevance', filters: {} });
    expect(result.items.length).toBeGreaterThan(0);
    const primaryTerm = query.split(' ')[0];
    expect(result.items.every((product) => product.produto.toLocaleLowerCase('pt-BR').includes(primaryTerm))).toBe(true);
    expect(result.rankingVersion).toContain('v4');
  });

  it('returns cadernos directly from the catalog without any index', async () => {
    const parsed = QueryParser.parse('caderno');
    const candidates = await CandidateRetriever.retrieveCatalog(1, parsed, {});
    const results = filterRelevantCandidates(parsed, ProductRankingEngine.rank(parsed, candidates));
    expect(results.length).toBeGreaterThan(0);
    console.info('[Catalog-only search]', { candidates: candidates.length, results: results.length });
  });

  it('inspects the catalog query plan without changing schema or data', async () => {
    const plan = await query(`EXPLAIN SELECT p.id_produto, p.produto, p.descricao, p.codigo, p.data_inclusao, tp.tipo_produto
      FROM produtos p LEFT JOIN tipos_produtos tp ON tp.id_empresa = p.id_empresa AND tp.id_tipo_produto = p.id_tipo_produto
      WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S'
      AND (p.produto LIKE ? ESCAPE '!' OR tp.tipo_produto LIKE ? ESCAPE '!')
      AND p.id_produto > ? ORDER BY p.id_produto LIMIT 500`, [1, '%caderno%', '%caderno%', 0]);
    expect(plan.length).toBeGreaterThan(0);
    console.info('[Catalog query plan]', plan);
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

  it('returns cafe only when cafe starts a word in the product title', async () => {
    const result = await PublicSiteSearchService.search({ empresaId: 1, query: 'café', page: 1, limit: 100, sort: 'relevance', filters: {} });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((product) => /(^|\s)cafe/i.test(product.produto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))).toBe(true);
    expect(result.items.some((product) => /^(bloco|kit home office|kit escritorio)\b/i.test(product.produto))).toBe(false);
  });
});
