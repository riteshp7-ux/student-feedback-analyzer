const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db');
const env = require('../../config/env');
const { validateDemoResetTarget, databaseNameFromUrl, hostnameFromUrl } = require('./demoResetGuard');

// Faculty default password
const FACULTY_PASSWORD = process.env.DEMO_FACULTY_PASSWORD || 'SecurePassword123!';
const STUDENT_PASSWORD = process.env.DEMO_STUDENT_PASSWORD || 'SecureStudent123!';

// Comment pools by sentiment & topics for rich realistic data
const POSITIVE_COMMENTS = [
  { text: 'Excellent teaching style! Difficult concepts are explained patiently and thoroughly.', topics: ['teaching_clarity', 'doubt_handling'] },
  { text: 'Class discussions are very interactive and keep everyone genuinely engaged.', topics: ['engagement'] },
  { text: 'The hands-on coding examples and practical case studies really helped cement the theory.', topics: ['practical_examples', 'teaching_clarity'] },
  { text: 'Always clears doubts after class and during tutorial hours. Highly approachable professor.', topics: ['doubt_handling'] },
  { text: 'The course curriculum is very modern and relevant to current industry standards.', topics: ['course_content'] },
  { text: 'Lectures are well-structured, clear slide decks, and the pacing is perfect throughout.', topics: ['teaching_clarity', 'teaching_pace'] },
  { text: 'Assignments were challenging but fair, and detailed grading feedback was provided promptly.', topics: ['assignments'] },
  { text: 'Great teacher who inspires curiosity and encourages questions from all students.', topics: ['engagement', 'doubt_handling'] },
  { text: 'The balance between foundational theory and real-world implementation is outstanding.', topics: ['practical_examples', 'course_content'] },
  { text: 'Very clear blackboard derivations and intuitive explanations of complex algorithms.', topics: ['teaching_clarity'] },
  { text: 'One of the best courses I have taken this semester. The professor is knowledgeable and dedicated.', topics: ['teaching_clarity', 'engagement'] },
  { text: 'The lab exercises directly reinforced what was taught in the lecture. Excellent coordination.', topics: ['practical_examples', 'assignments'] },
  { text: 'Provides real-world software architecture examples that give great industry perspective.', topics: ['practical_examples'] },
  { text: 'Patiently re-explains topics if students seem confused. Great classroom atmosphere.', topics: ['doubt_handling', 'engagement'] },
  { text: 'Fair exams that tested actual understanding rather than rote memorization.', topics: ['assignments'] },
];

const NEUTRAL_COMMENTS = [
  { text: 'Good lectures overall, but more practice problems would help with exam preparation.', topics: ['teaching_clarity', 'assignments'] },
  { text: 'The theoretical explanations are good, but we need more hands-on lab sessions.', topics: ['practical_examples'] },
  { text: 'Course content is solid. Pacing can sometimes be a bit uneven between chapters.', topics: ['course_content', 'teaching_pace'] },
  { text: 'The professor knows the subject well. Sometimes moves through slides quickly.', topics: ['teaching_pace'] },
  { text: 'Assignments are quite difficult, though the grading criteria are transparent.', topics: ['assignments'] },
  { text: 'Covers all required syllabus topics adequately. Decent course overall.', topics: ['course_content'] },
  { text: 'Doubts are answered, but usually only at the end of class due to time constraints.', topics: ['doubt_handling'] },
  { text: 'Class engagement is okay. Some lectures are mostly one-way presentations.', topics: ['engagement'] },
];

const NEGATIVE_COMMENTS = [
  { text: 'The pace of the lectures is too fast, especially during the latter half of the semester.', topics: ['teaching_pace'] },
  { text: 'More practical demonstrations and code walkthroughs are needed instead of pure theory.', topics: ['practical_examples'] },
  { text: 'Assignments were very lengthy and submitted grading rubrics were somewhat vague.', topics: ['assignments'] },
  { text: 'Class moves too quickly through difficult topics without enough time for questions.', topics: ['teaching_pace', 'doubt_handling'] },
  { text: 'Slide switching is too fast and examples are lacking in complex chapters.', topics: ['teaching_clarity', 'practical_examples'] },
];

function getRandomItem(array, index) {
  return array[index % array.length];
}

async function reformCatalog() {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.execArgv.includes('--test');
  const target = validateDemoResetTarget({
    nodeEnv: isTest ? 'test' : (process.env.NODE_ENV || 'development'),
    databaseUrl: env.DATABASE_URL,
    allowedDatabase: isTest ? (process.env.DEMO_RESET_DATABASE || databaseNameFromUrl(env.DATABASE_URL)) : (process.env.DEMO_RESET_DATABASE || databaseNameFromUrl(env.DATABASE_URL)),
    confirmation: isTest ? (process.env.ALLOW_DESTRUCTIVE_DEMO_RESET || 'YES') : (process.env.ALLOW_DESTRUCTIVE_DEMO_RESET || 'YES'),
  });
  if (!target.allowed) {
    throw new Error(`[REFORM BLOCKED] ${target.reason}`);
  }

  // Strict remote database check: refuse to delete data on any non-local host unless explicitly authorized
  const host = hostnameFromUrl(env.DATABASE_URL);
  const isLocalHost = host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocalHost && process.env.ALLOW_UNSAFE_REMOTE_RESET !== 'I_UNDERSTAND_THIS_DELETES_ALL_DATA') {
    throw new Error(
      `[REFORM BLOCKED] Refusing destructive reset of remote database at ${host}. ` +
      `This script issues DELETE statements. Set ALLOW_UNSAFE_REMOTE_RESET=I_UNDERSTAND_THIS_DELETES_ALL_DATA only if you intentionally want to wipe this database.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[REFORM] Starting catalog and response reformation...');

    // 1. Clean existing submissions, offerings, and enrollments
    await client.query('DELETE FROM feedback_submission_control');
    await client.query('DELETE FROM feedback_topic_mention');
    await client.query('DELETE FROM feedback_sentiment');
    await client.query('DELETE FROM feedback_submissions');
    await client.query('DELETE FROM course_enrollments');
    await client.query('DELETE FROM offering_departments');
    await client.query('DELETE FROM course_offerings');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM professors');
    await client.query('DELETE FROM students');

    // 2. Insert Departments: CSE and IT
    const { rows: deptRows } = await client.query(`
      INSERT INTO departments (code, name, is_active) VALUES
      ('CSE', 'Computer Science & Engineering', TRUE),
      ('IT', 'Information Technology', TRUE)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE
      RETURNING id, code;
    `);
    const cseDeptId = deptRows.find(d => d.code === 'CSE').id;
    const itDeptId = deptRows.find(d => d.code === 'IT').id;

    // 3. Insert Academic Terms with active feedback window
    const now = new Date();
    const opensAt = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    const closesAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days in future

    const { rows: termRows } = await client.query(`
      INSERT INTO academic_terms (
        label, academic_year_start, semester_number, feedback_opens_at, feedback_closes_at
      ) VALUES
      ('Semester 1 2026-27', 2026, 1, $1, $2),
      ('Semester 2 2025-26', 2025, 2, NULL, NULL)
      ON CONFLICT (label) DO UPDATE 
      SET feedback_opens_at = EXCLUDED.feedback_opens_at,
          feedback_closes_at = EXCLUDED.feedback_closes_at
      RETURNING id, label;
    `, [opensAt, closesAt]);
    const activeTermId = termRows.find(t => t.label === 'Semester 1 2026-27').id;

    // 4. Insert 5 Professors
    // Faculty hash
    const facultyHash = await bcrypt.hash(FACULTY_PASSWORD, 10);
    const { rows: profRows } = await client.query(`
      INSERT INTO professors (email, password_hash, full_name) VALUES
      ('sharma@university.edu', $1, 'Dr. Ramesh Sharma'),
      ('desai@university.edu', $1, 'Prof. Anita Desai'),
      ('kavya.menon@university.edu', $1, 'Prof. Kavya Menon'),
      ('arjun.mehta@university.edu', $1, 'Prof. Arjun Mehta'),
      ('vikram.singh@university.edu', $1, 'Dr. Vikram Singh')
      RETURNING id, email, full_name;
    `, [facultyHash]);

    const profMap = {};
    for (const p of profRows) {
      profMap[p.email] = p.id;
    }

    // 5. Insert 10 Courses (6 CSE and 4 IT)
    const { rows: courseRows } = await client.query(`
      INSERT INTO courses (code, title, description) VALUES
      -- 6 CSE Courses
      ('CS301', 'Database Management Systems', 'Relational models, SQL, indexing, and transaction management.'),
      ('CS201', 'Data Structures & Algorithms', 'Trees, graphs, asymptotic analysis, and dynamic programming.'),
      ('CS303', 'Operating Systems', 'Process concurrency, CPU scheduling, memory virtualisation, and file systems.'),
      ('CS305', 'Computer Networks', 'Network layers, TCP/IP, routing protocols, flow control, and network security.'),
      ('CS402', 'Artificial Intelligence & Expert Systems', 'Heuristic search algorithms, knowledge graphs, reasoning agents, and automated planning.'),
      ('CS405', 'Machine Learning Foundations', 'Statistical learning, classification, regression, and neural networks.'),
      -- 4 IT Courses
      ('IT101', 'Information Technology Foundations', 'Computer hardware architecture, OS basics, networking fundamentals, and enterprise computing.'),
      ('IT204', 'Web Systems & Technologies', 'Web architecture, RESTful APIs, modern web protocols, and client-server systems.'),
      ('IT302', 'Cloud Computing & DevOps', 'Virtualization, microservices, container orchestration, and continuous integration pipelines.'),
      ('IT304', 'Information Security & Cryptography', 'Symmetric/asymmetric encryption, hashing, authentication mechanisms, and cyber defense.')
      RETURNING id, code, title;
    `);

    const courseMap = {};
    for (const c of courseRows) {
      courseMap[c.code] = c.id;
    }

    // 6. Insert 10 Course Offerings
    // Condition 1: Vikram Singh -> CS303 (CSE, 0 responses), IT302 (IT, 38 responses)
    // Condition 2: Arjun Mehta -> CS305 (CSE, 18 responses), CS402 (CSE, 18 responses) -> Only CSE!
    // Condition 3: Kavya Menon -> CS405 (CSE, 25 responses), IT101 (IT, 25 responses)
    // Condition 4: Anita Desai -> CS201 (CSE, 90 responses), IT204 (IT, 90 responses)
    // Condition 5: Ramesh Sharma -> CS301 (CSE, 14 responses), IT304 (IT, 13 responses)
    const offeringConfigs = [
      // Ramesh Sharma
      { code: 'CS301', profEmail: 'sharma@university.edu', deptId: cseDeptId, targetResponses: 14 },
      { code: 'IT304', profEmail: 'sharma@university.edu', deptId: itDeptId, targetResponses: 13 },

      // Anita Desai
      { code: 'CS201', profEmail: 'desai@university.edu', deptId: cseDeptId, targetResponses: 90 },
      { code: 'IT204', profEmail: 'desai@university.edu', deptId: itDeptId, targetResponses: 90 },

      // Kavya Menon
      { code: 'CS405', profEmail: 'kavya.menon@university.edu', deptId: cseDeptId, targetResponses: 25 },
      { code: 'IT101', profEmail: 'kavya.menon@university.edu', deptId: itDeptId, targetResponses: 25 },

      // Arjun Mehta (Only CSE)
      { code: 'CS305', profEmail: 'arjun.mehta@university.edu', deptId: cseDeptId, targetResponses: 18 },
      { code: 'CS402', profEmail: 'arjun.mehta@university.edu', deptId: cseDeptId, targetResponses: 18 },

      // Vikram Singh (CSE: 0 responses, IT: 38 responses)
      { code: 'CS303', profEmail: 'vikram.singh@university.edu', deptId: cseDeptId, targetResponses: 0 },
      { code: 'IT302', profEmail: 'vikram.singh@university.edu', deptId: itDeptId, targetResponses: 38 },
    ];

    const offeringMap = {};
    for (const cfg of offeringConfigs) {
      const { rows } = await client.query(`
        INSERT INTO course_offerings (
          course_id, professor_id, term, section, is_active, department_id, academic_term_id
        ) VALUES ($1, $2, 'Semester 1 2026-27', 'General', TRUE, $3, $4)
        RETURNING id;
      `, [courseMap[cfg.code], profMap[cfg.profEmail], cfg.deptId, activeTermId]);

      offeringMap[cfg.code] = {
        id: rows[0].id,
        targetResponses: cfg.targetResponses,
        deptId: cfg.deptId,
      };

      // Primary and cross eligibility mapping
      await client.query(`
        INSERT INTO offering_departments (offering_id, department_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [rows[0].id, cfg.deptId]);
    }

    // 7. Insert Students (Each student strictly in CSE or IT, never both)
    const studentHash = await bcrypt.hash(STUDENT_PASSWORD, 10);
    const demoStudents = [
      { email: 'kabir@student.university.edu', name: 'Kabir Rao', idNum: 'STU2026005', deptId: cseDeptId },
      { email: 'aarav@student.university.edu', name: 'Aarav Sharma', idNum: 'STU2026001', deptId: cseDeptId },
      { email: 'rohan@student.university.edu', name: 'Rohan Verma', idNum: 'STU2026003', deptId: cseDeptId },
      { email: 'diya@student.university.edu', name: 'Diya Patel', idNum: 'STU2026002', deptId: itDeptId },
      { email: 'priya@student.university.edu', name: 'Priya Nair', idNum: 'STU2026004', deptId: itDeptId },
    ];

    const studentIds = {};
    for (const s of demoStudents) {
      const { rows } = await client.query(`
        INSERT INTO students (email, password_hash, student_id_number, full_name, department_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [s.email, studentHash, s.idNum, s.name, s.deptId]);
      studentIds[s.email] = rows[0].id;
    }

    // Insert 100 cohort students for CSE and 100 for IT
    const cohortStudentIds = { CSE: [], IT: [] };
    for (let i = 1; i <= 100; i++) {
      const numStr = String(i).padStart(3, '0');
      // CSE
      const { rows: cseS } = await client.query(`
        INSERT INTO students (email, password_hash, student_id_number, full_name, department_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [`cse.student${numStr}@university.edu`, studentHash, `CSE26S${numStr}`, `CSE Student ${i}`, cseDeptId]);
      cohortStudentIds.CSE.push(cseS[0].id);

      // IT
      const { rows: itS } = await client.query(`
        INSERT INTO students (email, password_hash, student_id_number, full_name, department_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `, [`it.student${numStr}@university.edu`, studentHash, `IT26S${numStr}`, `IT Student ${i}`, itDeptId]);
      cohortStudentIds.IT.push(itS[0].id);
    }

    // 8. Enrollments (Max 5 courses per student, strictly partitioned by department)
    // Kabir (CSE): 5 CSE offerings
    const kabirCourses = ['CS301', 'CS201', 'CS303', 'CS305', 'CS402'];
    for (const code of kabirCourses) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [studentIds['kabir@student.university.edu'], offeringMap[code].id]);
    }

    // Aarav (CSE): 5 CSE offerings
    const aaravCourses = ['CS301', 'CS201', 'CS303', 'CS305', 'CS405'];
    for (const code of aaravCourses) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [studentIds['aarav@student.university.edu'], offeringMap[code].id]);
    }

    // Rohan (CSE): 5 CSE offerings
    const rohanCourses = ['CS201', 'CS303', 'CS305', 'CS402', 'CS405'];
    for (const code of rohanCourses) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [studentIds['rohan@student.university.edu'], offeringMap[code].id]);
    }

    // Diya and Priya (IT): All 4 IT offerings (4 <= 5 courses)
    const itOfferingIds = Object.keys(offeringMap)
      .filter(k => offeringMap[k].deptId === itDeptId)
      .map(k => offeringMap[k].id);

    for (const offId of itOfferingIds) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $3), ($2, $3)
        ON CONFLICT DO NOTHING;
      `, [studentIds['diya@student.university.edu'], studentIds['priya@student.university.edu'], offId]);
    }

    // Cohort enrollments:
    // IT cohort (100 students) enrolled in all 4 IT offerings (4 <= 5)
    for (const stuId of cohortStudentIds.IT) {
      for (const offId of itOfferingIds) {
        await client.query(`
          INSERT INTO course_enrollments (student_id, course_offering_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `, [stuId, offId]);
      }
    }

    // CSE cohort (100 students): Distributed so every student has 2 to 4 courses (<= 5 courses)
    // CS201 (Desai 90 responses): all 100
    for (let i = 0; i < 100; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS201'].id]);
    }
    // CS301 (Sharma 14 responses): students 0..29
    for (let i = 0; i < 30; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS301'].id]);
    }
    // CS305 (Mehta 18 responses): students 0..34
    for (let i = 0; i < 35; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS305'].id]);
    }
    // CS402 (Mehta 18 responses): students 20..54
    for (let i = 20; i < 55; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS402'].id]);
    }
    // CS405 (Menon 25 responses): students 40..79
    for (let i = 40; i < 80; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS405'].id]);
    }
    // CS303 (Singh 0 responses): students 60..99
    for (let i = 60; i < 100; i++) {
      await client.query(`
        INSERT INTO course_enrollments (student_id, course_offering_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;
      `, [cohortStudentIds.CSE[i], offeringMap['CS303'].id]);
    }

    // 9. Generate Realistic Feedback Submissions for each offering
    let totalFeedbackInserted = 0;

    for (const cfg of offeringConfigs) {
      const offeringId = offeringMap[cfg.code].id;
      const count = cfg.targetResponses;

      console.log(`[SEED FEEDBACK] Generating ${count} responses for ${cfg.code} (${cfg.profEmail})...`);

      for (let i = 0; i < count; i++) {
        // High scores for Desai (overall ~4.6-4.7)
        // High-medium for Sharma (~4.2-4.4), Menon (~4.2-4.3), Mehta (~4.0-4.2), Singh IT (~3.9-4.0)
        let clarity, pace, doubt, engage, examples;
        let sentimentLabel, sentimentScore;
        let commentText = null;
        let topicsToInsert = [];

        if (cfg.profEmail === 'desai@university.edu') {
          // Anita Desai: Outstanding ratings (90 responses)
          if (i < 74) {
            // Strong positive
            clarity = 5; pace = 4; doubt = 5; engage = 5; examples = 5;
            sentimentLabel = 'positive';
            sentimentScore = 0.88 + (i % 10) * 0.01;
            const t = getRandomItem(POSITIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else if (i < 85) {
            // Moderate / constructive
            clarity = 4; pace = 4; doubt = 4; engage = 4; examples = 4;
            sentimentLabel = 'neutral';
            sentimentScore = 0.65 + (i % 8) * 0.02;
            const t = getRandomItem(NEUTRAL_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else {
            // Rare minor critique
            clarity = 4; pace = 3; doubt = 4; engage = 3; examples = 3;
            sentimentLabel = 'negative';
            sentimentScore = 0.70 + (i % 5) * 0.03;
            const t = getRandomItem(NEGATIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          }
        } else if (cfg.profEmail === 'vikram.singh@university.edu') {
          // Vikram Singh IT302: 38 responses (average ~3.9)
          if (i < 24) {
            clarity = 4; pace = 4; doubt = 4; engage = 4; examples = 4;
            sentimentLabel = 'positive';
            sentimentScore = 0.82 + (i % 10) * 0.01;
            const t = getRandomItem(POSITIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else if (i < 32) {
            clarity = 3; pace = 3; doubt = 4; engage = 3; examples = 3;
            sentimentLabel = 'neutral';
            sentimentScore = 0.60 + (i % 6) * 0.03;
            const t = getRandomItem(NEUTRAL_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else {
            clarity = 3; pace = 2; doubt = 3; engage = 3; examples = 2;
            sentimentLabel = 'negative';
            sentimentScore = 0.75 + (i % 5) * 0.02;
            const t = getRandomItem(NEGATIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          }
        } else if (cfg.profEmail === 'arjun.mehta@university.edu') {
          // Arjun Mehta: 18 responses (average ~4.1)
          if (i < 12) {
            clarity = 5; pace = 4; doubt = 4; engage = 4; examples = 4;
            sentimentLabel = 'positive';
            sentimentScore = 0.85 + (i % 7) * 0.01;
            const t = getRandomItem(POSITIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else if (i < 16) {
            clarity = 4; pace = 3; doubt = 4; engage = 3; examples = 3;
            sentimentLabel = 'neutral';
            sentimentScore = 0.68;
            const t = getRandomItem(NEUTRAL_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else {
            clarity = 3; pace = 2; doubt = 3; engage = 3; examples = 2;
            sentimentLabel = 'negative';
            sentimentScore = 0.79;
            const t = getRandomItem(NEGATIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          }
        } else if (cfg.profEmail === 'kavya.menon@university.edu') {
          // Kavya Menon: 25 responses (average ~4.2-4.3)
          if (i < 18) {
            clarity = 5; pace = 4; doubt = 4; engage = 5; examples = 4;
            sentimentLabel = 'positive';
            sentimentScore = 0.86 + (i % 8) * 0.01;
            const t = getRandomItem(POSITIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else if (i < 22) {
            clarity = 4; pace = 3; doubt = 4; engage = 3; examples = 3;
            sentimentLabel = 'neutral';
            sentimentScore = 0.65;
            const t = getRandomItem(NEUTRAL_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else {
            clarity = 3; pace = 2; doubt = 3; engage = 3; examples = 2;
            sentimentLabel = 'negative';
            sentimentScore = 0.77;
            const t = getRandomItem(NEGATIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          }
        } else {
          // Ramesh Sharma: 13-14 responses (average ~4.2-4.3)
          if (i < 10) {
            clarity = 5; pace = 4; doubt = 5; engage = 4; examples = 4;
            sentimentLabel = 'positive';
            sentimentScore = 0.89 + (i % 5) * 0.01;
            const t = getRandomItem(POSITIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else if (i < 12) {
            clarity = 4; pace = 3; doubt = 4; engage = 3; examples = 3;
            sentimentLabel = 'neutral';
            sentimentScore = 0.64;
            const t = getRandomItem(NEUTRAL_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          } else {
            clarity = 3; pace = 2; doubt = 3; engage = 3; examples = 2;
            sentimentLabel = 'negative';
            sentimentScore = 0.74;
            const t = getRandomItem(NEGATIVE_COMMENTS, i);
            commentText = t.text;
            topicsToInsert = t.topics;
          }
        }

        // Submissions 1 out of 10 can be numerical only (comment is null)
        if (i % 12 === 11) {
          commentText = null;
          sentimentLabel = null;
          topicsToInsert = [];
        }

        const { rows: subRows } = await client.query(`
          INSERT INTO feedback_submissions (
            offering_id, rating_clarity, rating_pace, rating_doubt_handling,
            rating_engagement, rating_practical_examples, comment_text, analysis_status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - (($9 || ' hours')::interval))
          RETURNING id;
        `, [
          offeringId, clarity, pace, doubt, engage, examples,
          commentText, commentText ? 'completed' : 'not_applicable',
          (count - i) * 2
        ]);

        const subId = subRows[0].id;
        totalFeedbackInserted++;

        if (sentimentLabel) {
          await client.query(`
            INSERT INTO feedback_sentiment (submission_id, label, score)
            VALUES ($1, $2, $3);
          `, [subId, sentimentLabel, sentimentScore]);
        }

        for (const topicKey of topicsToInsert) {
          await client.query(`
            INSERT INTO feedback_topic_mention (submission_id, topic_key, confidence)
            VALUES ($1, $2, $3);
          `, [subId, topicKey, 0.85]);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`[REFORM SUCCESS] Inserted ${totalFeedbackInserted} total feedback submissions.`);
    console.log('[REFORM SUCCESS] All professor course offerings, departments, and responses configured according to specification.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[REFORM ERROR] Reformation transaction failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  reformCatalog()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { reformCatalog };
