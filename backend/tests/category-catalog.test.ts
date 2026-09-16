import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/database/connection', () => ({ query: vi.fn() }));

import { query } from '../src/database/connection';
import { CategoriaModel } from '../src/models/Categoria';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('public category catalog membership', () => {
  it('uses an enabled child-subcategory link without requiring a direct category link', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([{ total: '1' }])
      .mockResolvedValueOnce([{ id_produto: 91, produto: 'Produto exclusivo da subcategoria' }])
      .mockResolvedValueOnce([{ id_imagem: 1, id_produto: 91, url_imagem: 'produto.jpg', ordem_imagem: 1 }])
      .mockResolvedValueOnce([{ id_produto: 91, id_subcategoria: 31, subcategoria: 'Copos' }])
      .mockResolvedValueOnce([{ id_produto: 91, id_publico_alvo: 4, publico_alvo: 'Empresas' }])
      .mockResolvedValueOnce([{ id_produto: 91, id_data_promocional: 5, data_promocional: 'Natal' }]);

    const result = await CategoriaModel.findCatalogProducts(7, 8, {
      page: 2,
      limit: 24,
      subcategorias: [31],
      publicosAlvos: [4],
      datasPromocionais: [5],
      quantidadeMinimaMin: 10,
      quantidadeMinimaMax: 100,
    });

    expect(result).toMatchObject({
      total: 1,
      page: 2,
      limit: 24,
      items: [{
        id_produto: 91,
        imagem_url: 'produto.jpg',
        imagens: [{ id_imagem: 1 }],
        subcategorias: [{ id_subcategoria: 31 }],
      }],
    });

    for (const callIndex of [0, 1]) {
      const [sql, values] = vi.mocked(query).mock.calls[callIndex];
      expect(sql).toContain('FROM produtos p');
      expect(sql).not.toContain('FROM aux_categorias_produtos acp');
      expect(sql).toContain('FROM aux_subcategorias_produtos asp_catalog');
      expect(sql).toContain('s_catalog.id_empresa = asp_catalog.id_empresa');
      expect(sql).toContain('s_catalog.id_categoria = ?');
      expect(sql).toContain("s_catalog.habilitado = 'S'");
      expect(sql).toContain("p.habilitado = 'S'");
      expect(sql).toContain("p.site = 'S'");
      expect(values?.slice(0, 7)).toEqual([7, 8, 31, 10, 100, 4, 5]);
    }
    expect(vi.mocked(query).mock.calls[1][1]?.slice(-2)).toEqual([24, 24]);
  });

  it('keeps direct category membership when no subcategory is selected', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await CategoriaModel.findCatalogProducts(7, 8, { page: 1, limit: 24 });

    for (const callIndex of [0, 1]) {
      const [sql, values] = vi.mocked(query).mock.calls[callIndex];
      expect(sql).toContain('FROM aux_categorias_produtos acp');
      expect(sql).not.toContain('asp_catalog');
      expect(values?.slice(0, 3)).toEqual([7, 7, 8]);
    }
  });

  it('counts subcategory links independently and scopes active facet candidates to the selected child', async () => {
    vi.mocked(query).mockResolvedValue([]);

    await CategoriaModel.findCatalogFacets(7, 8, { subcategorias: [31] });

    const calls = vi.mocked(query).mock.calls;
    expect(calls).toHaveLength(4);

    const [subcategorySql, subcategoryValues] = calls[0];
    expect(subcategorySql).toContain('FROM aux_subcategorias_produtos asp');
    expect(subcategorySql).not.toContain('FROM aux_categorias_produtos acp');
    expect(subcategorySql).toContain('s_link.id_categoria = ?');
    expect(subcategorySql).toContain("s_link.habilitado = 'S'");
    expect(subcategorySql).toContain("p.habilitado = 'S'");
    expect(subcategorySql).toContain("p.site = 'S'");
    expect(subcategoryValues).toEqual([7, 7, 8, 7, 8]);

    for (const [sql, values] of calls.slice(1)) {
      expect(sql).toContain('FROM produtos p');
      expect(sql).toContain('FROM aux_subcategorias_produtos asp_catalog');
      expect(sql).toContain('s_catalog.id_categoria = ?');
      expect(sql).toContain("s_catalog.habilitado = 'S'");
      expect(sql).toContain("p.habilitado = 'S'");
      expect(sql).toContain("p.site = 'S'");
      expect(values).toEqual([7, 8, 31]);
    }
  });
});
