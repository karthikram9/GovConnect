const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');

const { hashPassword, verifyPassword, dummyVerification } = require('../src/auth/password');
const { generateToken, verifyToken } = require('../src/auth/token');
const { revokeToken, isTokenRevoked, clearRevocations } = require('../src/auth/revocation');
const { isLoginRateLimited, recordFailedLogin, clearRateLimits } = require('../src/auth/rateLimiter');
const { findUserByUsername, setUserFinder } = require('../src/auth/users');
const { authenticateToken } = require('../src/middleware/authenticateToken');
const { app } = require('../src/server');

const TEST_SECRET = 'test-auth-secret-key-32-bytes-long-for-hmac-sha256-compliance!';

describe('Revenue Department — Authentication Foundation Unit & Adversarial Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    process.env.AUTH_TOKEN_SECRET = TEST_SECRET;
    process.env.NODE_ENV = 'test';

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    setUserFinder(null);
  });

  beforeEach(() => {
    clearRevocations();
    clearRateLimits();
  });

  // --------------------------------------------------------------------------
  // 1. Password Hashing & Verification Security
  // --------------------------------------------------------------------------
  test('1. Passwords are scrypt hashed with unique salts and verified with timing-safe comparison', () => {
    const rawPass = 'Secret#Password2026!';
    const hash1 = hashPassword(rawPass);
    const hash2 = hashPassword(rawPass);

    assert.notStrictEqual(hash1, hash2, 'Salts must be unique per hash');
    assert.ok(hash1.startsWith('scrypt$16384$8$1$'), 'Must use scrypt format with correct N, r, p parameters');

    assert.strictEqual(verifyPassword(rawPass, hash1), true);
    assert.strictEqual(verifyPassword('WrongPassword123!', hash1), false);
    assert.strictEqual(verifyPassword(rawPass, 'invalid$format'), false);
    assert.strictEqual(verifyPassword('', hash1), false);
  });

  test('2. Synthetic dummy verification executes without error for nonexistent user protection', () => {
    assert.doesNotThrow(() => {
      dummyVerification('candidatePassword');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Token Generation, Claims, & Expiry
  // --------------------------------------------------------------------------
  test('3. Token generation includes required claims (sub, role, dept, jti, iat, exp)', () => {
    const token = generateToken({
      sub: 'rev_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'revenue'
    }, 7200, TEST_SECRET);

    const verified = verifyToken(token, TEST_SECRET);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.sub, 'rev_officer_01');
    assert.strictEqual(verified.payload.role, 'ISSUER_OFFICER');
    assert.strictEqual(verified.payload.dept, 'revenue');
    assert.ok(verified.payload.jti, 'jti claim must exist');
    assert.ok(verified.payload.iat, 'iat claim must exist');
    assert.ok(verified.payload.exp, 'exp claim must exist');
    assert.strictEqual(verified.payload.exp - verified.payload.iat, 7200);
  });

  test('4. Expired tokens are rejected', () => {
    // Generate token with negative lifetime (-10 seconds)
    const expiredToken = generateToken({
      sub: 'rev_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'revenue'
    }, -70, TEST_SECRET); // beyond 60s clock skew buffer

    const res = verifyToken(expiredToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'TOKEN_EXPIRED');
  });

  // --------------------------------------------------------------------------
  // 3. Adversarial Attack Tests: Tampering, Replay, Forgery, Alg Confusion
  // --------------------------------------------------------------------------
  test('5. Adversarial: Tampered token payload is rejected with INVALID_SIGNATURE', () => {
    const token = generateToken({
      sub: 'rev_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'revenue'
    }, 7200, TEST_SECRET);

    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    payload.role = 'ADMIN'; // Attempt vertical escalation
    const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const forgedToken = `${parts[0]}.${forgedPayloadB64}.${parts[2]}`;

    const res = verifyToken(forgedToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'INVALID_SIGNATURE');
  });

  test('6. Adversarial: Algorithm confusion (alg: "none") is rejected', () => {
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify({
      sub: 'rev_admin_01',
      role: 'ADMIN',
      dept: 'revenue',
      jti: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200
    })).toString('base64url');

    const unsignedToken = `${headerB64}.${payloadB64}.`;
    const res = verifyToken(unsignedToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'UNSUPPORTED_OR_INCORRECT_ALGORITHM');
  });

  test('7. Adversarial: Token signed with wrong secret is rejected', () => {
    const wrongSecret = 'different-unauthorized-secret-key-32-bytes-long!';
    const token = generateToken({
      sub: 'rev_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'revenue'
    }, 7200, wrongSecret);

    const res = verifyToken(token, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'INVALID_SIGNATURE');
  });

  test('8. Adversarial: Malformed token structures are rejected', () => {
    assert.strictEqual(verifyToken('not.enough.parts.really').valid, false);
    assert.strictEqual(verifyToken('just-a-string').valid, false);
    assert.strictEqual(verifyToken(null).valid, false);
    assert.strictEqual(verifyToken(12345).valid, false);
  });

  // --------------------------------------------------------------------------
  // 4. Token Revocation & Logout
  // --------------------------------------------------------------------------
  test('9. Logout revokes token JTI and prevents token reuse', () => {
    const jti = crypto.randomUUID();
    const token = generateToken({
      sub: 'rev_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'revenue',
      jti
    }, 7200, TEST_SECRET);

    assert.strictEqual(verifyToken(token, TEST_SECRET).valid, true);

    // Revoke token
    revokeToken(jti);
    assert.strictEqual(isTokenRevoked(jti), true);

    const resAfterRevocation = verifyToken(token, TEST_SECRET);
    assert.strictEqual(resAfterRevocation.valid, false);
    assert.strictEqual(resAfterRevocation.error, 'TOKEN_REVOKED');
  });

  // --------------------------------------------------------------------------
  // 5. Brute-Force Rate Limiting
  // --------------------------------------------------------------------------
  test('10. Repeated failed login attempts trigger rate limiting (5 attempts max)', () => {
    const testIp = '192.168.1.100';

    for (let i = 0; i < 4; i++) {
      recordFailedLogin(testIp);
      assert.strictEqual(isLoginRateLimited(testIp), false);
    }

    recordFailedLogin(testIp); // 5th attempt
    assert.strictEqual(isLoginRateLimited(testIp), true, '5th failed attempt must trigger rate limit');
  });

  // --------------------------------------------------------------------------
  // 6. Endpoint Integration Tests: /auth/login, /auth/logout, /auth/me
  // --------------------------------------------------------------------------
  test('11. POST /auth/login succeeds with valid credentials and returns Bearer token', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rev_officer_01',
        password: 'Password#2026!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.token, 'Token must be returned');
    assert.strictEqual(body.tokenType, 'Bearer');
    assert.strictEqual(body.expiresIn, 7200);
    assert.strictEqual(body.user.username, 'rev_officer_01');
    assert.strictEqual(body.user.role, 'ISSUER_OFFICER');
    assert.strictEqual(body.user.department, 'revenue');

    // Never leak password hashes or secrets in response
    assert.strictEqual(body.password, undefined);
    assert.strictEqual(body.password_hash, undefined);
    assert.strictEqual(JSON.stringify(body).includes(TEST_SECRET), false);
  });

  test('12. POST /auth/login fails with invalid credentials and generic error', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rev_officer_01',
        password: 'WrongPassword#999'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'UNAUTHORIZED');
    assert.strictEqual(body.message, 'Invalid username or password.');
  });

  test('13. POST /auth/login fails with nonexistent user and generic error (no account enumeration)', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent_user_999',
        password: 'Password#2026!'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'UNAUTHORIZED');
    assert.strictEqual(body.message, 'Invalid username or password.');
  });

  test('14. POST /auth/logout followed by /auth/me rejects revoked token with 401', async () => {
    // 1. Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'rev_officer_01',
        password: 'Password#2026!'
      })
    });
    const { token } = await loginRes.json();

    // 2. Access /auth/me successfully
    const meRes1 = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes1.status, 200);

    // 3. Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(logoutRes.status, 200);

    // 4. Access /auth/me after logout must fail with 401
    const meRes2 = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes2.status, 401);
    const errBody = await meRes2.json();
    assert.strictEqual(errBody.error, 'UNAUTHORIZED');
  });

  test('15. Middleware rejects request with missing or malformed Authorization header', async () => {
    const noHeaderRes = await fetch(`${baseUrl}/auth/me`);
    assert.strictEqual(noHeaderRes.status, 401);

    const wrongSchemeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
    });
    assert.strictEqual(wrongSchemeRes.status, 401);

    const malformedBearerRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': 'Bearer invalid.token.structure' }
    });
    assert.strictEqual(malformedBearerRes.status, 401);
  });
});
