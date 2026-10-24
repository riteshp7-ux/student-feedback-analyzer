const app = require('./app');
const env = require('./config/env');
const { closePool } = require('./config/db');
const { startAnalysisWorker } = require('./modules/nlp/analysisService');

const stopAnalysisWorker = startAnalysisWorker();

const server = app.listen(env.PORT, () => {
  console.log(`[BACKEND SERVER] Started successfully on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  console.log(`[HEALTH CHECK] Ready at http://localhost:${env.PORT}/health`);
});

let isShuttingDown = false;
const handleShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[BACKEND SERVER] Received ${signal}. Shutting down gracefully...`);

  // Force exit after 10 seconds if connections refuse to terminate
  const forceExitTimeout = setTimeout(() => {
    console.error('[BACKEND SERVER] Forced shutdown due to connection timeout.');
    process.exit(1);
  }, 10000);
  if (forceExitTimeout.unref) forceExitTimeout.unref();

  try {
    await stopAnalysisWorker();
  } catch (err) {
    console.error('[BACKEND SERVER] Error stopping analysis worker:', err.message);
  }

  server.close(async () => {
    console.log('[BACKEND SERVER] Closed out remaining HTTP connections.');
    try {
      await closePool();
      console.log('[BACKEND SERVER] Database pool terminated cleanly.');
    } catch (err) {
      console.error('[BACKEND SERVER] Error terminating database pool:', err.message);
    }
    clearTimeout(forceExitTimeout);
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[BACKEND SERVER] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[BACKEND SERVER] Uncaught Exception:', err);
});

