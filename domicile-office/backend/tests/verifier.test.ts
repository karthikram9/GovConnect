import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http, { Server } from 'http';
import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';
import { createApp } from '../src/app.js';
import {
  registerIssuerForTesting,
  resetTrustRegistry
} from '../src/services/trustRegistry.js';
import { clearReplayRegistry } from '../src/services/replayService.js';
import { resetApplicationState, setVerificationRequest, getVerificationRequest } from '../src/services/applicationService.js';
import { VerifiablePresentation } from '../src/types/index.js';

// Ephemeral Department Signing Keys for Realistic Fixture Generation in Tests
const revenueKeyPair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const socialWelfareKeyPair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const REVENUE_PRIVATE_KEY = revenueKeyPair.privateKey;
const SOCIAL_WELFARE_PRIVATE_KEY = socialWelfareKeyPair.privateKey;

function signPayload(payload: unknown, privateKeyPem: string): string {
  const canonical = stringify(payload);
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(canonical, 'utf8'), privKey);
  return signature.toString('base64');
}

function createIncomeCredential(overrides: Partial<any> = {}) {
  const payload = {
    credentialType: 'IncomeCertificate',
    issuer: 'revenue-dept-maharashtra',
    subject: {
      name: 'Ramesh Kumar Patil',
      dateOfBirth: '1988-04-12',
      panNumber: 'ABCDE1234F',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    },
    claims: {
      annualIncome: 120000,
      financialYear: '2023-2024'
    },
    issuedAt: '2024-01-15T10:00:00.000Z',
    ...overrides
  };

  const signature = signPayload(payload, REVENUE_PRIVATE_KEY);

  return {
    credentialId: 'cred-inc-101',
    credentialType: 'IncomeCertificate',
    title: 'Income Certificate',
    originalCredential: payload,
    signature,
    verification: {
      status: 'verified',
      verifiedAt: '2024-01-16T10:00:00.000Z',
      issuer: 'revenue-dept-maharashtra'
    }
  };
}

function createCasteCredential(overrides: Partial<any> = {}) {
  const payload = {
    credentialType: 'CasteCertificate',
    issuer: 'social-welfare-dept-maharashtra',
    subject: {
      name: 'Ramesh Kumar Patil',
      dateOfBirth: '1988-04-12',
      address: '12, Shivaji Nagar, Pune, Maharashtra'
    },
    claims: {
      casteCategory: 'OBC',
      casteName: 'Kunbi',
      certificateNumber: 'MS-CC-2023-001089'
    },
    issuedAt: '2024-01-15T10:00:00.000Z',
    ...overrides
  };

  const signature = signPayload(payload, SOCIAL_WELFARE_PRIVATE_KEY);

  return {
    credentialId: 'cred-caste-202',
    credentialType: 'CasteCertificate',
    title: 'Caste Certificate',
    originalCredential: payload,
    signature,
    verification: {
      status: 'verified',
      verifiedAt: '2024-01-16T10:00:00.000Z',
      issuer: 'social-welfare-dept-maharashtra'
    }
  };
}

function createPresentationEnvelope(params: {
  requestId: string;
  nonce: string;
  credentials?: any[];
  verifier?: string;
  holder?: string;
  expiresAt?: string;
}): VerifiablePresentation {
  const nowIso = new Date().toISOString();

  // Register request in verifier memory if not already present
  if (!getVerificationRequest(params.requestId)) {
    setVerificationRequest({
      requestId: params.requestId,
      nonce: params.nonce,
      verifier: {
        id: params.verifier || 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department',
        jurisdiction: 'Maharashtra'
      },
      purpose: 'Verify eligibility and required documentation for Domicile Certificate issuance',
      requestedCredentials: [
        {
          type: 'IncomeCertificate',
          title: 'Income Certificate',
          issuerName: 'Revenue Department',
          issuerId: 'revenue-dept-maharashtra',
          requiredClaims: [{ key: 'annualIncome', label: 'Income' }]
        },
        {
          type: 'CasteCertificate',
          title: 'Caste Certificate',
          issuerName: 'Social Welfare Department',
          issuerId: 'social-welfare-dept-maharashtra',
          requiredClaims: [{ key: 'casteCategory', label: 'Category' }]
        }
      ],
      createdAt: nowIso,
      expiresAt: params.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }

  return {
    presentationId: `vp-${crypto.randomUUID()}`,
    holder: (params.holder || 'demo-wallet-user') as any,
    verifier: params.verifier || 'domicile-office-maharashtra',
    requestId: params.requestId,
    nonce: params.nonce,
    purpose: 'Verify eligibility and required documentation for Domicile Certificate issuance',
    credentials: params.credentials || [createIncomeCredential(), createCasteCredential()],
    consent: {
      granted: true,
      timestamp: nowIso
    },
    proof: {
      type: 'ApplicationProof',
      created: nowIso,
      holder: 'demo-wallet-user',
      nonce: params.nonce,
      requestId: params.requestId,
      verifier: params.verifier || 'domicile-office-maharashtra',
      bindingDigest: `digest-${crypto.randomUUID().slice(0, 8)}`
    },
    createdAt: nowIso
  };
}

describe('GovConnect Domicile Certificate Office — 24 Comprehensive API & Verification Tests', () => {
  let server: Server;
  let baseUrl: string;
  let fetchCallCount = 0;
  let originalFetch: typeof global.fetch;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // Setup global fetch spy to strictly prove NO live issuer contact
    originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCallCount++;
      return originalFetch(input, init);
    };
  });

  after(async () => {
    global.fetch = originalFetch;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    resetTrustRegistry();
    registerIssuerForTesting({
      issuerId: 'revenue-dept-maharashtra',
      issuerName: 'Revenue Department',
      department: 'Revenue & Forest Department, Government of Maharashtra',
      keyId: 'revenue-key-1',
      publicKey: revenueKeyPair.publicKey,
      status: 'active',
      credentialTypes: ['IncomeCertificate']
    });
    registerIssuerForTesting({
      issuerId: 'social-welfare-dept-maharashtra',
      issuerName: 'Social Welfare Department',
      department: 'Social Justice & Special Assistance Department, Government of Maharashtra',
      keyId: 'social-welfare-key-1',
      publicKey: socialWelfareKeyPair.publicKey,
      status: 'active',
      credentialTypes: ['CasteCertificate']
    });
    clearReplayRegistry();
    resetApplicationState();
    fetchCallCount = 0;
  });

  // 1. Health endpoint
  test('1. GET /health returns 200 and status: ok', async () => {
    const res = await originalFetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.deepStrictEqual(body, {
      service: 'domicile-office',
      status: 'ok'
    });
  });

  // 2. Trust registry endpoint
  test('2. GET /api/trust-registry returns registered issuers and public keys with zero citizen data', async () => {
    const res = await originalFetch(`${baseUrl}/api/trust-registry`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.ok(Array.isArray(data.issuers));
    assert.strictEqual(data.issuers.length, 2);

    const revenue = data.issuers.find((i: any) => i.issuerId === 'revenue-dept-maharashtra');
    const swd = data.issuers.find((i: any) => i.issuerId === 'social-welfare-dept-maharashtra');

    assert.ok(revenue);
    assert.ok(swd);
    assert.strictEqual(revenue.status, 'active');
    assert.strictEqual(swd.status, 'active');
    assert.ok(revenue.publicKey.includes('BEGIN PUBLIC KEY'));
    assert.ok(swd.publicKey.includes('BEGIN PUBLIC KEY'));

    // Assert ZERO citizen data in registry
    const registryStr = JSON.stringify(data).toLowerCase();
    assert.strictEqual(registryStr.includes('patil'), false);
    assert.strictEqual(registryStr.includes('income'), true); // in credentialTypes array
    assert.strictEqual(registryStr.includes('120000'), false); // no actual income values
    assert.strictEqual(registryStr.includes('pan'), false);
  });

  // 3. Valid verifier request
  test('3. POST /api/verification-requests creates a fresh valid request envelope', async () => {
    const res = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    assert.strictEqual(res.status, 201);
    const reqData = await res.json() as any;

    assert.ok(reqData.requestId.startsWith('req-'));
    assert.ok(reqData.nonce.startsWith('nonce-'));
    assert.strictEqual(reqData.verifier.id, 'domicile-office-maharashtra');
    assert.strictEqual(reqData.requestedCredentials.length, 2);
    assert.ok(new Date(reqData.expiresAt).getTime() > Date.now());

    // GET /api/verification-requests/:requestId retrieval
    const getRes = await originalFetch(`${baseUrl}/api/verification-requests/${reqData.requestId}`);
    assert.strictEqual(getRes.status, 200);
    const retrieved = await getRes.json() as any;
    assert.strictEqual(retrieved.requestId, reqData.requestId);
  });

  // 4. Expired verifier request retrieval check
  test('4. GET /api/verification-requests/:requestId returns 404 for non-existent request', async () => {
    const res = await originalFetch(`${baseUrl}/api/verification-requests/req-non-existent-9999`);
    assert.strictEqual(res.status, 404);
  });

  // 5. Valid presentation verification
  test('5. POST /api/presentations/verify succeeds with VERIFIED for valid presentation', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce
    });

    const verifyRes = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation,
        applicationId: 'APP-2026-001', // Ramesh Kumar Patil
        citizenConfirmedOwnership: true
      })
    });

    assert.strictEqual(verifyRes.status, 200);
    const result = await verifyRes.json() as any;

    assert.strictEqual(result.status, 'VERIFIED');
    assert.strictEqual(result.manualReviewRequired, false);
    assert.strictEqual(result.credentialResults.length, 2);
    assert.strictEqual(result.signatureResults.length, 2);

    // Assert mandatory disclosure text is present
    assert.ok(result.credentialResults[0].mandatoryNotice.includes("no direct contact with"));
    assert.ok(result.credentialResults[1].mandatoryNotice.includes("no direct contact with"));

    // Assert certificate automatically issued
    assert.ok(result.issuedCertificate);
    assert.ok(result.issuedCertificate.certificateId.startsWith('DOM-MH-2026-'));
    assert.strictEqual(result.issuedCertificate.status, 'ISSUED');
  });

  // 6. Invalid presentation structure
  test('6. POST /api/presentations/verify rejects empty or malformed presentation structure', async () => {
    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation: { malformed: true }
      })
    });
    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'CREDENTIAL_INVALID');
  });

  // 7. Unknown issuer
  test('7. POST /api/presentations/verify rejects unknown/unregistered issuer', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const rogueCred = createIncomeCredential({
      issuer: 'rogue-department-xyz'
    });

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [rogueCred]
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'UNKNOWN_ISSUER');
    assert.ok(result.message.includes('not registered'));
  });

  // 8. Inactive issuer key
  test('8. POST /api/presentations/verify rejects credential from issuer with inactive/revoked key', async () => {
    // Temporarily mark Revenue issuer key as retired
    registerIssuerForTesting({
      issuerId: 'revenue-dept-maharashtra',
      issuerName: 'Revenue Department',
      department: 'Revenue Dept',
      keyId: 'revenue-key-1',
      publicKey: revenueKeyPair.publicKey,
      status: 'retired', // Inactive key
      credentialTypes: ['IncomeCertificate']
    });

    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [createIncomeCredential()]
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'KEY_INACTIVE');
  });

  // 9. Invalid Ed25519 signature
  test('9. POST /api/presentations/verify rejects credential with completely invalid signature', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const corruptedCred = {
      ...createIncomeCredential(),
      signature: 'bm90LWEtdmFsaWQtZWQyNTUxOS1zaWduYXR1cmUtYmFzZTY0Cg==' // bogus base64
    };

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [corruptedCred]
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'SIGNATURE_INVALID');
  });

  // 10. Tampered credential payload
  test('10. POST /api/presentations/verify rejects tampered credential claim (e.g. annualIncome altered)', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const validCred = createIncomeCredential();
    // Tamper with annual income after it was signed
    const tamperedCred = {
      ...validCred,
      originalCredential: {
        ...validCred.originalCredential,
        claims: {
          ...validCred.originalCredential.claims,
          annualIncome: 9999999 // Tampered from 120000
        }
      }
    };

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [tamperedCred]
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'SIGNATURE_INVALID');
  });

  // 11. Missing requested credential
  test('11. POST /api/presentations/verify rejects presentation with zero credentials', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [] // empty
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'MISSING_CREDENTIAL');
  });

  // 12. Missing requested claim
  test('12. POST /api/presentations/verify rejects credential missing required claim', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    // Build income cred without annualIncome
    const payloadWithoutIncome = {
      credentialType: 'IncomeCertificate',
      issuer: 'revenue-dept-maharashtra',
      subject: { name: 'Ramesh Kumar Patil', dateOfBirth: '1988-04-12' },
      claims: { financialYear: '2023-2024' }, // Missing annualIncome!
      issuedAt: '2024-01-15T10:00:00.000Z'
    };
    const signature = signPayload(payloadWithoutIncome, REVENUE_PRIVATE_KEY);
    const credWithoutClaim = {
      credentialType: 'IncomeCertificate',
      originalCredential: payloadWithoutIncome,
      signature
    };

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce,
      credentials: [credWithoutClaim]
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'MISSING_CLAIM');
    assert.ok(result.message.includes('annualIncome'));
  });

  // 13. Wrong requestId
  test('13. POST /api/presentations/verify rejects presentation with wrong requestId', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce
    });

    // Mutate requestId to unknown ID
    presentation.requestId = 'req-completely-wrong-id';

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'CREDENTIAL_INVALID');
  });

  // 14. Wrong nonce
  test('14. POST /api/presentations/verify rejects presentation with wrong nonce', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: 'nonce-mismatched-challenge'
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'CREDENTIAL_INVALID');
  });

  // 15. Expired request
  test('15. POST /api/presentations/verify rejects presentation submitted against expired request', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    // Mutate the server-side request expiration in memory to the past
    setVerificationRequest({
      ...request,
      expiresAt: new Date(Date.now() - 1000).toISOString()
    });

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce
    });

    // Submitting against expired request
    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(res.status, 400);
    const result = await res.json() as any;
    assert.strictEqual(result.status, 'REQUEST_EXPIRED');
  });

  // 16. Replay of requestId
  test('16. Replay protection: Re-submitting same presentation with consumed requestId is rejected', async () => {
    const reqRes = await originalFetch(`${baseUrl}/api/verification-requests`, { method: 'POST' });
    const request = await reqRes.json() as any;

    const presentation = createPresentationEnvelope({
      requestId: request.requestId,
      nonce: request.nonce
    });

    // 1st submission -> SUCCESS
    const res1 = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });
    assert.strictEqual(res1.status, 200);

    // 2nd submission with same presentation -> MUST BE REJECTED
    const res2 = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });
    assert.strictEqual(res2.status, 400);
    const result2 = await res2.json() as any;
    assert.strictEqual(result2.status, 'REQUEST_ALREADY_USED');
  });

  // 17. Replay of nonce
  test('17. Replay protection: Submitting same nonce under different requestId is rejected', async () => {
    const sharedNonce = `nonce-shared-${crypto.randomUUID()}`;

    const presentation1 = createPresentationEnvelope({
      requestId: `req-1-${crypto.randomUUID()}`,
      nonce: sharedNonce
    });

    const presentation2 = createPresentationEnvelope({
      requestId: `req-2-${crypto.randomUUID()}`,
      nonce: sharedNonce // Reusing nonce
    });

    const res1 = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation: presentation1 })
    });
    assert.strictEqual(res1.status, 200);

    const res2 = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation: presentation2 })
    });
    assert.strictEqual(res2.status, 400);
    const result2 = await res2.json() as any;
    assert.strictEqual(result2.status, 'REQUEST_ALREADY_USED');
  });

  // 18. No live Revenue API call during verification
  test('18. PROOF: Verification makes ZERO live network calls to Revenue Department (:4001)', async () => {
    const presentation = createPresentationEnvelope({
      requestId: `req-offline-rev-${crypto.randomUUID()}`,
      nonce: `nonce-offline-rev-${crypto.randomUUID()}`
    });

    // Reset spy count before verification
    fetchCallCount = 0;

    await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    // Domicile backend made 0 outbound fetch calls!
    assert.strictEqual(fetchCallCount, 0, 'Domicile backend must make ZERO outbound HTTP calls');
  });

  // 19. No live Social Welfare API call during verification
  test('19. PROOF: Verification makes ZERO live network calls to Social Welfare Dept (:4002)', async () => {
    const presentation = createPresentationEnvelope({
      requestId: `req-offline-swd-${crypto.randomUUID()}`,
      nonce: `nonce-offline-swd-${crypto.randomUUID()}`
    });

    fetchCallCount = 0;

    await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentation })
    });

    assert.strictEqual(fetchCallCount, 0, 'Domicile backend must make ZERO outbound HTTP calls');
  });

  // 20. Successful deterministic identity match
  test('20. Matching Engine: Exact match on name, DOB, and address issues certificate automatically', async () => {
    const presentation = createPresentationEnvelope({
      requestId: `req-match-${crypto.randomUUID()}`,
      nonce: `nonce-match-${crypto.randomUUID()}`
    });

    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation,
        applicationId: 'APP-2026-001', // Ramesh Kumar Patil
        citizenConfirmedOwnership: true
      })
    });

    assert.strictEqual(res.status, 200);
    const result = await res.json() as any;
    assert.strictEqual(result.matchingResult.status, 'MATCH');
    assert.strictEqual(result.matchingResult.confidence, 'HIGH');
    assert.ok(result.issuedCertificate);
    assert.strictEqual(result.issuedCertificate.issuanceMode, 'AUTOMATIC');
  });

  // 21. Ambiguous Ramesh name case -> manual review
  test('21. CANONICAL TEST CASE: "Ramesh Kumar Patil" vs "Ramesh K. Patil" triggers NEEDS_MANUAL_REVIEW', async () => {
    // Presentation has "Ramesh Kumar Patil"
    const presentation = createPresentationEnvelope({
      requestId: `req-ambig-${crypto.randomUUID()}`,
      nonce: `nonce-ambig-${crypto.randomUUID()}`
    });

    // Submitting for Application APP-2026-002 ("Ramesh K. Patil")
    const res = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation,
        applicationId: 'APP-2026-002', // Ramesh K. Patil
        citizenConfirmedOwnership: true
      })
    });

    assert.strictEqual(res.status, 200);
    const result = await res.json() as any;

    // MUST NOT issue certificate automatically
    assert.strictEqual(result.status, 'NEEDS_MANUAL_REVIEW');
    assert.strictEqual(result.manualReviewRequired, true);
    assert.strictEqual(result.matchingResult.status, 'AMBIGUOUS');
    assert.strictEqual(result.issuedCertificate, undefined);

    // Assert mandatory explanatory message
    assert.ok(result.manualReviewReason.includes("Some credential identity details are similar, but the submitted identity could not be deterministically linked with sufficient confidence."));
  });

  // 22. Manual review approval
  test('22. Manual Review: Officer approves ambiguous application and issues Prototype Domicile Certificate', async () => {
    // Step A: Trigger ambiguity on APP-2026-002
    const presentation = createPresentationEnvelope({
      requestId: `req-rev-app-${crypto.randomUUID()}`,
      nonce: `nonce-rev-app-${crypto.randomUUID()}`
    });

    await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation,
        applicationId: 'APP-2026-002',
        citizenConfirmedOwnership: true
      })
    });

    // Step B: Officer reviews and approves
    const reviewRes = await originalFetch(`${baseUrl}/api/applications/APP-2026-002/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVE',
        officerNotes: 'Verified identity discrepancy in person with applicant affidavit.'
      })
    });

    assert.strictEqual(reviewRes.status, 200);
    const reviewData = await reviewRes.json() as any;
    assert.strictEqual(reviewData.success, true);
    assert.strictEqual(reviewData.application.status, 'APPROVED');
    assert.ok(reviewData.certificate);
    assert.strictEqual(reviewData.certificate.issuanceMode, 'APPROVED_AFTER_MANUAL_REVIEW');
  });

  // 23. Manual review rejection
  test('23. Manual Review: Officer rejects application with clear audit status', async () => {
    const reviewRes = await originalFetch(`${baseUrl}/api/applications/APP-2026-002/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'REJECT',
        officerNotes: 'Identity could not be established.'
      })
    });

    assert.strictEqual(reviewRes.status, 200);
    const reviewData = await reviewRes.json() as any;
    assert.strictEqual(reviewData.success, true);
    assert.strictEqual(reviewData.application.status, 'REJECTED');
    assert.strictEqual(reviewData.certificate, undefined);
  });

  // 24. Prototype certificate issuance structure
  test('24. Prototype Domicile Certificate contains required non-official labels and references', async () => {
    const presentation = createPresentationEnvelope({
      requestId: `req-cert-${crypto.randomUUID()}`,
      nonce: `nonce-cert-${crypto.randomUUID()}`
    });

    const verifyRes = await originalFetch(`${baseUrl}/api/presentations/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation,
        applicationId: 'APP-2026-001',
        citizenConfirmedOwnership: true
      })
    });

    const result = await verifyRes.json() as any;
    const cert = result.issuedCertificate;

    assert.ok(cert);
    assert.strictEqual(cert.certificateType, 'Prototype Domicile Certificate');
    assert.ok(cert.disclaimer.includes('Demo Output — Not an Official Government Certificate'));
    assert.strictEqual(cert.applicant.name, 'Ramesh Kumar Patil');
    assert.strictEqual(cert.applicant.demoIdentityContext, 'demo-wallet-user');
    assert.ok(cert.verifiedClaims.incomeStatus.includes('₹1,20,000'));
    assert.ok(cert.verifiedClaims.casteStatus.includes('OBC'));
    assert.strictEqual(cert.sourceCredentials.length, 2);

    // Verify certificate can be retrieved by ID
    const getCertRes = await originalFetch(`${baseUrl}/api/certificates/${cert.certificateId}`);
    assert.strictEqual(getCertRes.status, 200);
    const retrievedCert = await getCertRes.json() as any;
    assert.strictEqual(retrievedCert.certificateId, cert.certificateId);
  });
});
