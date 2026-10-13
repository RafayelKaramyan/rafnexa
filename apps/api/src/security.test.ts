import { describe, expect, it } from 'vitest';
import { constantEqual, hashPassword, verifyPassword, randomToken, tokenHash } from './security.js';
import { loadConfig } from './config.js';

describe('authentication primitives', () => {
  it('salts passwords independently and rejects incorrect or absent hashes', async () => {
    const first = await hashPassword('a-long-test-password');
    const second = await hashPassword('a-long-test-password');
    expect(first).not.toEqual(second);
    expect(first).not.toContain('a-long-test-password');
    expect(await verifyPassword('a-long-test-password', first)).toBe(true);
    expect(await verifyPassword('wrong-password', first)).toBe(false);
    expect(await verifyPassword('a-long-test-password', null)).toBe(false);
  }, 60_000);
  it('generates unique opaque tokens and stores only deterministic hashes', () => {
    const first = randomToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(randomToken()).not.toBe(first);
    expect(tokenHash(first)).not.toBe(first);
    expect(tokenHash(first)).toBe(tokenHash(first));
  });
  it('compares tokens without accepting different lengths', () => {
    expect(constantEqual('abc', 'abc')).toBe(true);
    expect(constantEqual('abc', 'abd')).toBe(false);
    expect(constantEqual('abc', 'abcd')).toBe(false);
  });
  it('requires HTTPS cookies in production and TLS for remote databases', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://u:p@localhost/app',
        PUBLIC_ORIGIN: 'http://example.com',
      }),
    ).toThrow('HTTPS');
    expect(() => loadConfig({ DATABASE_URL: 'mysql://u:p@db.example.com/app' })).toThrow('TLS');
    expect(
      loadConfig({ DATABASE_URL: 'mysql://u:p@db.example.com/app', DATABASE_SSL: 'true' })
        .databaseSsl,
    ).toBe(true);
  });
});
