const crypto = require('crypto');
const { verifyToken } = require('../auth/token');

/**
 * Normalizes department string for consistent comparison (handles 'social_welfare' vs 'social-welfare').
 * @param {string} dept
 * @returns {string}
 */
function normalizeDept(dept) {
  if (!dept || typeof dept !== 'string') return '';
  return dept.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Middleware to enforce role-based access control.
 * Requires authenticateToken to have run previously.
 * 
 * @param {...string|string[]} roles - Allowed roles (e.g. 'ADMIN', 'ISSUER_OFFICER')
 */
function requireRole(...roles) {
  const allowedRoles = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. No user principal attached.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Role "${req.user.role}" does not have permission for this resource.`
      });
    }

    next();
  };
}

/**
 * Middleware to enforce department boundary authorization.
 * Requires authenticateToken to have run previously.
 * 
 * @param {...string|string[]} departments - Allowed departments (e.g. 'social-welfare', 'revenue')
 */
function requireDepartment(...departments) {
  const allowedDepts = departments.flat().map(normalizeDept);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. No user principal attached.'
      });
    }

    const userDept = normalizeDept(req.user.dept);
    if (!allowedDepts.includes(userDept)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Department "${req.user.dept}" is not authorized for this resource.`
      });
    }

    next();
  };
}

/**
 * Dual-mode middleware for credential issuance endpoints.
 * Supports BOTH:
 * A) Human Operator Bearer token (ADMIN or ISSUER_OFFICER of target department)
 * B) Machine-to-Machine X-API-Key matching ISSUER_API_KEY
 * 
 * Rejects wrong department or wrong role with 403.
 * Rejects missing/invalid auth with 401.
 * 
 * @param {string} targetDepartment - e.g. 'social-welfare'
 */
function requireIssuanceAuth(targetDepartment) {
  const normalizedTargetDept = normalizeDept(targetDepartment);

  return (req, res, next) => {
    const authHeader = req.header('Authorization');
    const apiKey = req.header('X-API-Key');

    // Path A: Human Operator Bearer Token
    if (authHeader && typeof authHeader === 'string' && authHeader.trim().startsWith('Bearer ')) {
      const parts = authHeader.trim().split(' ');
      if (parts.length !== 2) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Invalid Bearer token format.'
        });
      }

      const verification = verifyToken(parts[1]);
      if (!verification.valid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.user = verification.payload;
      req.authType = 'BEARER_TOKEN';

      // Enforce Department Boundary: Wrong department must receive 403
      const userDept = normalizeDept(req.user.dept);
      if (userDept !== normalizedTargetDept) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. User from department "${req.user.dept}" cannot issue credentials for "${targetDepartment}".`
        });
      }

      // Enforce Role Boundary: REVIEW_OFFICER must NOT issue credentials (403)
      if (!['ADMIN', 'ISSUER_OFFICER'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Access denied. Role "${req.user.role}" is not permitted to issue credentials.`
        });
      }

      return next();
    }

    // Path B: Machine-to-Machine Service Authentication (X-API-Key)
    if (apiKey && typeof apiKey === 'string') {
      const expectedKey = process.env.ISSUER_API_KEY;
      if (!expectedKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const providedBuffer = Buffer.from(apiKey, 'utf8');
      const expectedBuffer = Buffer.from(expectedKey, 'utf8');

      if (providedBuffer.length !== expectedBuffer.length) {
        crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.serviceAuth = true;
      req.authType = 'SERVICE_API_KEY';
      return next();
    }

    // Path C: Neither authentication provided
    return res.status(401).json({ error: 'Unauthorized' });
  };
}

module.exports = {
  requireRole,
  requireDepartment,
  requireIssuanceAuth,
  normalizeDept
};
