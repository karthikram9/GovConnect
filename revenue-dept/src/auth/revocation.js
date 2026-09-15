/**
 * In-memory TTL-aware token revocation store.
 * 
 * IMPORTANT LIMITATION (Phase 4A Prototype Scope):
 * This revocation registry is held entirely in server process memory.
 * It is effective for single-process prototype runtime, but:
 * 1. Does NOT survive server process restarts.
 * 2. Does NOT synchronize across multiple horizontal cluster instances.
 * Distributed production implementations require an external synchronized store (e.g., Redis).
 */

// Map of jti -> exp (Unix epoch seconds)
const revokedTokens = new Map();

/**
 * Revokes a token by recording its JTI and expiry timestamp.
 * @param {string} jti - Unique token identifier
 * @param {number} exp - Token expiration timestamp (Unix seconds)
 */
function revokeToken(jti, exp) {
  if (!jti || typeof jti !== 'string') return;
  const expiry = typeof exp === 'number' ? exp : Math.floor(Date.now() / 1000) + 7200;
  revokedTokens.set(jti, expiry);
  cleanupExpiredRevocations();
}

/**
 * Checks whether a token JTI has been revoked.
 * @param {string} jti - Unique token identifier
 * @returns {boolean} True if revoked
 */
function isTokenRevoked(jti) {
  if (!jti || typeof jti !== 'string') return false;
  return revokedTokens.has(jti);
}

/**
 * Purges expired tokens from the revocation registry to avoid memory leaks.
 */
function cleanupExpiredRevocations() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (nowSec > exp + 60) {
      revokedTokens.delete(jti);
    }
  }
}

/**
 * Resets the revocation store (useful for tests).
 */
function clearRevocations() {
  revokedTokens.clear();
}

module.exports = {
  revokeToken,
  isTokenRevoked,
  cleanupExpiredRevocations,
  clearRevocations
};
