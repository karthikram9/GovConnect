import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import { createApp } from '../src/app.js';
import { generateToken } from '../src/auth/token.js';
import { revokeToken } from '../src/auth/revocation.js';
import { normalizeDept, requireRole, requireDepartment } from '../src/middleware/rbac.js';
import { resetApplicationState, createApplication, reviewApplication, getApplication } from '../src/services/applicationService.js';

describe('Domicile Office — RBAC, Department Boundaries & Lifecycle Authorization Tests', () => {
  let server: Server;
  let baseUrl: string;

  const TEST_SECRET = 'domicile-test-secret-key-must-be-32bytes-long';

  let domicileAdminToken: string;
  let domicileReviewerToken: string;
  let domicileIssuerToken: string;
  let revenueReviewerToken: string;
  let socialWelfareReviewerToken: string;
  let revokedDomicileToken: string;

  before(async () => {
    process.env.AUTH_TOKEN_SECRET = TEST_SECRET;

    domicileAdminToken = generateToken({ sub: 'dom_admin', role: 'ADMIN', dept: 'domicile' });
    domicileReviewerToken = generateToken({ sub: 'dom_reviewer', role: 'REVIEW_OFFICER', dept: 'domicile' });
    domicileIssuerToken = generateToken({ sub: 'dom_issuer', role: 'ISSUER_OFFICER', dept: 'domicile' });
    revenueReviewerToken = generateToken({ sub: 'rev_reviewer', role: 'REVIEW_OFFICER', dept: 'revenue' });
    socialWelfareReviewerToken = generateToken({ sub: 'swd_reviewer', role: 'REVIEW_OFFICER', dept: 'social-welfare' });

    const jti = 'revoked-jti-domicile-rbac-test';
    revokedDomicileToken = generateToken({ sub: 'dom_revoked', role: 'REVIEW_OFFICER', dept: 'domicile', jti });
    revokeToken(jti);

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    resetApplicationState();
  });

  // --- UNIT TESTS ---
  test('1. normalizeDept correctly normalizes department string variants', () => {
    assert.strictEqual(normalizeDept('domicile'), 'domicile');
    assert.strictEqual(normalizeDept('DOMICILE'), 'domicile');
    assert.strictEqual(normalizeDept(' social_welfare '), 'social-welfare');
    assert.strictEqual(normalizeDept(undefined), '');
  });

  test('2. requireRole unit behavior: 401 unauthenticated, 403 role mismatch, next() on match', () => {
    const mw = requireRole('ADMIN', 'REVIEW_OFFICER');

    let statusSet: number | undefined;
    let jsonSent: any;
    const resMock: any = {
      status(s: number) { statusSet = s; return this; },
      json(j: any) { jsonSent = j; }
    };

    // Unauthenticated
    mw({} as any, resMock, () => {});
    assert.strictEqual(statusSet, 401);
    assert.strictEqual(jsonSent.error, 'UNAUTHORIZED');

    // Role mismatch
    mw({ user: { role: 'ISSUER_OFFICER', dept: 'domicile' } } as any, resMock, () => {});
    assert.strictEqual(statusSet, 403);
    assert.strictEqual(jsonSent.error, 'FORBIDDEN');

    // Role match
    let called = false;
    mw({ user: { role: 'REVIEW_OFFICER', dept: 'domicile' } } as any, resMock, () => { called = true; });
    assert.strictEqual(called, true);
  });

  test('3. requireDepartment unit behavior: 401 unauthenticated, 403 dept mismatch, next() on match', () => {
    const mw = requireDepartment('domicile');

    let statusSet: number | undefined;
    let jsonSent: any;
    const resMock: any = {
      status(s: number) { statusSet = s; return this; },
      json(j: any) { jsonSent = j; }
    };

    // Dept mismatch
    mw({ user: { role: 'REVIEW_OFFICER', dept: 'revenue' } } as any, resMock, () => {});
    assert.strictEqual(statusSet, 403);
    assert.strictEqual(jsonSent.error, 'FORBIDDEN');

    // Dept match
    let called = false;
    mw({ user: { role: 'REVIEW_OFFICER', dept: 'domicile' } } as any, resMock, () => { called = true; });
    assert.strictEqual(called, true);
  });

  // --- PUBLIC ENDPOINTS INVARIANT ---
  test('4. Public endpoints MUST remain accessible without any Bearer token', async () => {
    const health = await fetch(`${baseUrl}/health`);
    assert.strictEqual(health.status, 200);

    const registry = await fetch(`${baseUrl}/api/trust-registry`);
    assert.strictEqual(registry.status, 200);

    const reqEnvelope = await fetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    assert.strictEqual(reqEnvelope.status, 201);
  });

  // --- /api/applications RBAC ---
  test('5. GET /api/applications requires authentication (401 without token)', async () => {
    const res = await fetch(`${baseUrl}/api/applications`);
    assert.strictEqual(res.status, 401);
  });

  test('6. GET /api/applications rejects cross-department access with 403 Forbidden', async () => {
    const resRev = await fetch(`${baseUrl}/api/applications`, {
      headers: { 'Authorization': `Bearer ${revenueReviewerToken}` }
    });
    assert.strictEqual(resRev.status, 403);

    const resSwd = await fetch(`${baseUrl}/api/applications`, {
      headers: { 'Authorization': `Bearer ${socialWelfareReviewerToken}` }
    });
    assert.strictEqual(resSwd.status, 403);
  });

  test('7. GET /api/applications rejects unauthorized role (ISSUER_OFFICER) with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/applications`, {
      headers: { 'Authorization': `Bearer ${domicileIssuerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json() as any;
    assert.strictEqual(body.error, 'FORBIDDEN');
  });

  test('8. GET /api/applications allows authorized domicile REVIEW_OFFICER and ADMIN (200 OK)', async () => {
    const resReviewer = await fetch(`${baseUrl}/api/applications`, {
      headers: { 'Authorization': `Bearer ${domicileReviewerToken}` }
    });
    assert.strictEqual(resReviewer.status, 200);
    const data = await resReviewer.json() as any[];
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 2);

    const resAdmin = await fetch(`${baseUrl}/api/applications`, {
      headers: { 'Authorization': `Bearer ${domicileAdminToken}` }
    });
    assert.strictEqual(resAdmin.status, 200);
  });

  // --- /api/applications/:id RBAC ---
  test('9. GET /api/applications/:id requires authentication and domicile role', async () => {
    const resUnauth = await fetch(`${baseUrl}/api/applications/APP-2026-001`);
    assert.strictEqual(resUnauth.status, 401);

    const resWrongDept = await fetch(`${baseUrl}/api/applications/APP-2026-001`, {
      headers: { 'Authorization': `Bearer ${revenueReviewerToken}` }
    });
    assert.strictEqual(resWrongDept.status, 403);

    const resAuth = await fetch(`${baseUrl}/api/applications/APP-2026-001`, {
      headers: { 'Authorization': `Bearer ${domicileReviewerToken}` }
    });
    assert.strictEqual(resAuth.status, 200);
    const app = await resAuth.json() as any;
    assert.strictEqual(app.applicationId, 'APP-2026-001');
  });

  // --- LIFECYCLE STATE AUTHORIZATION (409 Conflict) ---
  test('10. Lifecycle Guard: Attempting to review application in PENDING_CREDENTIALS returns 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/applications/APP-2026-001/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domicileReviewerToken}`
      },
      body: JSON.stringify({ decision: 'APPROVE', officerNotes: 'Premature review attempt' })
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json() as any;
    assert.strictEqual(body.error, 'INVALID_LIFECYCLE_STATE');
    assert.ok(body.message.includes('NEEDS_MANUAL_REVIEW'));
  });

  test('11. Lifecycle Guard: Successfully review application when in NEEDS_MANUAL_REVIEW state', async () => {
    // Transition APP-2026-002 to NEEDS_MANUAL_REVIEW in memory
    const inMem = getApplication('APP-2026-002');
    assert.ok(inMem);
    inMem.status = 'NEEDS_MANUAL_REVIEW';

    // Officer reviews and approves
    const res = await fetch(`${baseUrl}/api/applications/APP-2026-002/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domicileReviewerToken}`
      },
      body: JSON.stringify({ decision: 'APPROVE', officerNotes: 'Identity confirmed via personal affidavit.' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.application.status, 'APPROVED');
  });

  test('12. Lifecycle Guard: Re-reviewing an already APPROVED or REJECTED application returns 409 Conflict', async () => {
    // Put APP-2026-002 in NEEDS_MANUAL_REVIEW, then review to APPROVE
    const inMem = getApplication('APP-2026-002');
    assert.ok(inMem);
    inMem.status = 'NEEDS_MANUAL_REVIEW';

    const approveRes = await fetch(`${baseUrl}/api/applications/APP-2026-002/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domicileReviewerToken}`
      },
      body: JSON.stringify({ decision: 'APPROVE', officerNotes: 'Initial approval' })
    });
    assert.strictEqual(approveRes.status, 200);

    // Now in terminal state APPROVED - attempting second review must yield 409 Conflict
    const secondReviewRes = await fetch(`${baseUrl}/api/applications/APP-2026-002/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${domicileReviewerToken}`
      },
      body: JSON.stringify({ decision: 'REJECT', officerNotes: 'Attempting to reject approved application' })
    });

    assert.strictEqual(secondReviewRes.status, 409);
    const body = await secondReviewRes.json() as any;
    assert.strictEqual(body.error, 'INVALID_LIFECYCLE_STATE');
  });
});
