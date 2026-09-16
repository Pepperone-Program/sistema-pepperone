import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../src/services/CategoryProductsService', () => ({ CategoryProductsService: {} }));
vi.mock('../src/services/CategoriaService', () => ({
  CategoriaService: { getCatalogoCategoria: vi.fn() },
  SubcategoriaService: {},
}));
vi.mock('../src/services/CacheService', () => ({
  CacheService: {
    buildKey: vi.fn((_namespace: string, key: string) => key),
    getOrSet: vi.fn((_key: string, loader: () => unknown) => loader()),
  },
}));
vi.mock('../src/utils/response', () => ({
  successResponse: vi.fn(),
  paginatedResponse: vi.fn(),
  errorResponse: vi.fn(),
}));

import { CategoriaController } from '../src/controllers/CategoriaController';
import { CategoriaService } from '../src/services/CategoriaService';
import { CacheService } from '../src/services/CacheService';
import { successResponse } from '../src/utils/response';

beforeEach(() => {
  vi.clearAllMocks();
});

it('expires the public category catalog cache after 30 minutes', async () => {
  const catalog = { items: [], total: 0, page: 1, limit: 24 };
  vi.mocked(CategoriaService.getCatalogoCategoria).mockResolvedValue(catalog as any);
  const req = {
    params: { id: '8' },
    query: { empresaId: '7', page: '1', limit: '24', subcategorias: '31' },
    originalUrl: '/categorias/8/catalogo?page=1&limit=24&subcategorias=31',
  } as any;
  const res = {} as any;

  await CategoriaController.catalogo(req, res);

  expect(CacheService.getOrSet).toHaveBeenCalledWith(
    '7:/categorias/8/catalogo?page=1&limit=24&subcategorias=31',
    expect.any(Function),
    1800
  );
  expect(CategoriaService.getCatalogoCategoria).toHaveBeenCalledWith(7, 8, {
    page: '1',
    limit: '24',
    subcategorias: '31',
    publicos_alvos: undefined,
    datas_promocionais: undefined,
    quantidade_minima_min: undefined,
    quantidade_minima_max: undefined,
  });
  expect(successResponse).toHaveBeenCalledWith(
    res,
    catalog,
    'Catalogo da categoria listado com sucesso'
  );
});
