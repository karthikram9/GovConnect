const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');

const { hashPassword, verifyPassword, dummyVerification } = require('../src/auth/password');
const { generateToken, verifyToken } = require('../src/auth/token');
const { revokeToken, isTokenRevoked, clearRevocations } = require('../src/auth/revocation');
const { isLoginRateLimited, recordFailedLogin, clearRateLimits } = require('../src/auth/rateLimiter');
const { findUserByUsername, setUserFinder } = require('../src/auth/users');
const { app } = require('../src/server');

const TEST_SECRET = 'test-swd-auth-secret-key-32-bytes-long-for-hmac-sha256-compliance!';

describe('Social Welfare Department — Authentication Foundation Unit & Adversarial Tests', () => {
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

  test('1. Passwords are scrypt hashed with unique salts and verified with timing-safe comparison', () => {
    const rawPass = 'Secret#Password2026!';
    const hash1 = hashPassword(rawPass);
    const hash2 = hashPassword(rawPass);

    assert.notStrictEqual(hash1, hash2, 'Salts must be unique per hash');
    assert.ok(hash1.startsWith('scrypt$16384$8$1$'), 'Must use scrypt format with correct parameters');
    assert.strictEqual(verifyPassword(rawPass, hash1), true);
    assert.strictEqual(verifyPassword('WrongPassword123!', hash1), false);
  });

  test('2. Synthetic dummy verification executes cleanly', () => {
    assert.doesNotThrow(() => {
      dummyVerification('candidatePassword');
    });
  });

  test('3. Token generation includes required claims (sub, role, dept, jti, iat, exp)', () => {
    const token = generateToken({
      sub: 'swd_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'social_welfare'
    }, 7200, TEST_SECRET);

    const verified = verifyToken(token, TEST_SECRET);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.sub, 'swd_officer_01');
    assert.strictEqual(verified.payload.role, 'ISSUER_OFFICER');
    assert.strictEqual(verified.payload.dept, 'social_welfare');
    assert.ok(verified.payload.jti);
    assert.ok(verified.payload.iat);
    assert.ok(verified.payload.exp);
  });

  test('4. Expired tokens are rejected', () => {
    const expiredToken = generateToken({
      sub: 'swd_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'social_welfare'
    }, -70, TEST_SECRET);

    const res = verifyToken(expiredToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'TOKEN_EXPIRED');
  });

  test('5. Adversarial: Tampered token payload is rejected with INVALID_SIGNATURE', () => {
    const token = generateToken({
      sub: 'swd_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'social_welfare'
    }, 7200, TEST_SECRET);

    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    payload.role = 'ADMIN';
    const forgedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const forgedToken = `${parts[0]}.${forgedPayloadB64}.${parts[2]}`;

    const res = verifyToken(forgedToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'INVALID_SIGNATURE');
  });

  test('6. Adversarial: Algorithm confusion (alg: "none") is rejected', () => {
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify({
      sub: 'swd_admin_01',
      role: 'ADMIN',
      dept: 'social_welfare',
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
    const wrongSecret = 'wrong-swd-secret-32-bytes-long-padding!';
    const token = generateToken({
      sub: 'swd_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'social_welfare'
    }, 7200, wrongSecret);

    const res = verifyToken(token, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'INVALID_SIGNATURE');
  });

  test('8. Logout revokes token JTI and prevents token reuse', () => {
    const jti = crypto.randomUUID();
    const token = generateToken({
      sub: 'swd_officer_01',
      role: 'ISSUER_OFFICER',
      dept: 'social_welfare',
      jti
    }, 7200, TEST_SECRET);

    assert.strictEqual(verifyToken(token, TEST_SECRET).valid, true);

    revokeToken(jti);
    assert.strictEqual(isTokenRevoked(jti), true);

    const res = verifyToken(token, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'TOKEN_REVOKED');
  });

  test('9. Repeated failed login attempts trigger rate limiting (5 attempts max)', () => {
    const testIp = '10.0.0.50';

    for (let i = 0; i < 4; i++) {
      recordFailedLogin(testIp);
      assert.strictEqual(isLoginRateLimited(testIp), false);
    }

    recordFailedLogin(testIp);
    assert.strictEqual(isLoginRateLimited(testIp), true);
  });

  test('10. POST /auth/login succeeds with valid credentials and returns Bearer token', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'swd_officer_01',
        password: 'Password#2026!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.strictEqual(body.tokenType, 'Bearer');
    assert.strictEqual(body.expiresIn, 7200);
    assert.strictEqual(body.user.username, 'swd_officer_01');
    assert.strictEqual(body.user.role, 'ISSUER_OFFICER');
    assert.strictEqual(body.user.department, 'social_welfare');
  });

  test('11. POST /auth/login fails with invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'swd_officer_01',
        password: 'BadPassword#123'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'UNAUTHORIZED');
  });

  test('12. POST /auth/logout followed by /auth/me rejects revoked token', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'swd_officer_01',
        password: 'Password#2026!'
      })
    });
    const { token } = await loginRes.json();

    const meRes1 = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes1.status, 200);

    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(logoutRes.status, 200);

    const meRes2 = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(meRes2.status, 401);
  });
});
