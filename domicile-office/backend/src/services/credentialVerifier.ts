import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';
import {
  VerifiablePresentation,
  CredentialVerificationDetail,
  SignatureVerificationDetail,
  OverallVerificationStatus,
  StoredCredentialPayload
} from '../types/index.js';
import { getTrustedIssuer, getIssuerPublicKey } from './trustRegistry.js';
import { isTokenConsumed, markTokenConsumed } from './replayService.js';
import { config } from '../config/index.js';

/**
 * Canonically serializes credential payload into deterministic UTF-8 JSON.
 * Identical algorithm used by Revenue Department and Social Welfare Department.
 */
export function canonicalize(data: unknown): string {
  return stringify(data);
}

/**
 * Native Ed25519 cryptographic verification.
 * Evaluates: Verify(K_public, Canonicalize(OriginalPayload), Signature) === true
 *
 * CRITICAL CRYPTOGRAPHIC RULE:
 * Verifies the exact, original payload object without transformation, renaming, or normalization.
 */
export function verifyEd25519Signature(
  payload: unknown,
  signatureBase64: string,
  publicKeyPemOrDer: string
): boolean {
  if (!payload || !signatureBase64 || !publicKeyPemOrDer) {
    return false;
  }

  try {
    let verifierKey: crypto.KeyObject;

    if (publicKeyPemOrDer.includes('-----BEGIN PUBLIC KEY-----')) {
      verifierKey = crypto.createPublicKey(publicKeyPemOrDer);
    } else {
      verifierKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyPemOrDer, 'base64'),
        format: 'der',
        type: 'spki'
      });
    }

    const canonicalData = canonicalize(payload);

    return crypto.verify(
      null,
      Buffer.from(canonicalData, 'utf8'),
      verifierKey,
      Buffer.from(signatureBase64, 'base64')
    );
  } catch (err) {
    return false;
  }
}

export interface VerificationPipelineResult {
  valid: boolean;
  status: OverallVerificationStatus;
  errorMessage?: string;
  credentialResults: CredentialVerificationDetail[];
  signatureResults: SignatureVerificationDetail[];
  extractedSubject: {
    name?: string;
    dateOfBirth?: string;
    address?: string;
    panNumber?: string;
    casteCategory?: string;
    casteName?: string;
    annualIncome?: number;
  };
}

/**
 * Executes the complete offline cryptographic and envelope verification pipeline.
 *
 * NOTE: ZERO network calls are made to port 4001 or port 4002.
 */
export async function verifyPresentation(
  presentation: VerifiablePresentation,
  expectedRequest?: {
    requestId: string;
    nonce: string;
    expiresAt?: string;
  }
): Promise<VerificationPipelineResult> {
  const credentialResults: CredentialVerificationDetail[] = [];
  const signatureResults: SignatureVerificationDetail[] = [];
  const extractedSubject: VerificationPipelineResult['extractedSubject'] = {};

  // 1. Structural Parsing
  if (!presentation || typeof presentation !== 'object') {
    return {
      valid: false,
      status: 'CREDENTIAL_INVALID',
      errorMessage: 'Presentation payload is empty or malformed.',
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  if (!presentation.presentationId || !presentation.proof || !Array.isArray(presentation.credentials)) {
    return {
      valid: false,
      status: 'CREDENTIAL_INVALID',
      errorMessage: 'Missing required presentation fields (presentationId, credentials, or proof).',
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  // 2. Verifier Identity Binding
  if (presentation.verifier && presentation.verifier !== config.verifier.id) {
    return {
      valid: false,
      status: 'WRONG_VERIFIER',
      errorMessage: `Presentation is bound to recipient "${presentation.verifier}", but this verifier is "${config.verifier.id}".`,
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  // 3. Expected Request ID & Nonce Match
  if (expectedRequest) {
    if (presentation.requestId !== expectedRequest.requestId) {
      return {
        valid: false,
        status: 'CREDENTIAL_INVALID',
        errorMessage: `Presentation requestId "${presentation.requestId}" does not match active request "${expectedRequest.requestId}".`,
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }

    if (presentation.nonce !== expectedRequest.nonce) {
      return {
        valid: false,
        status: 'CREDENTIAL_INVALID',
        errorMessage: `Presentation nonce does not match the active session challenge.`,
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }

    if (expectedRequest.expiresAt && Date.now() > new Date(expectedRequest.expiresAt).getTime()) {
      return {
        valid: false,
        status: 'REQUEST_EXPIRED',
        errorMessage: 'This verification request has expired (> 15 minutes). Please generate a fresh request.',
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }
  }

  // 4. Verifier-Side Replay Protection
  const alreadyConsumed = isTokenConsumed(presentation.requestId, presentation.nonce);
  if (alreadyConsumed) {
    return {
      valid: false,
      status: 'REQUEST_ALREADY_USED',
      errorMessage: 'This verification request or challenge nonce has already been consumed. Replay detected.',
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  // 5. Credentials Count
  if (presentation.credentials.length === 0) {
    return {
      valid: false,
      status: 'MISSING_CREDENTIAL',
      errorMessage: 'No credentials included in the presentation.',
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  // 6. Iterate through credentials and perform OFFLINE Ed25519 signature checks
  for (const cred of presentation.credentials) {
    // Extract original unmutated payload and signature
    const originalPayload = cred.originalCredential || cred.credential || cred;
    const signature = cred.signature || cred.proof?.signature || '';
    const credType = cred.credentialType || originalPayload.credentialType || originalPayload.type?.[1] || 'UnknownCredential';
    
    // Extract issuer identifier
    let rawIssuer = cred.issuer || originalPayload.issuer;
    let issuerId = typeof rawIssuer === 'string' ? rawIssuer : (rawIssuer?.id || '');

    // Canonicalize known issuer aliases
    if (issuerId === 'revenue-department-maharashtra') issuerId = 'revenue-dept-maharashtra';
    if (issuerId === 'social-welfare-department-maharashtra') issuerId = 'social-welfare-dept-maharashtra';

    // A. Check Trust Registry
    const trustedIssuer = getTrustedIssuer(issuerId);
    if (!trustedIssuer) {
      return {
        valid: false,
        status: 'UNKNOWN_ISSUER',
        errorMessage: `Issuer "${issuerId}" is not registered in the Domicile Office Trust Registry.`,
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }

    // B. Check Public Key Status
    const pubKeyData = getIssuerPublicKey(issuerId);
    if (!pubKeyData || pubKeyData.status !== 'active') {
      return {
        valid: false,
        status: 'KEY_INACTIVE',
        errorMessage: `The signing key for issuer "${issuerId}" is inactive or revoked.`,
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }

    // C. Perform Offline Ed25519 Signature Verification
    const isSignatureValid = verifyEd25519Signature(
      originalPayload,
      signature,
      pubKeyData.key
    );

    if (!isSignatureValid) {
      return {
        valid: false,
        status: 'SIGNATURE_INVALID',
        errorMessage: `Cryptographic signature verification failed for ${credType}. The certificate payload may have been tampered with.`,
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }

    // D. Mandatory Verification Disclosure Notice
    const mandatoryNotice = `Signature checked against ${trustedIssuer.issuerName}'s registered public key — no direct contact with ${trustedIssuer.issuerName} was needed.`;

    const credSubject = originalPayload.subject || originalPayload.credentialSubject || {};
    const credClaims = originalPayload.claims || {};

    // E. Record Details
    credentialResults.push({
      credentialType: credType,
      issuerId: trustedIssuer.issuerId,
      issuerName: trustedIssuer.issuerName,
      signatureStatus: 'verified',
      publicKeyStatus: 'registered',
      keyId: pubKeyData.keyId,
      offlineVerified: true,
      mandatoryNotice,
      extractedClaims: credClaims,
      subject: credSubject
    });

    signatureResults.push({
      issuerId: trustedIssuer.issuerId,
      issuerName: trustedIssuer.issuerName,
      keyId: pubKeyData.keyId,
      algorithm: 'Ed25519',
      valid: true,
      offlineVerified: true,
      directIssuerContactMade: false,
      disclosureStatement: mandatoryNotice
    });

    // Populate demographic extraction
    if (credSubject.name) extractedSubject.name = credSubject.name;
    if (credSubject.dateOfBirth) extractedSubject.dateOfBirth = credSubject.dateOfBirth;
    if (credSubject.address) extractedSubject.address = credSubject.address;
    if (credSubject.panNumber) extractedSubject.panNumber = credSubject.panNumber;
    if (credClaims.annualIncome !== undefined) extractedSubject.annualIncome = Number(credClaims.annualIncome);
    if (credClaims.casteCategory) extractedSubject.casteCategory = String(credClaims.casteCategory);
    if (credClaims.casteName) extractedSubject.casteName = String(credClaims.casteName);
  }

  // 7. Check for required credential types
  const hasIncome = credentialResults.some(c => c.credentialType === 'IncomeCertificate');
  const hasCaste = credentialResults.some(c => c.credentialType === 'CasteCertificate');

  if (!hasIncome && !hasCaste) {
    return {
      valid: false,
      status: 'MISSING_CREDENTIAL',
      errorMessage: 'Presentation must contain at least an Income Certificate or Caste Certificate.',
      credentialResults,
      signatureResults,
      extractedSubject
    };
  }

  // 8. Check for required claims inside provided credentials
  if (hasIncome) {
    const incomeResult = credentialResults.find(c => c.credentialType === 'IncomeCertificate');
    if (incomeResult?.extractedClaims.annualIncome === undefined) {
      return {
        valid: false,
        status: 'MISSING_CLAIM',
        errorMessage: 'Income Certificate is missing required claim: annualIncome.',
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }
  }

  if (hasCaste) {
    const casteResult = credentialResults.find(c => c.credentialType === 'CasteCertificate');
    if (!casteResult?.extractedClaims.casteCategory) {
      return {
        valid: false,
        status: 'MISSING_CLAIM',
        errorMessage: 'Caste Certificate is missing required claim: casteCategory.',
        credentialResults,
        signatureResults,
        extractedSubject
      };
    }
  }

  // Replay token will be burned upon final acceptance
  return {
    valid: true,
    status: 'VERIFIED',
    credentialResults,
    signatureResults,
    extractedSubject
  };
}
