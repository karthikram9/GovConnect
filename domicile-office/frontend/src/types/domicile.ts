export interface TrustedIssuer {
  issuerId: string;
  issuerName: string;
  department: string;
  keyId: string;
  publicKey: string;
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

export interface VerifierRequest {
  requestId: string;
  verifier: {
    id: string;
    name: string;
    department: string;
    jurisdiction: string;
  };
  purpose: string;
  requestedCredentials: RequestedCredentialSpec[];
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

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
  status:
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
