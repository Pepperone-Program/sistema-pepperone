import { describe, expect, it } from 'vitest';
import { QueryParser } from '../../src/search/QueryParser';
import { ProductRankingEngine } from '../../src/search/ProductRankingEngine';
import type { SearchCandidate } from '../../src/types/search';

const candidate = (id: number, name: string, type: string, overrides: Partial<SearchCandidate> = {}): SearchCandidate => ({
  id_empresa: 1, id_produto: id, id_tipo_produto: id, produto: name, descricao: '', codigo: `P${id}`,
  id_tipo_gravacao_padrao: 0, altura: '', largura: '', profundidade: '', peso: '', caixa1: '', caixa2: '', caixa3: '', caixa4: '', caixa5: '',
  ncm: '', imagem: null, data_inclusao: '2026-01-01', data_inicial: '', data_final: '', data_modificacao: '', obs: '', site: 'S', sugerir_sempre: 'N',
  lancamento: 'N', promocao: 'N', premium: 'N', marketplace: 'N', video: '', habilitado: 'S', cod_forn: null, quantidade_minima: null,
  name_search: name.toLowerCase(), search_text: name.toLowerCase(), canonical_product_type: type, contained_types: [], contained_quantities: {}, attributes: {}, capacity_ml: null,
  material_key: null, color_key: null, popularity_score: 0, fulltext_name_score: 0, fulltext_search_score: 0, code_match: false, ...overrides,
});

describe('ranking v1 invariants', () => {
  it('ranks primary product type before a kit containing that type', () => {
    const ranked = ProductRankingEngine.rank(QueryParser.parse('bloco'), [
      candidate(2, 'Kit Executivo com Bloco', 'kit', { contained_types: ['bloco'], fulltext_name_score: 100 }),
      candidate(1, 'Bloco A5', 'bloco'),
    ]);
    expect(ranked.map((item) => item.product.id_produto)).toEqual([1, 2]);
  });

  it('ranks all constraints before partial matches', () => {
    const ranked = ProductRankingEngine.rank(QueryParser.parse('garrafa termica inox 500ml'), [
      candidate(1, 'Garrafa Inox', 'garrafa', { material_key: 'stainless_steel' }),
      candidate(2, 'Garrafa Termica Inox 500ml', 'garrafa', { material_key: 'stainless_steel', capacity_ml: 500, attributes: { thermal: [true] } }),
    ]);
    expect(ranked[0].product.id_produto).toBe(2);
    expect(ranked[0].matchedConstraints).toBe(ranked[0].totalConstraints);
  });

  it('strongly penalizes explicit contradictions', () => {
    const ranked = ProductRankingEngine.rank(QueryParser.parse('bloco sem pauta'), [
      candidate(1, 'Bloco Pautado', 'bloco', { attributes: { lined: [true] } }),
      candidate(2, 'Bloco Liso', 'bloco', { attributes: { lined: [false] } }),
    ]);
    expect(ranked[0].product.id_produto).toBe(2);
    expect(ranked[1].contradictions).toBe(1);
  });
});
