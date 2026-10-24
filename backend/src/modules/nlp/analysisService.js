const { pool } = require('../../config/db');
const { analyzeFeedback } = require('./nlpClient');
const {
  getSubmissionForAnalysis,
  saveAnalysisSuccess,
  markAnalysisFailed,
  getPendingSubmissions,
  claimSubmissionForProcessing,
} = require('./analysisRepository');

let pendingBatchInFlight = false;

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

    // 5. Persist analysis results atomically inside a dedicated transaction.
    // saveAnalysisSuccess re-checks eligibility under a row lock; `written=false`
    // means a concurrent worker already completed this submission (idempotent skip).
    let written = true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      written = await saveAnalysisSuccess(submissionId, analysisResult, client);
      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    if (!written) {
      console.log(`[NLP ANALYSIS SKIP] submissionId=${submissionId} already completed by a concurrent worker.`);
      return { success: true };
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
 * Sweeps and processes pending or failed submissions for background recovery.
 * Each candidate is claimed via a conditional UPDATE before processing so
 * multiple backend instances (or the sweep racing the immediate dispatch)
 * never analyze the same submission twice.
 * @param {number} [limit=50]
 * @returns {Promise<{ total: number, succeeded: number, failed: number, skipped: number }>}
 */
async function processPendingBatch(limit = 50) {
  const pending = await getPendingSubmissions(limit);
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending) {
    const claimed = await claimSubmissionForProcessing(item.id);
    if (!claimed) {
      // Another worker owns this row right now.
      skipped++;
      continue;
    }
    const res = await processSubmissionAnalysis(item.id);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { total: pending.length, succeeded, failed, skipped };
}

/**
 * Requeues permanently-failed analyses (attempt budget exhausted) for a course
 * offering owned by the requesting professor. Only usable for offerings the
 * professor already controls (enforced by requireOfferingOwnership middleware).
 * @param {string} offeringId
 * @returns {Promise<number>} number of submissions requeued
 */
async function requeueFailedAnalyses(offeringId) {
  const { rows } = await pool.query(
    `UPDATE feedback_submissions
     SET analysis_status = 'pending',
         analysis_attempts = 0,
         analysis_retry_at = NOW()
     WHERE offering_id = $1
       AND analysis_status = 'failed'
       AND comment_text IS NOT NULL
       AND TRIM(comment_text) != ''
     RETURNING id;`,
    [offeringId]
  );
  return rows.length;
}

/**
 * Starts an in-process recovery worker for pending and retryable analyses.
 * Retry timing is persisted in PostgreSQL, so restarts do not lose the queue.
 */
function startAnalysisWorker(intervalMs = 15000) {
  let activeBatch = null;
  const runBatch = () => {
    if (pendingBatchInFlight) return activeBatch;
    pendingBatchInFlight = true;
    activeBatch = (async () => {
      try {
        const result = await processPendingBatch();
        if (result.total > 0) {
          console.log(`[NLP RECOVERY] checked=${result.total} succeeded=${result.succeeded} failed=${result.failed}`);
        }
      } catch (err) {
        console.error(`[NLP RECOVERY] Batch failed: ${err.message}`);
      } finally {
        pendingBatchInFlight = false;
        activeBatch = null;
      }
    })();
    return activeBatch;
  };

  const initialRun = setTimeout(runBatch, 1000);
  const interval = setInterval(runBatch, intervalMs);
  if (initialRun.unref) initialRun.unref();
  if (interval.unref) interval.unref();

  return async () => {
    clearTimeout(initialRun);
    clearInterval(interval);
    if (activeBatch) await activeBatch;
  };
}

module.exports = {
  processSubmissionAnalysis,
  scheduleAnalysis,
  processPendingBatch,
  requeueFailedAnalyses,
  startAnalysisWorker,
};
