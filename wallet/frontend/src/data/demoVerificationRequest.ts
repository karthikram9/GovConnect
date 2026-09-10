/**
 * GovConnect Demo Verifier Request Fixture — SIH26129
 *
 * NOTE:
 * This is a TEMPORARY Wallet-side demo request fixture simulating a request
 * from the Domicile Certificate Office. It will be replaced by a real network-delivered
 * request once the Domicile Certificate Office verifier service is built in subsequent steps.
 *
 * DO NOT create a fake Domicile backend or server.
 * This fixture exists strictly for client-side consent preview and presentation packaging.
 */

import { VerifierRequest } from '../types/presentation';

export const DOMICILE_VERIFIER_INFO = {
  id: 'domicile-office-maharashtra',
  name: 'Domicile Certificate Office',
  department: 'Government of Maharashtra'
};

export const DOMICILE_PURPOSE = 'Verify eligibility for Domicile Certificate';

/**
 * Creates a demo verifier request from Domicile Certificate Office.
 *
 * @param options.expiresInMinutes Duration before the request expires (default: 15 mins)
 * @param options.expired If true, creates an already-expired request for testing
 * @param options.customRequestId Optional override for requestId testing
 * @param options.customNonce Optional override for nonce testing
 */
export function createDemoVerifierRequest(options?: {
  expiresInMinutes?: number;
  expired?: boolean;
  customRequestId?: string;
  customNonce?: string;
}): VerifierRequest {
  const now = Date.now();
  const validityMs = (options?.expiresInMinutes ?? 15) * 60 * 1000;

  const createdAt = options?.expired
    ? new Date(now - validityMs * 2).toISOString()
    : new Date(now).toISOString();

  const expiresAt = options?.expired
    ? new Date(now - validityMs).toISOString()
    : new Date(now + validityMs).toISOString();

  // Deterministic or pseudo-random demo identifiers
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const requestId = options?.customRequestId || `req-domicile-2026-${randomSuffix}`;
  const nonce = options?.customNonce || `n-domicile-sih-${randomSuffix}`;

  return {
    requestId,
    verifier: DOMICILE_VERIFIER_INFO,
    purpose: DOMICILE_PURPOSE,
    requestedCredentials: [
      {
        type: 'IncomeCertificate',
        title: 'Income Certificate',
        issuerName: 'Revenue Department',
        issuerId: 'revenue-dept-maharashtra',
        requiredClaims: [
          { key: 'name', label: 'Full Name' },
          { key: 'dateOfBirth', label: 'Date of Birth' },
          { key: 'address', label: 'Residential Address' },
          { key: 'annualIncome', label: 'Certified Annual Income' }
        ]
      },
      {
        type: 'CasteCertificate',
        title: 'Caste Certificate',
        issuerName: 'Social Welfare Department',
        issuerId: 'social-welfare-dept-maharashtra',
        requiredClaims: [
          { key: 'name', label: 'Full Name' },
          { key: 'dateOfBirth', label: 'Date of Birth' },
          { key: 'address', label: 'Residential Address' },
          { key: 'casteCategory', label: 'Caste Category' },
          { key: 'casteName', label: 'Recognized Caste' },
          { key: 'certificateNumber', label: 'Certificate Number' }
        ]
      }
    ],
    nonce,
    createdAt,
    expiresAt
  };
}

/**
 * Default active demo request instance for the current Wallet session.
 */
export const DEFAULT_DEMO_VERIFIER_REQUEST: VerifierRequest = createDemoVerifierRequest();

/**
 * Attempts to retrieve a live verification request from Domicile Certificate Office (:5000).
 * If Domicile service is offline or unreachable, falls back seamlessly to the demo request fixture.
 */
export async function fetchOrGenerateVerifierRequest(): Promise<VerifierRequest> {
  try {
    const res = await fetch('http://localhost:5000/api/verification-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Domicile service offline; fallback cleanly
  }
  return createDemoVerifierRequest();
}
