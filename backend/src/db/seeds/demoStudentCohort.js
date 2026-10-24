const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db');

const DEMO_STUDENT_PASSWORD = process.env.DEMO_STUDENT_PASSWORD || 'DemoStudent2026!';
const DEMO_STUDENT_PREFIX = 'DEMO26S';

// These offerings provide five distinct courses taught by five distinct faculty.
// They are deliberately explicit so this fixture fails safely if the demo catalog
// changes instead of enrolling students into arbitrary offerings.
const REQUIRED_OFFERINGS = [
  { courseCode: 'IT201', professorName: 'Prof. Anita Desai' },
  { courseCode: 'IT301', professorName: 'Dr. Ramesh Sharma' },
  { courseCode: 'IT303', professorName: 'Dr. Vikram Singh' },
  { courseCode: 'IT305', professorName: 'Prof. Arjun Mehta' },
  { courseCode: 'IT101', professorName: 'Prof. Kavya Menon' },
];

const DEMO_NAMES = [
  'Aditi Rao', 'Bharat Nair', 'Charu Iyer', 'Dev Malhotra', 'Esha Kapoor',
  'Farhan Ali', 'Gauri Shah', 'Harsh Vora', 'Isha Menon', 'Jay Sethi',
  'Kavya Bose', 'Laksh Mehra', 'Meera Joshi', 'Nikhil Jain', 'Ojas Kulkarni',
  'Pooja Reddy', 'Rahul Bhat', 'Sneha Das', 'Tanvi Gupta', 'Vihaan Roy',
];

async function seedDemoStudentCohort() {
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Demo student fixtures are restricted to development/test environments.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: departments } = await client.query(
      `SELECT id FROM departments WHERE code = 'IT' AND is_active = TRUE LIMIT 1`
    );
    if (!departments[0]) throw new Error('The IT department is required for the demo student cohort.');
    const itDepartmentId = departments[0].id;

    const offeringIds = [];
    for (const requirement of REQUIRED_OFFERINGS) {
      const { rows } = await client.query(
        `SELECT co.id, c.code, p.full_name
         FROM course_offerings co
         JOIN courses c ON c.id = co.course_id
         JOIN professors p ON p.id = co.professor_id
         WHERE co.is_active = TRUE AND c.code = $1 AND p.full_name = $2
         ORDER BY co.created_at DESC
         LIMIT 1`,
        [requirement.courseCode, requirement.professorName]
      );
      if (!rows[0]) {
        throw new Error(`Required demo offering is missing: ${requirement.courseCode} with ${requirement.professorName}.`);
      }
      offeringIds.push(rows[0].id);
    }

    if (new Set(offeringIds).size !== 5) {
      throw new Error('The demo cohort requires five distinct course offerings.');
    }

    const passwordHash = await bcrypt.hash(DEMO_STUDENT_PASSWORD, 10);
    let createdOrUpdated = 0;
    let enrollments = 0;
    for (let index = 0; index < DEMO_NAMES.length; index += 1) {
      const number = String(index + 1).padStart(2, '0');
      const studentIdNumber = `${DEMO_STUDENT_PREFIX}${number}`;
      const email = `demo.student${number}@example.test`;
      const { rows } = await client.query(
        `INSERT INTO students (email, password_hash, student_id_number, full_name, department_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               student_id_number = EXCLUDED.student_id_number,
               full_name = EXCLUDED.full_name,
               department_id = EXCLUDED.department_id
         RETURNING id`,
        [email, passwordHash, studentIdNumber, DEMO_NAMES[index], itDepartmentId]
      );
      createdOrUpdated += 1;

      for (const offeringId of offeringIds) {
        const result = await client.query(
          `INSERT INTO course_enrollments (student_id, course_offering_id)
           VALUES ($1, $2)
           ON CONFLICT (student_id, course_offering_id) DO NOTHING`,
          [rows[0].id, offeringId]
        );
        enrollments += result.rowCount;
      }
    }

    await client.query('COMMIT');
    return { students: createdOrUpdated, enrollments, coursesPerStudent: offeringIds.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoStudentCohort()
    .then(({ students, enrollments, coursesPerStudent }) => {
      console.log(JSON.stringify({ students, enrollments, coursesPerStudent }));
    })
    .catch((error) => {
      console.error(`[DEMO STUDENT COHORT ERROR] ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { seedDemoStudentCohort };
