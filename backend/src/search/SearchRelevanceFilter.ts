import type { ParsedSearchQuery, RankedSearchCandidate } from '@/types/search';
import { normalizeComparable } from './QueryNormalizer';

export interface RelevanceBuckets {
  primary: RankedSearchCandidate[];
  tail: RankedSearchCandidate[];
}

const containsTerm = (text: string, term: string): boolean =>
  new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?=\\s|$)`, 'u').test(text);

const hasConstraint = (item: RankedSearchCandidate, key: string, value: string | number | boolean): boolean => {
  const candidate = item.product;
  if (key === 'capacity_ml') return candidate.capacity_ml === Number(value);
  if (key === 'material') return candidate.material_key === String(value);
  if (key === 'color') return candidate.color_key === String(value);
  if (key.startsWith('contains:')) return candidate.contained_quantities[key.slice('contains:'.length)] === Number(value);
  return (candidate.attributes[key] || []).some((candidateValue) => String(candidateValue) === String(value));
};

const hasRequiredTerms = (parsed: ParsedSearchQuery, item: RankedSearchCandidate): boolean => {
  const name = normalizeComparable(item.product.name_search || item.product.produto);
  const acceptedTerms = new Set([ ...parsed.positiveTerms, ...parsed.synonyms ].filter((term) => term.length >= 2));
  return [...acceptedTerms].every((term) => containsTerm(name, term));
};

const hasRequiredConstraints = (parsed: ParsedSearchQuery, item: RankedSearchCandidate): boolean =>
  parsed.constraints
    .filter((constraint) => constraint.strength !== 'SOFT')
    .every((constraint) => hasConstraint(item, constraint.key, constraint.value));

/**
 * Final public-response gate. Retrieval can be broad enough to preserve recall,
 * but only type/term/attribute verified candidates are allowed into primary results.
 */
export const splitRelevantCandidates = (parsed: ParsedSearchQuery, ranked: RankedSearchCandidate[]): RelevanceBuckets => {
  const eligible = ranked.filter((item) => !item.hardContradiction && item.contradictions === 0);
  const primary = eligible.filter((item) => {
    const typeMatches = !parsed.productType || item.primaryTypeMatch;
    return typeMatches && hasRequiredTerms(parsed, item) && hasRequiredConstraints(parsed, item);
  });

  // A secondary result must still be demonstrably connected to the request. For a
  // typed query, only a kit/documented composition containing that type is eligible.
  const tailCandidates = eligible.filter((item) => {
    if (primary.includes(item) || !hasRequiredTerms(parsed, item) || !hasRequiredConstraints(parsed, item)) return false;
    return Boolean(parsed.productType && item.relatedOnly);
  });
  const tailLimit = primary.length >= 10 ? Math.floor(primary.length * 0.1) : 0;
  return { primary, tail: tailCandidates.slice(0, tailLimit) };
};
