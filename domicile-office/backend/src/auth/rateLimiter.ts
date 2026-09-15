/**
 * In-memory sliding-window rate limiter for login brute-force protection.
 * Target Policy: Max 5 failed login attempts per IP within a 5-minute window.
 */

const failedAttempts = new Map<string, number[]>();
export const WINDOW_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export function isLoginRateLimited(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const attempts = failedAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < WINDOW_MS);
  failedAttempts.set(ip, recent);
  return recent.length >= MAX_ATTEMPTS;
}

export function recordFailedLogin(ip: string): void {
  if (!ip) return;
  const now = Date.now();
  const attempts = failedAttempts.get(ip) || [];
  attempts.push(now);
  failedAttempts.set(ip, attempts.filter(t => now - t < WINDOW_MS));
}

export function resetLoginRateLimit(ip: string): void {
  if (!ip) return;
  failedAttempts.delete(ip);
}

export function clearRateLimits(): void {
  failedAttempts.clear();
}
