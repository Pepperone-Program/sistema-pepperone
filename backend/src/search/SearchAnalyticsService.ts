import { createHash } from 'crypto';
import { query } from '@database/connection';

export interface SearchEventInput {
  searchId: string; empresaId: number; rankingVersion: string; normalizedQuery: string; filters: object;
  resultCount: number; candidateCount: number; databaseMs: number; parserMs: number; rankingMs: number;
  totalMs: number; cacheStatus: string; fallback: boolean;
}

export class SearchAnalyticsService {
  static async record(input: SearchEventInput): Promise<void> {
    const queryHash = createHash('sha256').update(input.normalizedQuery).digest('hex');
    try {
      await query(`INSERT INTO search_events
        (search_id,id_empresa,ranking_version,query_hash,normalized_query,filters_json,result_count,candidate_count,
         database_duration_ms,parser_duration_ms,ranking_duration_ms,total_duration_ms,cache_status,fallback_used)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [input.searchId, input.empresaId, input.rankingVersion, queryHash,
        process.env.SEARCH_STORE_NORMALIZED_QUERY === 'true' ? input.normalizedQuery : null, JSON.stringify(input.filters),
        input.resultCount, input.candidateCount, input.databaseMs, input.parserMs, input.rankingMs, input.totalMs,
        input.cacheStatus, input.fallback ? 1 : 0]);
    } catch (error) {
      console.warn('[ProductSearch] analytics unavailable', { searchId: input.searchId, message: error instanceof Error ? error.message : String(error) });
    }
  }
}
