const crypto = require('crypto');

/**
 * Middleware to enforce service-to-service authentication using X-API-Key.
 * Rejects unauthenticated requests with 401 Unauthorized before any DB or crypto operations.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
function requireIssuerApiKey(req, res, next) {
  const providedKey = req.header('X-API-Key');
  const expectedKey = process.env.ISSUER_API_KEY;

  if (!providedKey || !expectedKey || typeof providedKey !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const providedBuffer = Buffer.from(providedKey, 'utf8');
  const expectedBuffer = Buffer.from(expectedKey, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    // Constant-time dummy comparison to prevent timing leak on length inequality
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireIssuerApiKey };
