const { query } = require('../db');

// Fallback seed accounts for testing / standalone execution
const FALLBACK_USERS = [
  {
    id: 1,
    username: 'swd_officer_01',
    password_hash: 'scrypt$16384$8$1$582cdfc4a9e882ad0657ce8f540fe2e6$2c6f5110e582e928cd09f256ced69248d9f4195138012102d71e990412f5b84cba7ed906625c979f910133bfaed98eb2161f502fe8bcacea08a1668c22eb653d',
    role: 'ISSUER_OFFICER',
    department: 'social_welfare',
    is_active: true
  },
  {
    id: 2,
    username: 'swd_admin_01',
    password_hash: 'scrypt$16384$8$1$edb7c11e76d1a61c5f20e704338fe62f$c31bbc4525a3a55c5f57075e912b08e9657d52fc094c1b42b2de22dde9ce331c5645a57db008dfdac71440b6fab70ba7f4c5579eacdb2f60b859f5546e484ef3',
    role: 'ADMIN',
    department: 'social_welfare',
    is_active: true
  }
];

let customUserFinder = null;

function setUserFinder(fn) {
  customUserFinder = fn;
}

async function findUserByUsername(username) {
  if (!username || typeof username !== 'string') {
    return null;
  }

  if (customUserFinder) {
    return customUserFinder(username);
  }

  try {
    const result = await query(
      'SELECT id, username, password_hash, role, department, is_active FROM users WHERE username = $1',
      [username.trim()]
    );

    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        username: row.username,
        password_hash: row.password_hash,
        role: row.role,
        department: row.department,
        is_active: Boolean(row.is_active)
      };
    }
  } catch (err) {
    // If DB query fails or table does not exist yet, fallback to seed users
  }

  const fallback = FALLBACK_USERS.find(u => u.username === username.trim());
  return fallback ? { ...fallback } : null;
}

module.exports = {
  findUserByUsername,
  setUserFinder,
  FALLBACK_USERS
};
