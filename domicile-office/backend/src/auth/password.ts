import crypto from 'crypto';

export const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1
};
const KEY_LEN = 64;
const SALT_LEN = 16;

const SYNTHETIC_SALT = '0123456789abcdef0123456789abcdef';
const SYNTHETIC_KEY = '0'.repeat(128);
const SYNTHETIC_HASH = `scrypt$16384$8$1$${SYNTHETIC_SALT}$${SYNTHETIC_KEY}`;

export function hashPassword(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const derivedKey = crypto.scryptSync(plaintext, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex');
  return `scrypt$16384$8$1$${salt}$${derivedKey}`;
}

export function verifyPassword(plaintext: string, storedHash: string): boolean {
  if (typeof plaintext !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = parts[4];
  const storedKeyHex = parts[5];

  if (!salt || !storedKeyHex || isNaN(N) || isNaN(r) || isNaN(p)) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(plaintext, salt, KEY_LEN, { N, r, p });
    const storedKeyBuffer = Buffer.from(storedKeyHex, 'hex');

    if (derivedKey.length !== storedKeyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, storedKeyBuffer);
  } catch {
    return false;
  }
}

export function dummyVerification(candidatePassword?: string): void {
  try {
    const safePass = typeof candidatePassword === 'string' ? candidatePassword : 'dummy';
    verifyPassword(safePass, SYNTHETIC_HASH);
  } catch {
    // ignore
  }
}
