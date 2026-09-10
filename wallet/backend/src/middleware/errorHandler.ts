import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Wallet Backend Error]:', err.message);
  res.status(500).json({
    error: 'Internal server error'
  });
}
