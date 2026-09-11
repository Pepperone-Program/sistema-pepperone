import { SEARCH_LIMITS } from '@config/search';
import { query } from '@database/connection';
import type { ParsedSearchQuery, SearchCandidate, SearchFilters } from '@/types/search';
import { buildSafeBooleanQuery, significantSearchTokens } from './QueryTokenizer';
import { catalogSearchCandidate, type CatalogSearchRow } from './CatalogSearchCandidate';
import { OptionalSearchDependency } from './OptionalSearchDependency';
import { createHash } from 'crypto';

interface AttributeRow { id_produto: number; attribute_key: string; value_text: string | null; value_number: number | null; value_boolean: number | null }

export const buildCandidateBooleanQueries = (parsed: ParsedSearchQuery): { booleanQuery: string; canonicalQuery: string } => ({
  booleanQuery: buildSafeBooleanQuery(significantSearchTokens(parsed.tokens)),
  canonicalQuery: buildSafeBooleanQuery(significantSearchTokens([
    ...(parsed.productType ? [parsed.productType.value] : []),
    ...parsed.positiveTerms,
    ...parsed.synonyms,
  ])),
});

export class CandidateRetriever {
  static async retrieve(empresaId: number, parsed: ParsedSearchQuery, filters: SearchFilters): Promise<SearchCandidate[]> {
    // The index can enrich results, but never controls catalog coverage or freshness.
    const [live, indexed] = await Promise.all([
      this.retrieveCatalog(empresaId, parsed, filters),
      OptionalSearchDependency.run(`index:${empresaId}:${createHash('sha256').update(JSON.stringify([parsed.normalized, filters])).digest('hex')}`,
        () => this.retrieveIndexed(empresaId, parsed, filters), [] as SearchCandidate[], 400, `index:${empresaId}`),
    ]);
    const byId = new Map(indexed.map((item) => [Number(item.id_produto), item]));
    const missingIds = live.filter((item) => !byId.has(item.id_produto)).map((item) => item.id_produto);
    // Manual facts are authoritative even when their product has no search document.
    const manual = missingIds.length ? await OptionalSearchDependency.run(
      `manual:${empresaId}:${createHash('sha256').update(JSON.stringify(missingIds)).digest('hex')}`,
      () => this.retrieveManual(empresaId, missingIds), new Map<number, Pick<SearchCandidate, 'attributes' | 'contained_quantities'>>(),
      400, `manual:${empresaId}`,
    ) : new Map<number, Pick<SearchCandidate, 'attributes' | 'contained_quantities'>>();
    return live.map((candidate) => {
      const enrichment = byId.get(candidate.id_produto) || manual.get(candidate.id_produto);
      if (enrichment) {
        // Indexed attributes below are MANUAL only. Derived data always comes from current catalog fields.
        Object.assign(candidate.attributes, enrichment.attributes);
        Object.assign(candidate.contained_quantities, enrichment.contained_quantities);
        candidate.contained_types = Object.keys(candidate.contained_quantities);
      }
      return candidate;
    }).filter((item) => (!filters.material || item.material_key === filters.material)
      && (!filters.color || item.color_key === filters.color));
  }

  private static async retrieveManual(empresaId: number, ids: number[]) {
    const result = new Map<number, Pick<SearchCandidate, 'attributes' | 'contained_quantities'>>();
    const get = (id: number) => {
      if (!result.has(id)) result.set(id, { attributes: {}, contained_quantities: {} });
      return result.get(id)!;
    };
    for (let start = 0; start < ids.length; start += 500) {
      const chunk = ids.slice(start, start + 500);
      const placeholders = chunk.map(() => '?').join(',');
      const [attributes, contains] = await Promise.all([
        query(`SELECT psa.id_produto, sad.attribute_key, psa.value_text, psa.value_number, psa.value_boolean
          FROM product_search_attributes psa INNER JOIN search_attribute_definitions sad
          ON sad.id_empresa = psa.id_empresa AND sad.id = psa.attribute_definition_id
          WHERE psa.id_empresa = ? AND psa.source = 'MANUAL' AND psa.id_produto IN (${placeholders})`, [empresaId, ...chunk]) as Promise<AttributeRow[]>,
        query(`SELECT id_produto, canonical_product_type, quantity FROM product_contains_types
          WHERE id_empresa = ? AND source = 'MANUAL' AND id_produto IN (${placeholders})`, [empresaId, ...chunk]) as Promise<Array<{ id_produto: number; canonical_product_type: string; quantity: number | null }>>,
      ]);
      for (const row of attributes) {
        const value = row.value_boolean === null ? (row.value_number === null ? row.value_text : Number(row.value_number)) : Boolean(row.value_boolean);
        if (value !== null) (get(Number(row.id_produto)).attributes[row.attribute_key] ||= []).push(value);
      }
      for (const row of contains) {
        if (row.quantity !== null) get(Number(row.id_produto)).contained_quantities[row.canonical_product_type] = Number(row.quantity);
      }
    }
    return result;
  }

  static async retrieveCatalog(empresaId: number, parsed: ParsedSearchQuery, filters: SearchFilters): Promise<SearchCandidate[]> {
    const terms = [...new Set([...(parsed.productType ? [parsed.productType.value] : []), ...parsed.positiveTerms, ...parsed.synonyms])];
    const conditions = ["p.id_empresa = ?", "p.site = 'S'", "p.habilitado = 'S'"];
    const values: unknown[] = [empresaId];
    // Broad entrance; the existing relevance gate checks every term and constraint afterwards.
    if (terms.length) {
      conditions.push(`(${terms.map(() => "(p.produto LIKE ? ESCAPE '!' OR tp.tipo_produto LIKE ? ESCAPE '!')").join(' OR ')})`);
      for (const term of terms) {
        const pattern = `%${term.replace(/[!%_]/g, '!$&')}%`;
        values.push(pattern, pattern);
      }
    }
    if (filters.categoryId) {
      conditions.push('EXISTS (SELECT 1 FROM aux_categorias_produtos acp WHERE acp.id_empresa = p.id_empresa AND acp.id_produto = p.id_produto AND acp.id_categoria = ?)');
      values.push(filters.categoryId);
    }
    const candidates: SearchCandidate[] = [];
    let afterId = 0;
    // Keyset batches avoid an arbitrary candidate cap silently dropping matching products.
    while (true) {
      const rows = await query(`SELECT p.id_produto, p.produto, p.descricao, p.codigo, p.data_inclusao, tp.tipo_produto
        FROM produtos p LEFT JOIN tipos_produtos tp ON tp.id_empresa = p.id_empresa AND tp.id_tipo_produto = p.id_tipo_produto
        WHERE ${conditions.join(' AND ')} AND p.id_produto > ? ORDER BY p.id_produto LIMIT 500`, [...values, afterId]) as CatalogSearchRow[];
      candidates.push(...rows.map((row) => catalogSearchCandidate(row, parsed)));
      if (rows.length < 500) break;
      afterId = Number(rows[rows.length - 1].id_produto);
    }
    return candidates;
  }

  private static async retrieveIndexed(empresaId: number, parsed: ParsedSearchQuery, filters: SearchFilters): Promise<SearchCandidate[]> {
    const { booleanQuery, canonicalQuery } = buildCandidateBooleanQueries(parsed);
    const candidateLimit = Math.min(Math.max(Number(process.env.SEARCH_CANDIDATE_LIMIT || SEARCH_LIMITS.candidateLimit), 100), 5000);
    const material = filters.material || parsed.materials[0] || '';
    const color = filters.color || parsed.colors[0] || '';
    const capacity = parsed.measurements.capacityMl || null;
    const structuredConstraint = parsed.constraints.find((constraint) => !['material', 'color', 'capacity_ml'].includes(constraint.key));
    const structuredText = typeof structuredConstraint?.value === 'string' ? structuredConstraint.value : '';
    const structuredNumber = typeof structuredConstraint?.value === 'number' ? structuredConstraint.value : null;
    const structuredBoolean = typeof structuredConstraint?.value === 'boolean' ? Number(structuredConstraint.value) : null;
    const categoryJoin = filters.categoryId
      ? 'INNER JOIN aux_categorias_produtos acp ON acp.id_empresa = p.id_empresa AND acp.id_produto = p.id_produto AND acp.id_categoria = ?'
      : '';
    const categoryValues = filters.categoryId ? [filters.categoryId] : [];
    const sql = `
      WITH candidate_ids AS (
        /* FULLTEXT is the candidate entrance. Structured attributes only rescue
           terms deliberately not indexed by MariaDB (for example A4/A5). */
        SELECT psd.id_produto FROM product_search_documents psd
        WHERE psd.id_empresa = ? AND psd.is_public = 1 AND MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE)
        UNION DISTINCT
        SELECT psd.id_produto FROM product_search_documents psd
        WHERE psd.id_empresa = ? AND psd.is_public = 1 AND ? <> ''
          AND MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE)
        UNION DISTINCT
        SELECT psa.id_produto FROM product_search_attributes psa
        INNER JOIN search_attribute_definitions sad ON sad.id_empresa = psa.id_empresa AND sad.id = psa.attribute_definition_id
        WHERE psa.id_empresa = ? AND sad.attribute_key = ?
          AND ((? <> '' AND psa.value_text = ?) OR (? IS NOT NULL AND psa.value_number = ?) OR (? IS NOT NULL AND psa.value_boolean = ?))
        UNION DISTINCT
        SELECT psd.id_produto FROM product_search_documents psd WHERE psd.id_empresa = ? AND psd.is_public = 1
          AND ((? <> '' AND psd.material_key = ?) OR (? <> '' AND psd.color_key = ?) OR (? IS NOT NULL AND psd.capacity_ml = ?))
      )
      SELECT p.id_produto, p.produto, p.codigo, p.data_inclusao,
        psd.name_search, psd.search_text, psd.canonical_product_type,
        psd.capacity_ml, psd.material_key, psd.color_key, psd.popularity_score,
        GREATEST(MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE),
          MATCH(psd.name_search) AGAINST (? IN BOOLEAN MODE)) fulltext_name_score,
        MATCH(psd.search_text) AGAINST (? IN BOOLEAN MODE) fulltext_search_score,
        CASE WHEN p.codigo = ? THEN 1 ELSE 0 END code_match
      FROM candidate_ids ci
      INNER JOIN produtos p ON p.id_empresa = ? AND p.id_produto = ci.id_produto AND p.site = 'S' AND p.habilitado = 'S'
      INNER JOIN product_search_documents psd ON psd.id_empresa = p.id_empresa AND psd.id_produto = p.id_produto
      ${categoryJoin}
      WHERE (? = '' OR psd.material_key = ?) AND (? = '' OR psd.color_key = ?) AND (? IS NULL OR psd.capacity_ml = ?)
      ORDER BY fulltext_name_score DESC, fulltext_search_score DESC, p.id_produto DESC LIMIT ?`;
    const values = [empresaId, booleanQuery, empresaId, canonicalQuery, canonicalQuery,
      empresaId, structuredConstraint?.key || '', structuredText, structuredText,
      structuredNumber, structuredNumber, structuredBoolean, structuredBoolean, empresaId, material, material, color, color, capacity, capacity,
      booleanQuery, canonicalQuery, booleanQuery, parsed.normalized, empresaId, ...categoryValues,
      material, material, color, color, capacity, capacity, candidateLimit];
    const rows = await query(sql, values) as Array<SearchCandidate & { contained_types?: string }>;
    if (!rows.length) return [];
    const ids = rows.map((row) => Number(row.id_produto));
    const placeholders = ids.map(() => '?').join(',');
    const [attributeRows, containedRows] = await Promise.all([
      query(`SELECT psa.id_produto, sad.attribute_key, psa.value_text, psa.value_number, psa.value_boolean
        FROM product_search_attributes psa INNER JOIN search_attribute_definitions sad
          ON sad.id_empresa = psa.id_empresa AND sad.id = psa.attribute_definition_id
        WHERE psa.id_empresa = ? AND psa.source = 'MANUAL' AND psa.id_produto IN (${placeholders})`, [empresaId, ...ids]) as Promise<AttributeRow[]>,
      query(`SELECT id_produto, canonical_product_type, quantity FROM product_contains_types WHERE id_empresa = ? AND source = 'MANUAL' AND id_produto IN (${placeholders})`, [empresaId, ...ids]) as Promise<Array<{ id_produto: number; canonical_product_type: string; quantity: number | null }>>,
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
