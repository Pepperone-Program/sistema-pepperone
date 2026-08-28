import type { Produto } from './produto';

export type ConstraintStrength = 'HARD' | 'STRONG' | 'SOFT';
export type DictionaryEntryType =
  | 'PRODUCT_TYPE' | 'ATTRIBUTE' | 'MATERIAL' | 'MATERIAL_GROUP'
  | 'COLOR' | 'SYNONYM' | 'PHRASE' | 'RELATED_TERM' | 'NEGATION';
export type DictionaryRelation = 'EXACT_SYNONYM' | 'RELATED_TERM' | 'BROADER_TERM' | 'NARROWER_TERM' | 'CONTRADICTION';
export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';

export interface NormalizedSearchQuery {
  original: string;
  normalized: string;
  tokens: string[];
}

export interface SearchConstraint {
  key: string;
  value: string | number | boolean;
  strength: ConstraintStrength;
  confidence: number;
  source: 'PHRASE' | 'TOKEN' | 'MEASUREMENT' | 'FILTER';
  contradictionValues?: Array<string | number | boolean>;
}

export interface DictionaryEntry {
  id: number;
  term: string;
  normalizedTerm: string;
  type: DictionaryEntryType;
  canonicalValue: string;
  priority: number;
  relationType: DictionaryRelation | null;
  strength: ConstraintStrength;
}

export interface ParsedSearchQuery extends NormalizedSearchQuery {
  productType?: { value: string; confidence: number };
  constraints: SearchConstraint[];
  materials: string[];
  colors: string[];
  measurements: {
    capacityMl?: number;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    screenInches?: number;
    weightGrams?: number;
  };
  positiveTerms: string[];
  negativeTerms: string[];
  phrases: string[];
  unknownTerms: string[];
  synonyms: string[];
}

export interface SearchCandidate extends Produto {
  name_search: string;
  search_text: string;
  canonical_product_type: string | null;
  contained_types: string[];
  contained_quantities: Record<string, number>;
  attributes: Record<string, Array<string | number | boolean>>;
  capacity_ml: number | null;
  material_key: string | null;
  color_key: string | null;
  popularity_score: number;
  fulltext_name_score: number;
  fulltext_search_score: number;
  code_match: boolean;
}

export interface SearchScoreBreakdown {
  exactName: number;
  namePrefix: number;
  phrase: number;
  productType: number;
  containedType: number;
  constraints: number;
  material: number;
  capacity: number;
  color: number;
  synonym: number;
  fulltextName: number;
  fulltextSearch: number;
  typeMismatch: number;
  contradiction: number;
  popularity: number;
  total: number;
}

export interface RankedSearchCandidate {
  product: SearchCandidate;
  group: number;
  matchedConstraints: number;
  totalConstraints: number;
  contradictions: number;
  hardContradiction: boolean;
  primaryTypeMatch: boolean;
  relatedOnly: boolean;
  score: SearchScoreBreakdown;
}

export interface SearchCursor {
  version: string;
  group: number;
  matchedConstraints: number;
  contradictions: number;
  score: number;
  productId: number;
}

export interface SearchFilters {
  categoryId?: number;
  material?: string;
  color?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface PublicSearchOptions {
  empresaId: number;
  query: string;
  limit: number;
  page: number;
  cursor?: string;
  sort: SearchSort;
  filters: SearchFilters;
  sessionId?: string;
}

export interface SearchResult {
  searchId: string;
  rankingVersion: string;
  results: Produto[];
  relatedResults: Produto[];
  total: number;
  limit: number;
  nextCursor: string | null;
  fallback: boolean;
}
