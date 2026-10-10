const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
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

test.before(async () => {
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();

  const { rows: activeRows } = await query(
    'SELECT id FROM course_offerings WHERE is_active = TRUE LIMIT 1'
  );
  activeOfferingId = activeRows[0].id;

  const { rows: inactiveRows } = await query(
    'SELECT id FROM course_offerings WHERE is_active = FALSE LIMIT 1'
  );
  inactiveOfferingId = inactiveRows[0].id;
});

test.after(async () => {
  await closePool();
});

test('POST /api/v1/feedback - Happy Path: valid feedback with comment succeeds (201 Created)', async () => {
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
    body: payload,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Feedback submitted successfully.');
  // Anonymity check: never return internal row ID to client
  assert.equal(res.body.id, undefined);

  // Directly verify database persistence
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
  // NLP status lifecycle check: comment present -> initialized as pending, may transition to completed if online or failed if offline
  assert.ok(['pending', 'completed', 'failed'].includes(rows[0].analysis_status));
});


test('POST /api/v1/feedback - Happy Path: rating-only feedback (no comment) succeeds (201 Created)', async () => {
  const payload = {
    courseOfferingId: activeOfferingId,
    ratings: {
      teachingClarity: 4,
      teachingPace: 3,
      doubtHandling: 4,
      engagement: 3,
      practicalExamples: 2,
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    body: payload,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);

  // Directly verify database persistence and analysis_status = 'not_applicable'
  const { rows } = await query(
    `SELECT * FROM feedback_submissions 
     WHERE offering_id = $1 AND comment_text IS NULL AND rating_practical_examples = 2
     ORDER BY created_at DESC LIMIT 1`,
    [activeOfferingId]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].analysis_status, 'not_applicable');
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
      unsupportedExtraDimension: 5, // Forbidden unknown dimension
    },
  };

  const res = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    body: payload,
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/v1/feedback - Privacy Boundary: unexpected identity fields are rejected (422)', async () => {
  const payloadWithStudentIdentity = {
    courseOfferingId: activeOfferingId,
    studentId: 'STU12345678', // Malicious attempt to inject identity
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
    body: payload,
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'OFFERING_INACTIVE');
  assert.ok(res.body.error.message.includes('no longer accepting'));
});

test('POST /api/v1/feedback - Transaction Rollback: error during transaction rolls back cleanly', async () => {
  // Test transactional safety: call service directly with an offeringId that gets deleted or fails
  const { submitFeedback } = require('../src/modules/feedback/feedbackService');

  // Verify that an invalid insert inside transaction leaves 0 orphaned feedback rows
  const initialCountRes = await query('SELECT COUNT(*)::int AS count FROM feedback_submissions');
  const initialCount = initialCountRes.rows[0].count;

  await assert.rejects(
    submitFeedback({
      courseOfferingId: '00000000-0000-0000-0000-000000000000', // Non-existent
      ratings: {
        teachingClarity: 4, teachingPace: 4, doubtHandling: 4, engagement: 4, practicalExamples: 4
      },
      comment: 'Rollback test',
    })
  );

  const finalCountRes = await query('SELECT COUNT(*)::int AS count FROM feedback_submissions');
  assert.equal(finalCountRes.rows[0].count, initialCount, 'Database count must not change on rolled back transaction');
});
