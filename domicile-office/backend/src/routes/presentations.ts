import { Router, Request, Response } from 'express';
import { processPresentation } from '../services/applicationService.js';
import { VerifiablePresentation } from '../types/index.js';

const router = Router();

/**
 * POST /api/presentations/verify
 * Accepts a Verifiable Presentation prepared by the citizen Wallet.
 *
 * Verifies submitted credentials OFFLINE using registered public keys.
 * NEVER calls Revenue Department or Social Welfare Department databases.
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { presentation, applicationId, citizenConfirmedOwnership } = req.body as {
      presentation?: VerifiablePresentation;
      applicationId?: string;
      citizenConfirmedOwnership?: boolean;
    };

    if (!presentation) {
      res.status(400).json({
        error: 'MISSING_PAYLOAD',
        message: 'Request body must contain a "presentation" object.'
      });
      return;
    }

    const result = await processPresentation({
      presentation,
      applicationId,
      citizenConfirmedOwnership: Boolean(citizenConfirmedOwnership)
    });

    // Map verification status to appropriate HTTP status code
    if (result.status === 'VERIFIED') {
      res.status(200).json(result);
    } else if (result.status === 'NEEDS_MANUAL_REVIEW') {
      res.status(200).json(result); // 200 with manual review flag
    } else if (result.status === 'REQUEST_EXPIRED') {
      res.status(400).json(result);
    } else if (result.status === 'REQUEST_ALREADY_USED') {
      res.status(400).json(result);
    } else if (result.status === 'UNKNOWN_ISSUER' || result.status === 'KEY_INACTIVE') {
      res.status(400).json(result);
    } else if (result.status === 'SIGNATURE_INVALID') {
      res.status(400).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: unknown) {
    console.error('[Domicile Presentation Verification Error]:', err);
    res.status(500).json({
      error: 'VERIFICATION_ERROR',
      message: 'Internal server error while evaluating presentation.'
    });
  }
});

export default router;
