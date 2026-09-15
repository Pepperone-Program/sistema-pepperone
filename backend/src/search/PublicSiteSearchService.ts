import type { Produto } from '@/types/produto';
import type { PublicSearchOptions, SearchResult } from '@/types/search';
import { ProductSearchService } from './ProductSearchService';
import { ProdutoService } from '@services/ProdutoService';
import { ProdutoModel } from '@models/Produto';
import { CacheService } from '@services/CacheService';
import { SEARCH_LIMITS, SEARCH_RANKING_VERSION } from '@config/search';

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
    const exact = await CacheService.getOrSet(
      CacheService.buildKey('produtos', `exact-code:${options.empresaId}:${term.toLowerCase()}`),
      () => ProdutoService.findExactProductCodeForSite(options.empresaId, term),
    );
    if (exact) {
      if (options.cursor) {
        throw Object.assign(new Error('Busca por codigo utiliza page e limit, sem cursor'), { code: 'INVALID_CURSOR', statusCode: 400 });
      }
      return {
        items: [exact],
        total: 1, page: 1, limit: options.limit,
        rankingVersion: `${SEARCH_RANKING_VERSION}-literal-code-v1`, nextCursor: null,
        exactProduct: exact,
      };
    }
    if (term.toLowerCase() === 'pep') {
      if (options.cursor) {
        throw Object.assign(new Error('Catalogo completo utiliza page e limit, sem cursor'), { code: 'INVALID_CURSOR', statusCode: 400 });
      }
      const catalog = await ProdutoService.listProdutosSite(options.empresaId, options.page, options.limit);
      return { ...catalog, rankingVersion: `${SEARCH_RANKING_VERSION}-full-catalog-pep-v1`, nextCursor: null };
    }
    const intelligentOptions = { ...options, page: Math.min(options.page, SEARCH_LIMITS.maxPage) };
    const intelligent = await ProductSearchService.search(intelligentOptions);
    if (intelligent.total > 0) {
      return advancedToPage(intelligent, intelligentOptions);
    }
    if (options.cursor) {
      throw Object.assign(new Error('Fallback de busca utiliza page e limit, sem cursor'), { code: 'INVALID_CURSOR', statusCode: 400 });
    }
    const codes = await ProdutoModel.searchByCodigoLikeForSite(
      options.empresaId, term, options.page, options.limit,
    );
    if (codes.total > 0) {
      const images = await ProdutoModel.findImagesByProductIds(codes.items.map((item) => Number(item.id_produto)));
      return {
        items: codes.items.map((item) => ({ ...item, imagens: images.get(Number(item.id_produto)) || [] })),
        total: codes.total, page: options.page, limit: options.limit,
        rankingVersion: `${SEARCH_RANKING_VERSION}-literal-code-v1`, nextCursor: null,
      };
    }
    const names = await ProdutoModel.searchForSite(options.empresaId, term, options.page, options.limit);
    const images = await ProdutoModel.findImagesByProductIds(names.items.map((item) => Number(item.id_produto)));
    return {
      items: names.items.map((item) => ({ ...item, imagens: images.get(Number(item.id_produto)) || [] })),
      total: names.total, page: options.page, limit: options.limit,
      rankingVersion: `${SEARCH_RANKING_VERSION}-name-like-fallback-v1`, nextCursor: null,
      searchId: intelligent.searchId,
    };
  }
}
