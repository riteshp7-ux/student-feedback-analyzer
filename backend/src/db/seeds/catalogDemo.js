const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db');

const DEMO_PASSWORD = process.env.DEMO_FACULTY_PASSWORD || 'SecurePassword123!';

async function upsertDepartment(client, code, name) {
  const { rows } = await client.query(
    `INSERT INTO departments (code, name) VALUES ($1, $2)
     ON CONFLICT (code) DO NOTHING RETURNING id;`,
    [code, name]
  );
  if (rows[0]) return rows[0].id;
  const existing = await client.query('SELECT id FROM departments WHERE code = $1;', [code]);
  return existing.rows[0].id;
}

async function upsertTerm(client, label, yearStart, semester, opensAt, closesAt) {
  const { rows } = await client.query(
    `INSERT INTO academic_terms (
       label, academic_year_start, semester_number, feedback_opens_at, feedback_closes_at
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (label) DO NOTHING RETURNING id;`,
    [label, yearStart, semester, opensAt, closesAt]
  );
  if (rows[0]) return rows[0].id;
  const existing = await client.query('SELECT id FROM academic_terms WHERE label = $1;', [label]);
  return existing.rows[0].id;
}

async function upsertProfessor(client, professor, passwordHash) {
  const { rows } = await client.query(
    `INSERT INTO professors (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id;`,
    [professor.email, passwordHash, professor.name]
  );
  if (rows[0]) return rows[0].id;
  const existing = await client.query('SELECT id FROM professors WHERE email = $1;', [professor.email]);
  return existing.rows[0].id;
}

async function upsertCourse(client, course) {
  const { rows } = await client.query(
    `INSERT INTO courses (code, title, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (code) DO NOTHING RETURNING id;`,
    [course.code, course.title, course.description]
  );
  if (rows[0]) return rows[0].id;
  const existing = await client.query('SELECT id FROM courses WHERE code = $1;', [course.code]);
  return existing.rows[0].id;
}

async function upsertOffering(client, offering) {
  const { rows } = await client.query(
    `INSERT INTO course_offerings (
       course_id, professor_id, term, section, is_active, department_id, academic_term_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (course_id, professor_id, academic_term_id, department_id, section)
     DO NOTHING RETURNING id;`,
    [offering.courseId, offering.professorId, offering.term, offering.section,
      offering.isActive, offering.departmentId, offering.academicTermId]
  );
  let offeringId = rows[0]?.id;
  if (!offeringId) {
    const existing = await client.query(
      `SELECT id FROM course_offerings
       WHERE course_id = $1 AND professor_id = $2 AND academic_term_id = $3
         AND department_id = $4 AND section = $5;`,
      [offering.courseId, offering.professorId, offering.academicTermId, offering.departmentId, offering.section]
    );
    offeringId = existing.rows[0].id;
  }
  for (const departmentId of new Set([offering.departmentId, ...offering.eligibleDepartmentIds])) {
    await client.query(
      `INSERT INTO offering_departments (offering_id, department_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [offeringId, departmentId]
    );
  }
  return offeringId;
}

async function seedCatalogDemo() {
  require('../../config/env');
  if (!['development', 'test'].includes(process.env.NODE_ENV)) {
    throw new Error('Demo catalog data is restricted to development/test environments.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cseId = await upsertDepartment(client, 'CSE', 'Computer Science & Engineering');
    const itId = await upsertDepartment(client, 'IT', 'Information Technology');
    const termIds = new Map();
    for (let semester = 1; semester <= 8; semester += 1) {
      const term = `Semester ${semester} 2026-27`;
      const oddSemester = semester % 2 === 1;
      termIds.set(term, await upsertTerm(
        client,
        term,
        2026,
        semester,
        oddSemester ? '2026-08-01T00:00:00+05:30' : '2027-01-01T00:00:00+05:30',
        oddSemester ? '2026-12-31T23:59:59+05:30' : '2027-06-30T23:59:59+05:30'
      ));
    }
    const pastTermIds = new Map();
    for (let semester = 1; semester <= 8; semester += 1) {
      const term = `Semester ${semester} 2025-26`;
      const evenSemester = semester % 2 === 0;
      pastTermIds.set(term, await upsertTerm(
        client,
        term,
        2025,
        semester,
        evenSemester ? '2026-01-01T00:00:00+05:30' : '2025-08-01T00:00:00+05:30',
        evenSemester ? '2026-06-30T23:59:59+05:30' : '2025-12-31T23:59:59+05:30'
      ));
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const kavyaId = await upsertProfessor(client, {
      email: 'kavya.menon@university.edu', name: 'Prof. Kavya Menon',
    }, passwordHash);
    const arjunId = await upsertProfessor(client, {
      email: 'arjun.mehta@university.edu', name: 'Prof. Arjun Mehta',
    }, passwordHash);

    const cs301Id = await upsertCourse(client, {
      code: 'CS301', title: 'Database Management Systems',
      description: 'Relational databases, SQL, normalization, and transactions.',
    });
    const it101Id = await upsertCourse(client, {
      code: 'IT101', title: 'Information Technology Foundations',
      description: 'Digital systems, information management, and IT practice.',
    });
    const it204Id = await upsertCourse(client, {
      code: 'IT204', title: 'Web Systems',
      description: 'Web architecture, APIs, security, and deployment.',
    });
    const cs201Id = await upsertCourse(client, {
      code: 'CS201', title: 'Data Structures and Algorithms',
      description: 'Core data structures, algorithm design, and complexity.',
    });
    const cs405Id = await upsertCourse(client, {
      code: 'CS405', title: 'Machine Learning',
      description: 'Supervised learning, model evaluation, and applied machine learning.',
    });
    const cse401Id = await upsertCourse(client, {
      code: 'CSE401', title: 'Capstone Project',
      description: 'A supervised, team-based engineering project.',
    });
    const it401Id = await upsertCourse(client, {
      code: 'IT401', title: 'IT Project Studio',
      description: 'Applied information technology project and deployment.',
    });

    const offerings = [
      // Same course, two instructors/sections: the student must identify their class.
      { courseId: cs301Id, professorId: kavyaId, term: 'Semester 1 2026-27', section: 'B', isActive: true, departmentId: cseId, academicTermId: termIds.get('Semester 1 2026-27'), eligibleDepartmentIds: [itId] },
      // Kavya also teaches an IT course, demonstrating that faculty are not tied to one department.
      { courseId: it204Id, professorId: kavyaId, term: 'Semester 1 2026-27', section: 'A', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 1 2026-27'), eligibleDepartmentIds: [] },
      { courseId: it101Id, professorId: arjunId, term: 'Semester 1 2026-27', section: 'A', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 1 2026-27'), eligibleDepartmentIds: [] },
      { courseId: it101Id, professorId: arjunId, term: 'Semester 2 2025-26', section: 'A', isActive: false, departmentId: itId, academicTermId: pastTermIds.get('Semester 2 2025-26'), eligibleDepartmentIds: [] },
      { courseId: it204Id, professorId: arjunId, term: 'Semester 2 2026-27', section: 'A', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 2 2026-27'), eligibleDepartmentIds: [] },
      // Current sample offerings make all four program years discoverable.
      { courseId: cs201Id, professorId: kavyaId, term: 'Semester 3 2026-27', section: 'A', isActive: true, departmentId: cseId, academicTermId: termIds.get('Semester 3 2026-27'), eligibleDepartmentIds: [] },
      { courseId: it101Id, professorId: arjunId, term: 'Semester 3 2026-27', section: 'B', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 3 2026-27'), eligibleDepartmentIds: [] },
      { courseId: cs405Id, professorId: kavyaId, term: 'Semester 5 2026-27', section: 'A', isActive: true, departmentId: cseId, academicTermId: termIds.get('Semester 5 2026-27'), eligibleDepartmentIds: [] },
      { courseId: it204Id, professorId: arjunId, term: 'Semester 5 2026-27', section: 'A', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 5 2026-27'), eligibleDepartmentIds: [] },
      { courseId: cse401Id, professorId: kavyaId, term: 'Semester 7 2026-27', section: 'A', isActive: true, departmentId: cseId, academicTermId: termIds.get('Semester 7 2026-27'), eligibleDepartmentIds: [] },
      { courseId: it401Id, professorId: arjunId, term: 'Semester 7 2026-27', section: 'A', isActive: true, departmentId: itId, academicTermId: termIds.get('Semester 7 2026-27'), eligibleDepartmentIds: [] },
    ];

    for (const offering of offerings) await upsertOffering(client, offering);

    // Upsert demo students
    const studentPassword = process.env.DEMO_STUDENT_PASSWORD || 'SecureStudent123!';
    const studentHash = await bcrypt.hash(studentPassword, 10);
    const demoStudents = [
      { email: 'aarav@student.university.edu', studentIdNumber: 'STU2026001', fullName: 'Aarav Sharma' },
      { email: 'diya@student.university.edu', studentIdNumber: 'STU2026002', fullName: 'Diya Patel' },
      { email: 'rohan@student.university.edu', studentIdNumber: 'STU2026003', fullName: 'Rohan Verma' },
    ];

    const studentIds = {};
    for (const stu of demoStudents) {
      const { rows } = await client.query(`
        INSERT INTO students (email, password_hash, student_id_number, full_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash,
            student_id_number = EXCLUDED.student_id_number,
            full_name = EXCLUDED.full_name
        RETURNING id;
      `, [stu.email, studentHash, stu.studentIdNumber, stu.fullName]);
      studentIds[stu.email] = rows[0].id;
    }

    // Find cs301 and cs201 offerings
    const { rows: demoOfferings } = await client.query(`
      SELECT co.id, c.code
      FROM course_offerings co
      JOIN courses c ON co.course_id = c.id
      WHERE c.code IN ('CS301', 'CS201') AND co.is_active = TRUE
      LIMIT 2;
    `);

    if (demoOfferings.length >= 2) {
      const cs301Off = demoOfferings.find(o => o.code === 'CS301')?.id;
      const cs201Off = demoOfferings.find(o => o.code === 'CS201')?.id;

      if (cs301Off && cs201Off) {
        // Enrollments:
        // Aarav -> CS301, CS201
        // Diya -> CS301
        // Rohan -> CS201
        await client.query(`
          INSERT INTO course_enrollments (student_id, course_offering_id)
          VALUES 
            ($1, $2), ($1, $3),
            ($4, $2),
            ($5, $3)
          ON CONFLICT (student_id, course_offering_id) DO NOTHING;
        `, [studentIds['aarav@student.university.edu'], cs301Off, cs201Off,
            studentIds['diya@student.university.edu'], studentIds['rohan@student.university.edu']]);
      }
    }

    await client.query('COMMIT');
    console.log('[CATALOG DEMO] Added CSE and IT departments, semesters 1–8 for two academic sessions, faculty accounts, demo student accounts, and offerings across all four study years.');
    console.log('[CATALOG DEMO] Demo faculty accounts updated. Credentials are configured locally and were not logged.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedCatalogDemo().catch((err) => {
    console.error('[CATALOG DEMO ERROR]', err);
    process.exitCode = 1;
  });
}

module.exports = { seedCatalogDemo };
