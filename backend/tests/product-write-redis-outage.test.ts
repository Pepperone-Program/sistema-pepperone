import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/ProdutoService', () => ({ ProdutoService: { updateProduto: vi.fn() } }));
import { ProdutoController } from '../src/controllers/ProdutoController';
import { ProdutoService } from '../src/services/ProdutoService';

beforeEach(() => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unavailable' }))));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('product update with Redis unavailable', () => {
  it('returns the persisted product as success without asking the user to save twice', async () => {
    const persisted = { id_produto: 12, produto: 'Mochila atualizada' };
    vi.mocked(ProdutoService.updateProduto).mockResolvedValue(persisted as never);
    const res: any = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await ProdutoController.update({ user: { id_empresa: 7 }, params: { id: '12' }, body: { produto: persisted.produto } } as any, res);
    expect(ProdutoService.updateProduto).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: persisted }));
    expect(fetch).toHaveBeenCalled();
  });
});
