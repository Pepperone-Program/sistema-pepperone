import type { Produto } from '@/types/produto';
import type { PublicSearchOptions, SearchResult } from '@/types/search';
import { ProductSearchService } from './ProductSearchService';
import { ProdutoService } from '@services/ProdutoService';
import { ProdutoModel } from '@models/Produto';
import { CacheService } from '@services/CacheService';
import { SEARCH_CACHE_TTL_SECONDS, SEARCH_LIMITS, SEARCH_RANKING_VERSION } from '@config/search';
import { DictionaryService } from './DictionaryService';
import { SearchCatalogReadiness } from './SearchCatalogReadiness';
import { createHash } from 'crypto';

export interface SiteSearchPage {
  items: Produto[];
  total: number;
  page: number;
  limit: number;
  rankingVersion: string;
  searchId?: string;
  nextCursor?: string | null;
  exactProduct?: Produto & { match_exato_codigo: true };
}

const advancedToPage = (result: SearchResult, options: PublicSearchOptions): SiteSearchPage => ({
  items: result.results, total: result.total, page: options.page,
  limit: options.limit, rankingVersion: result.rankingVersion, searchId: result.searchId, nextCursor: result.nextCursor,
});

export class PublicSiteSearchService {
  static async search(options: PublicSearchOptions): Promise<SiteSearchPage> {
    const term = options.query.trim();
    if (term.length < SEARCH_LIMITS.minLength || term.length > SEARCH_LIMITS.maxLength) {
      throw Object.assign(new Error('Informe entre 2 e 200 caracteres'), { code: 'INVALID_SEARCH', statusCode: 400 });
    }
    if (term.toLowerCase() === 'pep') {
      if (options.cursor) {
        throw Object.assign(new Error('Catalogo completo utiliza page e limit, sem cursor'), { code: 'INVALID_CURSOR', statusCode: 400 });
      }
      const catalog = await ProdutoService.listProdutosSite(options.empresaId, options.page, options.limit);
      return { ...catalog, rankingVersion: `${SEARCH_RANKING_VERSION}-full-catalog-pep-v1`, nextCursor: null };
    }
    const exact = await ProdutoService.findExactProductCodeForSite(options.empresaId, term);
    const codes = exact ? { items: [exact], total: 1 } : await ProdutoModel.searchByCodigoLikeForSite(
      options.empresaId, term, options.page, options.limit,
    );
    const codeLike = !/\s/.test(term) && /[a-z]/i.test(term) && /[0-9]/.test(term);
    if (exact || codes.total > 0 || codeLike) {
      if (options.cursor) {
        throw Object.assign(new Error('Busca por codigo utiliza page e limit, sem cursor'), { code: 'INVALID_CURSOR', statusCode: 400 });
      }
      const images = await ProdutoModel.findImagesByProductIds(codes.items.map((item) => Number(item.id_produto)));
      return {
        items: codes.items.map((item) => ({ ...item, imagens: images.get(Number(item.id_produto)) || [] })),
        total: codes.total, page: exact ? 1 : options.page, limit: options.limit,
        rankingVersion: `${SEARCH_RANKING_VERSION}-literal-code-v1`, nextCursor: null,
        ...(exact ? { exactProduct: exact } : {}),
      };
    }
    options = { ...options, page: Math.min(options.page, SEARCH_LIMITS.maxPage) };
    await SearchCatalogReadiness.assertReady(options.empresaId);
    const dictionaryVersion = await DictionaryService.version(options.empresaId);
    const fingerprint = createHash('sha256').update(JSON.stringify({
      term, page: options.page, limit: options.limit, cursor: options.cursor,
      sort: options.sort, filters: options.filters,
    })).digest('hex');
    const key = CacheService.buildKey('search-v2', [options.empresaId, SEARCH_RANKING_VERSION,
      'literal-code-v1', dictionaryVersion, fingerprint].join(':'));
    return CacheService.getOrSet(key,
      async () => advancedToPage(await ProductSearchService.search(options), options), SEARCH_CACHE_TTL_SECONDS);
  }
}
