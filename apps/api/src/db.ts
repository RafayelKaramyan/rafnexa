import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise';
import type { Config } from './config.js';

export type Database = Pool | PoolConnection;
export type SqlValue = string | number | boolean | null | Date | Buffer;
export type Row = RowDataPacket & Record<string, unknown>;
export function createPool(config: Config): Pool {
  const url = new URL(config.databaseUrl);
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectionLimit: 8,
    waitForConnections: true,
    queueLimit: 30,
    ...(config.databaseSsl
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(config.databaseCa ? { ca: config.databaseCa } : {}),
          },
        }
      : {}),
  });
}
export async function rows(db: Database, sql: string, values: SqlValue[] = []): Promise<Row[]> {
  const [result] = await db.execute<Row[]>(sql, values);
  return result;
}
export async function write(
  db: Database,
  sql: string,
  values: SqlValue[] = [],
): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, values);
  return result;
}
export async function transaction<T>(
  pool: Pool,
  run: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
