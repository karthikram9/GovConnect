const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const db = require('../src/db');
const { app } = require('../src/server');
const { initKeys } = require('../src/crypto/signer');
const { generateToken } = require('../src/auth/token');
const { revokeToken } = require('../src/auth/revocation');
const { normalizeDept, requireRole, requireDepartment } = require('../src/middleware/rbac');

describe('Social Welfare Department — RBAC & Adversarial Boundary Tests', () => {
  let server;
  let baseUrl;
  let useMockDb = false;

  const TEST_API_KEY = 'social-welfare-test-secret-key-2026';
  const TEST_TOKEN_SECRET = 'test-token-secret-for-social-welfare-testing-32bytes';

  let swdAdminToken;
  let swdIssuerToken;
  let swdReviewerToken;
  let revenueIssuerToken;
  let revenueAdminToken;
  let revokedSwdToken;

  const mockCitizens = [
    {
      id: 1,
      applicant_name: 'Ramesh Kumar Patil',
      date_of_birth: '1988-04-12',
      caste_category: 'OBC',
      caste_name: 'Kunbi',
      certificate_number: 'MS-CC-2023-001089',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    }
  ];
  const mockIssued = [];

  before(async () => {
    process.env.ISSUER_API_KEY = TEST_API_KEY;
    process.env.AUTH_TOKEN_SECRET = TEST_TOKEN_SECRET;
    initKeys();

    swdAdminToken = generateToken({ sub: 'swd_admin', role: 'ADMIN', dept: 'social-welfare' }, 7200, TEST_TOKEN_SECRET);
    swdIssuerToken = generateToken({ sub: 'swd_issuer', role: 'ISSUER_OFFICER', dept: 'social-welfare' }, 7200, TEST_TOKEN_SECRET);
    swdReviewerToken = generateToken({ sub: 'swd_reviewer', role: 'REVIEW_OFFICER', dept: 'social-welfare' }, 7200, TEST_TOKEN_SECRET);
    revenueIssuerToken = generateToken({ sub: 'rev_issuer', role: 'ISSUER_OFFICER', dept: 'revenue' }, 7200, TEST_TOKEN_SECRET);
    revenueAdminToken = generateToken({ sub: 'rev_admin', role: 'ADMIN', dept: 'revenue' }, 7200, TEST_TOKEN_SECRET);

    const jtiToRevoke = 'revoked-jti-swd-test';
    revokedSwdToken = generateToken({ sub: 'swd_revoked', role: 'ISSUER_OFFICER', dept: 'social-welfare', jti: jtiToRevoke }, 7200, TEST_TOKEN_SECRET);
    revokeToken(jtiToRevoke);

    const isConnected = await db.checkConnection();
    if (!isConnected) {
      useMockDb = true;
      db.setQueryHandler(async (sql, params = []) => {
        const queryStr = sql.toLowerCase();
        if (queryStr.includes('select id, applicant_name')) {
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

  test('1. normalizeDept correctly normalizes department formats', () => {
    assert.strictEqual(normalizeDept('social_welfare'), 'social-welfare');
    assert.strictEqual(normalizeDept('social-welfare'), 'social-welfare');
    assert.strictEqual(normalizeDept('Social_Welfare'), 'social-welfare');
  });

  test('2. Public endpoints remain accessible without authentication', async () => {
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.strictEqual(resHealth.status, 200);

    const resPub = await fetch(`${baseUrl}/public-key`);
    assert.strictEqual(resPub.status, 200);
  });

  test('3. GET /admin requires authentication (401 without Bearer token)', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    assert.strictEqual(res.status, 401);
  });

  test('4. GET /admin rejects user from another department with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/admin`, {
      headers: { 'Authorization': `Bearer ${revenueAdminToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'FORBIDDEN');
  });

  test('5. GET /admin rejects user with unauthorized role (e.g. REVIEW_OFFICER) with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/admin`, {
      headers: { 'Authorization': `Bearer ${swdReviewerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'FORBIDDEN');
  });

  test('6. GET /admin allows authorized Social Welfare ADMIN and ISSUER_OFFICER (200 OK)', async () => {
    const resAdmin = await fetch(`${baseUrl}/admin`, {
      headers: { 'Authorization': `Bearer ${swdAdminToken}` }
    });
    assert.strictEqual(resAdmin.status, 200);

    const resIssuer = await fetch(`${baseUrl}/admin`, {
      headers: { 'Authorization': `Bearer ${swdIssuerToken}` }
    });
    assert.strictEqual(resIssuer.status, 200);
  });

  test('7. GET /citizens rejects cross-department access with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/citizens`, {
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  test('8. GET /citizens/:id rejects cross-department access with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/citizens/1`, {
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  test('9. GET /issued-credentials rejects cross-department access with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issued-credentials`, {
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  test('10. POST /issue-credential/:id rejects cross-department Bearer token with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revenueIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Forbidden');
  });

  test('11. POST /issue-credential/:id rejects REVIEW_OFFICER Bearer token with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${swdReviewerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'Forbidden');
  });

  test('12. POST /issue-credential/:id rejects revoked Bearer token with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${revokedSwdToken}` }
    });
    assert.strictEqual(res.status, 401);
  });

  test('13. POST /issue-credential/:id succeeds with authorized Social Welfare Bearer token (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/issue-credential/1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${swdIssuerToken}` }
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.credential);
    assert.strictEqual(body.issuer, 'social-welfare-dept-maharashtra');
  });

  test('14. Service X-API-Key CANNOT access /admin, /citizens, or /issued-credentials (401 Unauthorized)', async () => {
    const resAdmin = await fetch(`${baseUrl}/admin`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resAdmin.status, 401);

    const resCitizens = await fetch(`${baseUrl}/citizens`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resCitizens.status, 401);

    const resCitizenId = await fetch(`${baseUrl}/citizens/1`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resCitizenId.status, 401);

    const resIssued = await fetch(`${baseUrl}/issued-credentials`, {
      headers: { 'X-API-Key': TEST_API_KEY }
    });
    assert.strictEqual(resIssued.status, 401);
  });
});
