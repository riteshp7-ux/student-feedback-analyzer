-- One-time eligibility credentials are scoped to a specific offering (term + section).
-- Raw tokens and student identifiers are never stored in the database.
CREATE TABLE IF NOT EXISTS feedback_eligibility_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  student_key_hash CHAR(64) NOT NULL,
  offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  CONSTRAINT uq_eligibility_student_offering UNIQUE (offering_id, student_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_eligibility_tokens_available
  ON feedback_eligibility_tokens (offering_id, created_at)
  WHERE consumed_at IS NULL;
