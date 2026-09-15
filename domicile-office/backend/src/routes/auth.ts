import { Router, Request, Response } from 'express';
import { verifyPassword, dummyVerification } from '../auth/password.js';
import { generateToken } from '../auth/token.js';
import { revokeToken } from '../auth/revocation.js';
import { isLoginRateLimited, recordFailedLogin, resetLoginRateLimit } from '../auth/rateLimiter.js';
import { findUserByUsername } from '../auth/users.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authenticateToken.js';

const router = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0];
  return req.socket.remoteAddress || '127.0.0.1';
}

router.post('/login', async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);

  // 1. Rate limiting check
  if (isLoginRateLimited(clientIp)) {
    res.setHeader('Retry-After', '300');
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many failed login attempts. Please try again in 5 minutes.'
    });
    return;
  }

  // 2. Validate input
  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    recordFailedLogin(clientIp);
    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Username and password must be non-empty strings.'
    });
    return;
  }

  try {
    // 3. Find account
    const user = await findUserByUsername(username);

    if (!user) {
      dummyVerification(password);
      recordFailedLogin(clientIp);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid username or password.'
      });
      return;
    }

    // 4. Verify password
    const isMatch = verifyPassword(password, user.password_hash);
    if (!isMatch || user.is_active === false) {
      recordFailedLogin(clientIp);
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid username or password.'
      });
      return;
    }

    // 5. Successful login
    resetLoginRateLimit(clientIp);

    const token = generateToken({
      sub: user.username,
      role: user.role,
      dept: user.department
    });

    res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: 7200,
      user: {
        username: user.username,
        role: user.role,
        department: user.department
      }
    });
  } catch (err) {
    console.error('Authentication error:', err instanceof Error ? err.message : String(err));
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An internal authentication error occurred.'
    });
  }
});

router.post('/logout', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user && authReq.user.jti) {
    revokeToken(authReq.user.jti, authReq.user.exp);
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
});

router.get('/me', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  res.status(200).json({
    username: authReq.user?.sub,
    role: authReq.user?.role,
    department: authReq.user?.dept
  });
});

export default router;
