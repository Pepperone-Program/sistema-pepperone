import { SEARCH_LIMITS } from '@config/search';
import type { NormalizedSearchQuery } from '@/types/search';

export const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeComparable = (value: string): string =>
  stripAccents(value.normalize('NFKC'))
    .toLocaleLowerCase('pt-BR')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function normalizeSearchQuery(query: string): NormalizedSearchQuery {
  const original = String(query ?? '').slice(0, SEARCH_LIMITS.maxLength);
  const normalized = normalizeComparable(original);
  const tokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, SEARCH_LIMITS.maxTokens);

  return { original, normalized: tokens.join(' '), tokens };
}
