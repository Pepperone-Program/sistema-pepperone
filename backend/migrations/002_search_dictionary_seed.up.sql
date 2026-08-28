INSERT IGNORE INTO search_dictionary
  (id_empresa,term,normalized_term,type,canonical_value,priority,relation_type,strength,active,version)
SELECT DISTINCT p.id_empresa, seed.term, seed.normalized_term, seed.type, seed.canonical_value,
  seed.priority, seed.relation_type, seed.strength, 1, 1
FROM produtos p CROSS JOIN (
  SELECT 'garrafinha' term, 'garrafinha' normalized_term, 'SYNONYM' type, 'garrafa' canonical_value, 100 priority, 'EXACT_SYNONYM' relation_type, 'STRONG' strength UNION ALL
  SELECT 'squeeze', 'squeeze', 'PRODUCT_TYPE', 'garrafa', 100, 'NARROWER_TERM', 'HARD' UNION ALL
  SELECT 'aco inox', 'aco inox', 'MATERIAL', 'stainless_steel', 100, 'EXACT_SYNONYM', 'STRONG' UNION ALL
  SELECT 'aco inoxidavel', 'aco inoxidavel', 'MATERIAL', 'stainless_steel', 100, 'EXACT_SYNONYM', 'STRONG' UNION ALL
  SELECT 'inox', 'inox', 'MATERIAL', 'stainless_steel', 100, NULL, 'STRONG' UNION ALL
  SELECT 'aluminio', 'aluminio', 'MATERIAL', 'aluminum', 100, NULL, 'STRONG' UNION ALL
  SELECT 'pautado', 'pautado', 'SYNONYM', 'com pauta', 100, 'EXACT_SYNONYM', 'STRONG'
) seed;
