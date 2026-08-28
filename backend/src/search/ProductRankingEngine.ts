import { SEARCH_WEIGHTS } from '@config/search';
import type { ParsedSearchQuery, RankedSearchCandidate, SearchCandidate, SearchScoreBreakdown } from '@/types/search';
import { normalizeComparable } from './QueryNormalizer';

const hasValue = (candidate: SearchCandidate, key: string, expected: string | number | boolean): boolean => {
  if (key.startsWith('contains:')) return candidate.contained_quantities[key.slice('contains:'.length)] === Number(expected);
  if (key === 'capacity_ml') return candidate.capacity_ml === Number(expected);
  if (key === 'material') return candidate.material_key === String(expected);
  if (key === 'color') return candidate.color_key === String(expected);
  return (candidate.attributes[key] || []).some((value) => String(value) === String(expected));
};

export class ProductRankingEngine {
  static rank(parsed: ParsedSearchQuery, candidates: SearchCandidate[]): RankedSearchCandidate[] {
    return candidates.map((candidate) => this.score(parsed, candidate)).sort((a, b) => {
      if (a.primaryTypeMatch !== b.primaryTypeMatch) return a.primaryTypeMatch ? -1 : 1;
      if (a.contradictions !== b.contradictions) return a.contradictions - b.contradictions;
      if (a.group !== b.group) return a.group - b.group;
      if (a.matchedConstraints !== b.matchedConstraints) return b.matchedConstraints - a.matchedConstraints;
      if (a.score.total !== b.score.total) return b.score.total - a.score.total;
      return Number(b.product.id_produto) - Number(a.product.id_produto);
    });
  }

  private static score(parsed: ParsedSearchQuery, product: SearchCandidate): RankedSearchCandidate {
    const name = normalizeComparable(product.name_search || product.produto);
    const primaryTypeMatch = Boolean(parsed.productType && product.canonical_product_type === parsed.productType.value);
    const containedTypeMatch = Boolean(parsed.productType && product.contained_types.includes(parsed.productType.value));
    let matchedConstraints = 0;
    let contradictions = 0;
    let hardContradiction = false;
    let constraintPoints = 0;
    let material = 0, capacity = 0, color = 0;
    for (const constraint of parsed.constraints) {
      const matched = hasValue(product, constraint.key, constraint.value);
      if (matched) {
        matchedConstraints += 1;
        constraintPoints += SEARCH_WEIGHTS.constraint;
        if (constraint.key === 'material') material = SEARCH_WEIGHTS.material;
        if (constraint.key === 'capacity_ml') capacity = SEARCH_WEIGHTS.capacity;
        if (constraint.key === 'color') color = SEARCH_WEIGHTS.color;
      } else if (constraint.contradictionValues?.some((value) => hasValue(product, constraint.key, value))) {
        contradictions += 1;
        if (constraint.strength === 'HARD' && constraint.confidence >= 0.9) hardContradiction = true;
      }
    }
    const totalConstraints = parsed.constraints.length;
    if (totalConstraints > 0 && matchedConstraints === totalConstraints) constraintPoints += SEARCH_WEIGHTS.allConstraints;
    const breakdown: SearchScoreBreakdown = {
      exactName: name === parsed.normalized ? SEARCH_WEIGHTS.exactName : 0,
      namePrefix: name.startsWith(parsed.normalized) ? SEARCH_WEIGHTS.namePrefix : 0,
      phrase: parsed.phrases.some((phrase) => name.includes(phrase)) ? SEARCH_WEIGHTS.phrase : 0,
      productType: primaryTypeMatch ? SEARCH_WEIGHTS.primaryType : 0,
      containedType: !primaryTypeMatch && containedTypeMatch ? SEARCH_WEIGHTS.containedType : 0,
      constraints: constraintPoints, material, capacity, color,
      synonym: parsed.synonyms.some((term) => name.includes(term) || product.search_text.includes(term)) ? SEARCH_WEIGHTS.synonym : 0,
      fulltextName: product.fulltext_name_score * SEARCH_WEIGHTS.fulltextName,
      fulltextSearch: product.fulltext_search_score * SEARCH_WEIGHTS.fulltextSearch,
      typeMismatch: parsed.productType && !primaryTypeMatch && !containedTypeMatch ? SEARCH_WEIGHTS.typeMismatch : 0,
      contradiction: contradictions * SEARCH_WEIGHTS.contradiction,
      popularity: product.popularity_score * SEARCH_WEIGHTS.popularity,
      total: 0,
    };
    breakdown.total = Object.entries(breakdown).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0);
    return { product, group: totalConstraints - matchedConstraints, matchedConstraints, totalConstraints, contradictions, hardContradiction,
      primaryTypeMatch, relatedOnly: !primaryTypeMatch && containedTypeMatch, score: breakdown };
  }
}
