import { SEARCH_LIMITS } from '@config/search';
import { query } from '@database/connection';
import { SITE_PRODUTO_COLUMNS_P } from '@models/selectColumns';
import type { ParsedSearchQuery, SearchCandidate } from '@/types/search';
import { buildSafeBooleanQuery } from './QueryTokenizer';
import { normalizeComparable } from './QueryNormalizer';
import { QueryParser } from './QueryParser';

const canonicalizeType = (value: string): string | null => {
  const first = normalizeComparable(value).split(' ')[0];
  if (!first) return null;
  return first.length > 3 && first.endsWith('s') ? first.slice(0, -1) : first;
};

const containedProductTypes = ['bloco', 'garrafa', 'caneta', 'copo', 'mochila', 'caderno', 'agenda', 'taca'];

interface LegacyCandidateRow extends Omit<SearchCandidate, 'attributes' | 'contained_types' | 'contained_quantities'> {
  tipo_produto: string | null;
}

export class LegacyCandidateRetriever {
  static async retrieve(empresaId: number, parsed: ParsedSearchQuery): Promise<SearchCandidate[]> {
    const booleanQuery = buildSafeBooleanQuery([...parsed.tokens, ...parsed.synonyms]);
    const patterns = Array.from(new Set([
      parsed.productType?.value,
      ...parsed.positiveTerms,
      ...parsed.phrases,
      parsed.normalized,
    ].filter((term): term is string => Boolean(term)))).slice(0, 8);
    const likeConditions = patterns.map(() => 'p.produto LIKE ?').join(' OR ');
    const candidateLimit = Math.min(Number(process.env.SEARCH_CANDIDATE_LIMIT || SEARCH_LIMITS.candidateLimit), 1000);
    const rows = await query(`
      SELECT ${SITE_PRODUTO_COLUMNS_P}, tp.tipo_produto,
        p.produto name_search,
        CONCAT_WS(' ', p.produto, p.descricao, p.obs, p.codigo, tp.tipo_produto) search_text,
        MATCH(p.produto,p.descricao,p.obs) AGAINST (? IN BOOLEAN MODE) fulltext_search_score,
        MATCH(p.produto,p.descricao,p.obs) AGAINST (? IN NATURAL LANGUAGE MODE) fulltext_name_score,
        CASE WHEN p.codigo = ? THEN 1 ELSE 0 END code_match
      FROM produtos p
      LEFT JOIN tipos_produtos tp ON tp.id_empresa = p.id_empresa AND tp.id_tipo_produto = p.id_tipo_produto
      WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S'
        AND (MATCH(p.produto,p.descricao,p.obs) AGAINST (? IN BOOLEAN MODE)
          OR p.codigo LIKE ? ${likeConditions ? `OR ${likeConditions}` : ''})
      ORDER BY code_match DESC, fulltext_name_score DESC, fulltext_search_score DESC,
        CASE WHEN p.produto LIKE ? THEN 0 WHEN p.produto LIKE ? THEN 1 ELSE 2 END,
        p.id_produto DESC
      LIMIT ?`, [booleanQuery, parsed.normalized, parsed.normalized, empresaId, booleanQuery,
      `%${parsed.normalized}%`, ...patterns.map((term) => `%${term}%`), parsed.normalized, `${parsed.normalized}%`, candidateLimit]) as LegacyCandidateRow[];

    return rows.map((row) => {
      const text = normalizeComparable(`${row.produto || ''} ${row.descricao || ''}`);
      const derived = QueryParser.parse(text);
      const canonicalType = canonicalizeType(row.tipo_produto || '') || derived.productType?.value || null;
      const attributes: Record<string, Array<string | number | boolean>> = {};
      const containedQuantities: Record<string, number> = {};
      for (const constraint of derived.constraints) {
        if (constraint.key === 'capacity_ml' || constraint.key === 'material' || constraint.key === 'color') continue;
        if (constraint.key.startsWith('contains:')) {
          containedQuantities[constraint.key.slice('contains:'.length)] = Number(constraint.value);
          continue;
        }
        (attributes[constraint.key] ||= []).push(constraint.value);
      }
      const containedTypes = canonicalType === 'kit'
        ? containedProductTypes.filter((type) => type !== canonicalType && new RegExp(`\\b${type}s?\\b`).test(text))
        : [];
      for (const type of Object.keys(containedQuantities)) if (!containedTypes.includes(type)) containedTypes.push(type);
      return {
        ...row,
        name_search: normalizeComparable(row.produto),
        search_text: normalizeComparable(row.search_text),
        canonical_product_type: canonicalType,
        contained_types: containedTypes,
        contained_quantities: containedQuantities,
        attributes,
        capacity_ml: derived.measurements.capacityMl || null,
        material_key: derived.materials[0] || null,
        color_key: derived.colors[0] || null,
        popularity_score: 0,
        fulltext_name_score: Number(row.fulltext_name_score || 0),
        fulltext_search_score: Number(row.fulltext_search_score || 0),
        code_match: Boolean(row.code_match),
      };
    });
  }
}
