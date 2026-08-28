import { SEARCH_LIMITS } from '@config/search';
import { query } from '@database/connection';
import { SITE_PRODUTO_COLUMNS_P } from '@models/selectColumns';
import type { ParsedSearchQuery, SearchCandidate, SearchFilters } from '@/types/search';
import { buildSafeBooleanQuery } from './QueryTokenizer';

interface AttributeRow { id_produto: number; attribute_key: string; value_text: string | null; value_number: number | null; value_boolean: number | null }

export class CandidateRetriever {
  static async retrieve(empresaId: number, parsed: ParsedSearchQuery, filters: SearchFilters): Promise<SearchCandidate[]> {
    const booleanQuery = buildSafeBooleanQuery([...parsed.tokens, ...parsed.synonyms]);
    const candidateLimit = Math.min(Number(process.env.SEARCH_CANDIDATE_LIMIT || SEARCH_LIMITS.candidateLimit), 1000);
    const type = parsed.productType?.value || '';
    const material = filters.material || parsed.materials[0] || '';
    const color = filters.color || parsed.colors[0] || '';
    const capacity = parsed.measurements.capacityMl || null;
    const structuredConstraint = parsed.constraints.find((constraint) => !['material', 'color', 'capacity_ml'].includes(constraint.key));
    const containsConstraint = parsed.constraints.find((constraint) => constraint.key.startsWith('contains:'));
    const containsType = containsConstraint?.key.slice('contains:'.length) || '';
    const containsQuantity = containsConstraint ? Number(containsConstraint.value) : null;
    const structuredText = typeof structuredConstraint?.value === 'string' ? structuredConstraint.value : '';
    const structuredNumber = typeof structuredConstraint?.value === 'number' ? structuredConstraint.value : null;
    const structuredBoolean = typeof structuredConstraint?.value === 'boolean' ? Number(structuredConstraint.value) : null;
    const categoryJoin = filters.categoryId
      ? 'INNER JOIN aux_categorias_produtos acp ON acp.id_empresa = p.id_empresa AND acp.id_produto = p.id_produto AND acp.id_categoria = ?'
      : '';
    const categoryValues = filters.categoryId ? [filters.categoryId] : [];
    const sql = `
      WITH candidate_ids AS (
        SELECT psd.id_produto FROM product_search_documents psd
        WHERE psd.id_empresa = ? AND psd.is_public = 1 AND psd.canonical_product_type = ?
        UNION DISTINCT
        SELECT pct.id_produto FROM product_contains_types pct WHERE pct.id_empresa = ? AND pct.canonical_product_type = ?
        UNION DISTINCT
        SELECT pct.id_produto FROM product_contains_types pct WHERE pct.id_empresa = ? AND pct.canonical_product_type = ?
          AND (? IS NULL OR pct.quantity = ?)
        UNION DISTINCT
        SELECT psa.id_produto FROM product_search_attributes psa
        INNER JOIN search_attribute_definitions sad ON sad.id_empresa = psa.id_empresa AND sad.id = psa.attribute_definition_id
        WHERE psa.id_empresa = ? AND sad.attribute_key = ?
          AND ((? <> '' AND psa.value_text = ?) OR (? IS NOT NULL AND psa.value_number = ?) OR (? IS NOT NULL AND psa.value_boolean = ?))
        UNION DISTINCT
        SELECT psd.id_produto FROM product_search_documents psd WHERE psd.id_empresa = ? AND psd.is_public = 1
          AND ((? <> '' AND psd.material_key = ?) OR (? <> '' AND psd.color_key = ?) OR (? IS NOT NULL AND psd.capacity_ml = ?))
        UNION DISTINCT
        SELECT psd.id_produto FROM product_search_documents psd
        WHERE psd.id_empresa = ? AND psd.is_public = 1 AND MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE)
        UNION DISTINCT
        SELECT psd.id_produto FROM product_search_documents psd
        WHERE psd.id_empresa = ? AND psd.is_public = 1 AND MATCH(psd.search_text) AGAINST (? IN BOOLEAN MODE)
        UNION DISTINCT
        SELECT p0.id_produto FROM produtos p0 WHERE p0.id_empresa = ? AND p0.site = 'S' AND p0.habilitado = 'S' AND p0.codigo LIKE ?
      )
      SELECT ${SITE_PRODUTO_COLUMNS_P}, psd.name_search, psd.search_text, psd.canonical_product_type,
        psd.capacity_ml, psd.material_key, psd.color_key, psd.popularity_score,
        MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE) fulltext_name_score,
        MATCH(psd.search_text) AGAINST (? IN BOOLEAN MODE) fulltext_search_score,
        CASE WHEN p.codigo = ? THEN 1 ELSE 0 END code_match
      FROM candidate_ids ci
      INNER JOIN produtos p ON p.id_empresa = ? AND p.id_produto = ci.id_produto AND p.site = 'S' AND p.habilitado = 'S'
      INNER JOIN product_search_documents psd ON psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto
      ${categoryJoin}
      WHERE (? = '' OR psd.material_key = ?) AND (? = '' OR psd.color_key = ?) AND (? IS NULL OR psd.capacity_ml = ?)
      ORDER BY fulltext_name_score DESC, fulltext_search_score DESC, p.id_produto DESC LIMIT ?`;
    const values = [empresaId, type, empresaId, type, empresaId, containsType, containsQuantity, containsQuantity,
      empresaId, structuredConstraint?.key || '', structuredText, structuredText,
      structuredNumber, structuredNumber, structuredBoolean, structuredBoolean, empresaId, material, material, color, color, capacity, capacity,
      empresaId, booleanQuery, empresaId, booleanQuery,
      empresaId, `%${parsed.normalized}%`, booleanQuery, booleanQuery, parsed.normalized, empresaId, ...categoryValues,
      material, material, color, color, capacity, capacity, candidateLimit];
    const rows = await query(sql, values) as Array<SearchCandidate & { contained_types?: string }>;
    if (!rows.length) return [];
    const ids = rows.map((row) => Number(row.id_produto));
    const placeholders = ids.map(() => '?').join(',');
    const [attributeRows, containedRows] = await Promise.all([
      query(`SELECT psa.id_produto, sad.attribute_key, psa.value_text, psa.value_number, psa.value_boolean
        FROM product_search_attributes psa INNER JOIN search_attribute_definitions sad
          ON sad.id_empresa = psa.id_empresa AND sad.id = psa.attribute_definition_id
        WHERE psa.id_empresa = ? AND psa.id_produto IN (${placeholders})`, [empresaId, ...ids]) as Promise<AttributeRow[]>,
      query(`SELECT id_produto, canonical_product_type, quantity FROM product_contains_types WHERE id_empresa = ? AND id_produto IN (${placeholders})`, [empresaId, ...ids]) as Promise<Array<{ id_produto: number; canonical_product_type: string; quantity: number | null }>>,
    ]);
    const attrs = new Map<number, Record<string, Array<string | number | boolean>>>();
    for (const row of attributeRows) {
      const record = attrs.get(Number(row.id_produto)) || {};
      const value = row.value_boolean === null ? (row.value_number === null ? row.value_text : Number(row.value_number)) : Boolean(row.value_boolean);
      if (value !== null) (record[row.attribute_key] ||= []).push(value);
      attrs.set(Number(row.id_produto), record);
    }
    const contained = new Map<number, string[]>();
    const quantities = new Map<number, Record<string, number>>();
    for (const row of containedRows) {
      (contained.get(Number(row.id_produto)) || (contained.set(Number(row.id_produto), []), contained.get(Number(row.id_produto))!)).push(row.canonical_product_type);
      if (row.quantity !== null) {
        const record = quantities.get(Number(row.id_produto)) || {};
        record[row.canonical_product_type] = Number(row.quantity);
        quantities.set(Number(row.id_produto), record);
      }
    }
    return rows.map((row) => ({ ...row, fulltext_name_score: Number(row.fulltext_name_score || 0), fulltext_search_score: Number(row.fulltext_search_score || 0),
      popularity_score: Number(row.popularity_score || 0), capacity_ml: row.capacity_ml === null ? null : Number(row.capacity_ml),
      attributes: attrs.get(Number(row.id_produto)) || {}, contained_types: contained.get(Number(row.id_produto)) || [],
      contained_quantities: quantities.get(Number(row.id_produto)) || {}, code_match: Boolean(row.code_match) }));
  }
}
