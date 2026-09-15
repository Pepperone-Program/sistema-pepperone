import { describe, expect, it } from 'vitest';
import { QueryParser } from '../../src/search/QueryParser';
import { ProductRankingEngine } from '../../src/search/ProductRankingEngine';
import { filterRelevantCandidates } from '../../src/search/SearchRelevanceFilter';
import type { SearchCandidate } from '../../src/types/search';

const candidate = (id: number, name: string, type: string, overrides: Partial<SearchCandidate> = {}): SearchCandidate => ({
  id_produto: id, produto: name, codigo: `P${id}`, data_inclusao: '2026-01-01',
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
    const result = filterRelevantCandidates(parsed, ranked);
    expect(result.map((item) => item.product.id_produto)).toEqual([1]);
  });

  it('removes kits that only contain the requested product type', () => {
    const parsed = QueryParser.parse('mochila');
    const primaries = Array.from({ length: 20 }, (_, index) => candidate(index + 1, `Mochila ${index + 1}`, 'mochila'));
    const kits = Array.from({ length: 4 }, (_, index) => candidate(100 + index, `Kit ${index + 1}`, 'kit', { contained_types: ['mochila'] }));
    const result = filterRelevantCandidates(parsed, ProductRankingEngine.rank(parsed, [...primaries, ...kits]));
    expect(result).toHaveLength(20);
    expect(result.every((item) => item.primaryTypeMatch)).toBe(true);
  });

  it('accepts cafe only when a title word starts with cafe', () => {
    const parsed = QueryParser.parse('café');
    const ranked = ProductRankingEngine.rank(parsed, [
      candidate(1, 'Cafeteira em Vidro 740ml Personalizada', 'kit'),
      candidate(2, 'Conjunto de Cafés em Vidro Personalizado', 'kit'),
      candidate(3, 'Copo Café com Tampa Personalizado', 'copo'),
      candidate(4, 'Caderno em Fibra de Café Personalizado', 'caderno'),
      candidate(5, 'Bloco de Anotacoes Personalizado', 'bloco', { search_text: 'bloco para pausa do cafe' }),
      candidate(6, 'Kit Home Office Personalizado', 'kit', { search_text: 'kit com caneca para cafe' }),
    ]);
    expect(filterRelevantCandidates(parsed, ranked).map((item) => item.product.id_produto).sort()).toEqual([1, 2, 3, 4]);
  });

  it('requires detected strong attributes to match', () => {
    const parsed = QueryParser.parse('garrafa termica inox 500ml');
    const ranked = ProductRankingEngine.rank(parsed, [
      candidate(1, 'Garrafa Termica Inox 500ml', 'garrafa', { material_key: 'stainless_steel', capacity_ml: 500, attributes: { thermal: [true] } }),
      candidate(2, 'Garrafa Termica Inox 750ml', 'garrafa', { material_key: 'stainless_steel', capacity_ml: 750, attributes: { thermal: [true] } }),
    ]);
    expect(filterRelevantCandidates(parsed, ranked).map((item) => item.product.id_produto)).toEqual([1]);
  });

  it('keeps ranked product types first and appends other products whose names contain the complete query', () => {
    const parsed = QueryParser.parse('taça', [{
      id: 1, term: 'taça', normalizedTerm: 'taca', type: 'PRODUCT_TYPE', canonicalValue: 'taca',
      priority: 1, relationType: null, strength: 'STRONG',
    }]);
    const ranked = ProductRankingEngine.rank(parsed, [
      candidate(1, 'Taça de Vidro Personalizada', 'taca'),
      candidate(2, 'Kit com Taça e Abridor Personalizado', 'kit'),
      candidate(3, 'Kit para Vinho Personalizado', 'kit'),
    ]);

    const result = filterRelevantCandidates(parsed, ranked);

    expect(result.map((item) => item.product.id_produto)).toEqual([1, 2]);
    expect(result[1].group).toBe(13);
  });
});
