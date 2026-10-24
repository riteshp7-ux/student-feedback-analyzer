-- Add section-level course offerings and durable retry/idempotency metadata.
ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS section VARCHAR(64) NOT NULL DEFAULT 'General';

ALTER TABLE course_offerings
  DROP CONSTRAINT IF EXISTS uq_course_offering_term;

ALTER TABLE course_offerings
  ADD CONSTRAINT uq_course_offering_term_section
  UNIQUE (course_id, professor_id, term, section);

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_idempotency_key
  ON feedback_submissions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS analysis_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS analysis_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_feedback_analysis_retry
  ON feedback_submissions (analysis_retry_at, created_at)
  WHERE analysis_status IN ('pending', 'failed');
