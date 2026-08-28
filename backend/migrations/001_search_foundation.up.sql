CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS search_dictionary (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_empresa INT NOT NULL,
  term VARCHAR(200) NOT NULL,
  normalized_term VARCHAR(200) NOT NULL,
  type ENUM('PRODUCT_TYPE','ATTRIBUTE','MATERIAL','MATERIAL_GROUP','COLOR','SYNONYM','PHRASE','RELATED_TERM','NEGATION') NOT NULL,
  canonical_value VARCHAR(200) NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  relation_type ENUM('EXACT_SYNONYM','RELATED_TERM','BROADER_TERM','NARROWER_TERM','CONTRADICTION') NULL,
  strength ENUM('HARD','STRONG','SOFT') NOT NULL DEFAULT 'SOFT',
  active TINYINT(1) NOT NULL DEFAULT 1,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_search_dictionary_tenant_term (id_empresa, normalized_term, type, canonical_value),
  KEY idx_search_dictionary_lookup (id_empresa, active, normalized_term, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_attribute_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_empresa INT NOT NULL,
  attribute_key VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  value_type ENUM('BOOLEAN','TEXT','NUMBER') NOT NULL,
  searchable TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_search_attribute_key (id_empresa, attribute_key),
  UNIQUE KEY uq_search_attribute_owner (id_empresa, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_attribute_values (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_empresa INT NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  canonical_value VARCHAR(200) NOT NULL,
  label VARCHAR(200) NOT NULL,
  contradicts_value VARCHAR(200) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_search_attribute_value (id_empresa, attribute_definition_id, canonical_value),
  CONSTRAINT fk_search_attribute_values_definition FOREIGN KEY (id_empresa, attribute_definition_id)
    REFERENCES search_attribute_definitions (id_empresa, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_search_attributes (
  id_empresa INT NOT NULL,
  id_produto INT NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value_text VARCHAR(300) NULL,
  value_number DECIMAL(18,4) NULL,
  value_boolean TINYINT(1) NULL,
  source ENUM('MANUAL','IMPORT','DERIVED') NOT NULL DEFAULT 'MANUAL',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa, id_produto, attribute_definition_id),
  KEY idx_product_search_attribute_value (id_empresa, attribute_definition_id, value_text, value_number, value_boolean),
  CONSTRAINT fk_product_search_attributes_definition FOREIGN KEY (id_empresa, attribute_definition_id)
    REFERENCES search_attribute_definitions (id_empresa, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_contains_types (
  id_empresa INT NOT NULL,
  id_produto INT NOT NULL,
  canonical_product_type VARCHAR(100) NOT NULL,
  quantity SMALLINT UNSIGNED NULL,
  source ENUM('MANUAL','IMPORT','DERIVED') NOT NULL DEFAULT 'MANUAL',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa, id_produto, canonical_product_type),
  KEY idx_product_contains_lookup (id_empresa, canonical_product_type, id_produto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_search_documents (
  id_empresa INT NOT NULL,
  id_produto INT NOT NULL,
  name_search TEXT NOT NULL,
  search_text TEXT NOT NULL,
  canonical_product_type VARCHAR(100) NULL,
  capacity_ml INT NULL,
  material_key VARCHAR(100) NULL,
  color_key VARCHAR(100) NULL,
  popularity_score DECIMAL(14,4) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  source_hash CHAR(64) NOT NULL,
  document_version INT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_empresa, id_produto),
  KEY idx_product_search_type (id_empresa, is_public, canonical_product_type, id_produto),
  KEY idx_product_search_material_capacity (id_empresa, is_public, material_key, capacity_ml, id_produto),
  KEY idx_product_search_color (id_empresa, is_public, color_key, id_produto),
  KEY idx_product_search_popular (id_empresa, is_public, popularity_score, id_produto),
  FULLTEXT KEY ft_product_search_name (name_search),
  FULLTEXT KEY ft_product_search_text (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_events (
  search_id CHAR(36) NOT NULL,
  id_empresa INT NOT NULL,
  ranking_version VARCHAR(50) NOT NULL,
  query_hash CHAR(64) NOT NULL,
  normalized_query VARCHAR(200) NULL,
  filters_json JSON NULL,
  result_count INT UNSIGNED NOT NULL,
  candidate_count INT UNSIGNED NOT NULL,
  database_duration_ms DECIMAL(12,3) NOT NULL,
  parser_duration_ms DECIMAL(12,3) NOT NULL,
  ranking_duration_ms DECIMAL(12,3) NOT NULL,
  total_duration_ms DECIMAL(12,3) NOT NULL,
  cache_status VARCHAR(20) NOT NULL,
  fallback_used TINYINT(1) NOT NULL DEFAULT 0,
  clicked_product_id INT NULL,
  clicked_position SMALLINT UNSIGNED NULL,
  converted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (search_id),
  KEY idx_search_events_tenant_date (id_empresa, created_at),
  KEY idx_search_events_ranking_date (ranking_version, created_at),
  KEY idx_search_events_query (id_empresa, query_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO search_attribute_definitions (id_empresa, attribute_key, label, value_type)
SELECT DISTINCT id_empresa, seed.attribute_key, seed.label, seed.value_type
FROM produtos CROSS JOIN (
  SELECT 'lined' attribute_key, 'Pautado' label, 'BOOLEAN' value_type UNION ALL
  SELECT 'double_wall', 'Parede dupla', 'BOOLEAN' UNION ALL
  SELECT 'hard_cover', 'Capa dura', 'BOOLEAN' UNION ALL
  SELECT 'thermal', 'Termico', 'BOOLEAN' UNION ALL
  SELECT 'lid', 'Tampa', 'BOOLEAN' UNION ALL
  SELECT 'handle', 'Alca', 'BOOLEAN' UNION ALL
  SELECT 'paper_size', 'Tamanho de papel', 'TEXT' UNION ALL
  SELECT 'screen_inches', 'Polegadas', 'NUMBER'
) seed;
