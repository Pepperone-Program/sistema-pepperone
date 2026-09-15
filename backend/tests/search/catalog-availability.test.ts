import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/database/connection', () => ({ query: vi.fn() }));
vi.mock('../../src/models/Produto', () => ({ ProdutoModel: {
  findByIdsForSite: vi.fn(), findImagesByProductIds: vi.fn(),
} }));
vi.mock('../../src/search/SearchAnalyticsService', () => ({ SearchAnalyticsService: { record: vi.fn() } }));
vi.mock('../../src/search/SearchObservability', () => ({ SearchObservability: { log: vi.fn() } }));
import { query } from '../../src/database/connection';
import { ProdutoModel } from '../../src/models/Produto';
import { ProductSearchService } from '../../src/search/ProductSearchService';
import { CandidateRetriever } from '../../src/search/CandidateRetriever';
import { QueryParser } from '../../src/search/QueryParser';
import { SearchAnalyticsService } from '../../src/search/SearchAnalyticsService';
import { SEARCH_RANKING_VERSION } from '../../src/config/search';

let empresaId = 100;
const product = (id: number, name: string, type = 'Caderno') => ({
  id_produto: id, produto: name, descricao: name, codigo: `P${id}`, data_inclusao: '2026-09-11', tipo_produto: type,
});
let products: ReturnType<typeof product>[];
let indexFailure: boolean;
let dictionaryFailure: boolean;
let dictionaryEntries: any[];

beforeEach(() => {
  vi.clearAllMocks();
  empresaId++;
  products = [product(1, 'Caderno com pauta'), product(2, 'Caderno sem pauta'), product(3, 'Caderno A5')];
  indexFailure = false; dictionaryFailure = false; dictionaryEntries = [];
  vi.mocked(query).mockImplementation(async (sql: string, values?: any[]) => {
    if (sql.includes('FROM search_dictionary')) {
      if (dictionaryFailure) throw new Error('dictionary offline');
      return dictionaryEntries;
    }
    if (sql.includes('WITH candidate_ids')) {
      if (indexFailure) throw new Error('index offline');
      return []; // Empty index must not hide the catalog.
    }
    if (sql.includes('FROM product_search_attributes') || sql.includes('FROM product_contains_types')) return [];
    if (sql.includes('FROM produtos p LEFT JOIN tipos_produtos')) {
      expect(values?.[0]).toBe(empresaId);
      expect(sql).toContain("p.site = 'S'");
      expect(sql).toContain("p.habilitado = 'S'");
      const afterId = Number(values?.at(-1));
      return products.filter((item) => item.id_produto > afterId).slice(0, 500);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  vi.mocked(ProdutoModel.findByIdsForSite).mockImplementation(async (company, ids) => {
    expect(company).toBe(empresaId);
    return products.filter((item) => ids.includes(item.id_produto)) as any;
  });
  vi.mocked(ProdutoModel.findImagesByProductIds).mockResolvedValue(new Map());
  vi.mocked(SearchAnalyticsService.record).mockResolvedValue(undefined);
});

const search = (term: string, page = 1, limit = 10, cursor?: string) => ProductSearchService.search({
  empresaId, query: term, page, limit, cursor, sort: 'relevance', filters: {},
});

describe('catalog search availability', () => {
  it.each([false, true])('returns cadernos with empty/offline index (offline=%s)', async (offline) => {
    indexFailure = offline;
    const result = await search('caderno');
    expect(result.total).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/^(INSERT|UPDATE|DELETE)/), expect.anything());
  });

  it('one product missing its document does not block or disappear from the other results', async () => {
    products = Array.from({ length: 100 }, (_, i) => product(i + 1, 'Caderno'));
    const original = vi.mocked(query).getMockImplementation()!;
    vi.mocked(query).mockImplementation((sql, values) => sql.includes('WITH candidate_ids')
      ? Promise.resolve(products.slice(0, 99)) : original(sql, values));
    const result = await search('caderno', 1, 100);
    expect(result.total).toBe(100);
    expect(result.results).toHaveLength(100);
    expect(result.results.some((item) => item.id_produto === 100)).toBe(true);
  });

  it('uses current text even when the index contains stale derived data', async () => {
    const original = vi.mocked(query).getMockImplementation()!;
    vi.mocked(query).mockImplementation(async (sql, values) => {
      if (sql.includes('WITH candidate_ids')) return [{ ...products[0], name_search: 'Caderno com pauta', attributes: {} }];
      if (sql.includes('FROM product_search_attributes')) { expect(sql).toContain("psa.source = 'MANUAL'"); return []; }
      if (sql.includes('FROM product_contains_types')) return [];
      return original(sql, values);
    });
    products = [product(1, 'Caderno sem pauta')];
    expect((await search('caderno sem pauta')).results.map((p) => p.id_produto)).toEqual([1]);
    expect((await search('caderno com pauta')).results).toEqual([]);
  });

  it('works with dictionary unavailable and analytics never resolving', async () => {
    indexFailure = dictionaryFailure = true;
    vi.mocked(SearchAnalyticsService.record).mockReturnValue(new Promise(() => {}));
    expect((await search('caderno sem pauta')).results.map((p) => p.id_produto)).toEqual([2]);
  });

  it('preserves manual attributes when the search document is missing or unavailable', async () => {
    indexFailure = true;
    products = [product(1, 'Caderno A5')];
    const original = vi.mocked(query).getMockImplementation()!;
    vi.mocked(query).mockImplementation((sql, values) => sql.includes('FROM product_search_attributes')
      ? Promise.resolve([{ id_produto: 1, attribute_key: 'lined', value_boolean: 0, value_text: null, value_number: null }])
      : original(sql, values));
    expect((await search('caderno sem pauta')).results.map((p) => p.id_produto)).toEqual([1]);
  });

  it('includes new products and removes unpublished products on the next read', async () => {
    expect((await search('caderno')).total).toBe(3);
    products = [product(4, 'Caderno novo')];
    expect((await search('caderno')).results.map((p) => p.id_produto)).toEqual([4]);
  });

  it('returns empty only for genuinely unmatched terms or constraints', async () => {
    expect((await search('caderno inexistente')).total).toBe(0);
    expect((await search('caderno A4')).total).toBe(0);
    expect((await search('caderno A5')).results.map((p) => p.id_produto)).toEqual([3]);
  });

  it('keeps page and cursor order consistent beyond one SQL batch', async () => {
    products = Array.from({ length: 1001 }, (_, index) => product(index + 1, 'Caderno'));
    const first = await search('caderno', 1, 10);
    expect(first.total).toBe(1001);
    expect(first.rankingVersion).toBe(SEARCH_RANKING_VERSION);
    const next = await search('caderno', 1, 10, first.nextCursor!);
    const page = await search('caderno', 2, 10);
    expect(next.results).toEqual(page.results);
    expect(next.results.some((p) => first.results.some((a) => a.id_produto === p.id_produto))).toBe(false);
  });

  it('scopes category queries and escapes wildcard input', async () => {
    await CandidateRetriever.retrieveCatalog(empresaId, QueryParser.parse('100%_'), { categoryId: 9 });
    const call = vi.mocked(query).mock.calls[0];
    expect(call[0]).toContain('acp.id_empresa = p.id_empresa');
    expect(call[1]).toContain(9);
  });

  it('also retrieves the original accented phrase for product-name supplementation', async () => {
    await CandidateRetriever.retrieveCatalog(empresaId, QueryParser.parse('taça'), {});
    const call = vi.mocked(query).mock.calls[0];
    expect(call[0]).toContain("p.produto LIKE ? ESCAPE '!'");
    expect(call[1]).toContain('%taca%');
    expect(call[1]).toContain('%taça%');
  });

  it('returns ranked taça products first and then other product names containing taça', async () => {
    dictionaryEntries = [{
      id: 1, term: 'taça', normalized_term: 'taca', type: 'PRODUCT_TYPE', canonical_value: 'taca',
      priority: 1, relation_type: null, strength: 'STRONG',
    }];
    products = [
      product(1, 'Taça de Vidro Personalizada', 'Taça'),
      product(2, 'Kit com Taça e Abridor Personalizado', 'Kit'),
      product(3, 'Kit para Vinho Personalizado', 'Kit'),
    ];

    const result = await search('taça');

    expect(result.total).toBe(2);
    expect(result.results.map((item) => item.id_produto)).toEqual([1, 2]);
  });

  it('serves concurrent searches while a stalled index has only one in-flight request', async () => {
    const original = vi.mocked(query).getMockImplementation()!;
    vi.mocked(query).mockImplementation((sql, values) => sql.includes('WITH candidate_ids')
      ? new Promise(() => {}) : original(sql, values));
    const results = await Promise.all(Array.from({ length: 20 }, () => search('caderno')));
    expect(results.every((result) => result.total === 3 && result.results.length === 3)).toBe(true);
    expect(vi.mocked(query).mock.calls.filter(([sql]) => sql.includes('WITH candidate_ids'))).toHaveLength(1);
  });
});
