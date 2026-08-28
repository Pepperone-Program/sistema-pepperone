import { SEARCH_LIMITS } from '@config/search';
import type { DictionaryEntry, ParsedSearchQuery, SearchConstraint } from '@/types/search';
import { normalizeSearchQuery } from './QueryNormalizer';

const COLORS = new Set(['azul', 'preto', 'preta', 'branco', 'branca', 'vermelho', 'vermelha', 'verde', 'amarelo', 'amarela', 'rosa', 'roxo', 'roxa', 'cinza']);
const MATERIALS: Record<string, string> = { inox: 'stainless_steel', 'aco inox': 'stainless_steel', 'aco inoxidavel': 'stainless_steel', aluminio: 'aluminum', metalica: 'metal', metalico: 'metal', couro: 'leather', plastica: 'plastic', plastico: 'plastic' };
const PRODUCT_TYPES = new Set(['bloco', 'garrafa', 'caneta', 'kit', 'copo', 'mochila', 'caderno', 'agenda', 'squeeze', 'chaveiro', 'sacola']);
const COLOR_CANONICAL: Record<string, string> = { azul: 'azul', preto: 'preto', preta: 'preto', branco: 'branco', branca: 'branco',
  vermelho: 'vermelho', vermelha: 'vermelho', verde: 'verde', amarelo: 'amarelo', amarela: 'amarelo', rosa: 'rosa', roxo: 'roxo', roxa: 'roxo', cinza: 'cinza' };
const PHRASES: Array<{ phrase: string; constraint: SearchConstraint }> = [
  { phrase: 'sem pauta', constraint: { key: 'lined', value: false, strength: 'HARD', confidence: 1, source: 'PHRASE', contradictionValues: [true] } },
  { phrase: 'com pauta', constraint: { key: 'lined', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
  { phrase: 'parede dupla', constraint: { key: 'double_wall', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
  { phrase: 'dupla camada', constraint: { key: 'double_wall', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
  { phrase: 'parede simples', constraint: { key: 'double_wall', value: false, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [true] } },
  { phrase: 'capa dura', constraint: { key: 'hard_cover', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
  { phrase: 'capa flexivel', constraint: { key: 'hard_cover', value: false, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [true] } },
  { phrase: 'sem tampa', constraint: { key: 'lid', value: false, strength: 'HARD', confidence: 1, source: 'PHRASE', contradictionValues: [true] } },
  { phrase: 'com tampa', constraint: { key: 'lid', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
  { phrase: 'sem alca', constraint: { key: 'handle', value: false, strength: 'HARD', confidence: 1, source: 'PHRASE', contradictionValues: [true] } },
  { phrase: 'com alca', constraint: { key: 'handle', value: true, strength: 'STRONG', confidence: 1, source: 'PHRASE', contradictionValues: [false] } },
];

const numberValue = (value: string): number => Number(value.replace(',', '.'));

export class QueryParser {
  static parse(rawQuery: string, dictionary: DictionaryEntry[] = []): ParsedSearchQuery {
    const base = normalizeSearchQuery(rawQuery);
    const constraints: SearchConstraint[] = [];
    const phrases: string[] = [];
    const consumed = new Set<string>();

    const allPhrases = [...PHRASES, ...dictionary.filter((entry) => entry.type === 'PHRASE' || entry.type === 'ATTRIBUTE').map((entry) => ({
      phrase: entry.normalizedTerm,
      constraint: { key: entry.canonicalValue, value: true, strength: entry.strength, confidence: 1, source: 'PHRASE' as const },
    }))].sort((a, b) => b.phrase.length - a.phrase.length);

    for (const item of allPhrases) {
      if (phrases.length >= SEARCH_LIMITS.maxPhrases || constraints.length >= SEARCH_LIMITS.maxConstraints) break;
      if (base.normalized.includes(item.phrase)) {
        phrases.push(item.phrase);
        constraints.push(item.constraint);
        item.phrase.split(' ').forEach((token) => consumed.add(token));
      }
    }

    const measurements: ParsedSearchQuery['measurements'] = {};
    const composition = base.normalized.match(/\b(1|2|3|4|5|uma?|duas?|tres|quatro|cinco)\s+(tacas?|copos?|canetas?|blocos?|garrafas?)\b/);
    if (composition) {
      const numberWords: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };
      const quantity = numberWords[composition[1]] || Number(composition[1]);
      const containedType = composition[2].replace(/s$/, '');
      constraints.push({ key: `contains:${containedType}`, value: quantity, strength: 'STRONG', confidence: 0.95, source: 'PHRASE' });
      phrases.push(composition[0]);
      composition[0].split(' ').forEach((token) => consumed.add(token));
    }
    const capacity = base.normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|l|litros?)\b/);
    if (capacity) {
      const value = numberValue(capacity[1]);
      measurements.capacityMl = Math.round(capacity[2].startsWith('l') ? value * 1000 : value);
      constraints.push({ key: 'capacity_ml', value: measurements.capacityMl, strength: 'STRONG', confidence: 1, source: 'MEASUREMENT' });
      consumed.add(capacity[1]); consumed.add(capacity[2]);
    }
    const inches = base.normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:"|polegadas?)\b/);
    if (inches) {
      measurements.screenInches = numberValue(inches[1]);
      constraints.push({ key: 'screen_inches', value: measurements.screenInches, strength: 'STRONG', confidence: 1, source: 'MEASUREMENT' });
    }

    const dictionaryByTerm = new Map(dictionary.map((entry) => [entry.normalizedTerm, entry]));
    let productType: ParsedSearchQuery['productType'];
    const materials: string[] = [];
    const colors: string[] = [];
    const synonyms: string[] = [];
    for (const token of base.tokens) {
      const entry = dictionaryByTerm.get(token);
      if (!productType && (entry?.type === 'PRODUCT_TYPE' || PRODUCT_TYPES.has(token))) {
        productType = { value: entry?.canonicalValue || (token === 'squeeze' ? 'garrafa' : token), confidence: entry ? 1 : 0.85 };
        consumed.add(token);
      }
      const material = entry?.type === 'MATERIAL' ? entry.canonicalValue : MATERIALS[token];
      if (material && token !== 'metalizada' && token !== 'metalizado') {
        materials.push(material); consumed.add(token);
        constraints.push({ key: 'material', value: material, strength: 'STRONG', confidence: 0.9, source: 'TOKEN' });
      }
      if (entry?.type === 'SYNONYM') synonyms.push(entry.canonicalValue);
      if (COLORS.has(token)) {
        const color = COLOR_CANONICAL[token];
        colors.push(color); consumed.add(token);
        constraints.push({ key: 'color', value: color, strength: 'SOFT', confidence: 0.8, source: 'TOKEN' });
      }
      if (/^a[456]$/.test(token)) {
        constraints.push({ key: 'paper_size', value: token.toUpperCase(), strength: 'STRONG', confidence: 1, source: 'TOKEN' });
        consumed.add(token);
      }
      if (token === 'pauta' || token === 'pautado') {
        constraints.push({ key: 'lined', value: true, strength: 'STRONG', confidence: 0.9, source: 'TOKEN', contradictionValues: [false] });
        consumed.add(token);
      } else if (token === 'liso') {
        constraints.push({ key: 'lined', value: false, strength: 'STRONG', confidence: 0.9, source: 'TOKEN', contradictionValues: [true] });
        consumed.add(token);
      }
    }
    if (base.tokens.includes('termica') || base.tokens.includes('termico')) {
      constraints.push({ key: 'thermal', value: true, strength: 'STRONG', confidence: 0.9, source: 'TOKEN', contradictionValues: [false] });
      consumed.add('termica'); consumed.add('termico');
    }

    const positiveTerms = base.tokens.filter((token) => !consumed.has(token));
    return {
      ...base, productType, constraints: constraints.slice(0, SEARCH_LIMITS.maxConstraints), materials: Array.from(new Set(materials)),
      colors: Array.from(new Set(colors)), measurements, positiveTerms, negativeTerms: [], phrases,
      unknownTerms: positiveTerms.filter((term) => !dictionaryByTerm.has(term)), synonyms: Array.from(new Set(synonyms)),
    };
  }
}
