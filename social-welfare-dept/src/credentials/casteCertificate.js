const ISSUER_ID = 'social-welfare-dept-maharashtra';
const CREDENTIAL_TYPE = 'CasteCertificate';

/**
 * Formats a Date object or date string into YYYY-MM-DD
 * @param {string|Date} dateVal
 * @returns {string}
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(dateVal);
}

/**
 * Builds a CasteCertificate credential from a citizen database record.
 * @param {object} citizen - citizen record from DB
 * @param {string} [customIssuedAt] - optional timestamp for deterministic tests
 * @returns {object} Canonical credential object
 */
function buildCredential(citizen, customIssuedAt = null) {
  if (!citizen) {
    throw new Error('Citizen record is required to build credential');
  }

  const issuedAt = customIssuedAt || new Date().toISOString();

  return {
    credentialType: CREDENTIAL_TYPE,
    issuer: ISSUER_ID,
    subject: {
      name: citizen.applicant_name,
      dateOfBirth: formatDate(citizen.date_of_birth),
      address: citizen.address
    },
    claims: {
      casteCategory: citizen.caste_category,
      casteName: citizen.caste_name,
      certificateNumber: citizen.certificate_number
    },
    issuedAt
  };
}

module.exports = {
  ISSUER_ID,
  CREDENTIAL_TYPE,
  buildCredential,
  formatDate
};
