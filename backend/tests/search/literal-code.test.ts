import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ProdutoService', () => ({ ProdutoService: { findExactProductCodeForSite: vi.fn(), listProdutosSite: vi.fn() } }));
vi.mock('../../src/models/Produto', () => ({ ProdutoModel: {
  searchByCodigoLikeForSite: vi.fn(), findImagesByProductIds: vi.fn(),
} }));
vi.mock('../../src/search/ProductSearchService', () => ({ ProductSearchService: { search: vi.fn() } }));
vi.mock('../../src/search/DictionaryService', () => ({ DictionaryService: { version: vi.fn().mockResolvedValue(1) } }));
vi.mock('../../src/services/CacheService', () => ({ CacheService: {
  buildKey: (_namespace: string, key: string) => key,
  getOrSet: (_key: string, fn: () => unknown) => fn(),
} }));

import { PublicSiteSearchService } from '../../src/search/PublicSiteSearchService';
import { ProdutoService } from '../../src/services/ProdutoService';
import { ProdutoModel } from '../../src/models/Produto';
import { ProductSearchService } from '../../src/search/ProductSearchService';
import type { PublicSearchOptions } from '../../src/types/search';

const options = (query: string): PublicSearchOptions => ({ empresaId: 1, query, page: 1, limit: 10, sort: 'relevance', filters: {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(null);
  vi.mocked(ProdutoModel.searchByCodigoLikeForSite).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(ProdutoModel.findImagesByProductIds).mockResolvedValue(new Map());
});

describe('literal code search precedence', () => {
  it.each(['pep', 'PEP', ' PeP '])('lists the entire public catalog first for %s', async (query) => {
    const items = [{ id_produto: 99, codigo: 'CM001' }] as any;
    vi.mocked(ProdutoService.listProdutosSite).mockResolvedValue({ items, total: 3500, page: 102, limit: 10 });
    const result = await PublicSiteSearchService.search({ ...options(query), empresaId: 7, page: 102 });
    expect(ProdutoService.listProdutosSite).toHaveBeenCalledWith(7, 102, 10);
    expect(result).toMatchObject({ items, total: 3500, page: 102, limit: 10, nextCursor: null });
    expect(result.exactProduct).toBeUndefined();
    expect(ProdutoService.findExactProductCodeForSite).not.toHaveBeenCalled();
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
    expect(ProductSearchService.search).not.toHaveBeenCalled();
  });

  it('rejects cursors for the full catalog', async () => {
    await expect(PublicSiteSearchService.search({ ...options('pep'), cursor: 'old' }))
      .rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it.each(['CM', 'ket1001'])('returns code matches for %s without requiring the index', async (query) => {
    const item = { id_produto: 1, codigo: 'PEPKET1001' } as any;
    vi.mocked(ProdutoModel.searchByCodigoLikeForSite).mockResolvedValue({ items: [item], total: 3510 });
    const result = await PublicSiteSearchService.search({ ...options(query), page: 2 });
    expect(result.total).toBe(3510);
    expect(result.page).toBe(2);
    expect(result.exactProduct).toBeUndefined();
    expect(result.nextCursor).toBeNull();
    expect(ProductSearchService.search).not.toHaveBeenCalled();
    expect(ProdutoModel.searchByCodigoLikeForSite).toHaveBeenCalledWith(1, query, 2, 10);
  });

  it('does not approximate pepket1001 when it has no literal match', async () => {
    const result = await PublicSiteSearchService.search(options('pepket1001'));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(ProductSearchService.search).not.toHaveBeenCalled();
  });

  it('preserves exact-code response only from exact lookup', async () => {
    const exact = { id_produto: 1, codigo: 'PEPKET1001', match_exato_codigo: true } as any;
    vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(exact);
    const result = await PublicSiteSearchService.search(options(' PEPKET1001 '));
    expect(result.exactProduct).toEqual(exact);
    expect(ProdutoService.findExactProductCodeForSite).toHaveBeenCalledWith(1, 'PEPKET1001');
  });

  it('rejects cursors for literal code searches', async () => {
    await expect(PublicSiteSearchService.search({ ...options('pepket1001'), cursor: 'old' }))
      .rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it.each(['bloco sem pauta', 'garrafa inox', 'garrafa 500 ml'])('preserves intelligent search for %s', async (query) => {
    vi.mocked(ProductSearchService.search).mockResolvedValue({ results: [], total: 0, limit: 10, rankingVersion: 'v4' } as any);
    await PublicSiteSearchService.search(options(query));
    expect(ProductSearchService.search).toHaveBeenCalledWith(options(query));
  });
});
