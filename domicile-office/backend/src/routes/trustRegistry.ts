import { Router, Request, Response } from 'express';
import { getAllTrustedIssuers } from '../services/trustRegistry.js';

const router = Router();

/**
 * GET /api/trust-registry
 * Exposes the Domicile Office prototype Trust Registry for public audit.
 * Contains issuer IDs, key IDs, public keys, and operational status.
 * STRICTLY CONTAINS ZERO CITIZEN DATA.
 */
router.get('/', (_req: Request, res: Response) => {
  const issuers = getAllTrustedIssuers();
  res.status(200).json({
    registry: 'GovConnect Prototype Public Trust Registry',
    version: '2.0.1',
    description: 'Cryptographic public keys for authoritative departmental issuers',
    offlineVerificationPolicy: 'Verifiers check signatures locally using these registered keys with zero live issuer database calls',
    issuers
  });
});

export default router;
