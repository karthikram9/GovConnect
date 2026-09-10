/**
 * GovConnect Domicile Certificate Office — Type Definitions
 * In strict alignment with docs/SECURITY_INTEROPERABILITY_CONTRACT.md
 */

export interface TrustedIssuer {
  issuerId: string;
  issuerName: string;
  department: string;
  keyId: string;
  publicKey: string; // SPKI PEM or Base64 DER
  status: 'active' | 'retired' | 'revoked';
  credentialTypes: string[];
}

export interface RequestedClaim {
  key: string;
  label: string;
}

export interface RequestedCredentialSpec {
  type: 'IncomeCertificate' | 'CasteCertificate';
  title: string;
  issuerName: string;
  issuerId: string;
  requiredClaims: RequestedClaim[];
}

export interface VerifierInfo {
  id: string;
  name: string;
  department: string;
  jurisdiction: string;
}

export interface VerifierRequest {
  requestId: string;
  verifier: VerifierInfo;
  purpose: string;
  requestedCredentials: RequestedCredentialSpec[];
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

export interface PresentationProof {
  type: string;
  created: string;
  holder: string;
  nonce: string;
  requestId: string;
  verifier: string;
  bindingDigest: string;
}

export interface StoredCredentialPayload {
  credentialId?: string;
  credentialType?: string;
  title?: string;
  originalCredential?: any;
  credential?: any;
  signature?: string;
  issuer?: string | { id: string; keyId?: string };
  proof?: { type: string; signature: string };
  verification?: { status: string; verifiedAt: string; issuer: string };
}

export interface VerifiablePresentation {
  presentationId: string;
  holder: string;
  verifier: string;
  requestId: string;
  nonce: string;
  purpose: string;
  credentials: StoredCredentialPayload[];
  consent?: {
    granted: boolean;
    timestamp: string;
  };
  proof: PresentationProof;
  createdAt: string;
}

export type OverallVerificationStatus =
  | 'VERIFIED'
  | 'NEEDS_MANUAL_REVIEW'
  | 'SIGNATURE_INVALID'
  | 'UNKNOWN_ISSUER'
  | 'KEY_INACTIVE'
  | 'REQUEST_EXPIRED'
  | 'REQUEST_ALREADY_USED'
  | 'MISSING_CREDENTIAL'
  | 'MISSING_CLAIM'
  | 'CREDENTIAL_INVALID'
  | 'WRONG_VERIFIER'
  | 'CONSENT_NOT_GRANTED'
  | 'IDENTITY_MISMATCH';

export interface CredentialVerificationDetail {
  credentialType: string;
  issuerId: string;
  issuerName: string;
  signatureStatus: 'verified' | 'invalid' | 'unknown_issuer' | 'key_inactive';
  publicKeyStatus: 'registered' | 'unregistered' | 'inactive';
  keyId: string;
  offlineVerified: true;
  mandatoryNotice: string;
  extractedClaims: Record<string, unknown>;
  subject: {
    name?: string;
    dateOfBirth?: string;
    panNumber?: string;
    address?: string;
    [key: string]: unknown;
  };
}

export interface SignatureVerificationDetail {
  issuerId: string;
  issuerName: string;
  keyId: string;
  algorithm: 'Ed25519';
  valid: boolean;
  offlineVerified: true;
  directIssuerContactMade: false;
  disclosureStatement: string;
}

export interface MatchingResult {
  status: 'MATCH' | 'AMBIGUOUS' | 'MISMATCH';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchedFields: string[];
  discrepancies: string[];
  ambiguityReason?: string;
  citizenOwnershipConfirmed: boolean;
}

export interface PrototypeDomicileCertificate {
  certificateId: string;
  certificateType: 'Prototype Domicile Certificate';
  applicant: {
    name: string;
    dateOfBirth: string;
    address: string;
    demoIdentityContext: string;
  };
  verifiedClaims: {
    incomeStatus: string;
    casteStatus: string;
  };
  sourceCredentials: Array<{
    type: string;
    issuer: string;
    issuerName: string;
  }>;
  verificationReference: string;
  issuingAuthority: string;
  department: string;
  issuedAt: string;
  status: 'ISSUED';
  issuanceMode: 'AUTOMATIC' | 'APPROVED_AFTER_MANUAL_REVIEW';
  disclaimer: string;
}

export interface VerificationResult {
  verificationId: string;
  requestId: string;
  presentationId: string;
  status: OverallVerificationStatus;
  message: string;
  verifiedAt: string;
  credentialResults: CredentialVerificationDetail[];
  signatureResults: SignatureVerificationDetail[];
  matchingResult: MatchingResult;
  manualReviewRequired: boolean;
  manualReviewReason?: string;
  issuedCertificate?: PrototypeDomicileCertificate;
  offlineVerificationCertified: true;
}

export interface DomicileApplication {
  applicationId: string;
  applicantName: string;
  dateOfBirth: string;
  address: string;
  status: 'PENDING_CREDENTIALS' | 'VERIFIED' | 'NEEDS_MANUAL_REVIEW' | 'APPROVED' | 'REJECTED';
  verificationId?: string;
  presentationId?: string;
  reviewNotes?: string;
  reviewerDecision?: 'APPROVED' | 'REJECTED';
  reviewedAt?: string;
  certificateId?: string;
  createdAt: string;
  updatedAt: string;
}
