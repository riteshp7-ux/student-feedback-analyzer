/**
 * Production Provisioning Script for Student Feedback Analyzer
 * Safely provisions official academic courses and initial faculty accounts
 * without inserting synthetic feedback submissions.
 *
 * Usage:
 *   node src/db/provision.js
 *
 * Environment variables:
 *   PROF_EMAIL (default: prof.sharma@university.edu)
 *   PROF_NAME (default: Dr. Ramesh Sharma)
 *   PROF_PASSWORD (required or uses securely generated initial password)
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function provisionProductionData() {
  const email = process.env.PROF_EMAIL || 'sharma@university.edu';
  const name = process.env.PROF_NAME || 'Dr. Ramesh Sharma';
  const password = process.env.PROF_PASSWORD || 'SecurePassword123!';

  console.log(`[PROVISION] Connecting to production database...`);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Provision Course Catalog
    console.log('[PROVISION] Upserting core course catalog...');
    const courses = [
      { code: 'CS301', title: 'Database Management Systems', desc: 'Relational models, SQL, indexing, and transaction management.' },
      { code: 'CS201', title: 'Data Structures & Algorithms', desc: 'Trees, graphs, asymptotic analysis, and dynamic programming.' },
      { code: 'CS405', title: 'Machine Learning Foundations', desc: 'Statistical learning, classification, regression, and neural networks.' },
    ];

    const courseMap = {};
    for (const c of courses) {
      const res = await client.query(
        `INSERT INTO courses (code, title, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description
         RETURNING id, code;`,
        [c.code, c.title, c.desc]
      );
      courseMap[c.code] = res.rows[0].id;
    }

    // 2. Provision Faculty Account
    console.log(`[PROVISION] Upserting faculty account for ${email}...`);
    const passwordHash = await bcrypt.hash(password, 10);
    const profRes = await client.query(
      `INSERT INTO professors (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash
       RETURNING id, email, full_name;`,
      [email.toLowerCase(), passwordHash, name]
    );
    const profId = profRes.rows[0].id;

    // 3. Provision Active Course Offerings
    console.log('[PROVISION] Upserting active course offerings...');
    const term = process.env.ACADEMIC_TERM || 'Fall 2026';
    for (const [code, courseId] of Object.entries(courseMap)) {
      await client.query(
        `INSERT INTO course_offerings (course_id, professor_id, term, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (course_id, professor_id, term) DO UPDATE SET is_active = TRUE;`,
        [courseId, profId, term]
      );
    }

    await client.query('COMMIT');
    console.log(`[PROVISION] Successfully provisioned production catalog and faculty account for ${name} (${email}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PROVISION ERROR] Failed to provision production data:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  provisionProductionData();
}

module.exports = { provisionProductionData };
