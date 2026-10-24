const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { query, closePool } = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { seedDatabase } = require('../src/db/seeds/seed');
const { createRateLimiter } = require('../src/middlewares/rateLimiter');

// Helper to make raw HTTP requests
async function rawRequest(handler, options = {}) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const url = `http://127.0.0.1:${port}${options.path || '/'}`;
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.rawBody !== undefined ? options.rawBody : (options.body ? JSON.stringify(options.body) : undefined),
    });

    const json = await res.json().catch(() => null);
    return { status: res.status, body: json, headers: res.headers };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test.describe('Stage 21: Security Audit & Production Hardening Pass', () => {
  let cs301OfferingId;
  let cs201OfferingId;
  let profSharma;
  let profDesai;
  let sharmaToken;
  let desaiToken;
  let studentToken;

  test.before(async () => {
    await runMigrations();
    await seedDatabase();

    const { rows: profs } = await query('SELECT id, email FROM professors ORDER BY email;');
    profDesai = profs.find(p => p.email === 'desai@university.edu');
    profSharma = profs.find(p => p.email === 'sharma@university.edu');

    const { rows: offerings } = await query(`
      SELECT o.id, c.code
      FROM course_offerings o
      JOIN courses c ON c.id = o.course_id
      WHERE o.term = 'Semester 1 2026-27';
    `);

    cs301OfferingId = offerings.find(o => o.code === 'CS301').id;
    cs201OfferingId = offerings.find(o => o.code === 'CS201').id;

    sharmaToken = jwt.sign(
      { professorId: profSharma.id, email: profSharma.email },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    desaiToken = jwt.sign(
      { professorId: profDesai.id, email: profDesai.email },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { rows: stuRows } = await query("SELECT id, email FROM students WHERE email = 'diya@student.university.edu'");
    const studentDiya = stuRows[0];
    studentToken = jwt.sign(
      { studentId: studentDiya.id, email: studentDiya.email, role: 'student' },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  });

  test.after(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    await closePool();
  });

  // ---------------------------------------------------------------------------
  // 1. HTTP Security Headers
  // ---------------------------------------------------------------------------
  test('Security Audit: Enforces defensive security headers and strips X-Powered-By', async () => {
    const res = await rawRequest(app, { path: '/api/v1/health' });
    assert.equal(res.status, 200);

    // Verify critical headers
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-xss-protection'), '0');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.ok(res.headers.get('content-security-policy'));

    // Verify information leakage prevention
    assert.equal(res.headers.get('x-powered-by'), null, 'X-Powered-By header must be removed');
  });

  // ---------------------------------------------------------------------------
  // 2. Request Size Limits (Denial of Service Prevention)
  // ---------------------------------------------------------------------------
  test('Security Audit: Rejects oversized JSON payload exceeding 100kb limit (413 Payload Too Large)', async () => {
    // Generate an oversized payload > 100KB
    const largeComment = 'A'.repeat(120 * 1024);
    const oversizedBody = JSON.stringify({
      courseOfferingId: cs301OfferingId,
      ratings: {
        teachingClarity: 5,
        teachingPace: 5,
        doubtHandling: 5,
        engagement: 5,
        practicalExamples: 5,
      },
      comment: largeComment,
    });

    const res = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      headers: { 'Content-Type': 'application/json' },
      rawBody: oversizedBody,
    });

    assert.equal(res.status, 413, 'Oversized payload must trigger HTTP 413');
  });

  // ---------------------------------------------------------------------------
  // 3. Feedback Text Boundary (2000 character limit enforcement)
  // ---------------------------------------------------------------------------
  test('Security Audit: Strictly enforces 2000 character maximum on feedback comments', async () => {
    // Exactly 2000 characters: valid
    const validComment = 'E'.repeat(2000);
    const validRes = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseOfferingId: cs301OfferingId,
        ratings: {
          teachingClarity: 4,
          teachingPace: 4,
          doubtHandling: 4,
          engagement: 4,
          practicalExamples: 4,
        },
        comment: validComment,
      },
    });
    assert.equal(validRes.status, 201);

    // 2001 characters: rejected with 422
    const invalidComment = 'E'.repeat(2001);
    const invalidRes = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        courseOfferingId: cs301OfferingId,
        ratings: {
          teachingClarity: 4,
          teachingPace: 4,
          doubtHandling: 4,
          engagement: 4,
          practicalExamples: 4,
        },
        comment: invalidComment,
      },
    });
    assert.equal(invalidRes.status, 422);
    assert.equal(invalidRes.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 4. SQL Injection Resistance & Input Allowlisting
  // ---------------------------------------------------------------------------
  test('Security Audit: Rejects SQL injection attempts in query parameters without DB errors', async () => {
    // Attempt SQL injection via topic parameter
    const res = await rawRequest(app, {
      path: `/api/v1/feedback/${cs301OfferingId}?topic=teaching_clarity' OR '1'='1`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });

    // Must be rejected by strict schema validation (not reach SQL engine)
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('Security Audit: Rejects SQL injection attempts via sentiment parameter', async () => {
    const res = await rawRequest(app, {
      path: `/api/v1/feedback/${cs301OfferingId}?sentiment=positive'--`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // 5. XSS Content Ingestion & Safe Plaintext Retention
  // ---------------------------------------------------------------------------
  test('Security Audit: Ingests HTML/script tags as harmless text without executing or corrupting', async () => {
    // Generate token for Student C (rohan@student.university.edu), who is enrolled in CS201
    const { rows: stuCRows } = await query("SELECT id, email FROM students WHERE email = 'rohan@student.university.edu'");
    const studentRohan = stuCRows[0];
    const rohanToken = jwt.sign(
      { studentId: studentRohan.id, email: studentRohan.email, role: 'student' },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

    const submitRes = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      headers: { Authorization: `Bearer ${rohanToken}` },
      body: {
        courseOfferingId: cs201OfferingId,
        ratings: {
          teachingClarity: 4,
          teachingPace: 4,
          doubtHandling: 4,
          engagement: 4,
          practicalExamples: 4,
        },
        comment: xssPayload,
      },
    });
    // Verify in database that string was stored completely verbatim and unexecuted
    const { rows: subRows } = await query(
      'SELECT comment_text FROM feedback_submissions WHERE offering_id = $1 AND comment_text = $2;',
      [cs201OfferingId, xssPayload]
    );
    assert.equal(subRows.length, 1);
    assert.equal(subRows[0].comment_text, xssPayload, 'XSS string must be preserved exactly as literal text data');
  });

  // ---------------------------------------------------------------------------
  // 6. Rate Limiting Middleware Verification
  // ---------------------------------------------------------------------------
  test('Security Audit: Rate limiter enforces maximum threshold and returns HTTP 429', async () => {
    const testLimiter = createRateLimiter({
      windowMs: 1000,
      max: 3,
      message: 'Rate limit test reached.',
      code: 'TEST_RATE_LIMIT',
      forceEnable: true,
    });

    const testApp = http.createServer((req, res) => {
      testLimiter(req, res, () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise(r => testApp.listen(0, r));
    const port = testApp.address().port;

    try {
      // Requests 1, 2, 3 should succeed
      for (let i = 0; i < 3; i++) {
        const r = await fetch(`http://127.0.0.1:${port}/test`);
        assert.equal(r.status, 200);
      }

      // Request 4 must trigger 429
      const rBlocked = await fetch(`http://127.0.0.1:${port}/test`);
      assert.equal(rBlocked.status, 429);
      const json = await rBlocked.json();
      assert.equal(json.error.code, 'TEST_RATE_LIMIT');
      assert.ok(rBlocked.headers.get('Retry-After'));
    } finally {
      await new Promise(r => testApp.close(r));
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Health Probe Boundaries (Liveness vs Readiness)
  // ---------------------------------------------------------------------------
  test('Security Audit: /health/live returns immediate 200; /health/ready probes DB connectivity', async () => {
    // 1. Liveness
    const liveRes = await rawRequest(app, { path: '/health/live' });
    assert.equal(liveRes.status, 200);
    assert.equal(liveRes.body.status, 'alive');

    // 2. Readiness
    const readyRes = await rawRequest(app, { path: '/health/ready' });
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.status, 'ready');
    assert.equal(readyRes.body.services.database, 'connected');
  });

  // ---------------------------------------------------------------------------
  // 8. Authentication Timing & User Non-Enumeration
  // ---------------------------------------------------------------------------
  test('Security Audit: Nonexistent email and wrong password yield identical 401 error', async () => {
    const resNoUser = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {
        email: 'nobody@university.edu',
        password: 'Password123!',
      },
    });
    assert.equal(resNoUser.status, 401);
    assert.equal(resNoUser.body.error.code, 'INVALID_CREDENTIALS');

    const resWrongPass = await rawRequest(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {
        email: 'sharma@university.edu',
        password: 'WrongPassword!',
      },
    });
    assert.equal(resWrongPass.status, 401);
    assert.equal(resWrongPass.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(resNoUser.body.error.message, resWrongPass.body.error.message);
  });
});
