/**
 * GovConnect Domicile Certificate Office — Verifier-Side Replay Protection Service
 *
 * Implements independent, authoritative verifier-side replay prevention.
 * Rejects consumed requestIds and nonces regardless of Wallet status.
 *
 * In strict adherence to Section 22 of docs/SECURITY_INTEROPERABILITY_CONTRACT.md:
 * - Each verification session uses a single-use cryptographically fresh nonce.
 * - Once verified, the verifier permanently consumes the requestId and nonce.
 * - Re-submitting the same presentation produces REPLAY_DETECTED / REQUEST_ALREADY_USED.
 */

export interface ConsumedTokenRecord {
  requestId: string;
  nonce: string;
  presentationId: string;
  consumedAt: string;
}

const consumedRequestsMap: Map<string, ConsumedTokenRecord> = new Map();
const consumedNoncesSet: Set<string> = new Set();

/**
 * Checks if a requestId or nonce has already been consumed by this verifier.
 */
export function isTokenConsumed(requestId: string, nonce: string): boolean {
  if (consumedRequestsMap.has(requestId)) {
    return true;
  }
  if (consumedNoncesSet.has(nonce)) {
    return true;
  }
  return false;
}

/**
 * Marks a requestId and nonce as permanently consumed.
 */
export function markTokenConsumed(params: {
  requestId: string;
  nonce: string;
  presentationId: string;
}): void {
  const record: ConsumedTokenRecord = {
    requestId: params.requestId,
    nonce: params.nonce,
    presentationId: params.presentationId,
    consumedAt: new Date().toISOString()
  };

  consumedRequestsMap.set(params.requestId, record);
  consumedNoncesSet.add(params.nonce);
}

/**
 * Clears the replay registry (for testing purposes only).
 */
export function clearReplayRegistry(): void {
  consumedRequestsMap.clear();
  consumedNoncesSet.clear();
}
