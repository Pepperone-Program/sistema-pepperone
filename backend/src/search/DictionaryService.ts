import { query } from '@database/connection';
import type { DictionaryEntry } from '@/types/search';

interface DictionaryRow {
  id: number; term: string; normalized_term: string; type: DictionaryEntry['type']; canonical_value: string;
  priority: number; relation_type: DictionaryEntry['relationType']; strength: DictionaryEntry['strength'];
}

export class DictionaryService {
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
