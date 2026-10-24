-- A course delivery may be available to students from multiple departments.
CREATE TABLE IF NOT EXISTS offering_departments (
  offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (offering_id, department_id)
);

-- Existing offerings remain available to students in their teaching department.
INSERT INTO offering_departments (offering_id, department_id)
SELECT id, department_id FROM course_offerings
ON CONFLICT (offering_id, department_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_offering_departments_department
  ON offering_departments (department_id, offering_id);
