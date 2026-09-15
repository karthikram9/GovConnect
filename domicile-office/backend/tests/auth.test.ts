import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import crypto from 'crypto';

import { hashPassword, verifyPassword, dummyVerification } from '../src/auth/password.js';
import { generateToken, verifyToken } from '../src/auth/token.js';
import { revokeToken, isTokenRevoked, clearRevocations } from '../src/auth/revocation.js';
import { isLoginRateLimited, recordFailedLogin, clearRateLimits } from '../src/auth/rateLimiter.js';
import { createApp } from '../src/app.js';

const TEST_SECRET = 'test-domicile-auth-secret-32-bytes-long-padding-ok!';

describe('Domicile Office — Authentication Foundation Unit & Adversarial Tests', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    process.env.AUTH_TOKEN_SECRET = TEST_SECRET;
    process.env.NODE_ENV = 'test';

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 5000;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    clearRevocations();
    clearRateLimits();
  });

  test('1. Passwords are scrypt hashed with unique salts and verified with timing-safe comparison', () => {
    const rawPass = 'OfficerPassword#2026!';
    const hash1 = hashPassword(rawPass);
    const hash2 = hashPassword(rawPass);

    assert.notStrictEqual(hash1, hash2);
    assert.ok(hash1.startsWith('scrypt$16384$8$1$'));
    assert.strictEqual(verifyPassword(rawPass, hash1), true);
    assert.strictEqual(verifyPassword('WrongPass', hash1), false);
  });

  test('2. Synthetic dummy verification executes cleanly', () => {
    assert.doesNotThrow(() => {
      dummyVerification('candidatePass');
    });
  });

  test('3. Token generation includes required claims (sub, role, dept, jti, iat, exp)', () => {
    const token = generateToken({
      sub: 'dom_officer_01',
      role: 'REVIEW_OFFICER',
      dept: 'domicile'
    }, 7200, TEST_SECRET);

    const verified = verifyToken(token, TEST_SECRET);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload?.sub, 'dom_officer_01');
    assert.strictEqual(verified.payload?.role, 'REVIEW_OFFICER');
    assert.strictEqual(verified.payload?.dept, 'domicile');
    assert.ok(verified.payload?.jti);
    assert.ok(verified.payload?.iat);
    assert.ok(verified.payload?.exp);
  });

  test('4. Expired tokens are rejected', () => {
    const expiredToken = generateToken({
      sub: 'dom_officer_01',
      role: 'REVIEW_OFFICER',
      dept: 'domicile'
    }, -70, TEST_SECRET);

    const res = verifyToken(expiredToken, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'TOKEN_EXPIRED');
  });

  test('5. Adversarial: Tampered token payload is rejected with INVALID_SIGNATURE', () => {
    const token = generateToken({
      sub: 'dom_officer_01',
      role: 'REVIEW_OFFICER',
      dept: 'domicile'
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
      sub: 'dom_admin_01',
      role: 'ADMIN',
      dept: 'domicile',
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
    const wrongSecret = 'wrong-domicile-secret-32-bytes-long!';
    const token = generateToken({
      sub: 'dom_officer_01',
      role: 'REVIEW_OFFICER',
      dept: 'domicile'
    }, 7200, wrongSecret);

    const res = verifyToken(token, TEST_SECRET);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error, 'INVALID_SIGNATURE');
  });

  test('8. Logout revokes token JTI and prevents token reuse', () => {
    const jti = crypto.randomUUID();
    const token = generateToken({
      sub: 'dom_officer_01',
      role: 'REVIEW_OFFICER',
      dept: 'domicile',
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
    const testIp = '172.16.0.10';

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
        username: 'dom_officer_01',
        password: 'Password#2026!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(body.token);
    assert.strictEqual(body.tokenType, 'Bearer');
    assert.strictEqual(body.expiresIn, 7200);
    assert.strictEqual(body.user.username, 'dom_officer_01');
    assert.strictEqual(body.user.role, 'REVIEW_OFFICER');
    assert.strictEqual(body.user.department, 'domicile');
  });

  test('11. POST /auth/login fails with invalid credentials', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dom_officer_01',
        password: 'WrongPassword#999'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json() as any;
    assert.strictEqual(body.error, 'UNAUTHORIZED');
  });

  test('12. POST /auth/logout followed by /auth/me rejects revoked token', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dom_officer_01',
        password: 'Password#2026!'
      })
    });
    const { token } = await loginRes.json() as any;

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
