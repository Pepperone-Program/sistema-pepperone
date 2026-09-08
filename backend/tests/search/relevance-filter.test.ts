import { describe, expect, it } from 'vitest';
import { QueryParser } from '../../src/search/QueryParser';
import { ProductRankingEngine } from '../../src/search/ProductRankingEngine';
import { splitRelevantCandidates } from '../../src/search/SearchRelevanceFilter';
import type { SearchCandidate } from '../../src/types/search';

const candidate = (id: number, name: string, type: string, overrides: Partial<SearchCandidate> = {}): SearchCandidate => ({
  id_empresa: 1, id_produto: id, id_tipo_produto: id, produto: name, descricao: '', codigo: `P${id}`,
  id_tipo_gravacao_padrao: 0, altura: '', largura: '', profundidade: '', peso: '', caixa1: '', caixa2: '', caixa3: '', caixa4: '', caixa5: '',
  ncm: '', imagem: null, data_inclusao: '2026-01-01', data_inicial: '', data_final: '', data_modificacao: '', obs: '', site: 'S', sugerir_sempre: 'N', lancamento: 'N', promocao: 'N', premium: 'N', marketplace: 'N', video: '', habilitado: 'S', cod_forn: null, quantidade_minima: null,
  name_search: name.toLowerCase(), search_text: name.toLowerCase(), canonical_product_type: type, contained_types: [], contained_quantities: {}, attributes: {}, capacity_ml: null, material_key: null, color_key: null, popularity_score: 0, fulltext_name_score: 1, fulltext_search_score: 1, code_match: false, ...overrides,
});

describe('public relevance final gate', () => {
  it('never promotes unrelated products for mochila', () => {
    const parsed = QueryParser.parse('mochila');
    const ranked = ProductRankingEngine.rank(parsed, [
      candidate(1, 'Mochila Executiva', 'mochila'),
      candidate(2, 'Bloco de Anotacoes', 'bloco'),
      candidate(3, 'Bateria Portatil', 'bateria'),
      candidate(4, 'Mini Alicate', 'alicate'),
    ]);
    const result = splitRelevantCandidates(parsed, ranked);
    expect(result.primary.map((item) => item.product.id_produto)).toEqual([1]);
    expect(result.tail).toEqual([]);
  });

  it('keeps documented kits only in the 10 percent tail after primary results', () => {
    const parsed = QueryParser.parse('mochila');
    const primaries = Array.from({ length: 20 }, (_, index) => candidate(index + 1, `Mochila ${index + 1}`, 'mochila'));
    const kits = Array.from({ length: 4 }, (_, index) => candidate(100 + index, `Kit ${index + 1}`, 'kit', { contained_types: ['mochila'] }));
    const result = splitRelevantCandidates(parsed, ProductRankingEngine.rank(parsed, [...primaries, ...kits]));
    expect(result.primary).toHaveLength(20);
    expect(result.tail).toHaveLength(2);
    expect(result.tail.every((item) => item.relatedOnly)).toBe(true);
  });

  it('requires detected strong attributes to match', () => {
    const parsed = QueryParser.parse('garrafa termica inox 500ml');
    const ranked = ProductRankingEngine.rank(parsed, [
      candidate(1, 'Garrafa Termica Inox 500ml', 'garrafa', { material_key: 'stainless_steel', capacity_ml: 500, attributes: { thermal: [true] } }),
      candidate(2, 'Garrafa Termica Inox 750ml', 'garrafa', { material_key: 'stainless_steel', capacity_ml: 750, attributes: { thermal: [true] } }),
    ]);
    expect(splitRelevantCandidates(parsed, ranked).primary.map((item) => item.product.id_produto)).toEqual([1]);
  });
});
