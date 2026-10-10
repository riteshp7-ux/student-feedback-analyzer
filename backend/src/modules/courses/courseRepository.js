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
      o.term,
      p.full_name AS "instructorName",
      p.full_name AS "professorName"
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    JOIN professors p ON p.id = o.professor_id
    WHERE o.is_active = TRUE
    ORDER BY c.code ASC, o.term DESC;
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
      o.term,
      o.is_active AS "isActive",
      COUNT(s.id)::int AS "submissionCount"
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    LEFT JOIN feedback_submissions s ON s.offering_id = o.id
    WHERE o.professor_id = $1
    GROUP BY o.id, c.code, c.title, o.term, o.is_active
    ORDER BY o.term DESC, c.code ASC;
  `, [professorId]);
  return rows;
}

module.exports = {
  getActiveCourseOfferings,
  getOfferingsByProfessorId,
};
