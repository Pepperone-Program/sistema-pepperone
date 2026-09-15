import type { ParsedSearchQuery, RankedSearchCandidate } from '@/types/search';
import { SEARCH_LIMITS } from '@config/search';
import { normalizeComparable } from './QueryNormalizer';

const startsWord = (text: string, term: string): boolean =>
  new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'u').test(text);

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
  return [...acceptedTerms].every((term) => startsWord(name, term));
};

const hasRequiredConstraints = (parsed: ParsedSearchQuery, item: RankedSearchCandidate): boolean =>
  parsed.constraints
    .filter((constraint) => constraint.strength !== 'SOFT')
    .every((constraint) => hasConstraint(item, constraint.key, constraint.value));

/**
 * Final public-response gate. Verified type/term/attribute candidates stay first;
 * literal full-query name matches supplement them without promoting unrelated text.
 */
export const filterRelevantCandidates = (parsed: ParsedSearchQuery, ranked: RankedSearchCandidate[]): RankedSearchCandidate[] => {
  const eligible = ranked.filter((item) => !item.hardContradiction && item.contradictions === 0);
  const relevant = eligible.filter((item) => {
    const typeMatches = !parsed.productType || item.primaryTypeMatch;
    return typeMatches && hasRequiredTerms(parsed, item) && hasRequiredConstraints(parsed, item);
  });
  const relevantIds = new Set(relevant.map((item) => Number(item.product.id_produto)));
  const supplementalNameGroup = SEARCH_LIMITS.maxConstraints + 1;
  const supplemental = eligible
    .filter((item) => !relevantIds.has(Number(item.product.id_produto))
      && normalizeComparable(item.product.name_search || item.product.produto).includes(parsed.normalized))
    .sort((a, b) => b.matchedConstraints - a.matchedConstraints
      || b.score.total - a.score.total
      || Number(b.product.id_produto) - Number(a.product.id_produto))
    .map((item) => ({ ...item, group: supplementalNameGroup }));
  return [...relevant, ...supplemental];
};
