const { pool } = require('../../config/db');

/**
 * Finds a student by university email or student ID number.
 * @param {string} loginId
 * @returns {Promise<Object|null>}
 */
async function findStudentByLoginId(loginId) {
  const query = `
    SELECT id, email, password_hash, student_id_number, full_name, created_at
    FROM students
    WHERE LOWER(email) = LOWER($1) OR UPPER(student_id_number) = UPPER($1);
  `;
  const { rows } = await pool.query(query, [loginId.trim()]);
  return rows[0] || null;
}

/**
 * Finds a student by UUID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findStudentById(id) {
  const query = `
    SELECT id, email, student_id_number, full_name, created_at
    FROM students
    WHERE id = $1;
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

/**
 * Retrieves all offerings the student is enrolled in, joining course, instructor, term info,
 * and checking whether a submission record exists in feedback_submission_control.
 * @param {string} studentId
 * @returns {Promise<Array<Object>>}
 */
async function getEnrolledOfferingsByStudentId(studentId) {
  const query = `
    SELECT 
      co.id AS offering_id,
      co.term,
      co.section,
      co.is_active,
      c.id AS course_id,
      c.code AS course_code,
      c.title AS course_title,
      p.id AS professor_id,
      p.full_name AS professor_name,
      d.id AS department_id,
      d.code AS department_code,
      d.name AS department_name,
      at.id AS academic_term_id,
      at.label AS academic_term_label,
      at.academic_year_start,
      at.semester_number,
      ((at.semester_number + 1) / 2)::int AS study_year,
      COALESCE(
        JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
          'id', eligible.id, 'code', eligible.code, 'name', eligible.name
        )) FILTER (WHERE eligible.id IS NOT NULL),
        '[]'::jsonb
      ) AS eligible_departments,
      CASE 
        WHEN fsc.id IS NOT NULL THEN TRUE 
        ELSE FALSE 
      END AS has_submitted,
      fsc.submitted_at
    FROM course_enrollments ce
    INNER JOIN course_offerings co ON ce.course_offering_id = co.id
    INNER JOIN courses c ON co.course_id = c.id
    INNER JOIN professors p ON co.professor_id = p.id
    LEFT JOIN departments d ON co.department_id = d.id
    LEFT JOIN academic_terms at ON co.academic_term_id = at.id
    LEFT JOIN offering_departments od ON od.offering_id = co.id
    LEFT JOIN departments eligible ON eligible.id = od.department_id AND eligible.is_active = TRUE
    LEFT JOIN feedback_submission_control fsc 
      ON fsc.student_id = ce.student_id AND fsc.course_offering_id = ce.course_offering_id
    WHERE ce.student_id = $1
    GROUP BY co.id, c.id, c.code, c.title, p.id, p.full_name, d.id, d.code, d.name,
      at.id, at.label, at.academic_year_start, at.semester_number, fsc.id, fsc.submitted_at
    ORDER BY c.code ASC, co.term DESC;
  `;
  const { rows } = await pool.query(query, [studentId]);
  return rows.map((r) => ({
    id: r.offering_id,
    offeringId: r.offering_id,
    courseId: r.course_id,
    courseCode: r.course_code,
    courseTitle: r.course_title,
    professorId: r.professor_id,
    professorName: r.professor_name,
    instructorName: r.professor_name,
    term: r.term,
    section: r.section,
    isActive: r.is_active,
    departmentId: r.department_id,
    departmentCode: r.department_code,
    departmentName: r.department_name,
    academicTermId: r.academic_term_id,
    academicTermLabel: r.academic_term_label,
    academicYearStart: r.academic_year_start,
    semesterNumber: r.semester_number,
    studyYear: r.study_year,
    eligibleDepartments: r.eligible_departments,
    hasSubmitted: r.has_submitted,
    submittedAt: r.submitted_at,
  }));
}

/**
 * Checks if a student is actively enrolled in a course offering.
 * @param {string} studentId
 * @param {string} courseOfferingId
 * @returns {Promise<boolean>}
 */
async function isStudentEnrolled(studentId, courseOfferingId) {
  const query = `
    SELECT 1 FROM course_enrollments
    WHERE student_id = $1 AND course_offering_id = $2;
  `;
  const { rows } = await pool.query(query, [studentId, courseOfferingId]);
  return rows.length > 0;
}

/**
 * Checks if a submission control record already exists for the student and course offering.
 * @param {string} studentId
 * @param {string} courseOfferingId
 * @returns {Promise<boolean>}
 */
async function hasStudentSubmittedOffering(studentId, courseOfferingId) {
  const query = `
    SELECT 1 FROM feedback_submission_control
    WHERE student_id = $1 AND course_offering_id = $2;
  `;
  const { rows } = await pool.query(query, [studentId, courseOfferingId]);
  return rows.length > 0;
}

/**
 * Records a submission control entry for the student and offering.
 * Will throw unique constraint error if duplicate.
 * @param {string} studentId
 * @param {string} courseOfferingId
 * @returns {Promise<Object>}
 */
async function recordSubmissionControl(studentId, courseOfferingId) {
  const query = `
    INSERT INTO feedback_submission_control (student_id, course_offering_id)
    VALUES ($1, $2)
    RETURNING id, student_id, course_offering_id, submitted_at;
  `;
  const { rows } = await pool.query(query, [studentId, courseOfferingId]);
  return rows[0];
}

module.exports = {
  findStudentByLoginId,
  findStudentById,
  getEnrolledOfferingsByStudentId,
  isStudentEnrolled,
  hasStudentSubmittedOffering,
  recordSubmissionControl,
};
