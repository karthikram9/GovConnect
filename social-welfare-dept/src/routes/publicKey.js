const express = require('express');
const router = express.Router();
const { getPublicKeyBase64, getPublicKeyPem } = require('../crypto/signer');
const { ISSUER_ID } = require('../credentials/casteCertificate');

/**
 * Public key endpoint
 * GET /public-key
 * Returns the Ed25519 public key corresponding to the private signing key.
 * Private key is never exposed.
 */
router.get('/public-key', (req, res) => {
  try {
    const publicKey = getPublicKeyBase64();
    const pem = getPublicKeyPem();

    res.status(200).json({
      issuer: ISSUER_ID,
      publicKey: publicKey,
      publicKeyPem: pem
    });
  } catch (err) {
    console.error('Error fetching public key:', err);
    res.status(500).json({
      error: 'Failed to retrieve public key'
    });
  }
});

module.exports = router;
