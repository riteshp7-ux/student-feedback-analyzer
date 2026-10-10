const { Pool } = require('pg');
const env = require('./env');

const isLocalhost = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
const sslConfig = !isLocalhost
  ? { rejectUnauthorized: false }
  : (process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB ERROR] Unexpected error on idle client:', err.message);
});

/**
 * Checks connection health to PostgreSQL database
 * @returns {Promise<boolean>}
 */
async function checkDatabaseHealth() {
  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    return true;
  } catch (err) {
    return false;
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  checkDatabaseHealth,
  closePool: () => pool.end(),
};
