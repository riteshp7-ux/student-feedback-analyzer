const test = require('node:test');
const assert = require('node:assert/strict');
const { pool, query, closePool } = require('../src/config/db');

test.before(async () => {
  // Ensure tables and seed data are ready
  const { runMigrations } = require('../src/db/migrate');
  const { seedDatabase } = require('../src/db/seeds/seed');
  await runMigrations();
  await seedDatabase();
});

test.after(async () => {
  await closePool();
});

test('Database Integrity: enforces ratings CHECK constraint (1 to 5)', async () => {
  const { rows } = await query('SELECT id FROM course_offerings LIMIT 1');
  const offeringId = rows[0].id;

  // Invalid rating = 6 (Must fail)
  await assert.rejects(
    query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples, comment_text
      ) VALUES ($1, 6, 4, 5, 4, 3, 'Invalid rating test')
    `, [offeringId]),
    (err) => {
      assert.ok(err.message.includes('check constraint') || err.code === '23514');
      return true;
    }
  );

  // Invalid rating = 0 (Must fail)
  await assert.rejects(
    query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples, comment_text
      ) VALUES ($1, 4, 0, 5, 4, 3, 'Zero rating test')
    `, [offeringId]),
    (err) => {
      assert.ok(err.message.includes('check constraint') || err.code === '23514');
      return true;
    }
  );
});

test('Database Integrity: enforces analysis_status allowed enum values', async () => {
  const { rows } = await query('SELECT id FROM course_offerings LIMIT 1');
  const offeringId = rows[0].id;

  await assert.rejects(
    query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples, analysis_status
      ) VALUES ($1, 4, 4, 4, 4, 4, 'invalid_status_enum')
    `, [offeringId]),
    (err) => {
      assert.ok(err.code === '23514');
      return true;
    }
  );
});

test('Database Integrity: foreign key constraint blocks orphaned feedback', async () => {
  const invalidOfferingId = '00000000-0000-0000-0000-000000000000';

  await assert.rejects(
    query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples
      ) VALUES ($1, 4, 4, 4, 4, 4)
    `, [invalidOfferingId]),
    (err) => {
      assert.ok(err.code === '23503'); // foreign_key_violation
      return true;
    }
  );
});

test('Database Integrity: cascade delete removes child sentiment and topics', async () => {
  const { rows } = await query(`
    SELECT s.id 
    FROM feedback_submissions s
    JOIN feedback_sentiment sent ON sent.submission_id = s.id
    LIMIT 1
  `);
  const targetSubId = rows[0].id;

  // Delete submission
  await query('DELETE FROM feedback_submissions WHERE id = $1', [targetSubId]);

  // Sentiment should be automatically deleted
  const { rows: sentRows } = await query('SELECT * FROM feedback_sentiment WHERE submission_id = $1', [targetSubId]);
  assert.equal(sentRows.length, 0);

  // Topics should be automatically deleted
  const { rows: topRows } = await query('SELECT * FROM feedback_topic_mention WHERE submission_id = $1', [targetSubId]);
  assert.equal(topRows.length, 0);
});

test('Query Verification 1: Course offering feedback and response counts', async () => {
  const { rows: offeringRows } = await query(`
    SELECT o.id, c.code, c.title, o.term, COUNT(s.id)::int AS total_responses
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    LEFT JOIN feedback_submissions s ON s.offering_id = o.id
    WHERE c.code = 'CS301' AND o.term = 'Semester 1 2026-27'
    GROUP BY o.id, c.code, c.title, o.term
  `);

  assert.equal(offeringRows.length, 1);
  assert.equal(offeringRows[0].code, 'CS301');
  assert.equal(offeringRows[0].term, 'Semester 1 2026-27');
  // Initial seed has 12 submissions (1 was deleted in cascade test above, so 11 remain)
  assert.ok(offeringRows[0].total_responses >= 11);
});

test('Query Verification 2: Structured dimensional average ratings (Level 2)', async () => {
  const { rows } = await query(`
    SELECT 
      ROUND(AVG(rating_clarity)::numeric, 2) AS avg_clarity,
      ROUND(AVG(rating_pace)::numeric, 2) AS avg_pace,
      ROUND(AVG(rating_doubt_handling)::numeric, 2) AS avg_doubt,
      ROUND(AVG(rating_engagement)::numeric, 2) AS avg_engagement,
      ROUND(AVG(rating_practical_examples)::numeric, 2) AS avg_examples,
      ROUND(AVG((rating_clarity + rating_pace + rating_doubt_handling + rating_engagement + rating_practical_examples) / 5.0)::numeric, 2) AS overall_avg
    FROM feedback_submissions s
    JOIN course_offerings o ON o.id = s.offering_id
    JOIN courses c ON c.id = o.course_id
    WHERE c.code = 'CS301' AND o.term = 'Semester 1 2026-27'
  `);

  assert.equal(rows.length, 1);
  assert.ok(Number(rows[0].avg_clarity) >= 1 && Number(rows[0].avg_clarity) <= 5);
  assert.ok(Number(rows[0].overall_avg) >= 1 && Number(rows[0].overall_avg) <= 5);
});

test('Query Verification 3: Sentiment distribution breakdown (Level 1)', async () => {
  const { rows } = await query(`
    SELECT 
      COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS positive_count,
      COUNT(CASE WHEN sent.label = 'neutral' THEN 1 END)::int AS neutral_count,
      COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS negative_count
    FROM feedback_sentiment sent
    JOIN feedback_submissions s ON s.id = sent.submission_id
    JOIN course_offerings o ON o.id = s.offering_id
    JOIN courses c ON c.id = o.course_id
    WHERE c.code = 'CS301' AND o.term = 'Semester 1 2026-27'
  `);

  assert.equal(rows.length, 1);
  assert.ok(rows[0].positive_count > 0);
  assert.ok(rows[0].negative_count > 0);
});

test('Query Verification 4: Topic frequency and topic sentiment breakdown (Level 3)', async () => {
  const { rows } = await query(`
    SELECT 
      t.topic_key,
      COUNT(t.id)::int AS mention_count,
      COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS pos_count,
      COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS neg_count
    FROM feedback_topic_mention t
    JOIN feedback_submissions s ON s.id = t.submission_id
    LEFT JOIN feedback_sentiment sent ON sent.submission_id = s.id
    JOIN course_offerings o ON o.id = s.offering_id
    JOIN courses c ON c.id = o.course_id
    WHERE c.code = 'CS301' AND o.term = 'Semester 1 2026-27'
    GROUP BY t.topic_key
    ORDER BY mention_count DESC
  `);

  assert.ok(rows.length > 0);
  const practicalExamples = rows.find(r => r.topic_key === 'practical_examples');
  assert.ok(practicalExamples, 'practical_examples topic must be present');
  assert.ok(practicalExamples.mention_count > 0);
  assert.ok(practicalExamples.neg_count > 0, 'practical_examples should have negative mentions in seed');
});

test('Query Verification 5: Representative evidence comment retrieval (Level 4)', async () => {
  const { rows } = await query(`
    SELECT 
      s.id,
      s.comment_text,
      sent.label AS sentiment,
      ARRAY_AGG(t.topic_key) AS topics,
      TO_CHAR(s.created_at, 'YYYY-MM-DD') AS submitted_date
    FROM feedback_submissions s
    JOIN course_offerings o ON o.id = s.offering_id
    JOIN courses c ON c.id = o.course_id
    LEFT JOIN feedback_sentiment sent ON sent.submission_id = s.id
    LEFT JOIN feedback_topic_mention t ON t.submission_id = s.id
    WHERE c.code = 'CS301' AND o.term = 'Semester 1 2026-27' AND s.comment_text IS NOT NULL
    GROUP BY s.id, s.comment_text, sent.label, s.created_at
    ORDER BY s.created_at DESC
    LIMIT 5
  `);

  assert.ok(rows.length > 0);
  assert.ok(rows[0].comment_text);
  assert.ok(rows[0].submitted_date);
  // Verify date is coarse YYYY-MM-DD, protecting minute-level correlation
  assert.match(rows[0].submitted_date, /^\d{4}-\d{2}-\d{2}$/);
});
