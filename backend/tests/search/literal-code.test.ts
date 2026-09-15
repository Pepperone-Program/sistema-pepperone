import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ProdutoService', () => ({ ProdutoService: { findExactProductCodeForSite: vi.fn(), listProdutosSite: vi.fn() } }));
vi.mock('../../src/models/Produto', () => ({ ProdutoModel: {
  searchByCodigoLikeForSite: vi.fn(), searchForSite: vi.fn(), findImagesByProductIds: vi.fn(),
} }));
vi.mock('../../src/search/ProductSearchService', () => ({ ProductSearchService: { search: vi.fn() } }));
vi.mock('../../src/search/DictionaryService', () => ({ DictionaryService: { version: vi.fn().mockResolvedValue(1) } }));
vi.mock('../../src/services/CacheService', () => ({ CacheService: {
  buildKey: (_namespace: string, key: string) => key,
  getOrSet: vi.fn((_key: string, fn: () => unknown) => fn()),
} }));

import { PublicSiteSearchService } from '../../src/search/PublicSiteSearchService';
import { ProdutoService } from '../../src/services/ProdutoService';
import { ProdutoModel } from '../../src/models/Produto';
import { ProductSearchService } from '../../src/search/ProductSearchService';
import { CacheService } from '../../src/services/CacheService';
import type { PublicSearchOptions } from '../../src/types/search';

const options = (query: string): PublicSearchOptions => ({ empresaId: 1, query, page: 1, limit: 10, sort: 'relevance', filters: {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(null);
  vi.mocked(ProdutoModel.searchByCodigoLikeForSite).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(ProdutoModel.searchForSite).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(ProdutoModel.findImagesByProductIds).mockResolvedValue(new Map());
  vi.mocked(ProductSearchService.search).mockResolvedValue({
    searchId: 'search-1', results: [], total: 0, limit: 10,
    rankingVersion: 'v4', nextCursor: null, fallback: false,
  });
});

describe('literal code search precedence', () => {
  it.each(['pep', 'PEP', ' PeP '])('lists the entire public catalog when %s is not an exact code', async (query) => {
    const items = [{ id_produto: 99, codigo: 'CM001' }] as any;
    vi.mocked(ProdutoService.listProdutosSite).mockResolvedValue({ items, total: 3500, page: 102, limit: 10 });
    const result = await PublicSiteSearchService.search({ ...options(query), empresaId: 7, page: 102 });
    expect(ProdutoService.listProdutosSite).toHaveBeenCalledWith(7, 102, 10);
    expect(result).toMatchObject({ items, total: 3500, page: 102, limit: 10, nextCursor: null });
    expect(result.exactProduct).toBeUndefined();
    expect(ProdutoService.findExactProductCodeForSite).toHaveBeenCalledWith(7, query.trim());
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
    expect(ProductSearchService.search).not.toHaveBeenCalled();
  });

  it('prioritizes an exact PEP code over the full catalog', async () => {
    const exact = { id_produto: 1, codigo: 'PEP', match_exato_codigo: true } as any;
    vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(exact);

    const result = await PublicSiteSearchService.search(options('pep'));

    expect(result).toMatchObject({ items: [exact], total: 1, page: 1, exactProduct: exact });
    expect(ProdutoService.listProdutosSite).not.toHaveBeenCalled();
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
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
    expect(ProductSearchService.search).toHaveBeenCalledWith({ ...options(query), page: 2 });
    expect(ProdutoModel.searchByCodigoLikeForSite).toHaveBeenCalledWith(1, query, 2, 10);
    expect(ProdutoModel.searchForSite).not.toHaveBeenCalled();
  });

  it('does not approximate pepket1001 when it has no literal match', async () => {
    const result = await PublicSiteSearchService.search(options('pepket1001'));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(ProductSearchService.search).toHaveBeenCalledWith(options('pepket1001'));
    expect(ProdutoModel.searchForSite).toHaveBeenCalledWith(1, 'pepket1001', 1, 10);
  });

  it('returns PEPKB1033 individually through a trimmed, case-insensitive exact lookup', async () => {
    const exact = { id_produto: 1, codigo: 'PEPKB1033', match_exato_codigo: true } as any;
    vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(exact);
    const result = await PublicSiteSearchService.search(options(' pepkb1033 '));
    expect(result.exactProduct).toEqual(exact);
    expect(result.items).toMatchObject([exact]);
    expect(ProdutoService.findExactProductCodeForSite).toHaveBeenCalledWith(1, 'pepkb1033');
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
  });

  it('shares the exact-product cache between case variants of the same code', async () => {
    const exact = { id_produto: 1, codigo: 'PEPKB1033', match_exato_codigo: true } as any;
    vi.mocked(ProdutoService.findExactProductCodeForSite).mockResolvedValue(exact);

    await PublicSiteSearchService.search(options('PEPKB1033'));

    expect(CacheService.getOrSet).toHaveBeenCalledWith(
      'exact-code:1:pepkb1033',
      expect.any(Function),
    );
  });

  it('rejects cursors for literal code searches', async () => {
    await expect(PublicSiteSearchService.search({ ...options('pepket1001'), cursor: 'old' }))
      .rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it.each(['bloco sem pauta', 'garrafa inox', 'garrafa 500 ml'])('preserves intelligent search for %s', async (query) => {
    await PublicSiteSearchService.search(options(query));
    expect(ProductSearchService.search).toHaveBeenCalledWith(options(query));
  });

  it('returns intelligent results before consulting code or product name', async () => {
    const item = { id_produto: 10, produto: 'Resultado inteligente' } as any;
    vi.mocked(ProductSearchService.search).mockResolvedValue({
      searchId: 'search-2', results: [item], total: 1, limit: 10,
      rankingVersion: 'v4', nextCursor: null, fallback: false,
    });

    const result = await PublicSiteSearchService.search(options('garrafa metal'));

    expect(result.items).toEqual([item]);
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
    expect(ProdutoModel.searchForSite).not.toHaveBeenCalled();
  });

  it('falls back to the complete product-name phrase after intelligent and code searches are empty', async () => {
    const item = { id_produto: 20, produto: 'Garrafa de Metal 750ml Personalizada' } as any;
    vi.mocked(ProdutoModel.searchForSite).mockResolvedValue({ items: [item], total: 1 });
    vi.mocked(ProdutoModel.findImagesByProductIds).mockResolvedValue(new Map([[20, [{ id_imagem: 1 } as any]]]));

    const result = await PublicSiteSearchService.search(options('garrafa de metal'));

    expect(ProdutoModel.searchByCodigoLikeForSite).toHaveBeenCalledWith(1, 'garrafa de metal', 1, 10);
    expect(ProdutoModel.searchForSite).toHaveBeenCalledWith(1, 'garrafa de metal', 1, 10);
    expect(result).toMatchObject({
      items: [{ ...item, imagens: [{ id_imagem: 1 }] }], total: 1, page: 1, limit: 10,
      rankingVersion: expect.stringContaining('name-like-fallback-v1'), nextCursor: null,
    });
  });

  it('rejects cursor pagination before switching from intelligent search to SQL fallbacks', async () => {
    await expect(PublicSiteSearchService.search({ ...options('CPO'), cursor: 'cursor-v4' }))
      .rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    expect(ProdutoModel.searchByCodigoLikeForSite).not.toHaveBeenCalled();
    expect(ProdutoModel.searchForSite).not.toHaveBeenCalled();
  });
});
