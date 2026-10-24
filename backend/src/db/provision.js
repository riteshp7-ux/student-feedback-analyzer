/**
 * Production Provisioning Script for Student Feedback Analyzer
 * Safely provisions official academic courses and initial faculty accounts
 * without inserting synthetic feedback submissions.
 *
 * Usage:
 *   node src/db/provision.js
 *
 * Environment variables:
 *   PROF_EMAIL (default: prof.sharma@university.edu)
 *   PROF_NAME (default: Dr. Ramesh Sharma)
 *   PROF_PASSWORD (required unique secret; minimum 20 characters)
 *   ACADEMIC_DEPARTMENT_CODE / ACADEMIC_DEPARTMENT_NAME
 *   ACADEMIC_TERM / ACADEMIC_SECTION
 *   PROVISION_COURSES_JSON: optional JSON array of {code,title,desc,eligibleDepartments?}
 *   ELIGIBLE_DEPARTMENTS_JSON: optional JSON array of {code,name} for cross-listed students
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function provisionProductionData() {
  const email = process.env.PROF_EMAIL || 'sharma@university.edu';
  const name = process.env.PROF_NAME || 'Dr. Ramesh Sharma';
  const password = process.env.PROF_PASSWORD;
  if (!password || password.length < 20 || password === 'SecurePassword123!') {
    throw new Error('Set PROF_PASSWORD to a unique secret of at least 20 characters before provisioning.');
  }

  console.log(`[PROVISION] Connecting to production database...`);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Provision Course Catalog
    console.log('[PROVISION] Upserting core course catalog...');
    const defaultCourses = [
      { code: 'CS301', title: 'Database Management Systems', desc: 'Relational models, SQL, indexing, and transaction management.' },
      { code: 'CS201', title: 'Data Structures & Algorithms', desc: 'Trees, graphs, asymptotic analysis, and dynamic programming.' },
      { code: 'CS405', title: 'Machine Learning Foundations', desc: 'Statistical learning, classification, regression, and neural networks.' },
    ];
    const courses = process.env.PROVISION_COURSES_JSON
      ? JSON.parse(process.env.PROVISION_COURSES_JSON)
      : defaultCourses;
    if (!Array.isArray(courses) || courses.some((course) => !course.code || !course.title)) {
      throw new Error('PROVISION_COURSES_JSON must be an array of courses with code and title.');
    }

    const courseMap = {};
    for (const c of courses) {
      const res = await client.query(
        `INSERT INTO courses (code, title, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
         RETURNING id, code;`,
        [c.code, c.title, c.desc]
      );
      courseMap[c.code] = res.rows[0].id;
    }

    // 2. Provision Faculty Account
    console.log(`[PROVISION] Upserting faculty account for ${email}...`);
    const passwordHash = await bcrypt.hash(password, 10);
    const profRes = await client.query(
      `INSERT INTO professors (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash
       RETURNING id, email, full_name;`,
      [email.toLowerCase(), passwordHash, name]
    );
    const profId = profRes.rows[0].id;

    // 3. Provision the academic department and structured term.
    const departmentCode = process.env.ACADEMIC_DEPARTMENT_CODE || 'CSE';
    const departmentName = process.env.ACADEMIC_DEPARTMENT_NAME || 'Computer Science & Engineering';
    const { rows: departmentRows } = await client.query(
      `INSERT INTO departments (code, name) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id;`,
      [departmentCode, departmentName]
    );
    const departmentId = departmentRows[0].id;
    const term = process.env.ACADEMIC_TERM || 'Semester 1 2026-27';
    const parsedTerm = term.match(/^Semester ([1-8]) (\d{4})-(\d{2})$/);
    const { rows: termRows } = await client.query(
      `INSERT INTO academic_terms (label, academic_year_start, semester_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label
       RETURNING id;`,
      [term, parsedTerm ? Number(parsedTerm[2]) : null, parsedTerm ? Number(parsedTerm[1]) : null]
    );
    const academicTermId = termRows[0].id;

    // 4. Provision Active Course Offerings
    console.log('[PROVISION] Upserting active course offerings...');
    const eligibleDepartments = process.env.ELIGIBLE_DEPARTMENTS_JSON
      ? JSON.parse(process.env.ELIGIBLE_DEPARTMENTS_JSON)
      : [{ code: departmentCode, name: departmentName }];
    if (!Array.isArray(eligibleDepartments) || eligibleDepartments.some((department) => !department.code || !department.name)) {
      throw new Error('ELIGIBLE_DEPARTMENTS_JSON must be an array of departments with code and name.');
    }
    const section = process.env.ACADEMIC_SECTION || 'General';
    for (const [code, courseId] of Object.entries(courseMap)) {
      const course = courses.find((item) => item.code === code);
      const courseEligibleDepartments = course.eligibleDepartments || eligibleDepartments;
      const eligibleDepartmentIds = [];
      for (const department of courseEligibleDepartments) {
        if (!department.code || !department.name) {
          throw new Error(`Invalid eligible department for course ${code}.`);
        }
        const { rows } = await client.query(
          `INSERT INTO departments (code, name) VALUES ($1, $2)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id;`,
          [department.code, department.name]
        );
        eligibleDepartmentIds.push(rows[0].id);
      }
      const { rows: offeringRows } = await client.query(
        `INSERT INTO course_offerings (
           course_id, professor_id, term, section, is_active, department_id, academic_term_id
         ) VALUES ($1, $2, $3, $4, TRUE, $5, $6)
         ON CONFLICT (course_id, professor_id, academic_term_id, department_id, section)
         DO UPDATE SET is_active = TRUE, term = EXCLUDED.term
         RETURNING id;`,
        [courseId, profId, term, section, departmentId, academicTermId]
      );
      for (const eligibleDepartmentId of eligibleDepartmentIds) {
        await client.query(
          `INSERT INTO offering_departments (offering_id, department_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
          [offeringRows[0].id, eligibleDepartmentId]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`[PROVISION] Successfully provisioned production catalog and faculty account for ${name} (${email}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PROVISION ERROR] Failed to provision production data:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  provisionProductionData().catch(() => { process.exitCode = 1; });
}

module.exports = { provisionProductionData };
