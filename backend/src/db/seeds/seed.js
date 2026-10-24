const { pool } = require('../../config/db');
const env = require('../../config/env');
const { validateDemoResetTarget, databaseNameFromUrl } = require('./demoResetGuard');

/**
 * Seeds safe, representative development and test data into PostgreSQL.
 * Covers positive, neutral, negative feedback, multi-label topics,
 * edge cases (zero-topic comments, rating-only submissions),
 * and offerings with both ample (N >= 5) and low (N < 5) responses.
 */
async function seedDatabase() {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.execArgv.includes('--test');
  const target = validateDemoResetTarget({
    nodeEnv: isTest ? 'test' : (process.env.NODE_ENV || 'development'),
    databaseUrl: env.DATABASE_URL,
    allowedDatabase: isTest ? (process.env.DEMO_RESET_DATABASE || databaseNameFromUrl(env.DATABASE_URL)) : process.env.DEMO_RESET_DATABASE,
    confirmation: isTest ? (process.env.ALLOW_DESTRUCTIVE_DEMO_RESET || 'YES') : process.env.ALLOW_DESTRUCTIVE_DEMO_RESET,
  });
  if (!target.allowed) throw new Error(`[SEED BLOCKED] ${target.reason}`);

  const client = await pool.connect();
  try {
    const { rows: databaseRows } = await client.query('SELECT current_database() AS name;');
    if (databaseRows[0]?.name !== target.databaseName) {
      throw new Error(`[SEED BLOCKED] Connected database ${databaseRows[0]?.name || '(unknown)'} does not match the explicitly approved target.`);
    }
    console.log(`[SEED] Starting destructive demo reset for ${target.databaseName}...`);
    await client.query('BEGIN');

    // 1. Clean existing data in reverse dependency order
    await client.query('DELETE FROM feedback_submission_control');
    await client.query('DELETE FROM course_enrollments');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM feedback_topic_mention');
    await client.query('DELETE FROM feedback_sentiment');
    await client.query('DELETE FROM feedback_submissions');
    await client.query('DELETE FROM course_offerings');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM professors');

    // 2. Insert Professors
    // 5 Professors:
    // - Dr. Ramesh Sharma (CSE)
    // - Prof. Anita Desai (CSE & IT)
    // - Prof. Kavya Menon (IT)
    // - Prof. Arjun Mehta (IT & CSE)
    // - Dr. Vikram Singh (CSE)
    // Default faculty password: SecurePassword123!
    const { rows: profs } = await client.query(`
      INSERT INTO professors (email, password_hash, full_name) VALUES
      ('sharma@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Dr. Ramesh Sharma'),
      ('desai@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Prof. Anita Desai'),
      ('kavya.menon@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Prof. Kavya Menon'),
      ('arjun.mehta@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Prof. Arjun Mehta'),
      ('vikram.singh@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Dr. Vikram Singh')
      RETURNING id, email, full_name;
    `);
    const profSharma = profs.find((p) => p.email === 'sharma@university.edu').id;
    const profDesai = profs.find((p) => p.email === 'desai@university.edu').id;
    const profMenon = profs.find((p) => p.email === 'kavya.menon@university.edu').id;
    const profMehta = profs.find((p) => p.email === 'arjun.mehta@university.edu').id;
    const profSingh = profs.find((p) => p.email === 'vikram.singh@university.edu').id;

    // Insert Departments: CSE and IT
    const { rows: departmentRows } = await client.query(`
      INSERT INTO departments (code, name) VALUES 
      ('CSE', 'Computer Science & Engineering'),
      ('IT', 'Information Technology')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name 
      RETURNING id, code;
    `);
    const deptCse = departmentRows.find((d) => d.code === 'CSE').id;
    const deptIt = departmentRows.find((d) => d.code === 'IT').id;

    const termIds = {};
    for (const label of ['Semester 1 2026-27', 'Semester 2 2025-26']) {
      const match = label.match(/^Semester ([12]) (\d{4})-(\d{2})$/);
      const { rows } = await client.query(
        `INSERT INTO academic_terms (label, academic_year_start, semester_number)
         VALUES ($1, $2, $3)
         ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label RETURNING id;`,
        [label, Number(match[2]), Number(match[1])]
      );
      termIds[label] = rows[0].id;
    }

    // 3. Insert 10 Courses across CSE and IT
    const { rows: courses } = await client.query(`
      INSERT INTO courses (code, title, description) VALUES
      ('CS301', 'Database Management Systems', 'Relational models, SQL, indexing, and transaction management.'),
      ('CS405', 'Machine Learning Foundations', 'Statistical learning, classification, regression, and neural networks.'),
      ('CS201', 'Data Structures & Algorithms', 'Trees, graphs, asymptotic analysis, and dynamic programming.'),
      ('IT204', 'Web Systems & Technologies', 'Web architecture, RESTful APIs, modern web protocols, and client-server systems.'),
      ('IT101', 'Information Technology Foundations', 'Computer hardware architecture, OS basics, networking fundamentals, and enterprise computing.'),
      ('IT302', 'Cloud Computing & DevOps', 'Virtualization, microservices, container orchestration, and continuous integration pipelines.'),
      ('CS305', 'Computer Networks', 'Network layers, TCP/IP, routing protocols, flow control, and network security.'),
      ('IT304', 'Information Security & Cryptography', 'Symmetric/asymmetric encryption, hashing, authentication mechanisms, and cyber defense.'),
      ('CS303', 'Operating Systems', 'Process concurrency, CPU scheduling, memory virtualisation, and file systems.'),
      ('CS402', 'Artificial Intelligence & Expert Systems', 'Heuristic search algorithms, knowledge graphs, reasoning agents, and automated planning.')
      RETURNING id, code, title;
    `);
    const courseMap = {};
    for (const c of courses) {
      courseMap[c.code] = c.id;
    }

    // 4. Insert Course Offerings (Each of the 5 professors teaches exactly 2 courses in Semester 1 2026-27)
    // Plus 1 historical offering for CS301 (Sharma, Semester 2 2025-26)
    const { rows: offerings } = await client.query(`
      INSERT INTO course_offerings (
        course_id, professor_id, term, is_active, department_id, academic_term_id
      ) VALUES
      ($1,  $11, 'Semester 1 2026-27', TRUE,  $16, $18), -- CS301 Sharma (Has 12 submissions: N >= 5)
      ($1,  $11, 'Semester 2 2025-26', FALSE, $16, $19), -- CS301 Sharma (Past offering)
      ($2,  $12, 'Semester 1 2026-27', TRUE,  $16, $18), -- CS201 Desai (Has 2 submissions: N < 5 Privacy Edge Case)
      ($3,  $11, 'Semester 1 2026-27', TRUE,  $16, $18), -- CS405 Sharma (Has 0 submissions: Empty state)
      ($4,  $12, 'Semester 1 2026-27', TRUE,  $17, $18), -- IT204 Desai (Web Systems)
      ($5,  $13, 'Semester 1 2026-27', TRUE,  $17, $18), -- IT101 Menon (IT Foundations)
      ($6,  $13, 'Semester 1 2026-27', TRUE,  $17, $18), -- IT302 Menon (Cloud Computing)
      ($7,  $14, 'Semester 1 2026-27', TRUE,  $16, $18), -- CS305 Mehta (Computer Networks)
      ($8,  $14, 'Semester 1 2026-27', TRUE,  $17, $18), -- IT304 Mehta (Information Security)
      ($9,  $15, 'Semester 1 2026-27', TRUE,  $16, $18), -- CS303 Singh (Operating Systems)
      ($10, $15, 'Semester 1 2026-27', TRUE,  $16, $18)  -- CS402 Singh (AI & Expert Systems)
      RETURNING id, course_id, professor_id, term;
    `, [
      courseMap['CS301'], // $1
      courseMap['CS201'], // $2
      courseMap['CS405'], // $3
      courseMap['IT204'], // $4
      courseMap['IT101'], // $5
      courseMap['IT302'], // $6
      courseMap['CS305'], // $7
      courseMap['IT304'], // $8
      courseMap['CS303'], // $9
      courseMap['CS402'], // $10
      profSharma,         // $11
      profDesai,          // $12
      profMenon,          // $13
      profMehta,          // $14
      profSingh,          // $15
      deptCse,            // $16
      deptIt,             // $17
      termIds['Semester 1 2026-27'], // $18
      termIds['Semester 2 2025-26']  // $19
    ]);

    const cs301SemesterOneOffering = offerings.find(o => o.course_id === courseMap['CS301'] && o.term === 'Semester 1 2026-27').id;
    const cs201SemesterOneOffering = offerings.find(o => o.course_id === courseMap['CS201'] && o.term === 'Semester 1 2026-27').id;
    const cs305SemesterOneOffering = offerings.find(o => o.course_id === courseMap['CS305'] && o.term === 'Semester 1 2026-27').id;
    const it304SemesterOneOffering = offerings.find(o => o.course_id === courseMap['IT304'] && o.term === 'Semester 1 2026-27').id;

    // Link offering primary departments
    await client.query(`
      INSERT INTO offering_departments (offering_id, department_id)
      SELECT id, department_id FROM course_offerings
      ON CONFLICT DO NOTHING;
    `);

    // Cross-department eligibility:
    // CS301, CS201, CS305 are also eligible for IT students
    // IT304 is also eligible for CSE students
    await client.query(`
      INSERT INTO offering_departments (offering_id, department_id) VALUES
      ($1, $5),
      ($2, $5),
      ($3, $5),
      ($4, $6)
      ON CONFLICT DO NOTHING;
    `, [cs301SemesterOneOffering, cs201SemesterOneOffering, cs305SemesterOneOffering, it304SemesterOneOffering, deptIt, deptCse]);

    // 5. Insert Submissions for CS301 Semester 1 (N = 12, diverse feedback)
    const submissionsData = [
      {
        clarity: 5, pace: 4, doubt: 5, engage: 4, examples: 2,
        comment: 'The professor explains difficult concepts clearly, but we need more practical SQL examples.',
        status: 'completed',
        sentiment: { label: 'neutral', score: 0.65 },
        topics: [
          { key: 'teaching_clarity', conf: 0.92 },
          { key: 'practical_examples', conf: 0.88 }
        ]
      },
      {
        clarity: 4, pace: 2, doubt: 4, engage: 3, examples: 2,
        comment: 'The lectures move too quickly through relational algebra. More practice problems please.',
        status: 'completed',
        sentiment: { label: 'negative', score: 0.78 },
        topics: [
          { key: 'teaching_pace', conf: 0.94 },
          { key: 'practical_examples', conf: 0.82 }
        ]
      },
      {
        clarity: 5, pace: 4, doubt: 5, engage: 5, examples: 4,
        comment: 'Excellent teaching style! Doubts asked in class are answered patiently and thoroughly.',
        status: 'completed',
        sentiment: { label: 'positive', score: 0.95 },
        topics: [
          { key: 'doubt_handling', conf: 0.96 },
          { key: 'teaching_clarity', conf: 0.85 }
        ]
      },
      {
        clarity: 4, pace: 3, doubt: 4, engage: 5, examples: 3,
        comment: 'Class discussions are very interactive and keep everyone engaged.',
        status: 'completed',
        sentiment: { label: 'positive', score: 0.89 },
        topics: [
          { key: 'engagement', conf: 0.93 }
        ]
      },
      {
        clarity: 3, pace: 2, doubt: 3, engage: 3, examples: 2,
        comment: 'Assignments are quite difficult and the pace of the course is overwhelming at times.',
        status: 'completed',
        sentiment: { label: 'negative', score: 0.84 },
        topics: [
          { key: 'assignments', conf: 0.90 },
          { key: 'teaching_pace', conf: 0.86 }
        ]
      },
      {
        clarity: 4, pace: 4, doubt: 4, engage: 4, examples: 3,
        comment: 'The textbook and curriculum cover modern database concepts well.',
        status: 'completed',
        sentiment: { label: 'positive', score: 0.75 },
        topics: [
          { key: 'course_content', conf: 0.88 }
        ]
      },
      {
        clarity: 4, pace: 4, doubt: 5, engage: 4, examples: 4,
        comment: 'Great lectures overall.',  // Zero-topic detection test case
        status: 'completed',
        sentiment: { label: 'positive', score: 0.91 },
        topics: []
      },
      {
        clarity: 2, pace: 2, doubt: 2, engage: 2, examples: 1,
        comment: 'We need much more hands-on lab practice and real-world database examples.',
        status: 'completed',
        sentiment: { label: 'negative', score: 0.92 },
        topics: [
          { key: 'practical_examples', conf: 0.95 }
        ]
      },
      {
        clarity: 5, pace: 4, doubt: 4, engage: 4, examples: 3,
        comment: 'Very clear explanations on indexing and B+ trees.',
        status: 'completed',
        sentiment: { label: 'positive', score: 0.88 },
        topics: [
          { key: 'teaching_clarity', conf: 0.91 }
        ]
      },
      {
        clarity: 4, pace: 3, doubt: 4, engage: 3, examples: 2,
        comment: 'Concepts are clear but slide switching is too fast and examples are lacking.',
        status: 'completed',
        sentiment: { label: 'negative', score: 0.72 },
        topics: [
          { key: 'teaching_clarity', conf: 0.75 },
          { key: 'teaching_pace', conf: 0.82 },
          { key: 'practical_examples', conf: 0.89 }
        ]
      },
      {
        clarity: 4, pace: 4, doubt: 4, engage: 4, examples: 4,
        comment: null, // Numerical rating only test case (no text)
        status: 'not_applicable',
        sentiment: null,
        topics: []
      },
      {
        clarity: 3, pace: 3, doubt: 3, engage: 3, examples: 3,
        comment: 'Pending NLP analysis demonstration comment.',
        status: 'pending', // Unprocessed NLP lifecycle test case
        sentiment: null,
        topics: []
      }
    ];

    for (const item of submissionsData) {
      const { rows: subRows } = await client.query(`
        INSERT INTO feedback_submissions (
          offering_id, rating_clarity, rating_pace, rating_doubt_handling,
          rating_engagement, rating_practical_examples, comment_text, analysis_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `, [
        cs301SemesterOneOffering, item.clarity, item.pace, item.doubt,
        item.engage, item.examples, item.comment, item.status
      ]);

      const subId = subRows[0].id;

      if (item.sentiment) {
        await client.query(`
          INSERT INTO feedback_sentiment (submission_id, label, score)
          VALUES ($1, $2, $3);
        `, [subId, item.sentiment.label, item.sentiment.score]);
      }

      for (const t of item.topics) {
        await client.query(`
          INSERT INTO feedback_topic_mention (submission_id, topic_key, confidence)
          VALUES ($1, $2, $3);
        `, [subId, t.key, t.conf]);
      }
    }

    // 6. Insert Submissions for CS201 Semester 1 (N = 2, triggers Privacy Guard N < 5)
    await client.query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples, comment_text, analysis_status
      ) VALUES
      ($1, 4, 3, 5, 4, 3, 'Good algorithms course so far.', 'completed'),
      ($1, 5, 4, 4, 5, 4, 'Really enjoy the recursion lectures.', 'completed');
    `, [cs201SemesterOneOffering]);

    // 7. Insert Students (A, B, C)
    // Password: SecureStudent123!
    const bcrypt = require('bcryptjs');
    const studentHash = await bcrypt.hash('SecureStudent123!', 10);

    const { rows: studentRows } = await client.query(`
      INSERT INTO students (email, password_hash, student_id_number, full_name) VALUES
      ('aarav@student.university.edu', $1, 'STU2026001', 'Aarav Sharma'),
      ('diya@student.university.edu',  $1, 'STU2026002', 'Diya Patel'),
      ('rohan@student.university.edu', $1, 'STU2026003', 'Rohan Verma'),
      ('priya@student.university.edu', $1, 'STU2026004', 'Priya Nair'),
      ('kabir@student.university.edu', $1, 'STU2026005', 'Kabir Rao')
      RETURNING id, email;
    `, [studentHash]);

    const studentA = studentRows.find(s => s.email === 'aarav@student.university.edu').id;
    const studentB = studentRows.find(s => s.email === 'diya@student.university.edu').id;
    const studentC = studentRows.find(s => s.email === 'rohan@student.university.edu').id;
    const studentD = studentRows.find(s => s.email === 'priya@student.university.edu').id;
    const studentE = studentRows.find(s => s.email === 'kabir@student.university.edu').id;

    // 8. Insert Course Enrollments
    // Student A (Aarav): enrolled in CS301 and CS201 (Flow D1 tests exact length = 2)
    // Student B (Diya): enrolled in CS301 (Flow D2 tests exact length = 1)
    // Student C (Rohan): enrolled in CS201 (Flow D3 tests exact length = 1)
    await client.query(`
      INSERT INTO course_enrollments (student_id, course_offering_id) VALUES
      ($1, $2),
      ($1, $3),
      ($4, $2),
      ($5, $3);
    `, [studentA, cs301SemesterOneOffering, cs201SemesterOneOffering, studentB, studentC]);

    // Student D (Priya - IT Student): enrolled in IT101, IT204, IT302, IT304, CS301
    const activeOfferings = offerings.filter(o => o.term === 'Semester 1 2026-27');
    const priyaCourseCodes = ['IT101', 'IT204', 'IT302', 'IT304', 'CS301'];
    const priyaOfferings = activeOfferings.filter(o => priyaCourseCodes.some(code => courseMap[code] === o.course_id));
    for (const off of priyaOfferings) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id) VALUES ($1, $2);
      `, [studentD, off.id]);
    }

    // Student E (Kabir - Full Catalog Student): enrolled in ALL 10 active courses across CSE & IT!
    for (const off of activeOfferings) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id) VALUES ($1, $2);
      `, [studentE, off.id]);
    }

    // 9. Insert Feedback Submission Control (Record that Student A has already submitted for CS301)
    await client.query(`
      INSERT INTO feedback_submission_control (student_id, course_offering_id)
      VALUES ($1, $2);
    `, [studentA, cs301SemesterOneOffering]);

    await client.query('COMMIT');
    console.log('[SEED] Database seeded successfully with realistic test records.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED ERROR] Seeding transaction failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[SEED FATAL ERROR]:', err);
      pool.end().then(() => process.exit(1));
    });
}

module.exports = { seedDatabase };
