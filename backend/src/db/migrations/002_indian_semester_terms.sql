-- Convert seasonal labels to Indian academic semester labels.
-- Fall maps to Semester 1 of the academic year starting that calendar year.
-- Spring and Summer map to Semester 2 of the academic year ending that year.
UPDATE course_offerings
SET term = CASE
  WHEN term ~* '^Fall [0-9]{4}$' THEN
    'Semester 1 ' || substring(term from '([0-9]{4})$') || '-' ||
    right((substring(term from '([0-9]{4})$')::INTEGER + 1)::TEXT, 2)
  WHEN term ~* '^(Spring|Summer) [0-9]{4}$' THEN
    'Semester 2 ' || (substring(term from '([0-9]{4})$')::INTEGER - 1)::TEXT || '-' ||
    right(substring(term from '([0-9]{4})$'), 2)
END
WHERE term ~* '^(Fall|Spring|Summer) [0-9]{4}$';
