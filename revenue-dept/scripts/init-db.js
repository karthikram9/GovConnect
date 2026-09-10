require('dotenv').config();
const { initDatabase, pool } = require('../src/db');

async function main() {
  console.log('Initializing govconnect_revenue database...');
  try {
    await initDatabase();
    console.log('✅ Database schema and seeds successfully initialized.');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
