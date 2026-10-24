const { pool } = require('../../config/db');

/**
 * Retrieves all active course offerings for student dropdown selection.
 * Joins courses and professors to return human-readable metadata.
 * @returns {Promise<Array<object>>}
 */
async function getActiveCourseOfferings() {
  const { rows } = await pool.query(`
    SELECT 
      o.id,
      c.code AS "courseCode",
      c.title AS "courseTitle",
      c.id AS "courseId",
      t.id AS "academicTermId",
      t.label AS term,
      t.academic_year_start AS "academicYearStart",
      t.semester_number AS "semesterNumber",
      ((t.semester_number + 1) / 2)::int AS "studyYear",
      d.id AS "departmentId",
      d.code AS "departmentCode",
      d.name AS "departmentName",
      o.section,
      p.full_name AS "instructorName",
      p.full_name AS "professorName",
      COALESCE(
        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id', eligible.id, 'code', eligible.code, 'name', eligible.name
        )) FILTER (WHERE eligible.id IS NOT NULL),
        '[]'::jsonb
      ) AS "eligibleDepartments"
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    JOIN professors p ON p.id = o.professor_id
    JOIN academic_terms t ON t.id = o.academic_term_id
    JOIN departments d ON d.id = o.department_id
    LEFT JOIN offering_departments od ON od.offering_id = o.id
    LEFT JOIN departments eligible ON eligible.id = od.department_id AND eligible.is_active = TRUE
    WHERE o.is_active = TRUE
      AND (t.feedback_opens_at IS NULL OR NOW() >= t.feedback_opens_at)
      AND (t.feedback_closes_at IS NULL OR NOW() < t.feedback_closes_at)
    GROUP BY o.id, c.id, c.code, c.title, t.id, t.label,
      t.academic_year_start, t.semester_number, d.id, d.code, d.name,
      o.section, p.id, p.full_name
    ORDER BY t.academic_year_start DESC NULLS LAST,
      t.semester_number DESC NULLS LAST,
      d.name ASC, c.code ASC, p.full_name ASC, o.section ASC;
  `);
  return rows;
}

/**
 * Retrieves all course offerings assigned to a specific professor.
 * Includes submission count and active status.
 * @param {string} professorId
 * @returns {Promise<Array<object>>}
 */
async function getOfferingsByProfessorId(professorId) {
  const { rows } = await pool.query(`
    SELECT 
      o.id,
      c.code AS "courseCode",
      c.title AS "courseTitle",
      c.id AS "courseId",
      t.id AS "academicTermId",
      t.label AS term,
      ((t.semester_number + 1) / 2)::int AS "studyYear",
      d.id AS "departmentId",
      d.code AS "departmentCode",
      d.name AS "departmentName",
      o.section,
      (o.is_active
        AND (t.feedback_opens_at IS NULL OR NOW() >= t.feedback_opens_at)
        AND (t.feedback_closes_at IS NULL OR NOW() < t.feedback_closes_at)
      ) AS "isActive",
      COUNT(s.id)::int AS "submissionCount"
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    JOIN academic_terms t ON t.id = o.academic_term_id
    JOIN departments d ON d.id = o.department_id
    LEFT JOIN feedback_submissions s ON s.offering_id = o.id
    WHERE o.professor_id = $1
    GROUP BY o.id, c.id, c.code, c.title, t.id, t.label,
      d.id, d.code, d.name, o.is_active
    ORDER BY t.academic_year_start DESC NULLS LAST,
      t.semester_number DESC NULLS LAST, d.name ASC, c.code ASC, o.section ASC;
  `, [professorId]);
  return rows;
}

module.exports = {
  getActiveCourseOfferings,
  getOfferingsByProfessorId,
};
