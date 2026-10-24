-- Indian four-year undergraduate programmes use eight sequential semesters.
ALTER TABLE academic_terms
  DROP CONSTRAINT IF EXISTS academic_terms_semester_number_check;

ALTER TABLE academic_terms
  ADD CONSTRAINT academic_terms_semester_number_check
  CHECK (semester_number BETWEEN 1 AND 8);

CREATE INDEX IF NOT EXISTS idx_academic_terms_program_year
  ON academic_terms (((semester_number + 1) / 2), academic_year_start, semester_number);
