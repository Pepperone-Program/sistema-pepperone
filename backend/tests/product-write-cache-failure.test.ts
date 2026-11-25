import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/ProdutoService', () => ({ ProdutoService: { updateProduto: vi.fn() } }));
vi.mock('../src/services/CacheService', () => ({ CacheService: { invalidateAfterWrite: vi.fn() } }));
import { ProdutoController } from '../src/controllers/ProdutoController';
import { ProdutoService } from '../src/services/ProdutoService';
import { CacheService } from '../src/services/CacheService';

beforeEach(() => vi.clearAllMocks());

describe('product write response', () => {
  it('confirms the saved product when cache invalidation is unavailable', async () => {
    const product = { id_produto: 12, produto: 'Mochila atualizada' };
    vi.mocked(ProdutoService.updateProduto).mockResolvedValue(product as never);
    vi.mocked(CacheService.invalidateAfterWrite).mockResolvedValue(undefined);
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await ProdutoController.update({ user: { id_empresa: 7 }, params: { id: '12' }, body: { produto: product.produto } } as any, res);
    expect(ProdutoService.updateProduto).toHaveBeenCalledWith(7, 12, { produto: product.produto });
    expect(CacheService.invalidateAfterWrite).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: product }));
  });
});
