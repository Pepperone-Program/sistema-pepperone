import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/search/PublicSiteSearchService', () => ({ PublicSiteSearchService: { search: vi.fn() } }));
vi.mock('../../src/services/CacheService', () => ({ CacheService: {} }));
import { PublicSiteSearchService } from '../../src/search/PublicSiteSearchService';
import { ProdutoController } from '../../src/controllers/ProdutoController';

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => vi.clearAllMocks());
describe('public /produtos/site?busca contract', () => {
  it('keeps the public envelope and pagination with catalog results', async () => {
    const items = [{ id_produto: 3, produto: 'Caderno' }];
    vi.mocked(PublicSiteSearchService.search).mockResolvedValue({ items, total: 87, page: 2, limit: 10, rankingVersion: 'v4-catalog-v1', nextCursor: null } as any);
    const res = response();
    await ProdutoController.listSite({ query: { busca: 'caderno', page: '2', limit: '10' }, headers: {} } as any, res as any);
    expect(PublicSiteSearchService.search).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 1, query: 'caderno', page: 2, limit: 10 }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true,
      data: expect.objectContaining({ items, total: 87, totalPages: 9, page: 2, limit: 10 }) }));
  });

  it('does not turn database failures into a misleading successful empty list', async () => {
    vi.mocked(PublicSiteSearchService.search).mockRejectedValue(Object.assign(new Error('Banco indisponivel'), { code: 'DB_UNREACHABLE', statusCode: 503 }));
    const res = response();
    await ProdutoController.listSite({ query: { busca: 'caderno' }, headers: {} } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: { code: 'DB_UNREACHABLE', details: undefined } }));
  });
});
