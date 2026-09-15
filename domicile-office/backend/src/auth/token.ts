import crypto from 'crypto';
import { isTokenRevoked } from './revocation.js';

export const TOKEN_LIFETIME_SECONDS = 7200; // 2 hours
export const CLOCK_SKEW_SECONDS = 60;

export interface TokenClaims {
  sub: string;
  role: string;
  dept: string;
  jti?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface VerificationResult {
  valid: boolean;
  payload?: TokenClaims;
  error?: string;
}

export function getSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-fallback-secret-key-must-be-long-enough-32bytes';
    }
    throw new Error('FATAL: AUTH_TOKEN_SECRET is not configured in environment variables.');
  }
  return secret;
}

export function generateToken(
  claims: TokenClaims,
  expiresInSeconds: number = TOKEN_LIFETIME_SECONDS,
  customSecret: string | null = null
): string {
  const secret = customSecret || getSecret();

  if (!claims || typeof claims !== 'object') {
    throw new Error('Claims must be a valid object');
  }
  if (!claims.sub || !claims.role || !claims.dept) {
    throw new Error('Claims must include sub, role, and dept');
  }

  const now = Math.floor(Date.now() / 1000);
  const jti = claims.jti || crypto.randomUUID();

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload: TokenClaims = {
    sub: String(claims.sub),
    role: String(claims.role),
    dept: String(claims.dept),
    jti: String(jti),
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

export function verifyToken(tokenString: string, customSecret: string | null = null): VerificationResult {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, error: 'MISSING_OR_INVALID_TOKEN_STRING' };
  }

  const parts = tokenString.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'MALFORMED_TOKEN_STRUCTURE' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  if (!encodedHeader || !encodedPayload) {
    return { valid: false, error: 'MALFORMED_TOKEN_SEGMENTS' };
  }

  // 1. Enforce algorithm strictly
  let header: { alg?: string; typ?: string };
  try {
    const headerJson = Buffer.from(encodedHeader, 'base64url').toString('utf8');
    header = JSON.parse(headerJson);
  } catch {
    return { valid: false, error: 'MALFORMED_HEADER_JSON' };
  }

  if (!header || typeof header !== 'object' || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, error: 'UNSUPPORTED_OR_INCORRECT_ALGORITHM' };
  }

  if (!signature) {
    return { valid: false, error: 'MALFORMED_TOKEN_SEGMENTS' };
  }

  // 2. Cryptographic signature check
  let secret: string;
  try {
    secret = customSecret || getSecret();
  } catch {
    return { valid: false, error: 'SECRET_UNAVAILABLE' };
  }

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64url');

  const providedSigBuf = Buffer.from(signature, 'utf8');
  const expectedSigBuf = Buffer.from(expectedSignature, 'utf8');

  if (providedSigBuf.length !== expectedSigBuf.length) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  if (!crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  // 3. Decode & validate payload claims
  let payload: TokenClaims;
  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, error: 'MALFORMED_PAYLOAD_JSON' };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'INVALID_PAYLOAD' };
  }

  const requiredClaims = ['sub', 'role', 'dept', 'jti', 'iat', 'exp'];
  for (const claim of requiredClaims) {
    if (payload[claim] === undefined || payload[claim] === null || payload[claim] === '') {
      return { valid: false, error: `MISSING_REQUIRED_CLAIM_${claim.toUpperCase()}` };
    }
  }

  // 4. Timestamp & Expiry checks
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== 'number' || now > payload.exp + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'TOKEN_ISSUED_IN_FUTURE' };
  }

  // 5. Revocation check
  if (isTokenRevoked(payload.jti as string)) {
    return { valid: false, error: 'TOKEN_REVOKED' };
  }

  return { valid: true, payload };
}
