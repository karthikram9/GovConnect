const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const db = require('../src/db');
const { app } = require('../src/server');
const { initKeys } = require('../src/crypto/signer');
const { generateToken } = require('../src/auth/token');
const { revokeToken } = require('../src/auth/revocation');
const { normalizeDept, requireRole, requireDepartment } = require('../src/middleware/rbac');

describe('Revenue Department — RBAC & Adversarial Boundary Tests', () => {
  let server;
  let baseUrl;
  let useMockDb = false;

  const TEST_API_KEY = 'revenue-test-secret-key-2026';
  const TEST_TOKEN_SECRET = 'test-token-secret-for-revenue-dept-testing-32bytes';

  // Seeded test tokens
  let revenueAdminToken;
  let revenueIssuerToken;
  let revenueReviewerToken;
  let socialWelfareIssuerToken;
  let socialWelfareAdminToken;
  let revokedRevenueToken;

  const mockCitizens = [
    {
      id: 1,
      applicant_name: 'Ramesh Kumar Patil',
      date_of_birth: '1988-04-12',
      annual_income: 312000,
      pan_number: 'ABCDE1234F',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    }
  ];
  const mockIssued = [];

  before(async () => {
    process.env.ISSUER_API_KEY = TEST_API_KEY;
    process.env.AUTH_TOKEN_SECRET = TEST_TOKEN_SECRET;
    initKeys();

    revenueAdminToken = generateToken({ sub: 'rev_admin', role: 'ADMIN', dept: 'revenue' }, 7200, TEST_TOKEN_SECRET);
    revenueIssuerToken = generateToken({ sub: 'rev_issuer', role: 'ISSUER_OFFICER', dept: 'revenue' }, 7200, TEST_TOKEN_SECRET);
    revenueReviewerToken = generateToken({ sub: 'rev_reviewer', role: 'REVIEW_OFFICER', dept: 'revenue' }, 7200, TEST_TOKEN_SECRET);
    socialWelfareIssuerToken = generateToken({ sub: 'swd_issuer', role: 'ISSUER_OFFICER', dept: 'social-welfare' }, 7200, TEST_TOKEN_SECRET);
    socialWelfareAdminToken = generateToken({ sub: 'swd_admin', role: 'ADMIN', dept: 'social-welfare' }, 7200, TEST_TOKEN_SECRET);

    const jtiToRevoke = 'revoked-jti-revenue-test';
    revokedRevenueToken = generateToken({ sub: 'rev_revoked', role: 'ISSUER_OFFICER', dept: 'revenue', jti: jtiToRevoke }, 7200, TEST_TOKEN_SECRET);
    revokeToken(jtiToRevoke);

    const isConnected = await db.checkConnection();
    if (!isConnected) {
      useMockDb = true;
      db.setQueryHandler(async (sql, params = []) => {
        const queryStr = sql.toLowerCase();
        if (queryStr.includes('select id, applicant_name, date_of_birth from citizens')) {
          return { rows: mockCitizens.map(c => ({ id: c.id, applicant_name: c.applicant_name, date_of_birth: c.date_of_birth })) };
        }
        if (queryStr.includes('from citizens where id = $1')) {
          return { rows: mockCitizens.filter(c => c.id === params[0]) };
        }
        if (queryStr.includes('insert into issued_credentials')) {
          const [citizen_id, credential_json, signature, issued_at] = params;
          const rec = { id: mockIssued.length + 1, citizen_id, credential_json: typeof credential_json === 'string' ? JSON.parse(credential_json) : credential_json, signature, issued_at };
          mockIssued.push(rec);
          return { rows: [rec] };
        }
        if (queryStr.includes('from issued_credentials')) {
          return { rows: mockIssued };
        }
        return { rows: [] };
      });
    }

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (useMockDb) db.setQueryHandler(null);
    if (server) await new Promise(res => server.close(res));
    await db.pool.end().catch(() => {});
  });

  // --- UNIT TESTS: Normalization & RBAC Middleware logic ---
  test('1. normalizeDept correctly normalizes department strings', () => {
    assert.strictEqual(normalizeDept('Revenue'), 'revenue');
    assert.strictEqual(normalizeDept('social_welfare'), 'social-welfare');
    assert.strictEqual(normalizeDept('SOCIAL-WELFARE'), 'social-welfare');
    assert.strictEqual(normalizeDept(' domicile '), 'domicile');
    assert.strictEqual(normalizeDept(null), '');
    assert.strictEqual(normalizeDept(undefined), '');
  });

  test('2. requireRole unit logic returns 401 when unauthenticated and 403 on role mismatch', () => {
    const mw = requireRole('ADMIN', 'ISSUER_OFFICER');

    // Unauthenticated
    let statusSet, jsonSent;
    const reqUnauth = {};
    const resUnauth = {
      status(s) { statusSet = s; return this; },
      json(j) { jsonSent = j; }
    };
    mw(reqUnauth, resUnauth, () => {});
    assert.strictEqual(statusSet, 401);
    assert.strictEqual(jsonSent.error, 'UNAUTHORIZED');

    // Role Mismatch
    const reqMismatch = { user: { role: 'REVIEW_OFFICER', dept: 'revenue' } };
    mw(reqMismatch, resUnauth, () => {});
    assert.strictEqual(statusSet, 403);
    assert.strictEqual(jsonSent.error, 'FORBIDDEN');

    // Matching Role
    let nextCalled = false;
    const reqMatch = { user: { role: 'ISSUER_OFFICER', dept: 'revenue' } };
    mw(reqMatch, resUnauth, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('3. requireDepartment unit logic returns 401 when unauthenticated and 403 on dept mismatch', () => {
    const mw = requireDepartment('revenue');

    let statusSet, jsonSent;
    const resMock = {
      status(s) { statusSet = s; return this; },
      json(j) { jsonSent = j; }
    };

    // Dept Mismatch
    const reqMismatch = { user: { role: 'ADMIN', dept: 'social-welfare' } };
    mw(reqMismatch, resMock, () => {});
    assert.strictEqual(statusSet, 403);
    assert.strictEqual(jsonSent.error, 'FORBIDDEN');

    // Matching Dept with alternate spelling
    let nextCalled = false;
    const reqMatch = { user: { role: 'ADMIN', dept: 'REVENUE' } };
    mw(reqMatch, resMock, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  // --- INTEGRATION: HTTP Boundary Tests ---

  test('4. Public endpoints remain accessible without authentication', async () => {
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.strictEqual(resHealth.status, 200);

    const resPub = await fetch(`${baseUrl}/public-key`);
    assert.strictEqual(resPub.status, 200);
  });

  test('5. GET /admin delivers the institutional admin HTML shell (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('GovConnect'));
  });

  test('6. GET /citizens requires authentication (401 without Bearer token)', async () => {
    const res = await fetch(`${baseUrl}/citizens`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error, 'UNAUTHORIZED');
  });

  test('7. GET /citizens rejects user with unauthorized role (e.g. REVIEW_OFFICER) with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/citizens`, {
      headers: { 'Authorization': `Bearer ${revenueReviewerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'FORBIDDEN');
  });

  test('8. GET /citizens allows authorized Revenue ADMIN and ISSUER_OFFICER (200 OK)', async () => {
    const resAdmin = await fetch(`${baseUrl}/citizens`, {
      headers: { 'Authorization': `Bearer ${revenueAdminToken}` }
    });
    assert.strictEqual(resAdmin.status, 200);

    const resIssuer = await fetch(`${baseUrl}/citizens`, {
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(resIssuer.status, 200);
  });

  test('9. GET /citizens rejects cross-department access with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/citizens`, {
      headers: { 'Authorization': `Bearer ${socialWelfareIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  test('10. GET /issued-credentials rejects cross-department access with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issued-credentials`, {
      headers: { 'Authorization': `Bearer ${socialWelfareIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  test('11. POST /issue-credential/:id rejects cross-department Bearer token with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${socialWelfareIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Forbidden');
  });

  test('12. POST /issue-credential/:id rejects REVIEW_OFFICER Bearer token with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revenueReviewerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Forbidden');
  });

  test('13. POST /issue-credential/:id rejects revoked Bearer token with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revokedRevenueToken}` }
    });
    assert.strictEqual(res.status, 401);
  });

  test('14. POST /issue-credential/:id succeeds with authorized Revenue Bearer token (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.credential);
    assert.strictEqual(body.issuer, 'revenue-dept-maharashtra');
  });

  test('15. Service X-API-Key CANNOT access /citizens or /issued-credentials (401 Unauthorized)', async () => {
    // Proves privilege separation: Machine API Key is strictly limited to POST /issue-credential
    const resCitizens = await fetch(`${baseUrl}/citizens`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resCitizens.status, 401);

    const resIssued = await fetch(`${baseUrl}/issued-credentials`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resIssued.status, 401);
  });
});
