export const SEARCH_LIMITS = {
  minLength: 2,
  maxLength: 200,
  maxTokens: 20,
  maxPhrases: 8,
  maxConstraints: 12,
  maxPage: 100,
  maxLimit: 100,
  candidateLimit: 300,
} as const;

export const SEARCH_RANKING_VERSION = process.env.SEARCH_RANKING_VERSION || 'v1';
export const SEARCH_DOCUMENT_VERSION = 1;
export const SEARCH_CACHE_TTL_SECONDS = Number(process.env.SEARCH_CACHE_TTL_SECONDS || 300);

export const SEARCH_WEIGHTS = {
  exactName: 9000,
  namePrefix: 6000,
  phrase: 5000,
  primaryType: 10000,
  allConstraints: 4000,
  constraint: 2000,
  material: 2000,
  capacity: 2000,
  color: 1000,
  synonym: 1000,
  containedType: -3000,
  typeMismatch: -2000,
  contradiction: -10000,
  fulltextName: 250,
  fulltextSearch: 80,
  popularity: 1,
} as const;
