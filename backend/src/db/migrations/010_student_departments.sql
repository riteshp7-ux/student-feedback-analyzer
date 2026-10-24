-- Associate imported students with the only retained departments.
INSERT INTO departments (code, name)
VALUES ('DS', 'Data Science')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_students_department
  ON students (department_id);
