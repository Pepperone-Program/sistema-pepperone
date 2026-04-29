import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

type DbErrorCode =
  | 'ER_ACCESS_DENIED_ERROR'
  | 'ER_DBACCESS_DENIED_ERROR'
  | 'ER_BAD_DB_ERROR'
  | 'ECONNREFUSED'
  | 'ETIMEDOUT'
  | 'UNKNOWN';

interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

const config: MySQLConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const validateConfig = (): void => {
  const missing: string[] = [];

  if (!config.host) missing.push('DB_HOST');
  if (!config.user) missing.push('DB_USER');
  if (!config.password) missing.push('DB_PASSWORD');
  if (!config.database) missing.push('DB_NAME');

  if (missing.length > 0) {
    const error = new Error(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}`
    ) as Error & { code: string; statusCode: number };
    error.code = 'DB_CONFIG_ERROR';
    error.statusCode = 500;
    throw error;
  }
};

validateConfig();

const pool = mysql.createPool(config);

const mapDbError = (error: unknown): Error & { code: string; statusCode: number } => {
  const dbError = error as { code?: DbErrorCode; message?: string };

  const mapped = new Error('Falha na conexão com o banco de dados') as Error & {
    code: string;
    statusCode: number;
  };

  switch (dbError.code) {
    case 'ER_DBACCESS_DENIED_ERROR':
      mapped.code = 'DB_ACCESS_DENIED';
      mapped.statusCode = 503;
      mapped.message =
        'Usuário sem permissão para o schema configurado. Verifique DB_NAME e GRANTs.';
      break;
    case 'ER_ACCESS_DENIED_ERROR':
      mapped.code = 'DB_AUTH_DENIED';
      mapped.statusCode = 503;
      mapped.message =
        'Autenticação no MySQL falhou. Verifique DB_USER e DB_PASSWORD.';
      break;
    case 'ER_BAD_DB_ERROR':
      mapped.code = 'DB_NOT_FOUND';
      mapped.statusCode = 503;
      mapped.message = 'Schema configurado não existe no servidor MySQL.';
      break;
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
      mapped.code = 'DB_UNREACHABLE';
      mapped.statusCode = 503;
      mapped.message = 'Servidor MySQL indisponível ou inacessível.';
      break;
    default:
      mapped.code = 'DB_QUERY_ERROR';
      mapped.statusCode = 500;
      mapped.message = dbError.message || 'Erro interno ao consultar banco de dados.';
      break;
  }

  return mapped;
};

export const getConnection = async () => {
  try {
    return await pool.getConnection();
  } catch (error) {
    throw mapDbError(error);
  }
};

export const query = async (sql: string, values?: any[]): Promise<any> => {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute(sql, values);
    return result;
  } catch (error) {
    throw mapDbError(error);
  } finally {
    connection.release();
  }
};

export const testDatabaseConnection = async (): Promise<void> => {
  const connection = await getConnection();
  try {
    await connection.execute('SELECT 1');
  } finally {
    connection.release();
  }
};

export default pool;
