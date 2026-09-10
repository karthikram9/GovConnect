import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

/**
 * GovConnect Wallet — Step 3C Presentation & Consent Flow Test Suite
 * Validates:
 * 1. Verifier request validation (freshness, structure)
 * 2. Replay protection (reused requestId / nonce rejection)
 * 3. VerifiablePresentation structure & original credential preservation
 * 4. ConsentRecord reference-only audit invariant (STRICTLY NO raw claims)
 * 5. Explicit consent enforcement
 */

// Simulated in-memory replay ledger for tests
const consumedRequests = new Set<string>();
const consumedNonces = new Set<string>();

interface VerifierRequest {
  requestId: string;
  verifier: {
    id: string;
    name: string;
    department: string;
  };
  purpose: string;
  requestedCredentials: Array<{
    type: string;
    reason: string;
    requiredClaims: string[];
  }>;
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

interface PresentationProof {
  type: string;
  created: string;
  holder: string;
  nonce: string;
  requestId: string;
  verifier: string;
  bindingDigest: string;
}

interface VerifiablePresentation {
  presentationId: string;
  holder: string;
  verifier: string;
  requestId: string;
  nonce: string;
  purpose: string;
  credentials: any[];
  consent: {
    granted: boolean;
    timestamp: string;
  };
  proof: PresentationProof;
  createdAt: string;
}

interface ConsentRecord {
  consentId: string;
  presentationId: string;
  requestId: string;
  holder: string;
  recipient: string;
  verifierName: string;
  purpose: string;
  credentialsShared: string[];
  credentialTypesShared: string[];
  nonce: string;
  timestamp: string;
  status: 'granted';
  decision: 'explicit_citizen_consent';
}

function validateRequest(request: VerifierRequest): { valid: boolean; code?: string; error?: string } {
  if (!request || !request.requestId || !request.nonce || !request.expiresAt) {
    return { valid: false, code: 'INVALID_REQUEST', error: 'Malformed verification request.' };
  }
  if (Date.now() > new Date(request.expiresAt).getTime()) {
    return { valid: false, code: 'REQUEST_EXPIRED', error: 'This verification request has expired.' };
  }
  if (consumedRequests.has(request.requestId) || consumedNonces.has(request.nonce)) {
    return { valid: false, code: 'REQUEST_ALREADY_USED', error: 'This verification request has already been used.' };
  }
  return { valid: true };
}

function buildPresentation(params: {
  request: VerifierRequest;
  selectedCredentials: any[];
  consentGranted: boolean;
}): { presentation: VerifiablePresentation; consentRecord: ConsentRecord } {
  const { request, selectedCredentials, consentGranted } = params;

  if (!consentGranted) {
    throw new Error('CONSENT_REQUIRED: Explicit citizen consent is required.');
  }
  if (!selectedCredentials || selectedCredentials.length === 0) {
    throw new Error('NO_CREDENTIALS_SELECTED: At least one credential must be selected.');
  }

  const validation = validateRequest(request);
  if (!validation.valid) {
    throw new Error(`${validation.code}: ${validation.error}`);
  }

  for (const cred of selectedCredentials) {
    if (cred.verification?.status !== 'verified') {
      throw new Error(`CREDENTIAL_NOT_VERIFIED: Credential ${cred.credentialType} is not cryptographically verified.`);
    }
  }

  const nowIso = new Date().toISOString();
  const presentationId = `vp-${crypto.randomUUID()}`;

  const proof: PresentationProof = {
    type: 'ApplicationProof',
    created: nowIso,
    holder: 'demo-wallet-user',
    nonce: request.nonce,
    requestId: request.requestId,
    verifier: request.verifier.id,
    bindingDigest: `digest-${crypto.createHash('sha256').update(presentationId + request.nonce).digest('hex').slice(0, 16)}`
  };

  const presentation: VerifiablePresentation = {
    presentationId,
    holder: 'demo-wallet-user',
    verifier: request.verifier.id,
    requestId: request.requestId,
    nonce: request.nonce,
    purpose: request.purpose,
    credentials: selectedCredentials,
    consent: {
      granted: true,
      timestamp: nowIso
    },
    proof,
    createdAt: nowIso
  };

  const consentRecord: ConsentRecord = {
    consentId: `consent-${crypto.randomUUID()}`,
    presentationId,
    requestId: request.requestId,
    holder: 'demo-wallet-user',
    recipient: request.verifier.id,
    verifierName: request.verifier.name,
    purpose: request.purpose,
    credentialsShared: selectedCredentials.map(c => c.credentialId),
    credentialTypesShared: selectedCredentials.map(c => c.credentialType),
    nonce: request.nonce,
    timestamp: nowIso,
    status: 'granted',
    decision: 'explicit_citizen_consent'
  };

  // Consume replay tokens
  consumedRequests.add(request.requestId);
  consumedNonces.add(request.nonce);

  return { presentation, consentRecord };
}

describe('GovConnect Wallet Step 3C — Presentation & Consent Flow Test Suite', () => {
  const sampleIncomeCred = {
    credentialId: 'cred-inc-1',
    credentialType: 'IncomeCertificate',
    title: 'Income Certificate',
    originalCredential: {
      id: 'govconnect:income:cert-101',
      issuer: 'revenue-department-maharashtra',
      subject: { citizenId: 1, name: 'Ramesh Kumar Patil', panNumber: 'ABCDE1234F' },
      claims: { annualIncome: 120000, financialYear: '2023-2024' },
      issuedAt: '2024-01-15T10:00:00.000Z'
    },
    signature: 'mockEd25519SignatureBase64StringForIncomeCert==',
    verification: {
      status: 'verified',
      verifiedAt: '2024-01-16T10:00:00.000Z',
      issuer: 'revenue-department-maharashtra'
    }
  };

  const sampleCasteCred = {
    credentialId: 'cred-caste-1',
    credentialType: 'CasteCertificate',
    title: 'Caste Certificate',
    originalCredential: {
      id: 'govconnect:caste:cert-202',
      issuer: 'social-welfare-department-maharashtra',
      subject: { citizenId: 1, name: 'Ramesh Kumar Patil' },
      claims: { casteCategory: 'OBC', casteName: 'Kunbi', certificateNumber: 'MS-CC-2023-001089' },
      issuedAt: '2024-01-15T10:00:00.000Z'
    },
    signature: 'mockEd25519SignatureBase64StringForCasteCert==',
    verification: {
      status: 'verified',
      verifiedAt: '2024-01-16T10:00:00.000Z',
      issuer: 'social-welfare-department-maharashtra'
    }
  };

  test('1. Valid verifier request is accepted and builds complete Verifiable Presentation', () => {
    const validRequest: VerifierRequest = {
      requestId: `req-${crypto.randomUUID()}`,
      verifier: {
        id: 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department'
      },
      purpose: 'Verify eligibility and documentation for Domicile Certificate issuance',
      requestedCredentials: [
        { type: 'IncomeCertificate', reason: 'Income ceiling verification', requiredClaims: ['annualIncome'] },
        { type: 'CasteCertificate', reason: 'Reservation category verification', requiredClaims: ['casteCategory', 'casteName'] }
      ],
      nonce: `nonce-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    const { presentation, consentRecord } = buildPresentation({
      request: validRequest,
      selectedCredentials: [sampleIncomeCred, sampleCasteCred],
      consentGranted: true
    });

    // Check presentation envelope
    assert.ok(presentation.presentationId.startsWith('vp-'));
    assert.strictEqual(presentation.holder, 'demo-wallet-user');
    assert.strictEqual(presentation.verifier, 'domicile-office-maharashtra');
    assert.strictEqual(presentation.requestId, validRequest.requestId);
    assert.strictEqual(presentation.nonce, validRequest.nonce);
    assert.strictEqual(presentation.purpose, validRequest.purpose);
    assert.strictEqual(presentation.consent.granted, true);
    assert.strictEqual(presentation.credentials.length, 2);

    // Verify original payloads and signatures are strictly preserved unmodified
    assert.strictEqual(presentation.credentials[0].originalCredential.id, sampleIncomeCred.originalCredential.id);
    assert.strictEqual(presentation.credentials[0].signature, sampleIncomeCred.signature);
    assert.strictEqual(presentation.credentials[1].originalCredential.id, sampleCasteCred.originalCredential.id);
    assert.strictEqual(presentation.credentials[1].signature, sampleCasteCred.signature);

    // Check proof
    assert.strictEqual(presentation.proof.type, 'ApplicationProof');
    assert.strictEqual(presentation.proof.requestId, validRequest.requestId);
    assert.strictEqual(presentation.proof.nonce, validRequest.nonce);
    assert.ok(presentation.proof.bindingDigest);

    // Check consent record
    assert.ok(consentRecord.consentId.startsWith('consent-'));
    assert.strictEqual(consentRecord.status, 'granted');
    assert.strictEqual(consentRecord.recipient, 'domicile-office-maharashtra');
    assert.deepStrictEqual(consentRecord.credentialTypesShared, ['IncomeCertificate', 'CasteCertificate']);
  });

  test('2. Expired verifier request is rejected with REQUEST_EXPIRED', () => {
    const expiredRequest: VerifierRequest = {
      requestId: `req-${crypto.randomUUID()}`,
      verifier: {
        id: 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department'
      },
      purpose: 'Verify eligibility for Domicile Certificate',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: `nonce-${crypto.randomUUID()}`,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
    };

    assert.throws(
      () => {
        buildPresentation({
          request: expiredRequest,
          selectedCredentials: [sampleIncomeCred],
          consentGranted: true
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('REQUEST_EXPIRED'));
        return true;
      }
    );
  });

  test('3. Replay protection: Re-using the same requestId or nonce is rejected', () => {
    const freshRequest: VerifierRequest = {
      requestId: `req-replay-${crypto.randomUUID()}`,
      verifier: {
        id: 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department'
      },
      purpose: 'Verify eligibility for Domicile Certificate',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: `nonce-replay-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    // First use: must succeed
    const firstResult = buildPresentation({
      request: freshRequest,
      selectedCredentials: [sampleIncomeCred],
      consentGranted: true
    });
    assert.ok(firstResult.presentation);

    // Second use with identical requestId & nonce: MUST be rejected
    assert.throws(
      () => {
        buildPresentation({
          request: freshRequest,
          selectedCredentials: [sampleIncomeCred],
          consentGranted: true
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('REQUEST_ALREADY_USED'));
        return true;
      }
    );
  });

  test('4. Replay protection: Re-using identical nonce under different requestId is also rejected', () => {
    const sharedNonce = `nonce-shared-${crypto.randomUUID()}`;

    const requestA: VerifierRequest = {
      requestId: `req-a-${crypto.randomUUID()}`,
      verifier: { id: 'domicile-office-maharashtra', name: 'Domicile', department: 'Rev' },
      purpose: 'Verify income',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: sharedNonce,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    const requestB: VerifierRequest = {
      requestId: `req-b-${crypto.randomUUID()}`,
      verifier: { id: 'domicile-office-maharashtra', name: 'Domicile', department: 'Rev' },
      purpose: 'Verify income',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: sharedNonce, // Reused nonce
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    buildPresentation({ request: requestA, selectedCredentials: [sampleIncomeCred], consentGranted: true });

    assert.throws(
      () => {
        buildPresentation({ request: requestB, selectedCredentials: [sampleIncomeCred], consentGranted: true });
      },
      (err: any) => {
        assert.ok(err.message.includes('REQUEST_ALREADY_USED'));
        return true;
      }
    );
  });

  test('5. Explicit citizen consent is mandatory before presentation creation', () => {
    const freshRequest: VerifierRequest = {
      requestId: `req-no-consent-${crypto.randomUUID()}`,
      verifier: { id: 'domicile-office-maharashtra', name: 'Domicile', department: 'Rev' },
      purpose: 'Verify eligibility',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: `nonce-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    assert.throws(
      () => {
        buildPresentation({
          request: freshRequest,
          selectedCredentials: [sampleIncomeCred],
          consentGranted: false // Consent NOT given
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('CONSENT_REQUIRED'));
        return true;
      }
    );
  });

  test('6. Unverified credential cannot be shared in presentation', () => {
    const unverifiedCred = {
      ...sampleIncomeCred,
      credentialId: 'cred-unverified',
      verification: {
        status: 'failed',
        error: 'Invalid signature'
      }
    };

    const freshRequest: VerifierRequest = {
      requestId: `req-unverified-${crypto.randomUUID()}`,
      verifier: { id: 'domicile-office-maharashtra', name: 'Domicile', department: 'Rev' },
      purpose: 'Verify eligibility',
      requestedCredentials: [{ type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] }],
      nonce: `nonce-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    assert.throws(
      () => {
        buildPresentation({
          request: freshRequest,
          selectedCredentials: [unverifiedCred],
          consentGranted: true
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('CREDENTIAL_NOT_VERIFIED'));
        return true;
      }
    );
  });

  test('7. STRICT PRIVACY INVARIANT: ConsentRecord stores audit references ONLY and ZERO raw claims', () => {
    const freshRequest: VerifierRequest = {
      requestId: `req-privacy-${crypto.randomUUID()}`,
      verifier: {
        id: 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department'
      },
      purpose: 'Audit invariant verification',
      requestedCredentials: [
        { type: 'IncomeCertificate', reason: 'Income ceiling', requiredClaims: ['annualIncome'] },
        { type: 'CasteCertificate', reason: 'Category check', requiredClaims: ['casteCategory'] }
      ],
      nonce: `nonce-privacy-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };

    const { consentRecord } = buildPresentation({
      request: freshRequest,
      selectedCredentials: [sampleIncomeCred, sampleCasteCred],
      consentGranted: true
    });

    // 1. Assert allowed audit metadata fields are present
    assert.ok(consentRecord.consentId);
    assert.ok(consentRecord.presentationId);
    assert.strictEqual(consentRecord.recipient, 'domicile-office-maharashtra');
    assert.strictEqual(consentRecord.purpose, 'Audit invariant verification');
    assert.strictEqual(consentRecord.status, 'granted');
    assert.deepStrictEqual(consentRecord.credentialsShared, ['cred-inc-1', 'cred-caste-1']);

    // 2. Assert STRICT PROHIBITION of raw claims or personal data in consent record
    const consentJson = JSON.stringify(consentRecord).toLowerCase();

    // Raw sensitive claim values
    assert.strictEqual(consentJson.includes('120000'), false, 'ConsentRecord must NOT contain annual income value');
    assert.strictEqual(consentJson.includes('kunbi'), false, 'ConsentRecord must NOT contain caste name');
    assert.strictEqual(consentJson.includes('abcde1234f'), false, 'ConsentRecord must NOT contain PAN number');
    assert.strictEqual(consentJson.includes('ms-cc-2023-001089'), false, 'ConsentRecord must NOT contain certificate number');

    // Claim keys
    assert.strictEqual(consentJson.includes('annualincome'), false, 'ConsentRecord must NOT contain annualIncome field');
    assert.strictEqual(consentJson.includes('castecategory'), false, 'ConsentRecord must NOT contain casteCategory field');
    assert.strictEqual(consentJson.includes('castename'), false, 'ConsentRecord must NOT contain casteName field');
    assert.strictEqual(consentJson.includes('pannumber'), false, 'ConsentRecord must NOT contain panNumber field');

    // Cryptographic signatures
    assert.strictEqual(consentJson.includes('mocked25519signature'), false, 'ConsentRecord must NOT contain raw issuer signature');
  });
});
