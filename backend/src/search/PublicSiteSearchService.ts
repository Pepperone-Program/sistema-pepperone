import type { Produto } from '@/types/produto';
import type { PublicSearchOptions, SearchResult } from '@/types/search';
import { ProductSearchService } from './ProductSearchService';

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
  items: result.results, total: result.total, page: options.page,
  limit: options.limit, rankingVersion: result.rankingVersion, searchId: result.searchId, nextCursor: result.nextCursor,
});

export class PublicSiteSearchService {
  static async search(options: PublicSearchOptions): Promise<SiteSearchPage> {
    return advancedToPage(await ProductSearchService.search(options), options);
  }
}
