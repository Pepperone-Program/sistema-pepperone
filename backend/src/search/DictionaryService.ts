import { query } from '@database/connection';
import type { DictionaryEntry } from '@/types/search';
import { normalizeComparable } from './QueryNormalizer';

interface DictionaryRow {
  id: number; term: string; normalized_term: string; type: DictionaryEntry['type']; canonical_value: string;
  priority: number; relation_type: DictionaryEntry['relationType']; strength: DictionaryEntry['strength'];
}

export class DictionaryService {
  static async syncPublicProductTypes(empresaId: number): Promise<number> {
    const rows = await query(`SELECT DISTINCT tp.tipo_produto FROM tipos_produtos tp
      INNER JOIN produtos p ON p.id_empresa = tp.id_empresa AND p.id_tipo_produto = tp.id_tipo_produto
      WHERE p.id_empresa = ? AND p.site = 'S' AND p.habilitado = 'S'`, [empresaId]) as Array<{ tipo_produto: string }>;
    const entries = new Map<string, string>();
    for (const row of rows) {
      const rawType = normalizeComparable(row.tipo_produto || '').split(' ')[0];
      if (!rawType) continue;
      const canonicalType = rawType.length > 3 && rawType.endsWith('s') ? rawType.slice(0, -1) : rawType;
      entries.set(rawType, canonicalType);
      entries.set(canonicalType, canonicalType);
    }
    if (!entries.size) return 0;
    const values = [...entries].map(([term, canonicalValue]) => [empresaId, term, term, 'PRODUCT_TYPE', canonicalValue, 50, 'EXACT_SYNONYM', 'HARD', 1, 1]);
    const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
    await query(`INSERT INTO search_dictionary
      (id_empresa,term,normalized_term,type,canonical_value,priority,relation_type,strength,active,version)
      VALUES ${placeholders} ON DUPLICATE KEY UPDATE term=VALUES(term), active=1, version=version+1`, values.flat());
    return values.length;
  }

  static async listActive(empresaId: number): Promise<DictionaryEntry[]> {
    const rows = await query(
      `SELECT id, term, normalized_term, type, canonical_value, priority, relation_type, strength
       FROM search_dictionary WHERE id_empresa = ? AND active = 1
       ORDER BY CHAR_LENGTH(normalized_term) DESC, priority DESC, id ASC`, [empresaId]
    ) as DictionaryRow[];
    return rows.map((row) => ({ id: row.id, term: row.term, normalizedTerm: row.normalized_term, type: row.type,
      canonicalValue: row.canonical_value, priority: row.priority, relationType: row.relation_type, strength: row.strength }));
  }

  static async version(empresaId: number): Promise<number> {
    const rows = await query('SELECT COALESCE(MAX(version), 1) version FROM search_dictionary WHERE id_empresa = ?', [empresaId]) as Array<{ version: number }>;
    return Number(rows[0]?.version || 1);
  }
}
