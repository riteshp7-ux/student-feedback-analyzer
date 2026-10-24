-- Migration 009: Drop obsolete feedback eligibility tokens table
-- The architecture has migrated from one-time bearer eligibility tokens to
-- authenticated student identity, enrollment verification, and feedback_submission_control.

DROP TABLE IF EXISTS feedback_eligibility_tokens CASCADE;
