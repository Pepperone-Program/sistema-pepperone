import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/OrcamentoService', () => ({ OrcamentoService: { getTopCategoriasOrcadas: vi.fn() } }));
vi.mock('../src/services/CacheService', () => ({ CacheService: {
  buildKey: vi.fn((_namespace: string, key: string) => `site-pep:${key}`),
  getOrSet: vi.fn((_key: string, loader: () => unknown) => loader()),
} }));

import { OrcamentoController } from '../src/controllers/OrcamentoController';
import { OrcamentoService } from '../src/services/OrcamentoService';
import { CacheService } from '../src/services/CacheService';

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('top categorias cache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('caches each company ranking for 24 hours', async () => {
    const result = { items: [], periodo_dias: 30 } as const;
    vi.mocked(OrcamentoService.getTopCategoriasOrcadas).mockResolvedValue(result);
    const res = response();

    await OrcamentoController.topCategoriasOrcadas({ user: { id_empresa: 7 } } as any, res as any);

    expect(CacheService.buildKey).toHaveBeenCalledWith('orcamentos', 'estatisticas:top-categorias:7');
    expect(CacheService.getOrSet).toHaveBeenCalledWith(
      'site-pep:estatisticas:top-categorias:7',
      expect.any(Function),
      86_400,
    );
    expect(OrcamentoService.getTopCategoriasOrcadas).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
