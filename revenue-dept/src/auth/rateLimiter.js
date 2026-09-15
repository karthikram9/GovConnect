/**
 * In-memory sliding-window rate limiter for login brute-force protection.
 * 
 * Target Policy: Max 5 failed login attempts per IP within a 5-minute window.
 * 
 * IMPORTANT LIMITATION (Phase 4A Prototype Scope):
 * This counter is maintained in process memory.
 * 1. Restarts reset counters.
 * 2. Multi-instance deployments maintain independent counters.
 */

const failedAttempts = new Map(); // IP -> Array of timestamps (ms)
const WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_ATTEMPTS = 5;

/**
 * Checks whether an IP is currently rate-limited due to excessive failed attempts.
 * @param {string} ip
 * @returns {boolean}
 */
function isLoginRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const attempts = failedAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < WINDOW_MS);
  failedAttempts.set(ip, recent);
  return recent.length >= MAX_ATTEMPTS;
}

/**
 * Records a failed login attempt for an IP.
 * @param {string} ip
 */
function recordFailedLogin(ip) {
  if (!ip) return;
  const now = Date.now();
  const attempts = failedAttempts.get(ip) || [];
  attempts.push(now);
  failedAttempts.set(ip, attempts.filter(t => now - t < WINDOW_MS));
}

/**
 * Clears failed attempts for an IP (e.g., after successful authentication).
 * @param {string} ip
 */
function resetLoginRateLimit(ip) {
  if (!ip) return;
  failedAttempts.delete(ip);
}

/**
 * Resets all rate-limiting state (useful for tests).
 */
function clearRateLimits() {
  failedAttempts.clear();
}

module.exports = {
  isLoginRateLimited,
  recordFailedLogin,
  resetLoginRateLimit,
  clearRateLimits,
  WINDOW_MS,
  MAX_ATTEMPTS
};
