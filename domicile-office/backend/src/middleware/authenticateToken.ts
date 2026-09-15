import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenClaims } from '../auth/token.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenClaims;
  authType?: string;
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');

  if (!authHeader || typeof authHeader !== 'string') {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Authorization header missing.'
    });
    return;
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Bearer scheme required.'
    });
    return;
  }

  const tokenString = parts[1];
  const verification = verifyToken(tokenString);

  if (!verification.valid) {
    let clientMessage = 'Invalid or expired authentication token.';
    if (verification.error === 'TOKEN_EXPIRED') {
      clientMessage = 'Authentication token has expired. Please log in again.';
    } else if (verification.error === 'TOKEN_REVOKED') {
      clientMessage = 'Authentication token has been revoked. Please log in again.';
    }

    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: clientMessage
    });
    return;
  }

  (req as AuthenticatedRequest).user = verification.payload;
  (req as AuthenticatedRequest).authType = 'BEARER_TOKEN';
  next();
}
