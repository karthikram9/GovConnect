import { StoredCredential } from './credential';

/**
 * Specification for a single claim requested by the verifier.
 */
export interface RequestedClaim {
  key: string;
  label: string;
}

/**
 * Specification for a credential requested by the verifier.
 */
export interface RequestedCredentialSpec {
  type: 'IncomeCertificate' | 'CasteCertificate';
  title: string;
  issuerName: string;
  issuerId: string;
  requiredClaims: RequestedClaim[];
}

/**
 * Information identifying the requesting verifier.
 */
export interface VerifierInfo {
  id: string; // e.g. 'domicile-office-maharashtra'
  name: string; // e.g. 'Domicile Certificate Office'
  department: string; // e.g. 'Government of Maharashtra'
}

/**
 * Incoming Verifier Request envelope (inspired by OID4VP request object).
 */
export interface VerifierRequest {
  requestId: string;
  verifier: VerifierInfo;
  purpose: string;
  requestedCredentials: RequestedCredentialSpec[];
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Application-level presentation proof metadata.
 * Binds the presentation envelope to the verifier, requestId, and nonce.
 *
 * NOTE: "demo-wallet-user" is an application-level prototype holder identifier.
 * It is NOT a statutory legal identity, Aadhaar, or proof of real-world identity.
 */
export interface PresentationProof {
  type: 'ApplicationProof';
  created: string;
  holder: 'demo-wallet-user';
  nonce: string;
  requestId: string;
  verifier: string;
  bindingDigest: string;
}

/**
 * Verifiable Presentation Envelope constructed by the Wallet.
 * Preserves the original signed credential payloads and signatures without modification.
 */
export interface VerifiablePresentation {
  presentationId: string;
  holder: 'demo-wallet-user';
  verifier: string;
  requestId: string;
  nonce: string;
  purpose: string;
  credentials: StoredCredential[];
  consent: {
    granted: true;
    timestamp: string;
  };
  proof: PresentationProof;
  createdAt: string;
}

/**
 * Citizen Consent Audit Record.
 *
 * STRICT PRIVACY REQUIREMENT:
 * Stores cryptographic references and audit metadata ONLY.
 * NEVER stores raw credential payloads, income values, caste names, addresses, or PANs.
 */
export interface ConsentRecord {
  consentId: string;
  presentationId: string;
  requestId: string;
  holder: 'demo-wallet-user';
  recipient: string;
  verifierName: string;
  purpose: string;
  credentialsShared: string[]; // Local storage references (e.g. ['revenue-IncomeCertificate-1'])
  credentialTypesShared: string[]; // Type names (e.g. ['IncomeCertificate', 'CasteCertificate'])
  nonce: string;
  timestamp: string;
  status: 'granted';
  decision: 'explicit_citizen_consent';
}

/**
 * Consumed request record for Wallet-side replay protection.
 */
export interface ConsumedRequestRecord {
  requestId: string;
  nonce: string;
  consumedAt: string;
  presentationId: string;
}
