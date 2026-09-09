const BOOLEAN_OPERATORS = /[+\-<>()~*"@]/g;
const TOKEN_ALLOWLIST = /^[\p{L}\p{N}][\p{L}\p{N}._]*$/u;
const PORTUGUESE_CONNECTORS = new Set(['a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'por']);

export const tokenizeSearchQuery = (normalized: string): string[] =>
  normalized.split(/\s+/).map((token) => token.replace(BOOLEAN_OPERATORS, '')).filter((token) => TOKEN_ALLOWLIST.test(token));

export const significantSearchTokens = (tokens: string[]): string[] =>
  tokens.filter((token) => !PORTUGUESE_CONNECTORS.has(token));

export const buildSafeBooleanQuery = (tokens: string[]): string =>
  Array.from(new Set(tokens))
    .filter((token) => TOKEN_ALLOWLIST.test(token) && token.length >= 2)
    .slice(0, 20)
    .map((token) => `+${token}*`)
    .join(' ');
