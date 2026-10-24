-- Normalize the student-facing catalog so offerings can be filtered by
-- semester and department while remaining assigned to a specific professor.
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(64) NOT NULL UNIQUE,
  academic_year_start SMALLINT,
  semester_number SMALLINT CHECK (semester_number BETWEEN 1 AND 8),
  starts_on DATE,
  ends_on DATE,
  feedback_opens_at TIMESTAMPTZ,
  feedback_closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (feedback_closes_at IS NULL OR feedback_opens_at IS NULL OR feedback_closes_at > feedback_opens_at)
);

INSERT INTO departments (code, name)
VALUES ('GEN', 'General'), ('CS', 'Computer Science')
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_terms (label, academic_year_start, semester_number)
SELECT DISTINCT
  o.term,
  CASE WHEN o.term ~ '^Semester [1-8] [0-9]{4}-[0-9]{2}$'
    THEN substring(o.term from '^Semester [1-8] ([0-9]{4})-')::SMALLINT END,
  CASE WHEN o.term ~ '^Semester [1-8] [0-9]{4}-[0-9]{2}$'
    THEN substring(o.term from '^Semester ([1-8])')::SMALLINT END
FROM course_offerings o
ON CONFLICT (label) DO NOTHING;

ALTER TABLE course_offerings
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_term_id UUID REFERENCES academic_terms(id) ON DELETE RESTRICT;

UPDATE course_offerings o
SET department_id = CASE WHEN upper(c.code) LIKE 'CS%' THEN
      (SELECT id FROM departments WHERE code = 'CS')
    ELSE (SELECT id FROM departments WHERE code = 'GEN') END,
    academic_term_id = t.id
FROM courses c, academic_terms t
WHERE c.id = o.course_id AND t.label = o.term
  AND (o.department_id IS NULL OR o.academic_term_id IS NULL);

ALTER TABLE course_offerings
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN academic_term_id SET NOT NULL;

ALTER TABLE course_offerings
  DROP CONSTRAINT IF EXISTS uq_course_offering_term_section;

ALTER TABLE course_offerings
  ADD CONSTRAINT uq_course_offering_assignment
  UNIQUE (course_id, professor_id, academic_term_id, department_id, section);

CREATE INDEX IF NOT EXISTS idx_course_offerings_catalog
  ON course_offerings (academic_term_id, department_id, course_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_course_offerings_department
  ON course_offerings (department_id, academic_term_id);
