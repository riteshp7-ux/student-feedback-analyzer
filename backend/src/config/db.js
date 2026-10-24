const { Pool } = require('pg');
const env = require('./env');

const isLocalhost = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');

// TLS policy is now explicit instead of silently insecure:
//   DATABASE_SSL=false / DATABASE_SSL_MODE=disable -> skip TLS (used in local dev)
//   DATABASE_SSL_MODE=verify-full -> verify the server certificate (recommended for PaaS)
//   unset on remote -> connect with TLS but skip verification (emitting a loud warning)
let sslConfig = false;
if (process.env.DATABASE_SSL === 'false' || (process.env.DATABASE_SSL_MODE || '').toLowerCase() === 'disable') {
  sslConfig = false;
} else if (!isLocalhost) {
  if ((process.env.DATABASE_SSL_MODE || '').toLowerCase() === 'verify-full') {
    sslConfig = { rejectUnauthorized: true };
  } else {
    sslConfig = { rejectUnauthorized: false };
    console.warn(
      '[DB WARNING] TLS certificate verification is DISABLED for remote PostgreSQL connections. '
      + 'This is vulnerable to man-in-the-middle attacks. Set DATABASE_SSL_MODE=verify-full '
      + '(with a CA bundle trusted by the host) to enforce verification.'
    );
  }
} else if (process.env.DATABASE_SSL === 'true') {
  sslConfig = { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: sslConfig,
  max: 10,
  idleTimeoutMillis: (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) ? 1000 : 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
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
  closePool: () => {
    if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
      return pool.end();
    }
  },
};
