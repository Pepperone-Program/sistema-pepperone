import { SEARCH_LIMITS, SEARCH_RANKING_VERSION } from '@config/search';
import { ProdutoModel } from '@models/Produto';
import type { Produto } from '@/types/produto';
import type { PublicSearchOptions, SearchResult } from '@/types/search';
import { isAdvancedSearchEnabled } from './SearchFeatureFlag';
import { ProductRankingEngine } from './ProductRankingEngine';
import { ProductSearchService } from './ProductSearchService';
import { QueryParser } from './QueryParser';
import { LegacyCandidateRetriever } from './LegacyCandidateRetriever';

export interface SiteSearchPage {
  items: Produto[];
  total: number;
  page: number;
  limit: number;
  rankingVersion: string;
  searchId?: string;
  nextCursor?: string | null;
}

const advancedToPage = (result: SearchResult, options: PublicSearchOptions): SiteSearchPage => ({
  items: [...result.results, ...result.relatedResults], total: result.total, page: options.page,
  limit: options.limit, rankingVersion: result.rankingVersion, searchId: result.searchId, nextCursor: result.nextCursor,
});

export class PublicSiteSearchService {
  static async search(options: PublicSearchOptions): Promise<SiteSearchPage> {
    if (isAdvancedSearchEnabled(options.empresaId, options.sessionId)) {
      try {
        return advancedToPage(await ProductSearchService.search(options), options);
      } catch (error) {
        console.warn('[ProductSearch] advanced schema unavailable; using intelligent legacy ranking', {
          empresaId: options.empresaId, message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const parsed = QueryParser.parse(options.query);
    if (parsed.normalized.length < SEARCH_LIMITS.minLength) {
      throw Object.assign(new Error('Informe ao menos 2 caracteres'), { code: 'INVALID_SEARCH', statusCode: 400 });
    }
    const candidates = await LegacyCandidateRetriever.retrieve(options.empresaId, parsed);
    const ranked = ProductRankingEngine.rank(parsed, candidates).filter((item) => !item.hardContradiction);
    const primary = ranked.filter((item) => !item.relatedOnly && item.contradictions === 0);
    const related = ranked.filter((item) => item.relatedOnly || item.contradictions > 0);
    const ordered = [...primary, ...related];
    const offset = (options.page - 1) * options.limit;
    const selected = ordered.slice(offset, offset + options.limit);
    const images = await ProdutoModel.findImagesByProductIds(selected.map((item) => Number(item.product.id_produto)));
    return {
      items: selected.map((item) => ({ ...item.product, imagens: images.get(Number(item.product.id_produto)) || [] })),
      total: ordered.length, page: options.page, limit: options.limit, rankingVersion: `${SEARCH_RANKING_VERSION}-legacy-schema`,
    };
  }
}
