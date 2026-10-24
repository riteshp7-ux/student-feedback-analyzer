const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
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

const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

let cs301OfferingId;
let cs201LowResponseOfferingId;
let cs405ZeroResponseOfferingId;
let sharmaToken;
let desaiToken;
let studentDiyaToken;

test.before(async () => {
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();

  const { rows: profs } = await query(`
    SELECT id, email FROM professors;
  `);
  const sharma = profs.find(p => p.email === 'sharma@university.edu');
  const desai = profs.find(p => p.email === 'desai@university.edu');

  sharmaToken = jwt.sign(
    { professorId: sharma.id, email: sharma.email },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  desaiToken = jwt.sign(
    { professorId: desai.id, email: desai.email },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { rows: stuRows } = await query("SELECT id, email FROM students WHERE email = 'diya@student.university.edu'");
  const studentDiya = stuRows[0];
  studentDiyaToken = jwt.sign(
    { studentId: studentDiya.id, email: studentDiya.email, role: 'student' },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { rows: offerings } = await query(`
    SELECT o.id, c.code
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    WHERE o.term = 'Semester 1 2026-27';
  `);

  cs301OfferingId = offerings.find(o => o.code === 'CS301').id;
  cs201LowResponseOfferingId = offerings.find(o => o.code === 'CS201').id;
  cs405ZeroResponseOfferingId = offerings.find(o => o.code === 'CS405').id;
});

test.after(async () => {
  await closePool();
});

// -----------------------------------------------------------------------------
// 1. Course Offerings Tests (GET /api/v1/course-offerings)
// -----------------------------------------------------------------------------
test('GET /api/v1/course-offerings - Returns active course offerings with metadata', async () => {
  const res = await request(app, { path: '/api/v1/course-offerings' });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 3);

  const cs301 = res.body.find(item => item.courseCode === 'CS301');
  assert.ok(cs301);
  assert.equal(cs301.courseTitle, 'Database Management Systems');
  assert.equal(cs301.term, 'Semester 1 2026-27');
  assert.equal(cs301.instructorName, 'Dr. Ramesh Sharma');
  // Privacy check: no internal professor password hashes or emails exposed
  assert.equal(cs301.password_hash, undefined);
});

// -----------------------------------------------------------------------------
// 2. Dashboard Aggregation Tests (GET /api/v1/dashboard/:courseOfferingId)
// -----------------------------------------------------------------------------
test('GET /api/v1/dashboard/:id - Happy Path: offering with N >= 5 returns full analytics', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.privacyThresholdMet, true);

  // Level 1: Overall state
  assert.ok(res.body.overall.responseCount >= 10);
  assert.ok(res.body.overall.averageRating >= 1.0 && res.body.overall.averageRating <= 5.0);
  assert.ok(res.body.overall.sentimentDistribution.positive > 0);
  assert.ok(res.body.overall.sentimentDistribution.negative > 0);

  // Level 2: Performance dimensions (Exactly 5 dimensions)
  assert.equal(res.body.performance.length, 5);
  const clarity = res.body.performance.find(p => p.dimensionKey === 'teachingClarity');
  assert.ok(clarity);
  assert.equal(clarity.label, 'Teaching Clarity');
  assert.ok(clarity.averageScore >= 1 && clarity.averageScore <= 5);
  assert.ok(['strong', 'moderate', 'weak'].includes(clarity.status));

  // Level 3: Topics
  assert.ok(Array.isArray(res.body.topics));
  const practicalExamples = res.body.topics.find(t => t.topicKey === 'practical_examples');
  assert.ok(practicalExamples);
  assert.equal(practicalExamples.label, 'Practical Examples');
  assert.ok(practicalExamples.mentionCount > 0);
  assert.ok(['positive', 'neutral', 'negative'].includes(practicalExamples.dominantSentiment));
});

test('GET /api/v1/dashboard/:id - Privacy Guard: offering with N < 5 masks granular analytics', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs201LowResponseOfferingId}`,
    headers: { Authorization: `Bearer ${desaiToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.privacyThresholdMet, false);
  assert.equal(res.body.overall.responseCount, 2);
  assert.equal(res.body.overall.averageRating, null);
  assert.equal(res.body.overall.sentimentDistribution, null);
  assert.equal(res.body.performance.length, 0);
  assert.equal(res.body.topics.length, 0);
  assert.ok(res.body.message.includes('Minimum response threshold not met'));
});

test('GET /api/v1/dashboard/:id - Empty State: offering with N = 0 returns 0 responses and masked analytics', async () => {
  const res = await request(app, {
    path: `/api/v1/dashboard/${cs405ZeroResponseOfferingId}`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.privacyThresholdMet, false);
  assert.equal(res.body.overall.responseCount, 0);
  assert.equal(res.body.performance.length, 0);
  assert.equal(res.body.topics.length, 0);
});

test('GET /api/v1/dashboard/:id - Nonexistent offering returns 404', async () => {
  const fakeId = '99999999-9999-9999-9999-999999999999';
  const res = await request(app, {
    path: `/api/v1/dashboard/${fakeId}`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'RESOURCE_NOT_FOUND');
});

test('GET /api/v1/dashboard/:id - Invalid UUID returns 400', async () => {
  const res = await request(app, {
    path: '/api/v1/dashboard/not-a-valid-uuid',
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'BAD_REQUEST');
});

// -----------------------------------------------------------------------------
// 3. Evidence Comment Retrieval Tests (GET /api/v1/feedback/:courseOfferingId)
// -----------------------------------------------------------------------------
test('GET /api/v1/feedback/:id - Happy Path: retrieves paginated comments', async () => {
  const res = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}?page=1&pageSize=5`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.currentPage, 1);
  assert.equal(res.body.pagination.pageSize, 5);
  assert.ok(res.body.pagination.totalComments > 0);
  assert.ok(res.body.comments.length <= 5);

  const first = res.body.comments[0];
  assert.ok(first.commentText);
  assert.ok(first.ratings);
  assert.equal(typeof first.ratings.teachingClarity, 'number');
  assert.ok(Array.isArray(first.topics));
  // Anonymity check: month-level granularity only ("Mon YYYY"); day-precision
  // dates and per-comment retry counters must never be exposed.
  assert.match(first.submittedMonth, /^[A-Z][a-z]{2} \d{4}$/);
  assert.equal(first.submittedDate, undefined, 'Day-precision submittedDate must not be exposed');
  assert.equal(first.analysisAttempts, undefined, 'Per-comment retry counters must not be exposed');
});

test('GET /api/v1/feedback/:id - Topic Filter: filters comments by topicKey', async () => {
  const res = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}?topic=practical_examples`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.comments.length > 0);
  for (const c of res.body.comments) {
    assert.ok(c.topics.includes('practical_examples'), 'Every comment must contain the filtered topic');
  }
});

test('GET /api/v1/feedback/:id - Sentiment Filter: filters comments by sentiment', async () => {
  const res = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}?sentiment=negative`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.comments.length > 0);
  for (const c of res.body.comments) {
    assert.equal(c.sentiment, 'negative');
  }
});

test('GET /api/v1/feedback/:id - Nonexistent offering returns 404', async () => {
  const fakeId = '99999999-9999-9999-9999-999999999999';
  const res = await request(app, {
    path: `/api/v1/feedback/${fakeId}`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'RESOURCE_NOT_FOUND');
});

// -----------------------------------------------------------------------------
// 4. Cross-Endpoint Consistency Verification
// -----------------------------------------------------------------------------
test('Cross-Endpoint Consistency: POST /feedback immediately reflects in GET /feedback and GET /dashboard', async () => {
  // 1. Submit a fresh distinctive feedback
  const uniqueComment = `Distinctive consistency verification comment ${Date.now()}`;
  const submitRes = await request(app, {
    method: 'POST',
    path: '/api/v1/feedback',
    headers: { Authorization: `Bearer ${studentDiyaToken}` },
    body: {
      courseOfferingId: cs301OfferingId,
      ratings: {
        teachingClarity: 1, teachingPace: 1, doubtHandling: 1, engagement: 1, practicalExamples: 1
      },
      comment: uniqueComment,
    },
  });
  assert.equal(submitRes.status, 201);

  // 2. Fetch comments list and verify comment appears
  const commentRes = await request(app, {
    path: `/api/v1/feedback/${cs301OfferingId}?pageSize=50`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(commentRes.status, 200);
  const foundComment = commentRes.body.comments.find(c => c.commentText === uniqueComment);
  assert.ok(foundComment, 'Submitted comment must be immediately retrievable');
  assert.equal(foundComment.ratings.teachingClarity, 1);

  // 3. Fetch dashboard and verify responseCount incremented
  const dashRes = await request(app, {
    path: `/api/v1/dashboard/${cs301OfferingId}`,
    headers: { Authorization: `Bearer ${sharmaToken}` },
  });
  assert.equal(dashRes.status, 200);
  assert.ok(dashRes.body.overall.responseCount >= commentRes.body.pagination.totalComments);
});
