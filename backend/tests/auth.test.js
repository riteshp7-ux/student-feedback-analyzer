const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { query, closePool } = require('../src/config/db');

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

let profSharmaId;
let profDesaiId;
let cs301OfferingId; // Owned by Sharma
let cs201OfferingId; // Owned by Desai
let validSharmaToken;
let validDesaiToken;

test.before(async () => {
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();

  const { rows: profs } = await query(`
    SELECT id, email, full_name FROM professors ORDER BY email;
  `);
  // desai@university.edu, sharma@university.edu
  profDesaiId = profs.find(p => p.email === 'desai@university.edu').id;
  profSharmaId = profs.find(p => p.email === 'sharma@university.edu').id;

  const { rows: offerings } = await query(`
    SELECT o.id, c.code, o.professor_id
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    WHERE o.term = 'Semester 1 2026-27';
  `);

  cs301OfferingId = offerings.find(o => o.code === 'CS301').id;
  cs201OfferingId = offerings.find(o => o.code === 'CS201').id;

  // Generate tokens for testing
  validSharmaToken = jwt.sign(
    { professorId: profSharmaId, email: 'sharma@university.edu' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  validDesaiToken = jwt.sign(
    { professorId: profDesaiId, email: 'desai@university.edu' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
});

test.after(async () => {
  await closePool();
});

// -----------------------------------------------------------------------------
// 1. Authentication Endpoints (POST /api/v1/auth/login)
// -----------------------------------------------------------------------------

test('POST /api/v1/auth/login - Success: valid credentials returns 200 with JWT and professor profile', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {
      email: 'sharma@university.edu',
      password: 'SecurePassword123!',
    },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'Response must include JWT token');
  assert.ok(res.body.professor, 'Response must include professor object');
  assert.equal(res.body.professor.email, 'sharma@university.edu');
  assert.equal(res.body.professor.fullName, 'Dr. Ramesh Sharma');
  // Password hash must NEVER be exposed
  assert.equal(res.body.professor.password_hash, undefined);
  assert.equal(res.body.professor.password, undefined);

  // Verify token decoding
  const decoded = jwt.verify(res.body.token, env.JWT_SECRET);
  assert.equal(decoded.professorId, profSharmaId);
  assert.equal(decoded.email, 'sharma@university.edu');
});

test('POST /api/v1/auth/login - Failure: wrong password returns 401 INVALID_CREDENTIALS', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {
      email: 'sharma@university.edu',
      password: 'WrongPassword!',
    },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Invalid email or password.');
});

test('POST /api/v1/auth/login - Failure: nonexistent email returns 401 INVALID_CREDENTIALS (no enumeration)', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {
      email: 'nonexistent@university.edu',
      password: 'SecurePassword123!',
    },
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(res.body.error.message, 'Invalid email or password.');
});

test('POST /api/v1/auth/login - Validation: missing fields returns 400 VALIDATION_FAILED', async () => {
  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {
      email: 'invalid-email',
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_FAILED');
});

// -----------------------------------------------------------------------------
// 2. Session Identity (GET /api/v1/auth/me)
// -----------------------------------------------------------------------------

test('GET /api/v1/auth/me - Success: returns authenticated professor profile', async () => {
  const res = await request(app, {
    path: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${validSharmaToken}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.professor.email, 'sharma@university.edu');
  assert.equal(res.body.professor.fullName, 'Dr. Ramesh Sharma');
  assert.equal(res.body.professor.password_hash, undefined);
});

test('GET /api/v1/auth/me - Unauthenticated: missing header returns 401 UNAUTHORIZED', async () => {
  const res = await request(app, { path: '/api/v1/auth/me' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('GET /api/v1/auth/me - Invalid: malformed token returns 401 MALFORMED_TOKEN / INVALID_TOKEN', async () => {
  const res = await request(app, {
    path: '/api/v1/auth/me',
    headers: { Authorization: 'Bearer not.a.real.token' },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_TOKEN');
});

test('GET /api/v1/auth/me - Expired: expired token returns 401 TOKEN_EXPIRED', async () => {
  const expiredToken = jwt.sign(
    { professorId: profSharmaId, email: 'sharma@university.edu' },
    env.JWT_SECRET,
    { expiresIn: '-1s' }
  );

  const res = await request(app, {
    path: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
});

// -----------------------------------------------------------------------------
// 3. Protected Offerings (GET /api/v1/professor/offerings)
// -----------------------------------------------------------------------------

test('GET /api/v1/professor/offerings - Success: returns only offerings assigned to professor', async () => {
  const res = await request(app, {
    path: '/api/v1/professor/offerings',
    headers: { Authorization: `Bearer ${validSharmaToken}` },
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  // Sharma has CS301 (Semester 1 2026-27), CS301 (Semester 2 2025-26), and CS405 (Semester 1 2026-27)
  assert.ok(res.body.length >= 2);
  for (const off of res.body) {
    // Should NOT include Desai's CS201
    assert.notEqual(off.courseCode, 'CS201');
  }
});

test('GET /api/v1/professor/offerings - Unauthenticated: returns 401 UNAUTHORIZED', async () => {
  const res = await request(app, { path: '/api/v1/professor/offerings' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

// -----------------------------------------------------------------------------
// 4. Authorization & Resource Ownership Guards
// -----------------------------------------------------------------------------

test('GET /api/v1/dashboard/:id - Authorized: Professor Sharma accesses own course (CS301)', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${validSharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.courseOffering.courseCode, 'CS301');
});

test('GET /api/v1/dashboard/:id - Forbidden: Professor Desai CANNOT access Sharma course (CS301)', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${validDesaiToken}` },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.ok(res.body.error.message.includes('not authorized'));
});

test('GET /api/v1/dashboard/:id - Unauthenticated: access rejected with 401 UNAUTHORIZED', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('GET /api/v1/feedback/:id - Authorized: Professor Sharma accesses own comments (CS301)', async () => {
  const res = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${validSharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.comments));
});

test('GET /api/v1/feedback/:id - Forbidden: Professor Desai CANNOT access Sharma comments (CS301)', async () => {
  const res = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${validDesaiToken}` },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

// -----------------------------------------------------------------------------
// 5. Student Anonymity Preservation
// -----------------------------------------------------------------------------

test('Student Submission Flow: POST /feedback requires student auth and rejects unauthenticated request', async () => {
  const unauthRes = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    body: {
      courseOfferingId: cs301OfferingId,
      ratings: {
        teachingClarity: 4,
        teachingPace: 4,
        doubtHandling: 4,
        engagement: 4,
        practicalExamples: 4,
      },
      comment: 'Unauthenticated submission should be rejected.',
    },
  });

  assert.equal(unauthRes.status, 401);
  assert.equal(unauthRes.body.error.code, 'UNAUTHORIZED');

  // Verify that student B (enrolled in CS301, not yet submitted) succeeds with valid student token
  const { rows: studentBRows } = await query("SELECT id, email FROM students WHERE email = 'diya@student.university.edu'");
  const studentB = studentBRows[0];
  const studentBToken = jwt.sign(
    { studentId: studentB.id, email: studentB.email, role: 'student' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const authRes = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: {
      courseOfferingId: cs301OfferingId,
      ratings: {
        teachingClarity: 4,
        teachingPace: 4,
        doubtHandling: 4,
        engagement: 4,
        practicalExamples: 4,
      },
      comment: 'Authenticated student submission works and persists anonymously.',
    },
  });

  assert.equal(authRes.status, 201);
  assert.equal(authRes.body.success, true);
  assert.equal(authRes.body.message, 'Feedback submitted successfully.');
});

test('Public / Student Flow: GET /course-offerings remains publicly accessible', async () => {
  const res = await request(app, { path: '/api/v1/course-offerings' });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
});
