const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== 'test') {
  console.warn('⚠️ WARNING: DATABASE_URL is not defined in environment or .env');
}

// Create connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error on idle client:', err.message);
});

let customQueryHandler = null;

/**
 * Set a custom query handler (useful for testing when live DB is mock/isolated)
 */
function setQueryHandler(handler) {
  customQueryHandler = handler;
}

/**
 * Executes a parameterized SQL query.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Array of parameters
 */
async function query(text, params) {
  if (customQueryHandler) {
    return customQueryHandler(text, params);
  }
  return pool.query(text, params);
}

/**
 * Checks PostgreSQL connectivity.
 * @returns {Promise<boolean>}
 */
async function checkConnection() {
  if (!databaseUrl) {
    return false;
  }
  try {
    const res = await pool.query('SELECT 1 AS connected');
    return res.rows.length > 0;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
}

/**
 * Initializes database schema and seeds from init.sql.
 */
async function initDatabase() {
  const initSqlPath = path.resolve(__dirname, '../init.sql');
  const sql = fs.readFileSync(initSqlPath, 'utf8');
  await pool.query(sql);
}

module.exports = {
  pool,
  query,
  checkConnection,
  initDatabase,
  setQueryHandler
};
