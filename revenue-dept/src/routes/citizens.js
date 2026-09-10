const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { formatDate } = require('../credentials/incomeCertificate');

/**
 * Minimal citizens list endpoint
 * GET /citizens
 * Exposes only minimal non-sensitive fields (id, name, dateOfBirth)
 */
router.get('/citizens', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, applicant_name, date_of_birth FROM citizens ORDER BY id ASC'
    );

    const citizens = result.rows.map((row) => ({
      id: row.id,
      name: row.applicant_name,
      dateOfBirth: formatDate(row.date_of_birth)
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
 */
router.get('/citizens/:citizenId', async (req, res) => {
  const citizenId = parseInt(req.params.citizenId, 10);
  if (isNaN(citizenId) || citizenId <= 0) {
    return res.status(400).json({ error: 'Invalid citizen ID. Must be a positive integer.' });
  }

  try {
    const result = await query(
      'SELECT id, applicant_name, date_of_birth, annual_income, pan_number, address FROM citizens WHERE id = $1',
      [citizenId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Citizen with ID ${citizenId} not found` });
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      name: row.applicant_name,
      dateOfBirth: formatDate(row.date_of_birth),
      annualIncome: Number(row.annual_income),
      panNumber: row.pan_number,
      address: row.address
    });
  } catch (err) {
    console.error(`Error fetching citizen ${citizenId}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch citizen details' });
  }
});

module.exports = router;
