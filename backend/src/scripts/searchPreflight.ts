import '../module-alias';
import { closeDatabasePool, query } from '@database/connection';

const run = async (): Promise<void> => {
  const versionRows = await query('SELECT VERSION() version') as Array<{ version: string }>;
  const version = versionRows[0]?.version || '';
  const mariaMatch = version.match(/^(\d+)\.(\d+).*MariaDB/i);
  const mysqlMatch = version.match(/^(\d+)\.(\d+)/);
  const supported = mariaMatch
    ? Number(mariaMatch[1]) > 10 || (Number(mariaMatch[1]) === 10 && Number(mariaMatch[2]) >= 3)
    : Boolean(mysqlMatch && Number(mysqlMatch[1]) >= 8);
  if (!supported) throw new Error(`Database version ${version} is not supported; require MariaDB >= 10.3 or MySQL >= 8.0`);
  const checks: Array<[string, string, unknown[]?]> = [
    ['version', 'SELECT VERSION() version, DATABASE() database_name'],
    ['fulltext_variables', `SHOW VARIABLES WHERE Variable_name IN ('innodb_ft_min_token_size','innodb_ft_max_token_size','innodb_ft_enable_stopword','character_set_server','collation_server')`],
    ['product_volume', `SELECT id_empresa, COUNT(*) total, SUM(site='S' AND habilitado='S') public_products FROM produtos GROUP BY id_empresa ORDER BY id_empresa`],
    ['product_columns', `SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='produtos' ORDER BY ORDINAL_POSITION`],
    ['product_indexes', `SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) columns_list FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='produtos' GROUP BY INDEX_NAME,NON_UNIQUE,INDEX_TYPE ORDER BY INDEX_NAME`],
    ['product_ddl', 'SHOW CREATE TABLE produtos'],
    ['legacy_search_explain', `EXPLAIN FORMAT=JSON SELECT id_produto FROM produtos WHERE id_empresa = ? AND site = 'S' AND habilitado = 'S' AND produto LIKE ? ORDER BY data_modificacao DESC LIMIT 20`, [Number(process.env.SEARCH_PREFLIGHT_EMPRESA_ID || 1), '%garrafa%']],
  ];
  for (const [name, sql, values] of checks) {
    console.log(`\n### ${name}`);
    console.log(JSON.stringify(await query(sql, values), null, 2));
  }
  console.log(`\n### compatibility\n${JSON.stringify({ version, supported: true, dialect: mariaMatch ? 'mariadb' : 'mysql' }, null, 2)}`);
};

run().then(closeDatabasePool).catch(async (error) => { console.error(error); await closeDatabasePool(); process.exit(1); });
