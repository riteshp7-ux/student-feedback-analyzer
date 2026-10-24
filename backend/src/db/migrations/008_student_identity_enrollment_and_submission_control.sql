-- Migration 008: Student identity, course enrollments, and submission-control foundation
-- Enforces:
-- 1. Students persistence table for application-managed login
-- 2. Course enrollments table linking students to course offerings
-- 3. Feedback submission control table enforcing UNIQUE(student_id, course_offering_id)
-- Note: Intentionally contains NO foreign keys to feedback_submissions, preserving Level 1 practical anonymity.

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  student_id_number VARCHAR(64) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_enrollment UNIQUE (student_id, course_offering_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student
  ON course_enrollments (student_id);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_offering
  ON course_enrollments (course_offering_id);

CREATE TABLE IF NOT EXISTS feedback_submission_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_offering_submission UNIQUE (student_id, course_offering_id)
);

CREATE INDEX IF NOT EXISTS idx_submission_control_lookup
  ON feedback_submission_control (student_id, course_offering_id);
