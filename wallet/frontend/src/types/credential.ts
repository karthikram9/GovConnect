export interface VerificationMetadata {
  status: 'verified';
  algorithm: 'Ed25519';
  verifiedAt: string;
  verifier: string;
  trustNote: string;
}

export interface IncomeCertificateClaims {
  annualIncome: number;
}

export interface CasteCertificateClaims {
  casteCategory: string;
  casteName: string;
  certificateNumber: string;
}

export interface CredentialSubject {
  name: string;
  dateOfBirth: string;
  address?: string;
  panNumber?: string;
}

export interface OriginalCredentialPayload {
  credentialType: 'IncomeCertificate' | 'CasteCertificate' | string;
  issuer: string;
  subject: CredentialSubject;
  claims: Record<string, unknown>;
  issuedAt: string;
}

export interface StoredCredential {
  credentialId: string;
  credentialType: 'IncomeCertificate' | 'CasteCertificate';
  title: string;
  issuer: string;
  issuerName: string;
  issuerDept: string;
  originalCredential: OriginalCredentialPayload;
  signature: string;
  verification: VerificationMetadata;
  fetchedAt: string;
}
