import { Router, Request, Response } from 'express';

export const healthRouter = Router();

/**
 * Health check endpoint
 * GET /health
 */
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'govconnect-wallet',
    status: 'ok'
  });
});
