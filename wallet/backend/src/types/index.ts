/**
 * GovConnect Wallet Types — Step 1 Project Foundation
 *
 * Aligned with docs/SECURITY_INTEROPERABILITY_CONTRACT.md
 */

export interface HealthResponse {
  service: string;
  status: string;
}

/**
 * Common Credential Status
 */
export type CredentialStatusType = 'active' | 'revoked' | 'suspended';

/**
 * Proof object
 */
export interface CryptographicProof {
  type: 'Ed25519Signature';
  signature: string;
}

/**
 * Target W3C-aligned Credential envelope (v2)
 */
export interface VerifiableCredentialV2 {
  id: string;
  type: string[];
  issuer: {
    id: string;
    keyId: string;
  };
  credentialSubject: Record<string, unknown>;
  claims: Record<string, unknown>;
  validFrom: string;
  validUntil: string | null;
  credentialStatus: {
    status: CredentialStatusType;
  };
  proof: CryptographicProof;
}
