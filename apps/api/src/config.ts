import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  PUBLIC_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().startsWith('mysql://'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_CA_CERT: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
});
export type Config = {
  environment: 'development' | 'test' | 'production';
  port: number;
  origin: string;
  databaseUrl: string;
  databaseSsl: boolean;
  databaseCa: string | undefined;
  cookieSecure: boolean;
  production: boolean;
};
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error('Invalid server configuration. Check the documented environment variables.');
  const data = parsed.data;
  const origin = new URL(data.PUBLIC_ORIGIN).origin;
  if (
    data.NODE_ENV === 'production' &&
    (new URL(origin).protocol !== 'https:' || data.COOKIE_SECURE !== 'true')
  ) {
    throw new Error('Production requires HTTPS and secure cookies.');
  }
  const url = new URL(data.DATABASE_URL);
  if (!['localhost', '127.0.0.1', 'mysql'].includes(url.hostname) && data.DATABASE_SSL !== 'true') {
    throw new Error('Remote database connections require verified TLS.');
  }
  return {
    environment: data.NODE_ENV,
    port: data.PORT,
    origin,
    databaseUrl: data.DATABASE_URL,
    databaseSsl: data.DATABASE_SSL === 'true',
    databaseCa: data.DATABASE_CA_CERT?.replace(/\\n/g, '\n'),
    cookieSecure: data.COOKIE_SECURE === 'true',
    production: data.NODE_ENV === 'production',
  };
}
