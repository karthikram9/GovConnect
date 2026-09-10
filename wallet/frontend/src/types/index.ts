/**
 * GovConnect Wallet Frontend Types
 * 
 * Source of Truth: docs/SECURITY_INTEROPERABILITY_CONTRACT.md
 */

export interface HealthStatus {
  service: string;
  status: string;
}

/**
 * Demo Identity representation for the prototype wallet.
 * 
 * NOTE: As defined in the contract:
 * - "demo-wallet-user" is an application-level prototype holder identifier.
 * - It is NOT a legal identity.
 * - It is NOT proof that the human presenting the credential is the person named in the credential.
 * - Cryptographic signature validity is never treated as identity proof.
 */
export interface DemoHolderProfile {
  holderId: 'demo-wallet-user';
  displayName: string;
  isDemo: true;
}

export type CredentialStatus = 'active' | 'revoked' | 'suspended';

export interface CredentialSubject {
  name: string;
  dateOfBirth: string;
  address: string;
  panNumber?: string;
  [key: string]: unknown;
}

export interface VerifiableCredential {
  id: string;
  type: string[];
  issuer: {
    id: string;
    keyId: string;
  };
  credentialSubject: CredentialSubject;
  claims: Record<string, unknown>;
  validFrom: string;
  validUntil: string | null;
  credentialStatus: {
    status: CredentialStatus;
  };
  proof: {
    type: 'Ed25519Signature';
    signature: string;
  };
}
