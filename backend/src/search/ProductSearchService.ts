import { randomUUID } from 'crypto';
import { SEARCH_LIMITS, SEARCH_RANKING_VERSION } from '@config/search';
import { ProdutoModel } from '@models/Produto';
import type { Produto } from '@/types/produto';
import type { PublicSearchOptions, RankedSearchCandidate, SearchResult } from '@/types/search';
import { CandidateRetriever } from './CandidateRetriever';
import { DictionaryService } from './DictionaryService';
import { ProductRankingEngine } from './ProductRankingEngine';
import { QueryParser } from './QueryParser';
import { decodeSearchCursor, encodeSearchCursor } from './SearchCursorCodec';
import { SearchAnalyticsService } from './SearchAnalyticsService';
import { SearchObservability } from './SearchObservability';

const afterCursor = (item: RankedSearchCandidate, cursor: ReturnType<typeof decodeSearchCursor>): boolean => {
  if (!cursor) return true;
  if (item.group !== cursor.group) return item.group > cursor.group;
  if (item.contradictions !== cursor.contradictions) return item.contradictions > cursor.contradictions;
  if (item.matchedConstraints !== cursor.matchedConstraints) return item.matchedConstraints < cursor.matchedConstraints;
  if (item.score.total !== cursor.score) return item.score.total < cursor.score;
  return Number(item.product.id_produto) < cursor.productId;
};

export class ProductSearchService {
  static async search(options: PublicSearchOptions): Promise<SearchResult> {
    const started = performance.now();
    const searchId = randomUUID();
    const parserStarted = performance.now();
    const dictionary = await DictionaryService.listActive(options.empresaId);
    const parsed = QueryParser.parse(options.query, dictionary);
    const parserMs = performance.now() - parserStarted;
    if (parsed.normalized.length < SEARCH_LIMITS.minLength) throw Object.assign(new Error('Informe ao menos 2 caracteres'), { code: 'INVALID_SEARCH', statusCode: 400 });
    const databaseStarted = performance.now();
    const candidates = await CandidateRetriever.retrieve(options.empresaId, parsed, options.filters);
    const databaseMs = performance.now() - databaseStarted;
    const rankingStarted = performance.now();
    const ranked = ProductRankingEngine.rank(parsed, candidates).filter((item) => !item.hardContradiction);
    if (options.sort === 'newest') {
      ranked.sort((a, b) => a.contradictions - b.contradictions || a.group - b.group ||
        String(b.product.data_inclusao).localeCompare(String(a.product.data_inclusao)) || Number(b.product.id_produto) - Number(a.product.id_produto));
    } else if (options.sort === 'popular') {
      ranked.sort((a, b) => a.contradictions - b.contradictions || a.group - b.group ||
        b.product.popularity_score - a.product.popularity_score || Number(b.product.id_produto) - Number(a.product.id_produto));
    }
    const cursor = options.cursor ? decodeSearchCursor(options.cursor) : null;
    if (options.cursor && (!cursor || cursor.version !== SEARCH_RANKING_VERSION)) throw Object.assign(new Error('Cursor de busca invalido ou expirado'), { code: 'INVALID_CURSOR', statusCode: 400 });
    const filtered = ranked.filter((item) => afterCursor(item, cursor));
    const primary = filtered.filter((item) => !item.relatedOnly && item.contradictions === 0);
    const related = filtered.filter((item) => item.relatedOnly || item.contradictions > 0);
    const selected = primary.slice(0, options.limit);
    const remaining = Math.max(0, options.limit - selected.length);
    const selectedRelated = related.slice(0, remaining);
    const pageItems = [...selected, ...selectedRelated];
    const imagesByProduct = await ProdutoModel.findImagesByProductIds(pageItems.map((item) => Number(item.product.id_produto)));
    const toProduct = (item: RankedSearchCandidate): Produto => ({ ...item.product, imagens: imagesByProduct.get(Number(item.product.id_produto)) || [] });
    const last = pageItems[pageItems.length - 1];
    const nextCursor = last && filtered.length > pageItems.length ? encodeSearchCursor({ version: SEARCH_RANKING_VERSION, group: last.group,
      matchedConstraints: last.matchedConstraints, contradictions: last.contradictions, score: last.score.total, productId: Number(last.product.id_produto) }) : null;
    const rankingMs = performance.now() - rankingStarted;
    const totalMs = performance.now() - started;
    const result: SearchResult = { searchId, rankingVersion: SEARCH_RANKING_VERSION,
      results: selected.map(toProduct), relatedResults: selectedRelated.map(toProduct), total: ranked.length, limit: options.limit, nextCursor, fallback: false };
    SearchObservability.log(searchId, options.empresaId, SEARCH_RANKING_VERSION, { databaseMs, parserMs, rankingMs, totalMs, candidateCount: candidates.length, resultCount: pageItems.length, fallback: false });
    await SearchAnalyticsService.record({ searchId, empresaId: options.empresaId, rankingVersion: SEARCH_RANKING_VERSION,
      normalizedQuery: parsed.normalized, filters: options.filters, resultCount: pageItems.length, candidateCount: candidates.length,
      databaseMs, parserMs, rankingMs, totalMs, cacheStatus: 'miss', fallback: false });
    return result;
  }

  static async debug(options: PublicSearchOptions): Promise<object> {
    const dictionary = await DictionaryService.listActive(options.empresaId);
    const parsed = QueryParser.parse(options.query, dictionary);
    const candidates = await CandidateRetriever.retrieve(options.empresaId, parsed, options.filters);
    const ranked = ProductRankingEngine.rank(parsed, candidates);
    return { rankingVersion: SEARCH_RANKING_VERSION, parsed, candidateCount: candidates.length,
      ranking: ranked.slice(0, options.limit).map((item) => ({ id_produto: item.product.id_produto, produto: item.product.produto,
        group: item.group, matchedConstraints: item.matchedConstraints, totalConstraints: item.totalConstraints,
        contradictions: item.contradictions, primaryTypeMatch: item.primaryTypeMatch, relatedOnly: item.relatedOnly, score: item.score })) };
  }
}
