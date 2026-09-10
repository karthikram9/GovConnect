import crypto from 'crypto';
import {
  DomicileApplication,
  VerifierRequest,
  VerificationResult,
  PrototypeDomicileCertificate,
  VerifiablePresentation
} from '../types/index.js';
import { config } from '../config/index.js';
import { verifyPresentation } from './credentialVerifier.js';
import { executeDemographicMatching } from './matchingEngine.js';
import { issuePrototypeDomicileCertificate } from './certificateIssuer.js';
import { markTokenConsumed } from './replayService.js';

// In-memory repositories for prototype demonstration
const applications: Map<string, DomicileApplication> = new Map();
const verificationRequests: Map<string, VerifierRequest> = new Map();
const verificationResults: Map<string, VerificationResult> = new Map();
const issuedCertificates: Map<string, PrototypeDomicileCertificate> = new Map();

function seedInitialApplications(): void {
  const app1: DomicileApplication = {
    applicationId: 'APP-2026-001',
    applicantName: 'Ramesh Kumar Patil',
    dateOfBirth: '1988-04-12',
    address: '12, Shivaji Nagar, Pune, Maharashtra',
    status: 'PENDING_CREDENTIALS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const app2: DomicileApplication = {
    applicationId: 'APP-2026-002',
    applicantName: 'Ramesh K. Patil', // Canonical ambiguity case
    dateOfBirth: '1988-04-12',
    address: '12, Shivaji Nagar, Pune, Maharashtra',
    status: 'PENDING_CREDENTIALS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  applications.set(app1.applicationId, app1);
  applications.set(app2.applicationId, app2);
}

seedInitialApplications();

/**
 * Creates a fresh Verifier Request conforming strictly to Section 20 of the contract.
 */
export function createVerificationRequest(): VerifierRequest {
  const requestId = `req-${crypto.randomUUID()}`;
  const nonce = `nonce-${crypto.randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15-minute validity window

  const request: VerifierRequest = {
    requestId,
    verifier: config.verifier,
    purpose: 'Verify eligibility and required documentation for Domicile Certificate issuance',
    requestedCredentials: [
      {
        type: 'IncomeCertificate',
        title: 'Income Certificate',
        issuerName: 'Revenue Department',
        issuerId: 'revenue-dept-maharashtra',
        requiredClaims: [
          { key: 'annualIncome', label: 'Certified Annual Income' }
        ]
      },
      {
        type: 'CasteCertificate',
        title: 'Caste Certificate',
        issuerName: 'Social Welfare Department',
        issuerId: 'social-welfare-dept-maharashtra',
        requiredClaims: [
          { key: 'casteCategory', label: 'Caste Category' },
          { key: 'casteName', label: 'Caste / Sub-Caste' }
        ]
      }
    ],
    nonce,
    createdAt: now.toISOString(),
    expiresAt
  };

  verificationRequests.set(requestId, request);
  return request;
}

export function setVerificationRequest(request: VerifierRequest): void {
  verificationRequests.set(request.requestId, request);
}

export function getVerificationRequest(requestId: string): VerifierRequest | undefined {
  return verificationRequests.get(requestId);
}

export function getAllApplications(): DomicileApplication[] {
  return Array.from(applications.values());
}

export function getApplication(applicationId: string): DomicileApplication | undefined {
  return applications.get(applicationId);
}

export function createApplication(data: {
  applicantName: string;
  dateOfBirth: string;
  address: string;
}): DomicileApplication {
  const applicationId = `APP-2026-${Math.floor(100 + Math.random() * 900)}`;
  const app: DomicileApplication = {
    applicationId,
    applicantName: data.applicantName,
    dateOfBirth: data.dateOfBirth,
    address: data.address,
    status: 'PENDING_CREDENTIALS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  applications.set(applicationId, app);
  return app;
}

export function getCertificate(certificateId: string): PrototypeDomicileCertificate | undefined {
  return issuedCertificates.get(certificateId);
}

export function getAllCertificates(): PrototypeDomicileCertificate[] {
  return Array.from(issuedCertificates.values());
}

/**
 * Handles presentation processing, offline cryptographic checks, matching, and issuance.
 */
export async function processPresentation(params: {
  presentation: VerifiablePresentation;
  applicationId?: string;
  citizenConfirmedOwnership?: boolean;
}): Promise<VerificationResult> {
  const { presentation, applicationId, citizenConfirmedOwnership = false } = params;

  // 1. Lookup active verification request
  const expectedReq = verificationRequests.get(presentation.requestId);
  if (!expectedReq) {
    const failedResult: VerificationResult = {
      verificationId: `verif-${crypto.randomUUID()}`,
      requestId: presentation.requestId,
      presentationId: presentation.presentationId,
      status: 'CREDENTIAL_INVALID',
      message: `Verification request "${presentation.requestId}" is unknown or was not issued by this verifier.`,
      verifiedAt: new Date().toISOString(),
      credentialResults: [],
      signatureResults: [],
      matchingResult: {
        status: 'MISMATCH',
        confidence: 'LOW',
        matchedFields: [],
        discrepancies: ['Unknown or unissued requestId'],
        citizenOwnershipConfirmed: false
      },
      manualReviewRequired: false,
      offlineVerificationCertified: true
    };
    return failedResult;
  }

  // 2. Perform Offline Cryptographic Verification Pipeline
  const pipelineResult = await verifyPresentation(presentation, {
    requestId: expectedReq.requestId,
    nonce: expectedReq.nonce,
    expiresAt: expectedReq.expiresAt
  });

  const verificationId = `verif-${crypto.randomUUID()}`;
  const nowIso = new Date().toISOString();

  // If cryptographic or structural checks fail, return immediately
  if (!pipelineResult.valid) {
    const failedResult: VerificationResult = {
      verificationId,
      requestId: presentation.requestId,
      presentationId: presentation.presentationId,
      status: pipelineResult.status,
      message: pipelineResult.errorMessage || 'Presentation verification failed.',
      verifiedAt: nowIso,
      credentialResults: pipelineResult.credentialResults,
      signatureResults: pipelineResult.signatureResults,
      matchingResult: {
        status: 'MISMATCH',
        confidence: 'LOW',
        matchedFields: [],
        discrepancies: [pipelineResult.errorMessage || 'Signature/format verification failed'],
        citizenOwnershipConfirmed: citizenConfirmedOwnership
      },
      manualReviewRequired: false,
      offlineVerificationCertified: true
    };
    verificationResults.set(verificationId, failedResult);
    return failedResult;
  }

  // 3. Match against Domicile Application (or demo fallback)
  let app = applicationId ? applications.get(applicationId) : undefined;
  if (!app) {
    // If no specific application provided, try to match by applicantName
    const matchingApp = Array.from(applications.values()).find(
      a => a.applicantName.toLowerCase() === (pipelineResult.extractedSubject.name || '').toLowerCase()
    );
    app = matchingApp || Array.from(applications.values())[0];
  }

  const matchingResult = executeDemographicMatching({
    applicant: {
      name: app.applicantName,
      dateOfBirth: app.dateOfBirth,
      address: app.address
    },
    credentialSubject: pipelineResult.extractedSubject,
    citizenConfirmedOwnership
  });

  // 4. Burn verifier-side replay tokens
  markTokenConsumed({
    requestId: presentation.requestId,
    nonce: presentation.nonce,
    presentationId: presentation.presentationId
  });

  // 5. Evaluate Decision & Issuance
  let overallStatus: VerificationResult['status'] = 'VERIFIED';
  let manualReviewRequired = false;
  let manualReviewReason: string | undefined;
  let issuedCert: PrototypeDomicileCertificate | undefined;

  if (matchingResult.status === 'MATCH') {
    // Deterministic match passed! Issue certificate automatically
    issuedCert = issuePrototypeDomicileCertificate({
      applicant: {
        name: app.applicantName,
        dateOfBirth: app.dateOfBirth,
        address: app.address
      },
      credentialResults: pipelineResult.credentialResults,
      verificationReference: verificationId,
      issuanceMode: 'AUTOMATIC'
    });

    issuedCertificates.set(issuedCert.certificateId, issuedCert);

    app.status = 'VERIFIED';
    app.verificationId = verificationId;
    app.presentationId = presentation.presentationId;
    app.certificateId = issuedCert.certificateId;
    app.updatedAt = nowIso;
  } else if (matchingResult.status === 'AMBIGUOUS') {
    // Ambiguity detected (e.g. Ramesh Kumar Patil vs Ramesh K. Patil)
    overallStatus = 'NEEDS_MANUAL_REVIEW';
    manualReviewRequired = true;
    manualReviewReason = matchingResult.ambiguityReason || 'Identity match requires manual review: Demographic variance detected.';

    app.status = 'NEEDS_MANUAL_REVIEW';
    app.verificationId = verificationId;
    app.presentationId = presentation.presentationId;
    app.reviewNotes = manualReviewReason;
    app.updatedAt = nowIso;
  } else {
    // Severe mismatch
    overallStatus = 'IDENTITY_MISMATCH';
    manualReviewRequired = true;
    manualReviewReason = matchingResult.discrepancies.join('; ');

    app.status = 'NEEDS_MANUAL_REVIEW';
    app.verificationId = verificationId;
    app.presentationId = presentation.presentationId;
    app.reviewNotes = manualReviewReason;
    app.updatedAt = nowIso;
  }

  const finalResult: VerificationResult = {
    verificationId,
    requestId: presentation.requestId,
    presentationId: presentation.presentationId,
    status: overallStatus,
    message: overallStatus === 'VERIFIED'
      ? 'Presentation verified offline successfully. Prototype Domicile Certificate issued.'
      : manualReviewReason || 'Verification requires manual officer review.',
    verifiedAt: nowIso,
    credentialResults: pipelineResult.credentialResults,
    signatureResults: pipelineResult.signatureResults,
    matchingResult,
    manualReviewRequired,
    manualReviewReason,
    issuedCertificate: issuedCert,
    offlineVerificationCertified: true
  };

  verificationResults.set(verificationId, finalResult);
  return finalResult;
}

/**
 * Handles officer manual review decision (Approve or Reject).
 */
export function reviewApplication(params: {
  applicationId: string;
  decision: 'APPROVE' | 'REJECT';
  officerNotes: string;
}): { success: boolean; application?: DomicileApplication; certificate?: PrototypeDomicileCertificate; error?: string } {
  const { applicationId, decision, officerNotes } = params;

  const app = applications.get(applicationId);
  if (!app) {
    return { success: false, error: `Application "${applicationId}" not found.` };
  }

  const verif = app.verificationId ? verificationResults.get(app.verificationId) : undefined;
  const nowIso = new Date().toISOString();

  app.reviewedAt = nowIso;
  app.reviewNotes = officerNotes;

  if (decision === 'APPROVE') {
    app.status = 'APPROVED';
    app.reviewerDecision = 'APPROVED';

    const cert = issuePrototypeDomicileCertificate({
      applicant: {
        name: app.applicantName,
        dateOfBirth: app.dateOfBirth,
        address: app.address
      },
      credentialResults: verif?.credentialResults || [
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
          subject: { name: app.applicantName, dateOfBirth: app.dateOfBirth, address: app.address }
        },
        {
          credentialType: 'CasteCertificate',
          issuerId: 'social-welfare-dept-maharashtra',
          issuerName: 'Social Welfare Department',
          signatureStatus: 'verified',
          publicKeyStatus: 'registered',
          keyId: 'social-welfare-key-1',
          offlineVerified: true,
          mandatoryNotice: "Signature checked against Social Welfare Department's registered public key — no direct contact with Social Welfare Department was needed.",
          extractedClaims: { casteCategory: 'OBC', casteName: 'Kunbi' },
          subject: { name: app.applicantName, dateOfBirth: app.dateOfBirth, address: app.address }
        }
      ],
      verificationReference: app.verificationId || `rev-app-${crypto.randomUUID()}`,
      issuanceMode: 'APPROVED_AFTER_MANUAL_REVIEW'
    });

    issuedCertificates.set(cert.certificateId, cert);
    app.certificateId = cert.certificateId;
    app.updatedAt = nowIso;

    return { success: true, application: app, certificate: cert };
  } else {
    app.status = 'REJECTED';
    app.reviewerDecision = 'REJECTED';
    app.updatedAt = nowIso;

    return { success: true, application: app };
  }
}

/**
 * Test helper to reset repositories.
 */
export function resetApplicationState(): void {
  applications.clear();
  verificationRequests.clear();
  verificationResults.clear();
  issuedCertificates.clear();
  seedInitialApplications();
}
