import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';

/**
 * Canonically serializes credential object into deterministic UTF-8 JSON.
 * Produces identical string representation regardless of key insertion order,
 * matching issuer canonicalization.
 */
export function canonicalize(data: unknown): string {
  return stringify(data);
}

/**
 * Fetches the active Ed25519 public key from the issuer's /public-key endpoint.
 */
export async function fetchIssuerPublicKey(issuerUrl: string): Promise<string> {
  const url = `${issuerUrl.replace(/\/+$/, '')}/public-key`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch issuer public key from ${url}: HTTP ${res.status}`);
  }

  const data = await res.json() as { publicKey?: string; publicKeyPem?: string; error?: string };
  const keyStr = data.publicKeyPem || data.publicKey;

  if (!keyStr) {
    throw new Error(`Invalid public key response from ${url}: missing publicKey/publicKeyPem`);
  }

  return keyStr;
}

/**
 * Cryptographically verifies an Ed25519 digital signature over a canonicalized credential payload.
 *
 * IMPORTANT:
 * Verifies the ORIGINAL received v1 credential object before any transformation or normalization.
 *
 * @param credentialObject The exact credential payload received from the issuer
 * @param signatureBase64 The Base64-encoded Ed25519 signature
 * @param publicKeyStr The issuer's SPKI PEM or Base64-encoded SPKI DER public key
 * @returns boolean True if the signature is valid, false otherwise
 */
export function verifyCredentialSignature(
  credentialObject: unknown,
  signatureBase64: string,
  publicKeyStr: string
): boolean {
  if (!credentialObject || !signatureBase64 || !publicKeyStr) {
    return false;
  }

  try {
    let verifierKey: crypto.KeyObject;

    if (publicKeyStr.includes('-----BEGIN PUBLIC KEY-----')) {
      verifierKey = crypto.createPublicKey(publicKeyStr);
    } else {
      verifierKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyStr, 'base64'),
        format: 'der',
        type: 'spki'
      });
    }

    const canonicalData = canonicalize(credentialObject);

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
