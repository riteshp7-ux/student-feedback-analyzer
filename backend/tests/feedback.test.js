const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { query, closePool } = require('../src/config/db');

// In-memory HTTP test client helper
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

let activeOfferingId;
let inactiveOfferingId;
let studentA, studentB, studentC;
let studentAToken, studentBToken, studentCToken;

test.before(async () => {
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();

  const { rows: offerings } = await query(`
    SELECT o.id, c.code, o.is_active
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    WHERE o.term = 'Semester 1 2026-27' AND c.code = 'CS301';
  `);
  activeOfferingId = offerings[0].id;

  const { rows: inactiveRows } = await query(
    'SELECT id FROM course_offerings WHERE is_active = FALSE LIMIT 1'
  );
  inactiveOfferingId = inactiveRows[0].id;

  const { rows: students } = await query('SELECT id, email FROM students;');
  studentA = students.find((s) => s.email === 'aarav@student.university.edu');
  studentB = students.find((s) => s.email === 'diya@student.university.edu');
  studentC = students.find((s) => s.email === 'rohan@student.university.edu');

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
});

test.after(async () => {
  await closePool();
});

test('POST /api/v1/feedback - Authentication Guard: unauthenticated request is rejected (401 UNAUTHORIZED)', async () => {
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 5,
      teachingPace: 4,
      doubtHandling: 5,
      engagement: 4,
      practicalExamples: 3,
    },
    comment: 'Unauthenticated attempt',
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    body: payload,
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('POST /api/v1/feedback - Enrollment Guard: non-enrolled student is rejected (403 STUDENT_NOT_ENROLLED)', async () => {
  // Student C (rohan) is NOT enrolled in CS301
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 5,
      teachingPace: 4,
      doubtHandling: 5,
      engagement: 4,
      practicalExamples: 3,
    },
    comment: 'Attempting submission to course I am not enrolled in',
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentCToken}` },
    body: payload,
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'STUDENT_NOT_ENROLLED');
  assert.ok(res.body.error.message.includes('not enrolled'));
});

test('POST /api/v1/feedback - Happy Path: valid feedback by enrolled student succeeds (201 Created)', async () => {
  // Student B (diya) is enrolled in CS301 and has not submitted yet
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 5,
      teachingPace: 4,
      doubtHandling: 5,
      engagement: 4,
      practicalExamples: 3,
    },
    comment: 'The instructor explains concepts thoroughly and doubt clearing is excellent.',
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payload,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Feedback submitted successfully.');
  // Anonymity check: never return internal row ID to client
  assert.equal(res.body.id, undefined);

  // Directly verify database persistence in feedback_submissions (NO student identity)
  const { rows } = await query(
    `SELECT * FROM feedback_submissions 
     WHERE offering_id = $1 AND comment_text = $2`,
    [activeOfferingId, payload.comment]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rating_clarity, 5);
  assert.equal(rows[0].rating_pace, 4);
  assert.equal(rows[0].rating_doubt_handling, 5);
  assert.equal(rows[0].rating_engagement, 4);
  assert.equal(rows[0].rating_practical_examples, 3);
  assert.ok(['pending', 'completed', 'failed'].includes(rows[0].analysis_status));

  // Directly verify submission-control record exists for Student B and CS301
  const { rows: controlRows } = await query(
    `SELECT * FROM feedback_submission_control
     WHERE student_id = $1 AND course_offering_id = $2`,
    [studentB.id, activeOfferingId]
  );
  assert.equal(controlRows.length, 1);
});

test('POST /api/v1/feedback - One-Submission Rule: second submission by same student is rejected (409 ALREADY_SUBMITTED)', async () => {
  // Student B just submitted above. Attempting second submission:
  const duplicatePayload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 4,
      teachingPace: 4,
      doubtHandling: 4,
      engagement: 4,
      practicalExamples: 4,
    },
    comment: 'Attempting duplicate submission',
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: duplicatePayload,
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ALREADY_SUBMITTED');
  assert.ok(res.body.error.message.includes('already been submitted'));
});

test('POST /api/v1/feedback - Validation: missing required rating returns 422 with details', async () => {
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 4,
      // teachingPace missing
      doubtHandling: 4,
      engagement: 3,
      practicalExamples: 2,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payload,
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.details['ratings.teachingPace']);
});

test('POST /api/v1/feedback - Validation: rating out of bounds (0 or 6) returns 422', async () => {
  const payloadOutOfRange = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 6, // Out of bounds
      teachingPace: 0,    // Out of bounds
      doubtHandling: 4,
      engagement: 3,
      practicalExamples: 2,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payloadOutOfRange,
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.details['ratings.teachingClarity']);
  assert.ok(res.body.error.details['ratings.teachingPace']);
});

test('POST /api/v1/feedback - Validation: unknown rating dimension is rejected (422)', async () => {
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 4,
      teachingPace: 4,
      doubtHandling: 4,
      engagement: 4,
      practicalExamples: 4,
      unsupportedExtraDimension: 5,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payload,
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/v1/feedback - Privacy Boundary: unexpected identity fields are rejected (422)', async () => {
  const payloadWithStudentIdentity = {
    courseOfferingId: activeOfferingId,
    studentId: 'STU12345678', // Forbidden identity field injection
    studentEmail: 'student@university.edu',
    ratings: {
      teachingClarity: 5,
      teachingPace: 5,
      doubtHandling: 5,
      engagement: 5,
      practicalExamples: 5,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payloadWithStudentIdentity,
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/v1/feedback - Nonexistent offering returns 404 RESOURCE_NOT_FOUND', async () => {
  const nonExistentOfferingId = '11111111-2222-3333-4444-555555555555';
  const payload = {
    courseOfferingId: nonExistentOfferingId,
    ratings: {
      teachingClarity: 4,
      teachingPace: 4,
      doubtHandling: 4,
      engagement: 4,
      practicalExamples: 4,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payload,
  });

  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'RESOURCE_NOT_FOUND');
  assert.ok(res.body.error.message.includes('does not exist'));
});

test('POST /api/v1/feedback - Inactive offering returns 400 OFFERING_INACTIVE', async () => {
  const payload = {
    courseOfferingId: inactiveOfferingId,
    ratings: {
      teachingClarity: 4,
      teachingPace: 4,
      doubtHandling: 4,
      engagement: 4,
      practicalExamples: 4,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentBToken}` },
    body: payload,
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'OFFERING_INACTIVE');
  assert.ok(res.body.error.message.includes('no longer accepting'));
});

test('POST /api/v1/feedback - Transaction Rollback: error during transaction rolls back cleanly', async () => {
  const { submitFeedback } = require('../src/modules/feedback/feedbackService');

  const initialCountRes = await query('SELECT COUNT(*)::int AS count FROM feedback_submissions');
  const initialCount = initialCountRes.rows[0].count;

  await assert.rejects(
    submitFeedback({
      courseOfferingId: '00000000-0000-0000-0000-000000000000', // Non-existent
      ratings: {
        teachingClarity: 4, teachingPace: 4, doubtHandling: 4, engagement: 4, practicalExamples: 4
      },
      comment: 'Rollback test',
    }, studentB.id)
  );

  const finalCountRes = await query('SELECT COUNT(*)::int AS count FROM feedback_submissions');
  assert.equal(finalCountRes.rows[0].count, initialCount, 'Database count must not change on rolled back transaction');
});
