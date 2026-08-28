import { promises as fs } from 'fs';
import path from 'path';
import { getConnection, query } from './connection';

const migrationsDirectory = path.resolve(__dirname, '../../migrations');
const splitStatements = (sql: string): string[] => sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean);

export async function migrate(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  const files = (await fs.readdir(migrationsDirectory)).filter((file) => file.endsWith('.up.sql')).sort();
  const applied = await query('SELECT version FROM schema_migrations') as Array<{ version: string }>;
  const versions = new Set(applied.map((row) => row.version));
  for (const file of files) {
    const version = file.replace('.up.sql', '');
    if (versions.has(version)) continue;
    const connection = await getConnection();
    try {
      const sql = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
      for (const statement of splitStatements(sql)) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
      console.log(`Applied migration ${version}`);
    } finally { connection.release(); }
  }
}

export async function rollback(): Promise<void> {
  const rows = await query('SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1') as Array<{ version: string }>;
  const version = rows[0]?.version;
  if (!version) { console.log('No migration to rollback'); return; }
  const sql = await fs.readFile(path.join(migrationsDirectory, `${version}.down.sql`), 'utf8');
  const connection = await getConnection();
  try {
    for (const statement of splitStatements(sql)) await connection.query(statement);
    await connection.execute('DELETE FROM schema_migrations WHERE version = ?', [version]);
    console.log(`Rolled back migration ${version}`);
  } finally { connection.release(); }
}
