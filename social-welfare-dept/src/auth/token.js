const crypto = require('crypto');
const { isTokenRevoked } = require('./revocation');

const TOKEN_LIFETIME_SECONDS = 7200; // 2 hours
const CLOCK_SKEW_SECONDS = 60;        // 60 seconds clock skew allowance

/**
 * Retrieves the HMAC signing secret from environment.
 * Throws if missing or insecure in non-test environments.
 * @returns {string}
 */
function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    if (process.env.NODE_ENV === 'test') {
      return 'test-fallback-secret-key-must-be-long-enough-32bytes';
    }
    throw new Error('FATAL: AUTH_TOKEN_SECRET is not configured in environment variables.');
  }
  return secret;
}

/**
 * Issues a signed HMAC-SHA256 Bearer token conforming strictly to Phase 4A specification.
 * 
 * @param {object} claims
 * @param {string} claims.sub - Username or user ID
 * @param {string} claims.role - Operational role
 * @param {string} claims.dept - Department identifier
 * @param {string} [claims.jti] - Optional JTI (generated if omitted)
 * @param {number} [expiresInSeconds] - Optional custom lifetime
 * @param {string} [customSecret] - Optional secret override for testing
 * @returns {string} Signed token: header.payload.signature
 */
function generateToken(claims, expiresInSeconds = TOKEN_LIFETIME_SECONDS, customSecret = null) {
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

  const payload = {
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

/**
 * Validates and decodes a signed HMAC-SHA256 Bearer token.
 * 
 * @param {string} tokenString
 * @param {string} [customSecret]
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function verifyToken(tokenString, customSecret = null) {
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

  // 1. Decode and strictly enforce header algorithm
  let header;
  try {
    const headerJson = Buffer.from(encodedHeader, 'base64url').toString('utf8');
    header = JSON.parse(headerJson);
  } catch (err) {
    return { valid: false, error: 'MALFORMED_HEADER_JSON' };
  }

  if (!header || typeof header !== 'object' || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, error: 'UNSUPPORTED_OR_INCORRECT_ALGORITHM' };
  }

  if (!signature) {
    return { valid: false, error: 'MALFORMED_TOKEN_SEGMENTS' };
  }

  // 2. Cryptographic signature check
  let secret;
  try {
    secret = customSecret || getSecret();
  } catch (err) {
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

  // 3. Decode and validate payload claims
  let payload;
  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch (err) {
    return { valid: false, error: 'MALFORMED_PAYLOAD_JSON' };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'INVALID_PAYLOAD' };
  }

  // Enforce mandatory claims
  const requiredClaims = ['sub', 'role', 'dept', 'jti', 'iat', 'exp'];
  for (const claim of requiredClaims) {
    if (payload[claim] === undefined || payload[claim] === null || payload[claim] === '') {
      return { valid: false, error: `MISSING_REQUIRED_CLAIM_${claim.toUpperCase()}` };
    }
  }

  // 4. Timestamp / Expiry checks (allowing 60 seconds clock skew)
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== 'number' || now > payload.exp + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'TOKEN_ISSUED_IN_FUTURE' };
  }

  // 5. Revocation check
  if (isTokenRevoked(payload.jti)) {
    return { valid: false, error: 'TOKEN_REVOKED' };
  }

  return { valid: true, payload };
}

module.exports = {
  generateToken,
  verifyToken,
  getSecret,
  TOKEN_LIFETIME_SECONDS,
  CLOCK_SKEW_SECONDS
};
