import { Router, Request, Response } from 'express';
import { config } from '../config';
import {
  fetchRevenueCredential,
  fetchSocialWelfareCredential,
  IssuerError
} from '../services/issuerClient';
import {
  fetchIssuerPublicKey,
  verifyCredentialSignature
} from '../services/cryptoVerifier';

export const credentialsRouter = Router();

/**
 * GET /api/credentials
 * Confirms edge-held architecture.
 * The Wallet backend does not maintain a server-side citizen database.
 * Stored credentials reside directly on the user's browser in IndexedDB.
 */
credentialsRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    credentials: [],
    storageModel: 'edge-held-indexeddb',
    message: 'Wallet credentials are held on user device in browser IndexedDB. No centralized database is maintained.'
  });
});

/**
 * POST /api/credentials/fetch/income
 * Fetches an Income Certificate from Revenue Department (port 4001),
 * verifies the Ed25519 digital signature, and returns the verified credential.
 */
credentialsRouter.post('/fetch/income', async (req: Request, res: Response) => {
  const demoCitizenId = req.body.demoCitizenId ? parseInt(req.body.demoCitizenId, 10) : 1;

  if (isNaN(demoCitizenId) || demoCitizenId <= 0) {
    return res.status(400).json({
      error: 'INVALID_DEMO_CITIZEN_ID',
      message: 'demoCitizenId must be a positive integer.'
    });
  }

  try {
    // 1. Fetch signed credential from Revenue Department
    const issued = await fetchRevenueCredential(demoCitizenId);

    // 2. Fetch public key from Revenue Department
    const publicKey = await fetchIssuerPublicKey(config.revenueApiUrl);

    // 3. Cryptographically verify the original credential payload
    const isValid = verifyCredentialSignature(issued.credential, issued.signature, publicKey);

    if (!isValid) {
      console.error('[Security Alert] Ed25519 verification failed for Income Certificate');
      return res.status(502).json({
        error: 'CREDENTIAL_SIGNATURE_INVALID',
        message: 'The credential signature could not be verified.'
      });
    }

    // 4. Construct verified response wrapper
    const verifiedCredential = {
      credentialId: `revenue-IncomeCertificate-${demoCitizenId}`,
      credentialType: 'IncomeCertificate',
      title: 'Income Certificate',
      issuer: issued.issuer,
      issuerName: 'Revenue Department',
      issuerDept: 'Government of Maharashtra',
      originalCredential: issued.credential,
      signature: issued.signature,
      verification: {
        status: 'verified',
        algorithm: 'Ed25519',
        verifiedAt: new Date().toISOString(),
        verifier: 'govconnect-wallet-backend',
        trustNote: "Signature verified using the issuer's public key."
      },
      fetchedAt: new Date().toISOString()
    };

    return res.status(200).json(verifiedCredential);
  } catch (err: unknown) {
    if (err instanceof IssuerError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message
      });
    }

    const msg = err instanceof Error ? err.message : 'Unknown internal error';
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: msg
    });
  }
});

/**
 * POST /api/credentials/fetch/caste
 * Fetches a Caste Certificate from Social Welfare Department (port 4002),
 * verifies the Ed25519 digital signature, and returns the verified credential.
 */
credentialsRouter.post('/fetch/caste', async (req: Request, res: Response) => {
  const demoCitizenId = req.body.demoCitizenId ? parseInt(req.body.demoCitizenId, 10) : 1;

  if (isNaN(demoCitizenId) || demoCitizenId <= 0) {
    return res.status(400).json({
      error: 'INVALID_DEMO_CITIZEN_ID',
      message: 'demoCitizenId must be a positive integer.'
    });
  }

  try {
    // 1. Fetch signed credential from Social Welfare Department
    const issued = await fetchSocialWelfareCredential(demoCitizenId);

    // 2. Fetch public key from Social Welfare Department
    const publicKey = await fetchIssuerPublicKey(config.socialWelfareApiUrl);

    // 3. Cryptographically verify the original credential payload
    const isValid = verifyCredentialSignature(issued.credential, issued.signature, publicKey);

    if (!isValid) {
      console.error('[Security Alert] Ed25519 verification failed for Caste Certificate');
      return res.status(502).json({
        error: 'CREDENTIAL_SIGNATURE_INVALID',
        message: 'The credential signature could not be verified.'
      });
    }

    // 4. Construct verified response wrapper
    const verifiedCredential = {
      credentialId: `social-welfare-CasteCertificate-${demoCitizenId}`,
      credentialType: 'CasteCertificate',
      title: 'Caste Certificate',
      issuer: issued.issuer,
      issuerName: 'Social Welfare Department',
      issuerDept: 'Government of Maharashtra',
      originalCredential: issued.credential,
      signature: issued.signature,
      verification: {
        status: 'verified',
        algorithm: 'Ed25519',
        verifiedAt: new Date().toISOString(),
        verifier: 'govconnect-wallet-backend',
        trustNote: "Signature verified using the issuer's public key."
      },
      fetchedAt: new Date().toISOString()
    };

    return res.status(200).json(verifiedCredential);
  } catch (err: unknown) {
    if (err instanceof IssuerError) {
      return res.status(err.statusCode).json({
        error: err.code,
        message: err.message
      });
    }

    const msg = err instanceof Error ? err.message : 'Unknown internal error';
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: msg
    });
  }
});
