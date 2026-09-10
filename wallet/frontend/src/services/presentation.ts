/**
 * GovConnect Wallet — Presentation Service (Step 3C)
 *
 * Implements client-side presentation assembly, consent validation,
 * credential integrity preservation, and replay protection.
 *
 * In strict adherence to docs/SECURITY_INTEROPERABILITY_CONTRACT.md:
 * - Credentials remain edge-held in browser IndexedDB.
 * - "holder": "demo-wallet-user" is an application-level prototype identifier.
 * - Original issuer credential payloads and Ed25519 signatures are preserved UNMODIFIED.
 * - Consent records store audit references/metadata ONLY (NO raw personal data).
 */

import { StoredCredential } from '../types/credential';
import {
  VerifierRequest,
  VerifiablePresentation,
  ConsentRecord,
  PresentationProof
} from '../types/presentation';
import {
  getAllStoredCredentials,
  saveStoredPresentation,
  saveConsentRecord,
  isRequestConsumed,
  markRequestConsumed
} from './storage';

export class PresentationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'PresentationError';
  }
}

/**
 * Generates a standard random UUID v4 string for presentation and consent identifiers.
 */
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${prefix}-${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * Simple deterministic digest binding the presentation envelope parameters.
 */
function createApplicationProofDigest(params: {
  presentationId: string;
  requestId: string;
  nonce: string;
  holder: string;
  verifier: string;
  created: string;
}): string {
  const content = `${params.presentationId}:${params.requestId}:${params.nonce}:${params.holder}:${params.verifier}:${params.created}`;
  // Simple deterministic hash for application-level binding
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `app-digest-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Validates a verifier request against expiration and local replay tracking.
 */
export async function validateVerifierRequest(request: VerifierRequest): Promise<{ valid: boolean; error?: string; code?: string }> {
  if (!request || !request.requestId || !request.nonce || !request.expiresAt) {
    return { valid: false, code: 'INVALID_REQUEST', error: 'Malformed verification request structure.' };
  }

  // 1. Temporal Expiration Check
  const expirationTime = new Date(request.expiresAt).getTime();
  if (Date.now() > expirationTime) {
    return {
      valid: false,
      code: 'REQUEST_EXPIRED',
      error: 'This verification request has expired.'
    };
  }

  // 2. Replay Protection: Check if requestId or nonce was already consumed locally
  const alreadyConsumed = await isRequestConsumed(request.requestId, request.nonce);
  if (alreadyConsumed) {
    return {
      valid: false,
      code: 'REQUEST_ALREADY_USED',
      error: 'This verification request has already been used.'
    };
  }

  return { valid: true };
}

export interface CreatePresentationOptions {
  request: VerifierRequest;
  selectedCredentialTypes: ('IncomeCertificate' | 'CasteCertificate')[];
  consentGranted: boolean;
}

export interface CreatePresentationResult {
  presentation: VerifiablePresentation;
  consentRecord: ConsentRecord;
}

/**
 * Builds an authentic Verifiable Presentation and audit Consent Record.
 */
export async function createPresentation(
  options: CreatePresentationOptions
): Promise<CreatePresentationResult> {
  const { request, selectedCredentialTypes, consentGranted } = options;

  // 1. Explicit Consent Enforcement
  if (!consentGranted) {
    throw new PresentationError(
      'CONSENT_REQUIRED',
      'Explicit citizen consent is required to share credentials.'
    );
  }

  // 2. Selection Check
  if (!selectedCredentialTypes || selectedCredentialTypes.length === 0) {
    throw new PresentationError(
      'NO_CREDENTIALS_SELECTED',
      'At least one credential must be selected for sharing.'
    );
  }

  // 3. Validate Request Freshness and Replay State
  const validation = await validateVerifierRequest(request);
  if (!validation.valid) {
    throw new PresentationError(validation.code || 'VALIDATION_FAILED', validation.error || 'Request validation failed');
  }

  // 4. Retrieve and Verify Available Credentials from IndexedDB
  const storedList = await getAllStoredCredentials();
  const credentialsToPackage: StoredCredential[] = [];

  for (const type of selectedCredentialTypes) {
    const cred = storedList.find(c => c.credentialType === type);

    if (!cred) {
      throw new PresentationError(
        'CREDENTIAL_MISSING',
        `The requested ${type === 'IncomeCertificate' ? 'Income Certificate' : 'Caste Certificate'} is not stored in your wallet. Please fetch it first.`
      );
    }

    if (cred.verification?.status !== 'verified') {
      throw new PresentationError(
        'CREDENTIAL_NOT_VERIFIED',
        `Credential ${type} has not been cryptographically verified and cannot be shared.`
      );
    }

    // Preserve the original signed credential and signature strictly without modification
    credentialsToPackage.push(cred);
  }

  // 5. Construct Verifiable Presentation Envelope
  const nowIso = new Date().toISOString();
  const presentationId = generateId('vp');

  const proof: PresentationProof = {
    type: 'ApplicationProof',
    created: nowIso,
    holder: 'demo-wallet-user',
    nonce: request.nonce,
    requestId: request.requestId,
    verifier: request.verifier.id,
    bindingDigest: createApplicationProofDigest({
      presentationId,
      requestId: request.requestId,
      nonce: request.nonce,
      holder: 'demo-wallet-user',
      verifier: request.verifier.id,
      created: nowIso
    })
  };

  const presentation: VerifiablePresentation = {
    presentationId,
    holder: 'demo-wallet-user',
    verifier: request.verifier.id,
    requestId: request.requestId,
    nonce: request.nonce,
    purpose: request.purpose,
    credentials: credentialsToPackage,
    consent: {
      granted: true,
      timestamp: nowIso
    },
    proof,
    createdAt: nowIso
  };

  // 6. Construct Consent Audit Record (References ONLY — ZERO Raw Claims)
  const consentRecord: ConsentRecord = {
    consentId: generateId('consent'),
    presentationId,
    requestId: request.requestId,
    holder: 'demo-wallet-user',
    recipient: request.verifier.id,
    verifierName: request.verifier.name,
    purpose: request.purpose,
    credentialsShared: credentialsToPackage.map(c => c.credentialId),
    credentialTypesShared: credentialsToPackage.map(c => c.credentialType),
    nonce: request.nonce,
    timestamp: nowIso,
    status: 'granted',
    decision: 'explicit_citizen_consent'
  };

  // 7. Atomic-style Storage in IndexedDB
  await saveStoredPresentation(presentation);
  await saveConsentRecord(consentRecord);
  await markRequestConsumed({
    requestId: request.requestId,
    nonce: request.nonce,
    consumedAt: nowIso,
    presentationId
  });

  return { presentation, consentRecord };
}

/**
 * Adapter interface for delivery to Domicile Certificate Office (:5000).
 * If Domicile is reachable, submits presentation directly for offline verification.
 * If unreachable, safely retains edge-held prepared state in IndexedDB.
 */
export async function sharePresentation(presentation: VerifiablePresentation): Promise<{
  delivered: boolean;
  localStatus: string;
  presentationId: string;
  message: string;
  verificationResult?: any;
}> {
  console.log('[Wallet Presentation Prepared]:', presentation.presentationId);

  try {
    const res = await fetch('http://localhost:5000/api/presentations/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        presentation,
        citizenConfirmedOwnership: true
      })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        delivered: true,
        localStatus: 'verified_by_domicile',
        presentationId: presentation.presentationId,
        message: 'Presentation successfully transmitted to and verified offline by Domicile Certificate Office.',
        verificationResult: data
      };
    }
  } catch {
    // Domicile backend not running locally; preserve local storage receipt
  }

  return {
    delivered: false,
    localStatus: 'prepared_edge_held',
    presentationId: presentation.presentationId,
    message: 'Demo mode: presentation prepared locally in IndexedDB. Domicile verifier is accessible on port 5000.'
  };
}
