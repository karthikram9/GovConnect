const { verifyToken } = require('../auth/token');

/**
 * Express middleware to enforce Bearer token authentication.
 * 
 * Extracts Bearer token from 'Authorization: Bearer <token>',
 * verifies cryptographic signature, algorithm, claims, expiration, and revocation.
 * Attaches decoded payload to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.header('Authorization');

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Authorization header missing.'
    });
  }

  const parts = authHeader.trim().split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Bearer scheme required.'
    });
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

    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: clientMessage
    });
  }

  req.user = verification.payload;
  req.authType = 'BEARER_TOKEN';
  next();
}

module.exports = { authenticateToken };
