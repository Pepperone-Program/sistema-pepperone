-- An older landing_pages table can predate migration 008. Keep existing rows
-- unassigned until their owning company is identified explicitly.
SET @landing_company_column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'id_empresa');
SET @landing_company_sql = IF(@landing_company_column_exists = 0, 'ALTER TABLE landing_pages ADD COLUMN id_empresa INT NULL', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;

SET @landing_company_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'landing_pages' AND INDEX_NAME = 'idx_landing_pages_empresa');
SET @landing_company_sql = IF(@landing_company_index_exists = 0, 'ALTER TABLE landing_pages ADD INDEX idx_landing_pages_empresa (id_empresa, id_landing_page)', 'SELECT 1');
PREPARE landing_company_statement FROM @landing_company_sql;
EXECUTE landing_company_statement;
DEALLOCATE PREPARE landing_company_statement;
