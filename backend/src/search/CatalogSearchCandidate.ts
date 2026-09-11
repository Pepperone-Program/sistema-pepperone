import type { Produto } from '@/types/produto';
import type { ParsedSearchQuery, SearchCandidate } from '@/types/search';
import { normalizeComparable } from './QueryNormalizer';
import { QueryParser } from './QueryParser';
import { significantSearchTokens } from './QueryTokenizer';

export const canonicalizeType = (value: string): string | null => {
  const first = normalizeComparable(value).split(' ')[0];
  return first ? (first.length > 3 && first.endsWith('s') ? first.slice(0, -1) : first) : null;
};

export const parseProductSearchData = (product: Pick<Produto, 'produto' | 'descricao'>) =>
  QueryParser.parse(`${product.produto || ''} ${product.descricao || ''}`);

export type CatalogSearchRow = Pick<Produto, 'id_produto' | 'produto' | 'descricao' | 'codigo' | 'data_inclusao'> & { tipo_produto: string | null };

export function catalogSearchCandidate(product: CatalogSearchRow, query: ParsedSearchQuery): SearchCandidate {
  const parsed = parseProductSearchData(product);
  const name = normalizeComparable(product.produto || '');
  const type = canonicalizeType(product.tipo_produto || '') || QueryParser.parse(product.produto || '').productType?.value || null;
  const text = [name, normalizeComparable(product.descricao || ''), normalizeComparable(product.codigo || ''), type].filter(Boolean).join(' ').slice(0, 16000);
  const terms = significantSearchTokens([...query.tokens, ...query.synonyms]);
  const attributes: SearchCandidate['attributes'] = {};
  const contained: Record<string, number> = {};
  for (const constraint of parsed.constraints) {
    (attributes[constraint.key] ||= []).push(constraint.value);
    if (constraint.key.startsWith('contains:')) contained[constraint.key.slice(9)] = Number(constraint.value);
  }
  return {
    id_produto: Number(product.id_produto), produto: product.produto, codigo: product.codigo, data_inclusao: product.data_inclusao,
    name_search: name, search_text: text, canonical_product_type: type,
    capacity_ml: parsed.measurements.capacityMl || null, material_key: parsed.materials[0] || null, color_key: parsed.colors[0] || null,
    attributes, contained_types: Object.keys(contained), contained_quantities: contained,
    // Deterministic lexical scores keep ordering stable when the optional index fails.
    fulltext_name_score: terms.filter((term) => name.includes(term)).length,
    fulltext_search_score: terms.filter((term) => text.includes(term)).length,
    popularity_score: 0, code_match: normalizeComparable(product.codigo) === query.normalized,
  };
}
