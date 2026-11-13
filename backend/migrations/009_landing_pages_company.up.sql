-- An older landing_pages table can predate migration 008. Keep existing rows
-- unassigned until their owning company is identified explicitly.
SET @landing_company_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'id_empresa');
SET @landing_company_sql = IF(@landing_company_column_exists = 0, 'ALTER TABLE landing_pages ADD COLUMN id_empresa INT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

-- Legacy tables may use a different name for their numeric primary key.
-- Rename that key in place so existing landing page IDs remain stable.
SET @landing_id_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'id_landing_page');
SET @landing_primary_key_column = (SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION LIMIT 1);
SET @landing_primary_key_count = (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND CONSTRAINT_NAME = 'PRIMARY');
SET @landing_primary_key_type = (SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = @landing_primary_key_column);
SET @landing_company_sql = IF(@landing_id_column_exists = 0 AND @landing_primary_key_count = 1 AND @landing_primary_key_type IN ('tinyint', 'smallint', 'mediumint', 'int', 'bigint'), CONCAT('ALTER TABLE landing_pages RENAME COLUMN `', REPLACE(@landing_primary_key_column, '`', '``'), '` TO id_landing_page'), 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

-- Bring the legacy content columns into the administrative API contract.
SET @landing_title_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'titulo');
SET @landing_legacy_title_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'TITLE');
SET @landing_company_sql = IF(@landing_title_column_exists = 0 AND @landing_legacy_title_exists > 0, 'ALTER TABLE landing_pages CHANGE COLUMN `TITLE` titulo VARCHAR(255) NOT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

SET @landing_description_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'descricao');
SET @landing_legacy_description_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'DESCRIPTION');
SET @landing_company_sql = IF(@landing_description_column_exists = 0 AND @landing_legacy_description_exists > 0, 'ALTER TABLE landing_pages CHANGE COLUMN `DESCRIPTION` descricao TEXT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

SET @landing_enabled_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'habilitado');
SET @landing_company_sql = IF(@landing_enabled_column_exists = 0, 'ALTER TABLE landing_pages ADD COLUMN habilitado CHAR(1) NOT NULL DEFAULT ''S''', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

-- Match the URL limit accepted by the API on the older 1000-character column.
SET @landing_url_length = (SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'url');
SET @landing_company_sql = IF(@landing_url_length < 2048, 'ALTER TABLE landing_pages MODIFY COLUMN url VARCHAR(2048) NOT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

-- The legacy site required these fields, but the admin form does not supply them.
-- Nullable slug values retain the existing unique index without blocking new rows.
SET @landing_keywords_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'KEYWORDS');
SET @landing_company_sql = IF(@landing_keywords_column_exists > 0, 'ALTER TABLE landing_pages MODIFY COLUMN `KEYWORDS` VARCHAR(250) NULL DEFAULT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

SET @landing_slug_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'SLUG');
SET @landing_company_sql = IF(@landing_slug_column_exists > 0, 'ALTER TABLE landing_pages MODIFY COLUMN `SLUG` VARCHAR(200) NULL DEFAULT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

SET @landing_company_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND INDEX_NAME = 'idx_landing_pages_empresa');
SET @landing_company_sql = IF(@landing_company_index_exists = 0, 'ALTER TABLE landing_pages ADD INDEX idx_landing_pages_empresa (id_empresa, id_landing_page)', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;
