const { pool } = require('../../config/db');

/**
 * Seeds safe, representative development and test data into PostgreSQL.
 * Covers positive, neutral, negative feedback, multi-label topics,
 * edge cases (zero-topic comments, rating-only submissions),
 * and offerings with both ample (N >= 5) and low (N < 5) responses.
 */
async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('[SEED] Starting development database seeding...');
    await client.query('BEGIN');

    // 1. Clean existing data in reverse dependency order
    await client.query('DELETE FROM feedback_topic_mention');
    await client.query('DELETE FROM feedback_sentiment');
    await client.query('DELETE FROM feedback_submissions');
    await client.query('DELETE FROM course_offerings');
    await client.query('DELETE FROM courses');
    await client.query('DELETE FROM professors');

    // 2. Insert Professors
    // Development accounts: email: sharma@university.edu / desai@university.edu, password: SecurePassword123!
    const { rows: profs } = await client.query(`
      INSERT INTO professors (email, password_hash, full_name) VALUES
      ('sharma@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Dr. Ramesh Sharma'),
      ('desai@university.edu', '$2b$10$dKrSErIZQ8WkgfdblPQUJedi6H6q2AdOal4UOA7mivZx.WhSBrglW', 'Prof. Anita Desai')
      RETURNING id, email, full_name;
    `);
    const profSharma = profs[0].id;
    const profDesai = profs[1].id;

    // 3. Insert Courses
    const { rows: courses } = await client.query(`
      INSERT INTO courses (code, title, description) VALUES
      ('CS301', 'Database Management Systems', 'Relational models, SQL, indexing, and transaction management.'),
      ('CS201', 'Data Structures & Algorithms', 'Trees, graphs, asymptotic analysis, and dynamic programming.'),
      ('CS405', 'Machine Learning Foundations', 'Statistical learning, classification, regression, and neural networks.')
      RETURNING id, code, title;
    `);
    const cs301 = courses[0].id;
    const cs201 = courses[1].id;
    const cs405 = courses[2].id;

    // 4. Insert Course Offerings
    const { rows: offerings } = await client.query(`
      INSERT INTO course_offerings (course_id, professor_id, term, is_active) VALUES
      ($1, $2, 'Fall 2026', TRUE),   -- CS301 Sharma (Has 12 submissions: N >= 5)
      ($1, $2, 'Spring 2026', FALSE), -- CS301 Sharma (Past offering)
      ($3, $4, 'Fall 2026', TRUE),   -- CS201 Desai (Has 2 submissions: N < 5 Privacy Edge Case)
      ($5, $2, 'Fall 2026', TRUE)    -- CS405 Sharma (Has 0 submissions: Empty state)
      RETURNING id, term;
    `, [cs301, profSharma, cs201, profDesai, cs405]);

    const cs301FallOffering = offerings[0].id;
    const cs201FallOffering = offerings[2].id;

    // 5. Insert Submissions for CS301 Fall (N = 12, diverse feedback)
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
        cs301FallOffering, item.clarity, item.pace, item.doubt,
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

    // 6. Insert Submissions for CS201 Fall (N = 2, triggers Privacy Guard N < 5)
    await client.query(`
      INSERT INTO feedback_submissions (
        offering_id, rating_clarity, rating_pace, rating_doubt_handling,
        rating_engagement, rating_practical_examples, comment_text, analysis_status
      ) VALUES
      ($1, 4, 3, 5, 4, 3, 'Good algorithms course so far.', 'completed'),
      ($1, 5, 4, 4, 5, 4, 'Really enjoy the recursion lectures.', 'completed');
    `, [cs201FallOffering]);

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
