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

const revokedTokens = new Map<string, number>();

export function revokeToken(jti: string, exp?: number): void {
  if (!jti || typeof jti !== 'string') return;
  const expiry = typeof exp === 'number' ? exp : Math.floor(Date.now() / 1000) + 7200;
  revokedTokens.set(jti, expiry);
  cleanupExpiredRevocations();
}

export function isTokenRevoked(jti: string): boolean {
  if (!jti || typeof jti !== 'string') return false;
  return revokedTokens.has(jti);
}

export function cleanupExpiredRevocations(): void {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (nowSec > exp + 60) {
      revokedTokens.delete(jti);
    }
  }
}

export function clearRevocations(): void {
  revokedTokens.clear();
}
