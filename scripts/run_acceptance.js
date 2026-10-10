const assert = require('node:assert/strict');
const { pool } = require('../backend/src/config/db');
const { processPendingBatch } = require('../backend/src/modules/nlp/analysisService');

const BACKEND_BASE = 'http://localhost:5000';
const NLP_BASE = 'http://127.0.0.1:8000';

async function runAcceptance() {
  console.log('='.repeat(75));
  console.log('STAGE 22: LOCALHOST FINAL ACCEPTANCE & PRODUCTION-LIKE VERIFICATION');
  console.log('='.repeat(75));

  // ---------------------------------------------------------------------------
  // STEP 1: Verify Health Probes on Live Running Services
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 1] Probing Live Health Endpoints...');

  const nlpHealth = await fetch(`${NLP_BASE}/health`).then(r => r.json());
  assert.equal(nlpHealth.status, 'healthy');
  assert.equal(nlpHealth.model_status, 'ready');
  console.log('  ✔ Python NLP Microservice (/health): HEALTHY (model ready)');

  const nlpReady = await fetch(`${NLP_BASE}/ready`).then(r => r.json());
  assert.equal(nlpReady.ready, true);
  console.log('  ✔ Python NLP Microservice (/ready): READY (artifacts loaded)');

  const backendLive = await fetch(`${BACKEND_BASE}/health/live`).then(r => r.json());
  assert.equal(backendLive.status, 'alive');
  console.log('  ✔ Express Backend (/health/live): ALIVE');

  const backendReady = await fetch(`${BACKEND_BASE}/health/ready`).then(r => r.json());
  assert.equal(backendReady.status, 'ready');
  assert.equal(backendReady.services.database, 'connected');
  console.log('  ✔ Express Backend (/health/ready): READY (PostgreSQL connected)');

  const apiGateway = await fetch(`${BACKEND_BASE}/api/v1/health`).then(r => r.json());
  assert.equal(apiGateway.status, 'ok');
  console.log('  ✔ API Gateway (/api/v1/health): OPERATIONAL');

  // ---------------------------------------------------------------------------
  // STEP 2: Public Course Offerings Discovery
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 2] Discovering Public Course Offerings...');
  const offeringsRes = await fetch(`${BACKEND_BASE}/api/v1/course-offerings`);
  assert.equal(offeringsRes.status, 200);
  const offerings = await offeringsRes.json();
  assert.ok(Array.isArray(offerings) && offerings.length >= 3);

  const cs301 = offerings.find(o => o.courseCode === 'CS301');
  const cs201 = offerings.find(o => o.courseCode === 'CS201');
  const cs405 = offerings.find(o => o.courseCode === 'CS405');

  assert.ok(cs301, 'CS301 must exist');
  assert.ok(cs201, 'CS201 must exist');
  assert.ok(cs405, 'CS405 must exist');
  console.log(`  ✔ Discovered ${offerings.length} course offerings: CS301 (Sharma), CS201 (Desai), CS405 (Sharma)`);

  // ---------------------------------------------------------------------------
  // STEP 3: Student Flow — Synthetic Submission & Real Live NLP Processing
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 3] Executing Student Submission Flow...');
  const syntheticComment = 'The concepts are explained clearly, but more practical examples would help.';
  const submitRes = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      ratings: {
        teachingClarity: 5,
        teachingPace: 4,
        doubtHandling: 5,
        engagement: 4,
        practicalExamples: 3,
      },
      comment: syntheticComment,
    }),
  });

  assert.equal(submitRes.status, 201);
  const submitBody = await submitRes.json();
  assert.equal(submitBody.success, true);
  assert.equal(submitBody.id, undefined, 'Must not leak internal submission UUID');
  console.log('  ✔ Feedback submitted successfully (HTTP 201 Created)');

  // Await asynchronous processing via the real running NLP microservice
  console.log('  ... Waiting for live Python NLP service inference ...');
  await new Promise(r => setTimeout(r, 600));

  // Inspect database directly
  const { rows: subRows } = await pool.query(
    'SELECT id, analysis_status, comment_text FROM feedback_submissions WHERE comment_text = $1;',
    [syntheticComment]
  );
  assert.equal(subRows.length, 1);
  const liveSub = subRows[0];
  assert.equal(liveSub.analysis_status, 'completed', 'Analysis status must transition to completed');
  console.log(`  ✔ Database persistence verified: submissionId=${liveSub.id}, status=completed`);

  // Verify sentiment in PostgreSQL
  const { rows: sentRows } = await pool.query(
    'SELECT label, score FROM feedback_sentiment WHERE submission_id = $1;',
    [liveSub.id]
  );
  assert.equal(sentRows.length, 1);
  console.log(`  ✔ NLP Sentiment persisted: label=${sentRows[0].label}, score=${sentRows[0].score}`);

  // Verify topics in PostgreSQL
  const { rows: topicRows } = await pool.query(
    'SELECT topic_key, confidence FROM feedback_topic_mention WHERE submission_id = $1 ORDER BY topic_key;',
    [liveSub.id]
  );
  assert.ok(topicRows.length > 0, 'Topics must be populated by model');
  const detectedKeys = topicRows.map(t => `${t.topic_key} (${t.confidence.toFixed(2)})`).join(', ');
  console.log(`  ✔ NLP Topics persisted: [${detectedKeys}]`);

  // ---------------------------------------------------------------------------
  // STEP 4: Input Validation & Boundary Defense
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 4] Verifying Validation Defenses...');
  // 1. Missing ratings
  const badRatingsRes = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseOfferingId: cs301.id, ratings: { teachingClarity: 5 } }),
  });
  assert.equal(badRatingsRes.status, 422);
  console.log('  ✔ Missing rating dimensions rejected (HTTP 422)');

  // 2. Rating out of bounds (6)
  const oobRatingRes = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      ratings: { teachingClarity: 6, teachingPace: 4, doubtHandling: 5, engagement: 4, practicalExamples: 3 },
    }),
  });
  assert.equal(oobRatingRes.status, 422);
  console.log('  ✔ Rating > 5 rejected (HTTP 422)');

  // 3. Oversized comment (>2000 chars)
  const oversizedRes = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      ratings: { teachingClarity: 5, teachingPace: 4, doubtHandling: 5, engagement: 4, practicalExamples: 3 },
      comment: 'X'.repeat(2001),
    }),
  });
  assert.equal(oversizedRes.status, 422);
  console.log('  ✔ Comment > 2000 characters rejected (HTTP 422)');

  // 4. Student identity injection
  const piiRes = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      studentId: 'STU12345',
      ratings: { teachingClarity: 5, teachingPace: 4, doubtHandling: 5, engagement: 4, practicalExamples: 3 },
    }),
  });
  assert.equal(piiRes.status, 422);
  console.log('  ✔ Student ID injection rejected (HTTP 422)');

  // ---------------------------------------------------------------------------
  // STEP 5: Professor Authentication & Session Token
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 5] Testing Professor Authentication...');
  // Invalid login
  const badLogin = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sharma@university.edu', password: 'WrongPassword!' }),
  });
  assert.equal(badLogin.status, 401);
  console.log('  ✔ Invalid credentials rejected with 401 INVALID_CREDENTIALS');

  // Valid login (Dr. Sharma)
  const goodLogin = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sharma@university.edu', password: 'SecurePassword123!' }),
  });
  assert.equal(goodLogin.status, 200);
  const sharmaAuth = await goodLogin.json();
  assert.ok(sharmaAuth.token);
  assert.equal(sharmaAuth.professor.email, 'sharma@university.edu');
  assert.equal(sharmaAuth.professor.password_hash, undefined);
  console.log('  ✔ Valid authentication returns JWT and profile without password hash');

  // Verify session endpoint
  const meRes = await fetch(`${BACKEND_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  });
  assert.equal(meRes.status, 200);
  const meBody = await meRes.json();
  assert.equal(meBody.professor.fullName, 'Dr. Ramesh Sharma');
  console.log('  ✔ GET /auth/me returns authenticated professor session profile');

  // Scoped offerings
  const sharmaOfferingsRes = await fetch(`${BACKEND_BASE}/api/v1/professor/offerings`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  });
  assert.equal(sharmaOfferingsRes.status, 200);
  const sharmaOfferings = await sharmaOfferingsRes.json();
  const sharmaCodes = sharmaOfferings.map(o => o.courseCode);
  assert.ok(sharmaCodes.includes('CS301'));
  assert.ok(sharmaCodes.includes('CS405'));
  assert.ok(!sharmaCodes.includes('CS201'), 'Must not include courses taught by other professors');
  console.log(`  ✔ Professor offerings scoped strictly to instructor: [${sharmaCodes.join(', ')}]`);

  // ---------------------------------------------------------------------------
  // STEP 6: Multi-Level Dashboard Analytics & Data Reconciliation
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 6] Reconciling Dashboard Analytics with PostgreSQL Ground Truth...');
  const dashRes = await fetch(`${BACKEND_BASE}/api/v1/dashboard/${cs301.id}`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  });
  assert.equal(dashRes.status, 200);
  const dash = await dashRes.json();

  assert.equal(dash.courseOffering.courseCode, 'CS301');
  assert.equal(dash.privacyThresholdMet, true);

  // Database comparison
  const { rows: dbCounts } = await pool.query(
    'SELECT COUNT(*)::int as count FROM feedback_submissions WHERE offering_id = $1;',
    [cs301.id]
  );
  assert.equal(dash.overall.responseCount, dbCounts[0].count);
  console.log(`  ✔ Level 1 Overview: responseCount=${dash.overall.responseCount} exactly matches PostgreSQL count`);

  const { rows: dbAvg } = await pool.query(`
    SELECT 
      ROUND(AVG(rating_clarity)::numeric, 2)::float as clarity,
      ROUND(AVG(rating_pace)::numeric, 2)::float as pace,
      ROUND(AVG(rating_doubt_handling)::numeric, 2)::float as doubt,
      ROUND(AVG(rating_engagement)::numeric, 2)::float as engage,
      ROUND(AVG(rating_practical_examples)::numeric, 2)::float as examples
    FROM feedback_submissions WHERE offering_id = $1;
  `, [cs301.id]);

  const perfMap = {};
  for (const p of dash.performance) {
    perfMap[p.dimensionKey] = p.averageScore;
  }
  assert.equal(perfMap.teachingClarity, dbAvg[0].clarity);
  assert.equal(perfMap.teachingPace, dbAvg[0].pace);
  assert.equal(perfMap.doubtHandling, dbAvg[0].doubt);
  assert.equal(perfMap.engagement, dbAvg[0].engage);
  assert.equal(perfMap.practicalExamples, dbAvg[0].examples);
  console.log('  ✔ Level 2 Performance: all 5 dimension averages match exact database computations');

  assert.ok(dash.topics.length > 0);
  console.log(`  ✔ Level 3 Topics: ${dash.topics.length} aggregated topics with dominant sentiment breakdown`);

  // Level 4 Evidence Comments
  const evidenceRes = await fetch(`${BACKEND_BASE}/api/v1/feedback/${cs301.id}`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  });
  assert.equal(evidenceRes.status, 200);
  const evidence = await evidenceRes.json();
  assert.ok(evidence.comments.length > 0);
  for (const c of evidence.comments) {
    assert.match(c.submittedDate, /^\d{4}-\d{2}-\d{2}$/, 'Date must be coarse YYYY-MM-DD');
  }
  console.log(`  ✔ Level 4 Evidence: ${evidence.comments.length} comments retrieved with coarse date truncation`);

  // ---------------------------------------------------------------------------
  // STEP 7: Cross-Professor Authorization Barriers
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 7] Verifying Cross-Professor Authorization Barriers...');
  // Login as Prof. Desai
  const desaiLogin = await fetch(`${BACKEND_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'desai@university.edu', password: 'SecurePassword123!' }),
  }).then(r => r.json());

  // Desai attempts to view Sharma's CS301 dashboard
  const unauthDash = await fetch(`${BACKEND_BASE}/api/v1/dashboard/${cs301.id}`, {
    headers: { Authorization: `Bearer ${desaiLogin.token}` },
  });
  assert.equal(unauthDash.status, 403);
  console.log('  ✔ Prof Desai blocked from CS301 dashboard (HTTP 403 FORBIDDEN)');

  // Desai attempts to view Sharma's CS301 comments
  const unauthComments = await fetch(`${BACKEND_BASE}/api/v1/feedback/${cs301.id}`, {
    headers: { Authorization: `Bearer ${desaiLogin.token}` },
  });
  assert.equal(unauthComments.status, 403);
  console.log('  ✔ Prof Desai blocked from CS301 feedback comments (HTTP 403 FORBIDDEN)');

  // Unauthenticated caller
  const anonDash = await fetch(`${BACKEND_BASE}/api/v1/dashboard/${cs301.id}`);
  assert.equal(anonDash.status, 401);
  console.log('  ✔ Unauthenticated access rejected (HTTP 401 UNAUTHORIZED)');

  // ---------------------------------------------------------------------------
  // STEP 8: Small Data Threshold & Empty States
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 8] Testing Small Data Privacy Guard & Empty States...');
  // CS201 has 2 responses (< 5). Desai accesses own course.
  const lowDataDash = await fetch(`${BACKEND_BASE}/api/v1/dashboard/${cs201.id}`, {
    headers: { Authorization: `Bearer ${desaiLogin.token}` },
  }).then(r => r.json());

  assert.equal(lowDataDash.privacyThresholdMet, false);
  assert.equal(lowDataDash.overall.responseCount, 2);
  assert.deepEqual(lowDataDash.performance, []);
  assert.deepEqual(lowDataDash.topics, []);
  console.log('  ✔ Small cohort (CS201, N=2 < 5): privacyThresholdMet=false, ratings & topics masked to []');

  // CS405 has 0 responses. Sharma accesses own course.
  const zeroDataDash = await fetch(`${BACKEND_BASE}/api/v1/dashboard/${cs405.id}`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  }).then(r => r.json());

  assert.equal(zeroDataDash.privacyThresholdMet, false);
  assert.equal(zeroDataDash.overall.responseCount, 0);
  console.log('  ✔ Empty course (CS405, N=0): responseCount=0 handled safely without error');

  // ---------------------------------------------------------------------------
  // STEP 9: Security Checks (XSS & SQL Injection)
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 9] Testing XSS and SQL Injection Resilience...');
  const xssString = '<script>alert("XSS")</script><b onmouseover=alert(1)>bold</b>';
  const xssSubmit = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      ratings: { teachingClarity: 4, teachingPace: 4, doubtHandling: 4, engagement: 4, practicalExamples: 4 },
      comment: xssString,
    }),
  });
  assert.equal(xssSubmit.status, 201);

  // Retrieve comments and verify literal storage
  const commentsAfterXss = await fetch(`${BACKEND_BASE}/api/v1/feedback/${cs301.id}`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  }).then(r => r.json());
  const foundXss = commentsAfterXss.comments.find(c => c.commentText === xssString);
  assert.ok(foundXss, 'XSS string must be stored literally as harmless text');
  console.log('  ✔ XSS payload stored literally as harmless text string');

  // SQL injection attempt in topic parameter
  const sqliRes = await fetch(`${BACKEND_BASE}/api/v1/feedback/${cs301.id}?topic=teaching_clarity' OR '1'='1`, {
    headers: { Authorization: `Bearer ${sharmaAuth.token}` },
  });
  assert.equal(sqliRes.status, 422);
  console.log('  ✔ SQL injection payload rejected by enum allowlist (HTTP 422 VALIDATION_ERROR)');

  // ---------------------------------------------------------------------------
  // STEP 10: Multi-Label Topic Synthesis
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 10] Testing Multi-Label Topic Synthesis...');
  const multiTopicText = 'The explanations were very clear, but pacing felt too fast and assignments were difficult.';
  const multiSubmit = await fetch(`${BACKEND_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseOfferingId: cs301.id,
      ratings: { teachingClarity: 4, teachingPace: 2, doubtHandling: 3, engagement: 4, practicalExamples: 3 },
      comment: multiTopicText,
    }),
  });
  assert.equal(multiSubmit.status, 201);
  await new Promise(r => setTimeout(r, 600));

  const { rows: multiRows } = await pool.query(
    'SELECT id FROM feedback_submissions WHERE comment_text = $1;',
    [multiTopicText]
  );
  assert.equal(multiRows.length, 1);
  const { rows: multiTopics } = await pool.query(
    'SELECT topic_key FROM feedback_topic_mention WHERE submission_id = $1;',
    [multiRows[0].id]
  );
  assert.ok(multiTopics.length >= 2, 'Comment must receive multiple topic tags');
  const multiLabels = multiTopics.map(t => t.topic_key).join(', ');
  console.log(`  ✔ Multi-label synthesis verified: comment tagged with ${multiTopics.length} distinct topics: [${multiLabels}]`);

  // ---------------------------------------------------------------------------
  // STEP 11: NLP Recovery Sweeper Test
  // ---------------------------------------------------------------------------
  console.log('\n[CHECK 11] Verifying Background Recovery Sweeper...');
  const sweepResult = await processPendingBatch(10);
  console.log(`  ✔ Recovery sweeper executed: total checked=${sweepResult.total}, succeeded=${sweepResult.succeeded}, failed=${sweepResult.failed}`);

  console.log('\n' + '='.repeat(75));
  console.log('ALL LOCAL ACCEPTANCE CHECKS PASSED (100% SUCCESS)');
  console.log('='.repeat(75));

  await pool.end();
}

runAcceptance().catch(err => {
  console.error('\n❌ ACCEPTANCE FAILED:', err);
  process.exit(1);
});
