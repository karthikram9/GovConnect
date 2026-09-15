const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { formatDate } = require('../credentials/casteCertificate');
const { authenticateToken } = require('../middleware/authenticateToken');
const { requireRole, requireDepartment } = require('../middleware/rbac');

/**
 * Minimal citizens list endpoint
 * GET /citizens
 * Exposes only minimal non-sensitive fields (id, applicant_name, date_of_birth)
 * Protected: ADMIN or ISSUER_OFFICER of social-welfare
 */
router.get('/citizens', authenticateToken, requireDepartment('social-welfare'), requireRole(['ADMIN', 'ISSUER_OFFICER']), async (req, res) => {
  try {
    const result = await query(
      "SELECT id, applicant_name, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth FROM citizens ORDER BY id ASC"
    );

    const citizens = result.rows.map((row) => ({
      id: row.id,
      applicant_name: row.applicant_name,
      date_of_birth: formatDate(row.date_of_birth),
      name: row.applicant_name // Included for universal client compatibility
    }));

    res.status(200).json(citizens);
  } catch (err) {
    console.error('Error fetching citizens:', err.message);
    res.status(500).json({ error: 'Failed to fetch citizens list' });
  }
});

/**
 * Internal citizen detail endpoint for staff review prior to credential issuance
 * GET /citizens/:citizenId
 * Protected: ADMIN or ISSUER_OFFICER of social-welfare
 */
router.get('/citizens/:citizenId', authenticateToken, requireDepartment('social-welfare'), requireRole(['ADMIN', 'ISSUER_OFFICER']), async (req, res) => {
  const citizenId = parseInt(req.params.citizenId, 10);
  if (isNaN(citizenId) || citizenId <= 0) {
    return res.status(400).json({ error: 'Invalid citizen ID. Must be a positive integer.' });
  }

  try {
    const result = await query(
      "SELECT id, applicant_name, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, caste_category, caste_name, certificate_number, address FROM citizens WHERE id = $1",
      [citizenId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Citizen with ID ${citizenId} not found` });
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      applicant_name: row.applicant_name,
      name: row.applicant_name,
      date_of_birth: formatDate(row.date_of_birth),
      dateOfBirth: formatDate(row.date_of_birth),
      caste_category: row.caste_category,
      casteCategory: row.caste_category,
      caste_name: row.caste_name,
      casteName: row.caste_name,
      certificate_number: row.certificate_number,
      certificateNumber: row.certificate_number,
      address: row.address
    });
  } catch (err) {
    console.error(`Error fetching citizen ${citizenId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch citizen details' });
  }
});

module.exports = router;
