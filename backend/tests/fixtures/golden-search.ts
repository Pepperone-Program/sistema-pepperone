export const requiredGoldenQueries = [
  'bloco', 'bloco pauta', 'bloco com pauta', 'bloco sem pauta', 'garrafa', 'garrafa inox',
  'garrafa parede dupla', 'garrafa termica parede dupla', 'garrafa termica inox 500ml', 'caneta',
  'caneta metalica', 'caneta aluminio', 'kit', 'kit vinho', 'kit vinho duas tacas', 'copo',
  'copo termico', 'copo termico 500ml', 'mochila', 'mochila notebook', 'mochila notebook 15.6 polegadas',
] as const;

// Variants make the automated corpus reach 150 deterministic cases. Product-ID judgments
// are intentionally kept out until a catalog export is approved and anonymized.
export const parserGoldenQueries = Array.from({ length: 150 }, (_, index) => {
  const base = requiredGoldenQueries[index % requiredGoldenQueries.length];
  const variant = index % 3 === 0 ? base.toUpperCase() : index % 3 === 1 ? `  ${base}  ` : base.replace('termica', 'térmica');
  return { id: index + 1, query: variant, canonicalQuery: base };
});
