import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { query } from '@database/connection';
import { CacheService } from '@services/CacheService';
import { ProductSearchService } from '@/search/ProductSearchService';
import { SearchObservability } from '@/search/SearchObservability';
import { normalizeSearchQuery } from '@/search/QueryNormalizer';
import type { DictionaryEntryType, DictionaryRelation, ConstraintStrength, SearchSort } from '@/types/search';
import { successResponse, errorResponse } from '@utils/response';

const allowedTypes: DictionaryEntryType[] = ['PRODUCT_TYPE','ATTRIBUTE','MATERIAL','MATERIAL_GROUP','COLOR','SYNONYM','PHRASE','RELATED_TERM','NEGATION'];
const allowedRelations: DictionaryRelation[] = ['EXACT_SYNONYM','RELATED_TERM','BROADER_TERM','NARROWER_TERM','CONTRADICTION'];
const allowedStrengths: ConstraintStrength[] = ['HARD','STRONG','SOFT'];

export class SearchController {
  static metrics(_req: AuthenticatedRequest, res: Response): void {
    successResponse(res, SearchObservability.snapshot(), 'Metricas locais da busca');
  }
  static async debug(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user!.id_empresa;
      const result = await ProductSearchService.debug({ empresaId, query: String(req.query.q || ''),
        limit: Math.min(Math.max(Number(req.query.limit || 20), 1), 100), page: 1,
        sort: String(req.query.sort || 'relevance') as SearchSort, filters: {} });
      successResponse(res, result, 'Diagnostico da busca');
    } catch (error) {
      const err = error as Error & { code?: string; statusCode?: number };
      errorResponse(res, err.code || 'SEARCH_DEBUG_ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listDictionary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const rows = await query(`SELECT id,term,normalized_term,type,canonical_value,priority,relation_type,strength,active,version,created_at,updated_at
        FROM search_dictionary WHERE id_empresa = ? ORDER BY active DESC, priority DESC, normalized_term ASC`, [req.user!.id_empresa]);
      successResponse(res, rows, 'Dicionario de busca');
    } catch (error) { const err = error as Error; errorResponse(res, 'DICTIONARY_ERROR', err.message, 500); }
  }

  static async upsertDictionary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = req.user!.id_empresa;
      const term = String(req.body.term || '').trim();
      const type = String(req.body.type || '') as DictionaryEntryType;
      const canonicalValue = normalizeSearchQuery(String(req.body.canonical_value || '')).normalized;
      const relation = req.body.relation_type ? String(req.body.relation_type) as DictionaryRelation : null;
      const strength = String(req.body.strength || 'SOFT') as ConstraintStrength;
      if (!term || term.length > 200 || !canonicalValue || !allowedTypes.includes(type) || (relation && !allowedRelations.includes(relation)) || !allowedStrengths.includes(strength)) {
        errorResponse(res, 'INVALID_DICTIONARY_ENTRY', 'Entrada de dicionario invalida', 400); return;
      }
      const normalizedTerm = normalizeSearchQuery(term).normalized;
      const priority = Math.max(-10000, Math.min(10000, Number(req.body.priority || 0)));
      await query(`INSERT INTO search_dictionary (id_empresa,term,normalized_term,type,canonical_value,priority,relation_type,strength,active,version)
        VALUES (?,?,?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE term=VALUES(term),priority=VALUES(priority),relation_type=VALUES(relation_type),
        strength=VALUES(strength),active=VALUES(active),version=version+1`, [empresaId, term, normalizedTerm, type, canonicalValue, priority, relation, strength, req.body.active === false ? 0 : 1]);
      await CacheService.invalidateNamespaces(['search', 'search-v2']);
      successResponse(res, { normalized_term: normalizedTerm, canonical_value: canonicalValue }, 'Dicionario atualizado');
    } catch (error) { const err = error as Error; errorResponse(res, 'DICTIONARY_ERROR', err.message, 500); }
  }

  static async deleteDictionary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await query('UPDATE search_dictionary SET active = 0, version = version + 1 WHERE id_empresa = ? AND id = ?', [req.user!.id_empresa, Number(req.params.id)]);
      await CacheService.invalidateNamespaces(['search', 'search-v2']);
      successResponse(res, null, 'Entrada desativada');
    } catch (error) { const err = error as Error; errorResponse(res, 'DICTIONARY_ERROR', err.message, 500); }
  }

  static async recordInteraction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const empresaId = Number(req.body.empresaId || req.user?.id_empresa || 0);
      const searchId = String(req.body.searchId || '');
      const productId = Number(req.body.productId);
      const position = Number(req.body.position);
      const event = String(req.body.event || 'click');
      if (!empresaId || !/^[0-9a-f-]{36}$/i.test(searchId) || !Number.isInteger(productId) || !Number.isInteger(position) || position < 1 || !['click', 'conversion'].includes(event)) {
        errorResponse(res, 'INVALID_SEARCH_EVENT', 'Evento de busca invalido', 400); return;
      }
      const sql = event === 'conversion'
        ? 'UPDATE search_events SET converted_at = CURRENT_TIMESTAMP WHERE search_id = ? AND id_empresa = ? AND clicked_product_id = ?'
        : 'UPDATE search_events SET clicked_product_id = ?, clicked_position = ? WHERE search_id = ? AND id_empresa = ?';
      const values = event === 'conversion' ? [searchId, empresaId, productId] : [productId, position, searchId, empresaId];
      await query(sql, values);
      successResponse(res, null, 'Evento registrado');
    } catch (error) { const err = error as Error; errorResponse(res, 'SEARCH_EVENT_ERROR', err.message, 500); }
  }
}
