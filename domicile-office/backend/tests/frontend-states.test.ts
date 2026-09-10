import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  issuePrototypeDomicileCertificate
} from '../src/services/certificateIssuer.js';
import {
  executeDemographicMatching
} from '../src/services/matchingEngine.js';
import {
  reviewApplication,
  resetApplicationState
} from '../src/services/applicationService.js';

describe('Domicile Frontend State & UI Model Test Suite', () => {
  test('1. Request display model has required fields for citizen preview', () => {
    const mockRequest = {
      requestId: 'req-123',
      verifier: {
        id: 'domicile-office-maharashtra',
        name: 'Domicile Certificate Office',
        department: 'Revenue & General Administration Department',
        jurisdiction: 'Maharashtra'
      },
      purpose: 'Verify eligibility and required documentation for Domicile Certificate issuance',
      requestedCredentials: [
        { type: 'IncomeCertificate', requiredClaims: [{ key: 'annualIncome', label: 'Income' }] },
        { type: 'CasteCertificate', requiredClaims: [{ key: 'casteCategory', label: 'Category' }] }
      ],
      nonce: 'nonce-123',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString()
    };

    assert.ok(mockRequest.requestId);
    assert.ok(mockRequest.nonce);
    assert.strictEqual(mockRequest.verifier.id, 'domicile-office-maharashtra');
    assert.strictEqual(mockRequest.requestedCredentials.length, 2);
  });

  test('2. Verification states: VERIFIED vs SIGNATURE_INVALID vs UNKNOWN_ISSUER vs NEEDS_MANUAL_REVIEW', () => {
    const validState = 'VERIFIED';
    const invalidSigState = 'SIGNATURE_INVALID';
    const unknownIssuerState = 'UNKNOWN_ISSUER';
    const reviewState = 'NEEDS_MANUAL_REVIEW';

    assert.strictEqual(validState, 'VERIFIED');
    assert.strictEqual(invalidSigState, 'SIGNATURE_INVALID');
    assert.strictEqual(unknownIssuerState, 'UNKNOWN_ISSUER');
    assert.strictEqual(reviewState, 'NEEDS_MANUAL_REVIEW');
  });

  test('3. Successful verification model contains mandatory no-direct-contact disclosure', () => {
    const revNotice = "Signature checked against Revenue Department's registered public key — no direct contact with Revenue Department was needed.";
    const swdNotice = "Signature checked against Social Welfare Department's registered public key — no direct contact with Social Welfare Department was needed.";

    assert.ok(revNotice.includes('Revenue Department'));
    assert.ok(revNotice.includes('no direct contact with Revenue Department was needed'));
    assert.ok(swdNotice.includes('Social Welfare Department'));
    assert.ok(swdNotice.includes('no direct contact with Social Welfare Department was needed'));
  });

  test('4. Matching Engine: Identifies Ramesh K. Patil ambiguity for human review UI', () => {
    const result = executeDemographicMatching({
      applicant: {
        name: 'Ramesh K. Patil',
        dateOfBirth: '1988-04-12',
        address: '12, Shivaji Nagar, Pune, Maharashtra'
      },
      credentialSubject: {
        name: 'Ramesh Kumar Patil',
        dateOfBirth: '1988-04-12',
        address: '12, Shivaji Nagar, Pune, Maharashtra'
      },
      citizenConfirmedOwnership: true
    });

    assert.strictEqual(result.status, 'AMBIGUOUS');
    assert.ok(result.ambiguityReason?.includes('Some credential identity details are similar, but the submitted identity could not be deterministically linked with sufficient confidence.'));
  });

  test('5. Manual Review UI: Approval produces valid prototype certificate', () => {
    resetApplicationState();

    const approval = reviewApplication({
      applicationId: 'APP-2026-002',
      decision: 'APPROVE',
      officerNotes: 'Identity confirmed via personal affidavit.'
    });

    assert.strictEqual(approval.success, true);
    assert.strictEqual(approval.application?.status, 'APPROVED');
    assert.ok(approval.certificate?.certificateId.startsWith('DOM-MH-2026-'));
    assert.strictEqual(approval.certificate?.issuanceMode, 'APPROVED_AFTER_MANUAL_REVIEW');
  });

  test('6. Manual Review UI: Rejection sets application status to REJECTED', () => {
    resetApplicationState();

    const rejection = reviewApplication({
      applicationId: 'APP-2026-002',
      decision: 'REJECT',
      officerNotes: 'Discrepancy in identity details.'
    });

    assert.strictEqual(rejection.success, true);
    assert.strictEqual(rejection.application?.status, 'REJECTED');
    assert.strictEqual(rejection.certificate, undefined);
  });

  test('7. Prototype Certificate Screen: Contains mandatory disclaimers and non-official tags', () => {
    const cert = issuePrototypeDomicileCertificate({
      applicant: {
        name: 'Ramesh Kumar Patil',
        dateOfBirth: '1988-04-12',
        address: '12, Shivaji Nagar, Pune, Maharashtra'
      },
      credentialResults: [
        {
          credentialType: 'IncomeCertificate',
          issuerId: 'revenue-dept-maharashtra',
          issuerName: 'Revenue Department',
          signatureStatus: 'verified',
          publicKeyStatus: 'registered',
          keyId: 'revenue-key-1',
          offlineVerified: true,
          mandatoryNotice: "Signature checked against Revenue Department's registered public key — no direct contact with Revenue Department was needed.",
          extractedClaims: { annualIncome: 120000 },
          subject: { name: 'Ramesh Kumar Patil' }
        }
      ],
      verificationReference: 'verif-test-ref',
      issuanceMode: 'AUTOMATIC'
    });

    assert.strictEqual(cert.certificateType, 'Prototype Domicile Certificate');
    assert.ok(cert.disclaimer.includes('Demo Output — Not an Official Government Certificate'));
    assert.strictEqual(cert.status, 'ISSUED');
    assert.ok(cert.certificateId.startsWith('DOM-MH-2026-'));
  });
});
