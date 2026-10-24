const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { query, closePool } = require('../src/config/db');
const {
  isStudentEnrolled,
  hasStudentSubmittedOffering,
  recordSubmissionControl,
} = require('../src/modules/students/studentRepository');

async function request(handler, options = {}) {
  const http = require('http');
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const url = `http://127.0.0.1:${port}${options.path || '/'}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

let studentA, studentB, studentC;
let profSharmaId;
let cs301OfferingId, cs201OfferingId;
let studentAToken, studentBToken, studentCToken;
let facultyToken;

test.before(async () => {
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();

  const { rows: students } = await query(`
    SELECT id, email, full_name FROM students ORDER BY email;
  `);
  studentA = students.find((s) => s.email === 'aarav@student.university.edu');
  studentB = students.find((s) => s.email === 'diya@student.university.edu');
  studentC = students.find((s) => s.email === 'rohan@student.university.edu');

  const { rows: profs } = await query(`
    SELECT id, email, full_name FROM professors WHERE email = 'sharma@university.edu';
  `);
  profSharmaId = profs[0].id;

  const { rows: offerings } = await query(`
    SELECT o.id, c.code
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    WHERE o.term = 'Semester 1 2026-27';
  `);
  cs301OfferingId = offerings.find((o) => o.code === 'CS301').id;
  cs201OfferingId = offerings.find((o) => o.code === 'CS201').id;

  studentAToken = jwt.sign(
    { studentId: studentA.id, email: studentA.email, role: 'student' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  studentBToken = jwt.sign(
    { studentId: studentB.id, email: studentB.email, role: 'student' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  studentCToken = jwt.sign(
    { studentId: studentC.id, email: studentC.email, role: 'student' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  facultyToken = jwt.sign(
    { professorId: profSharmaId, email: 'sharma@university.edu', role: 'faculty' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
});

test.after(async () => {
  await closePool();
});

// -----------------------------------------------------------------------------
// Flow A: Student Authentication
// -----------------------------------------------------------------------------

test('Flow A1: POST /api/v1/auth/student/login succeeds with valid credentials', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/student/login',
    body: {
      email: 'aarav@student.university.edu',
      password: 'SecureStudent123!',
    },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'Should return JWT token');
  assert.ok(res.body.student, 'Should return student profile');
  assert.equal(res.body.student.email, 'aarav@student.university.edu');
  assert.equal(res.body.student.fullName, 'Aarav Sharma');
  assert.equal(res.body.student.password_hash, undefined, 'Password hash must never be returned');

  // Verify decoded JWT claims
  const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
  assert.equal(decoded.studentId, studentA.id);
  assert.equal(decoded.email, 'aarav@student.university.edu');
  assert.equal(decoded.role, 'student');
});

test('Flow A2: POST /api/v1/auth/student/login fails with invalid password', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/student/login',
    body: {
      email: 'aarav@student.university.edu',
      password: 'WrongPassword123!',
    },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Invalid student ID or password.');
});

test('Flow A3: POST /api/v1/auth/student/login fails with unknown email (no user enumeration)', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/student/login',
    body: {
      email: 'unknown@student.university.edu',
      password: 'SecureStudent123!',
    },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Invalid student ID or password.');
});

test('Flow A4: POST /api/v1/auth/student/login returns 400 for missing fields', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/student/login',
    body: {
      email: 'aarav@student.university.edu',
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

// -----------------------------------------------------------------------------
// Flow B: Student Profile Retrieval (GET /api/v1/student/me)
// -----------------------------------------------------------------------------

test('Flow B1: GET /api/v1/student/me returns profile for authenticated student', async () => {
  const res = await request(app, {
    path: '/api/v1/student/me',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.student);
  assert.equal(res.body.student.id, studentA.id);
  assert.equal(res.body.student.email, 'aarav@student.university.edu');
  assert.equal(res.body.student.fullName, 'Aarav Sharma');
  assert.equal(res.body.student.studentIdNumber, 'STU2026001');
  assert.equal(res.body.student.password_hash, undefined);
});

test('Flow B2: GET /api/v1/student/me rejects request without token with 401', async () => {
  const res = await request(app, {
    path: '/api/v1/student/me',
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

// -----------------------------------------------------------------------------
// Flow C: Role Isolation (Faculty vs. Student)
// -----------------------------------------------------------------------------

test('Flow C1: Student token rejected by faculty-protected route (GET /api/v1/auth/me)', async () => {
  const res = await request(app, {
    path: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('Flow C2: Student token rejected by faculty dashboard route (GET /api/v1/dashboard/:id)', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('Flow C3: Faculty token rejected by student-protected route (GET /api/v1/student/me)', async () => {
  const res = await request(app, {
    path: '/api/v1/student/me',
    headers: { Authorization: `Bearer ${facultyToken}` },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('Flow C4: Faculty token rejected by student offerings route (GET /api/v1/student/offerings)', async () => {
  const res = await request(app, {
    path: '/api/v1/student/offerings',
    headers: { Authorization: `Bearer ${facultyToken}` },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

// -----------------------------------------------------------------------------
// Flow D: Relational Enrollment & Offerings Visibility
// -----------------------------------------------------------------------------

test('Flow D1: Student A sees only enrolled offerings (CS301 & CS201) and accurate submission status', async () => {
  const res = await request(app, {
    path: '/api/v1/student/offerings',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.offerings));
  assert.equal(res.body.offerings.length, 2);

  const cs301 = res.body.offerings.find((o) => o.courseCode === 'CS301');
  const cs201 = res.body.offerings.find((o) => o.courseCode === 'CS201');

  assert.ok(cs301, 'Student A must see CS301');
  assert.ok(cs201, 'Student A must see CS201');

  // In seed, Student A has already submitted for CS301
  assert.equal(cs301.hasSubmitted, true);
  assert.ok(cs301.submittedAt);

  // Student A has NOT submitted for CS201
  assert.equal(cs201.hasSubmitted, false);
});

test('Flow D2: Student B sees only CS301 (hasSubmitted = false)', async () => {
  const res = await request(app, {
    path: '/api/v1/student/offerings',
    headers: { Authorization: `Bearer ${studentBToken}` },
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.offerings));
  assert.equal(res.body.offerings.length, 1);
  assert.equal(res.body.offerings[0].courseCode, 'CS301');
  assert.equal(res.body.offerings[0].hasSubmitted, false);
});

test('Flow D3: Student C sees only CS201 (hasSubmitted = false)', async () => {
  const res = await request(app, {
    path: '/api/v1/student/offerings',
    headers: { Authorization: `Bearer ${studentCToken}` },
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.offerings));
  assert.equal(res.body.offerings.length, 1);
  assert.equal(res.body.offerings[0].courseCode, 'CS201');
  assert.equal(res.body.offerings[0].hasSubmitted, false);
});

// -----------------------------------------------------------------------------
// Flow E: Submission-Control Model & Uniqueness Constraints
// -----------------------------------------------------------------------------

test('Flow E1: Enrollment verification query functions accurately', async () => {
  const enrolledA301 = await isStudentEnrolled(studentA.id, cs301OfferingId);
  const enrolledB201 = await isStudentEnrolled(studentB.id, cs201OfferingId);

  assert.equal(enrolledA301, true, 'Student A is enrolled in CS301');
  assert.equal(enrolledB201, false, 'Student B is NOT enrolled in CS201');
});

test('Flow E2: Submission check query functions accurately', async () => {
  const submittedA301 = await hasStudentSubmittedOffering(studentA.id, cs301OfferingId);
  const submittedB301 = await hasStudentSubmittedOffering(studentB.id, cs301OfferingId);

  assert.equal(submittedA301, true, 'Student A has already submitted for CS301');
  assert.equal(submittedB301, false, 'Student B has not submitted for CS301');
});

test('Flow E3: Unique constraint on (student_id, course_offering_id) prevents duplicates', async () => {
  // Student B has not submitted for CS301 yet. First record should succeed.
  const rec1 = await recordSubmissionControl(studentB.id, cs301OfferingId);
  assert.ok(rec1.id);
  assert.equal(rec1.student_id, studentB.id);
  assert.equal(rec1.course_offering_id, cs301OfferingId);

  // Attempting second record must throw unique constraint violation
  await assert.rejects(
    async () => {
      await recordSubmissionControl(studentB.id, cs301OfferingId);
    },
    (err) => {
      assert.equal(err.code, '23505', 'Postgres error code must be 23505 (unique_violation)');
      return true;
    }
  );
});

// -----------------------------------------------------------------------------
// Flow F: Structural Anonymity (Zero Schema Coupling)
// -----------------------------------------------------------------------------

test('Flow F1: feedback_submissions table contains NO student_id column', async () => {
  const { rows } = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'feedback_submissions' AND column_name = 'student_id';
  `);
  assert.equal(rows.length, 0, 'feedback_submissions must not contain student_id');
});

test('Flow F2: feedback_submission_control table contains NO submission_id column', async () => {
  const { rows } = await query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'feedback_submission_control' AND column_name = 'submission_id';
  `);
  assert.equal(rows.length, 0, 'feedback_submission_control must not reference feedback submission id');
});

// -----------------------------------------------------------------------------
// Flow G: Existing Operational Behavior Unchanged
// -----------------------------------------------------------------------------

test('Flow G1: Faculty login and dashboard functionality remain operational', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {
      email: 'sharma@university.edu',
      password: 'SecurePassword123!',
    },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);

  const dashRes = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${res.body.token}` },
  });
  assert.equal(dashRes.status, 200);
  assert.equal(dashRes.body.courseOffering.courseCode, 'CS301');
});
