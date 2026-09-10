require('dotenv').config();
const { Client } = require('pg');
const { initDatabase, pool, query } = require('../src/db');

async function ensureDatabaseExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set in environment or .env');
  }

  try {
    const parsed = new URL(dbUrl);
    const targetDbName = parsed.pathname.replace(/^\//, '');

    // Connect to the default 'postgres' database to check/create target database
    parsed.pathname = '/postgres';
    const adminClient = new Client({ connectionString: parsed.toString() });
    await adminClient.connect();

    const checkRes = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbName]
    );

    if (checkRes.rows.length === 0) {
      console.log(`Database '${targetDbName}' does not exist. Creating...`);
      // CREATE DATABASE cannot be executed inside a transaction block or parameterized
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Database '${targetDbName}' created successfully.`);
    } else {
      console.log(`Database '${targetDbName}' already exists.`);
    }

    await adminClient.end();
  } catch (err) {
    console.warn(`Note on database creation check: ${err.message}`);
  }
}

async function main() {
  console.log('Initializing GovConnect Social Welfare Department database...');
  try {
    // 1. Ensure target database exists
    await ensureDatabaseExists();

    // 2. Initialize schema and seeds
    await initDatabase();
    console.log('✅ Schema and seeds applied successfully.');

    // 3. Confirm count of citizens
    const countRes = await query('SELECT COUNT(*) AS total FROM citizens');
    const total = parseInt(countRes.rows[0].total, 10);
    console.log(`✅ Citizen count confirmed: ${total} records in 'citizens' table.`);

    if (total !== 20) {
      console.warn(`⚠️ Warning: Expected exactly 20 mock citizens, found ${total}`);
    }
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
