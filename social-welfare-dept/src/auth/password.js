const crypto = require('crypto');

// Scrypt parameters conforming to RFC 7914 and Phase 4A specification
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost
  r: 8,     // block size
  p: 1      // parallelization
};
const KEY_LEN = 64; // 64 bytes = 512 bits
const SALT_LEN = 16; // 16 bytes = 128 bits

// Synthetic salt and hash for constant-time nonexistent-user path
const SYNTHETIC_SALT = '0123456789abcdef0123456789abcdef';
const SYNTHETIC_KEY = '0'.repeat(128);
const SYNTHETIC_HASH = `scrypt$16384$8$1$${SYNTHETIC_SALT}$${SYNTHETIC_KEY}`;

/**
 * Hashes a plaintext password using native scrypt.
 * @param {string} plaintext - Raw password string
 * @returns {string} Serialized hash: scrypt$16384$8$1$<saltHex>$<derivedKeyHex>
 */
function hashPassword(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_LEN).toString('hex');
  const derivedKey = crypto.scryptSync(plaintext, salt, KEY_LEN, SCRYPT_PARAMS).toString('hex');
  return `scrypt$16384$8$1$${salt}$${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using constant-time comparison.
 * @param {string} plaintext - Password attempt
 * @param {string} storedHash - Formatted scrypt hash
 * @returns {boolean} True if password matches
 */
function verifyPassword(plaintext, storedHash) {
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
  } catch (err) {
    return false;
  }
}

/**
 * Executes a synthetic scrypt verification against a dummy hash
 * to ensure timing parity when an account does not exist.
 * @param {string} candidatePassword
 */
function dummyVerification(candidatePassword) {
  try {
    const safePass = typeof candidatePassword === 'string' ? candidatePassword : 'dummy';
    verifyPassword(safePass, SYNTHETIC_HASH);
  } catch (_) {}
}

module.exports = {
  hashPassword,
  verifyPassword,
  dummyVerification,
  SCRYPT_PARAMS
};
