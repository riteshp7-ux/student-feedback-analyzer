const { URL } = require('node:url');

function databaseNameFromUrl(databaseUrl) {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

function hostnameFromUrl(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
}

function validateDemoResetTarget({ nodeEnv, databaseUrl, allowedDatabase, confirmation }) {
  const actualDatabase = databaseNameFromUrl(databaseUrl);
  const currentEnv = nodeEnv || process.env.NODE_ENV || 'development';
  const allowedEnvironments = new Set(['development', 'test']);
  if (!allowedEnvironments.has(currentEnv)) {
    return { allowed: false, reason: 'Destructive demo reset is only allowed in development or test.' };
  }
  // Test runs auto-confirm the reset for local developer convenience, but that
  // must never extend to remote or production-named databases: pointing
  // DATABASE_URL at a shared/hosted instance and running the test suite would
  // otherwise wipe it without any explicit human confirmation.
  if (currentEnv === 'test') {
    const host = hostnameFromUrl(databaseUrl);
    const isLocalHost = host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const looksLikeTestDb = /test/i.test(actualDatabase);
    const looksLikeProductionDb = /prod|live/i.test(actualDatabase);
    if (!isLocalHost && !looksLikeTestDb) {
      return {
        allowed: false,
        reason: 'Refusing test-mode reset of a non-local database. Use a database with "test" in its name, or run the reset explicitly via db:demo-reset.',
      };
    }
    if (looksLikeProductionDb && process.env.ALLOW_UNSAFE_DB_RESET !== 'I_UNDERSTAND') {
      return {
        allowed: false,
        reason: 'Target database name looks production-related. Set ALLOW_UNSAFE_DB_RESET=I_UNDERSTAND only if you are certain this is disposable.',
      };
    }
  }
  if (confirmation !== 'YES') {
    return { allowed: false, reason: 'Set ALLOW_DESTRUCTIVE_DEMO_RESET=YES to confirm the destructive reset.' };
  }
  if (!actualDatabase || !allowedDatabase || actualDatabase !== allowedDatabase) {
    return { allowed: false, reason: 'DEMO_RESET_DATABASE must exactly match the target database name.' };
  }
  return { allowed: true, databaseName: actualDatabase };
}

module.exports = { databaseNameFromUrl, hostnameFromUrl, validateDemoResetTarget };
