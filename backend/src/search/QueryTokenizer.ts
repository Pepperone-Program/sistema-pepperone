const BOOLEAN_OPERATORS = /[+\-<>()~*"@]/g;
const TOKEN_ALLOWLIST = /^[\p{L}\p{N}][\p{L}\p{N}._]*$/u;

export const tokenizeSearchQuery = (normalized: string): string[] =>
  normalized.split(/\s+/).map((token) => token.replace(BOOLEAN_OPERATORS, '')).filter((token) => TOKEN_ALLOWLIST.test(token));

export const buildSafeBooleanQuery = (tokens: string[]): string =>
  Array.from(new Set(tokens))
    .filter((token) => TOKEN_ALLOWLIST.test(token) && token.length >= 2)
    .slice(0, 20)
    .map((token) => `+${token}*`)
    .join(' ');
