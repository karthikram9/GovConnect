import { Router, Request, Response } from 'express';
import { createVerificationRequest, getVerificationRequest } from '../services/applicationService.js';

const router = Router();

/**
 * POST /api/verification-requests
 * Generates a fresh Verifier Request for presentation exchange.
 */
router.post('/', (_req: Request, res: Response) => {
  const request = createVerificationRequest();
  res.status(201).json(request);
});

/**
 * GET /api/verification-requests/:requestId
 * Retrieves a specific verification request by ID.
 */
router.get('/:requestId', (req: Request, res: Response) => {
  const request = getVerificationRequest(req.params.requestId);
  if (!request) {
    res.status(404).json({
      error: 'REQUEST_NOT_FOUND',
      message: `Verification request "${req.params.requestId}" does not exist or has expired.`
    });
    return;
  }
  res.status(200).json(request);
});

export default router;
