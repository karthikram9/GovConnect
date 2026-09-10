const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { buildCredential, ISSUER_ID } = require('../credentials/casteCertificate');
const { signCredential } = require('../crypto/signer');
const { requireIssuerApiKey } = require('../middleware/auth');

/**
 * Issue Caste Certificate for a citizen
 * POST /issue-credential/:citizenId
 */
router.post('/issue-credential/:citizenId', requireIssuerApiKey, async (req, res) => {
  const citizenId = parseInt(req.params.citizenId, 10);

  // 1. Validate citizen ID
  if (isNaN(citizenId) || citizenId <= 0) {
    return res.status(400).json({
      error: 'Invalid citizen ID. Must be a positive integer.'
    });
  }

  try {
    // 2. Find citizen in PostgreSQL
    const citizenResult = await query(
      "SELECT id, applicant_name, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, caste_category, caste_name, certificate_number, address FROM citizens WHERE id = $1",
      [citizenId]
    );

    if (citizenResult.rows.length === 0) {
      return res.status(404).json({
        error: `Citizen with ID ${citizenId} not found`
      });
    }

    const citizen = citizenResult.rows[0];

    // 3. Build CasteCertificate credential
    const credential = buildCredential(citizen);

    // 4 & 5. Canonically serialize and sign with Ed25519 private key
    let signature;
    try {
      signature = signCredential(credential);
    } catch (signErr) {
      console.error('Cryptographic signing failed:', signErr.message);
      return res.status(500).json({ error: 'Failed to sign credential cryptographically' });
    }

    // 6. Store credential JSON and signature in PostgreSQL
    await query(
      'INSERT INTO issued_credentials (citizen_id, credential_json, signature, issued_at) VALUES ($1, $2, $3, $4)',
      [citizen.id, JSON.stringify(credential), signature, credential.issuedAt]
    );

    console.log(`CasteCertificate issued for citizen ID ${citizen.id} (${citizen.applicant_name})`);

    // 7. Return response matching required shape
    return res.status(201).json({
      credential,
      signature,
      issuer: ISSUER_ID
    });
  } catch (err) {
    console.error('Error issuing credential:', err.message);
    return res.status(500).json({ error: 'Internal server error while issuing credential' });
  }
});

/**
 * Get all issued credentials
 * GET /issued-credentials
 */
router.get('/issued-credentials', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ic.id AS id,
        ic.citizen_id AS citizen_id,
        c.applicant_name AS citizen_name,
        ic.credential_json->>'credentialType' AS credential_type,
        ic.credential_json->>'issuer' AS issuer,
        ic.signature AS signature,
        ic.credential_json AS credential,
        ic.issued_at AS issued_at
      FROM issued_credentials ic
      LEFT JOIN citizens c ON ic.citizen_id = c.id
      ORDER BY ic.id DESC
    `);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching issued credentials:', err.message);
    return res.status(500).json({ error: 'Failed to fetch issued credentials' });
  }
});

module.exports = router;
