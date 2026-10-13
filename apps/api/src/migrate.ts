import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createPool, rows, write } from './db.js';
import { loadConfig } from './config.js';

const pool = createPool(loadConfig());
try {
  const sql = await readFile(resolve('apps/api/migrations/001-initial.sql'), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  await write(
    pool,
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const existing = (
    await rows(pool, 'SELECT checksum FROM schema_migrations WHERE version = 1')
  )[0];
  if (existing && existing.checksum !== checksum)
    throw new Error('An applied migration was modified. Add a new migration instead.');
  if (!existing) {
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await write(pool, statement);
    await write(pool, 'INSERT INTO schema_migrations(version, checksum) VALUES(1, ?)', [checksum]);
  }
  console.log('Database schema is current.');
} finally {
  await pool.end();
}
