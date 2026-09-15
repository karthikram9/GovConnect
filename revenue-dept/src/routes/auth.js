const express = require('express');
const router = express.Router();

const { verifyPassword, dummyVerification } = require('../auth/password');
const { generateToken } = require('../auth/token');
const { revokeToken } = require('../auth/revocation');
const { isLoginRateLimited, recordFailedLogin, resetLoginRateLimit } = require('../auth/rateLimiter');
const { findUserByUsername } = require('../auth/users');
const { authenticateToken } = require('../middleware/authenticateToken');

/**
 * Helper to determine client IP for rate limiting
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * POST /auth/login
 * Public authentication endpoint for operators.
 */
router.post('/login', async (req, res) => {
  const clientIp = getClientIp(req);

  // 1. Check brute-force rate limit
  if (isLoginRateLimited(clientIp)) {
    res.setHeader('Retry-After', '300');
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many failed login attempts. Please try again in 5 minutes.'
    });
  }

  // 2. Validate input format
  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    recordFailedLogin(clientIp);
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Username and password must be non-empty strings.'
    });
  }

  try {
    // 3. Locate account
    const user = await findUserByUsername(username);

    if (!user) {
      // Execute synthetic scrypt verification to prevent username enumeration timing attacks
      dummyVerification(password);
      recordFailedLogin(clientIp);
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid username or password.'
      });
    }

    // 4. Verify password securely
    const isMatch = verifyPassword(password, user.password_hash);
    if (!isMatch || user.is_active === false) {
      recordFailedLogin(clientIp);
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid username or password.'
      });
    }

    // 5. Successful login: reset rate limit & issue token
    resetLoginRateLimit(clientIp);

    const token = generateToken({
      sub: user.username,
      role: user.role,
      dept: user.department
    });

    return res.status(200).json({
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
    console.error('Authentication error:', err.message);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An internal authentication error occurred.'
    });
  }
});

/**
 * POST /auth/logout
 * Invalidates current token via JTI revocation.
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    if (req.user && req.user.jti) {
      revokeToken(req.user.jti, req.user.exp);
    }
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred while logging out.'
    });
  }
});

/**
 * GET /auth/me
 * Returns authenticated principal details.
 */
router.get('/me', authenticateToken, (req, res) => {
  return res.status(200).json({
    username: req.user.sub,
    role: req.user.role,
    department: req.user.dept
  });
});

module.exports = router;
