const { pool } = require('../../config/db');
const { analyzeFeedback } = require('./nlpClient');
const {
  getSubmissionForAnalysis,
  saveAnalysisSuccess,
  markAnalysisFailed,
  getPendingSubmissions,
} = require('./analysisRepository');

/**
 * Orchestrates analysis for a single feedback submission.
 * Calls the Python NLP service outside the persistence transaction,
 * validates the response, and persists the analysis results atomically.
 * @param {string} submissionId
 * @param {object} [options]
 * @param {string} [options.nlpUrl]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ success: boolean, analysisResult?: object, error?: string }>}
 */
async function processSubmissionAnalysis(submissionId, options = {}) {
  const startTime = Date.now();

  // 1. Fetch submission data
  const submission = await getSubmissionForAnalysis(submissionId);
  if (!submission) {
    console.warn(`[NLP ANALYSIS] Submission ${submissionId} not found.`);
    return { success: false, error: 'SUBMISSION_NOT_FOUND' };
  }

  // 2. Check comment text
  const text = submission.commentText?.trim();
  if (!text) {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE feedback_submissions SET analysis_status = 'not_applicable' WHERE id = $1;`,
        [submissionId]
      );
      return { success: true };
    } finally {
      client.release();
    }
  }

  // 3. Skip if already completed (idempotency check)
  if (submission.analysisStatus === 'completed') {
    return { success: true };
  }

  try {
    // 4. Request analysis from NLP microservice (outside DB transaction)
    const analysisResult = await analyzeFeedback(text, {
      url: options.nlpUrl,
      timeoutMs: options.timeoutMs,
    });

    // 5. Persist analysis results atomically inside a dedicated transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await saveAnalysisSuccess(submissionId, analysisResult, client);
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[NLP ANALYSIS SUCCESS] submissionId=${submissionId} duration=${durationMs}ms sentiment=${analysisResult.sentiment.label} topics=${analysisResult.topics.length}`
    );

    return { success: true, analysisResult };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(
      `[NLP ANALYSIS FAILED] submissionId=${submissionId} duration=${durationMs}ms code=${err.code || 'UNKNOWN'} message=${err.message}`
    );

    // 6. Record failed analysis status safely without touching feedback or ratings
    try {
      await markAnalysisFailed(submissionId);
    } catch (statusErr) {
      console.error(
        `[NLP ANALYSIS FAILED] Could not update status for submissionId=${submissionId}: ${statusErr.message}`
      );
    }

    return {
      success: false,
      error: err.code || 'NLP_ANALYSIS_FAILED',
      message: err.message,
    };
  }
}

/**
 * Schedules analysis asynchronously on the Node.js event loop
 * Returns immediately without blocking the student's submission response
 * @param {string} submissionId
 * @param {object} [options]
 */
function scheduleAnalysis(submissionId, options = {}) {
  setImmediate(async () => {
    try {
      await processSubmissionAnalysis(submissionId, options);
    } catch (err) {
      console.error(
        `[NLP SCHEDULE ERROR] Unexpected error processing submission ${submissionId}: ${err.message}`
      );
    }
  });
}

/**
 * Sweeps and processes pending or failed submissions for background recovery
 * @param {number} [limit=50]
 * @returns {Promise<{ total: number, succeeded: number, failed: number }>}
 */
async function processPendingBatch(limit = 50) {
  const pending = await getPendingSubmissions(limit);
  let succeeded = 0;
  let failed = 0;

  for (const item of pending) {
    const res = await processSubmissionAnalysis(item.id);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { total: pending.length, succeeded, failed };
}

module.exports = {
  processSubmissionAnalysis,
  scheduleAnalysis,
  processPendingBatch,
};
