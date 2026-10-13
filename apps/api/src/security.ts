import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('hex');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function constantEqual(left: string, right: string): boolean {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt-v1:' + salt + ':' + (await derive(password, salt)).toString('hex');
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [version, salt, hash] = (stored ?? '').split(':');
  // Unknown accounts still incur the same password-derivation cost.
  const key = await derive(password, version === 'scrypt-v1' && salt ? salt : '0'.repeat(32));
  return version === 'scrypt-v1' && Boolean(hash) && constantEqual(key.toString('hex'), hash ?? '');
}
