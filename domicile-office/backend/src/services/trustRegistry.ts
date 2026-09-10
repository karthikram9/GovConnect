import fs from 'fs';
import path from 'path';
import { TrustedIssuer } from '../types/index.js';

/**
 * GovConnect Domicile Certificate Office — Trust Registry Service
 *
 * PROTOTYPE SIMPLIFICATION NOTICE:
 * In accordance with docs/SECURITY_INTEROPERABILITY_CONTRACT.md (Section 8 & 36),
 * the Trust Registry is hosted inside the Domicile backend for prototype simplicity.
 * In a production architecture, this would be an independently governed National
 * Public Key Infrastructure / DID directory / Trust List.
 *
 * STRICT PROHIBITION:
 * This registry stores ONLY public issuer governance information and Ed25519 public keys.
 * It strictly contains ZERO citizen records, PAN, Aadhaar, DOB, income, caste, addresses,
 * or credential payloads.
 */

// Fallback PEM keys matching repository generated keys
const DEFAULT_REVENUE_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAK6o4JpHSuEy2D9A0Bg8GARzgGLsraStr334h+7esay4=
-----END PUBLIC KEY-----`;

const DEFAULT_SOCIAL_WELFARE_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEADcxXj7xX8K4r6yKB61SdtbvwswVbd6uIi+WRGpZtnQo=
-----END PUBLIC KEY-----`;

function loadKeyFileOrDefault(relativePath: string, defaultPem: string): string {
  try {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      if (content.includes('BEGIN PUBLIC KEY')) {
        return content;
      }
    }
  } catch (err) {
    // Fall back to default
  }
  return defaultPem;
}

// In-memory Trust Registry of Authoritative Issuers
const registry: Map<string, TrustedIssuer> = new Map();

function initializeRegistry(): void {
  const revenuePem = loadKeyFileOrDefault('../../revenue-dept/keys/public_key.pem', DEFAULT_REVENUE_PEM);
  const swdPem = loadKeyFileOrDefault('../../social-welfare-dept/keys/public_key.pem', DEFAULT_SOCIAL_WELFARE_PEM);

  const revenueIssuer: TrustedIssuer = {
    issuerId: 'revenue-dept-maharashtra',
    issuerName: 'Revenue Department',
    department: 'Revenue & Forest Department, Government of Maharashtra',
    keyId: 'revenue-key-1',
    publicKey: revenuePem,
    status: 'active',
    credentialTypes: ['IncomeCertificate']
  };

  const socialWelfareIssuer: TrustedIssuer = {
    issuerId: 'social-welfare-dept-maharashtra',
    issuerName: 'Social Welfare Department',
    department: 'Social Justice & Special Assistance Department, Government of Maharashtra',
    keyId: 'social-welfare-key-1',
    publicKey: swdPem,
    status: 'active',
    credentialTypes: ['CasteCertificate']
  };

  registry.set(revenueIssuer.issuerId, revenueIssuer);
  registry.set(socialWelfareIssuer.issuerId, socialWelfareIssuer);
}

// Initialize on load
initializeRegistry();

/**
 * Returns list of all registered issuers in the Trust Registry (sanitized for public transparency).
 */
export function getAllTrustedIssuers(): TrustedIssuer[] {
  return Array.from(registry.values());
}

/**
 * Retrieves a registered issuer by ID.
 */
export function getTrustedIssuer(issuerId: string): TrustedIssuer | undefined {
  return registry.get(issuerId);
}

/**
 * Checks if an issuer is registered.
 */
export function isIssuerRegistered(issuerId: string): boolean {
  return registry.has(issuerId);
}

/**
 * Retrieves the active public key for an issuer.
 */
export function getIssuerPublicKey(issuerId: string): { key: string; keyId: string; status: string } | null {
  const issuer = registry.get(issuerId);
  if (!issuer) return null;
  return {
    key: issuer.publicKey,
    keyId: issuer.keyId,
    status: issuer.status
  };
}

/**
 * Dynamically registers or updates an issuer (for testing key rotation / inactive keys).
 */
export function registerIssuerForTesting(issuer: TrustedIssuer): void {
  registry.set(issuer.issuerId, issuer);
}

/**
 * Resets registry to defaults.
 */
export function resetTrustRegistry(): void {
  registry.clear();
  initializeRegistry();
}
