const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

/**
 * Migration runner: Executes SQL migrations in strict alphabetical/version order
 * Tracks applied migrations in a `schema_migrations` ledger table.
 */
async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[MIGRATION] Starting database migration process...');

    // 1. Create migration tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const { rows: applied } = await client.query('SELECT migration_name FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.migration_name));

    // 3. Read migration files from migrations folder
    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[MIGRATION] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`[MIGRATION] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATION] Successfully applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATION ERROR] Failed on ${file}:`, err.message);
        throw err;
      }
    }

    console.log('[MIGRATION] All migrations applied successfully.');
  } finally {
    client.release();
  }
}

// Allow standalone execution via `node src/db/migrate.js`
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[MIGRATION FATAL ERROR]:', err);
      pool.end().then(() => process.exit(1));
    });
}

module.exports = { runMigrations };
