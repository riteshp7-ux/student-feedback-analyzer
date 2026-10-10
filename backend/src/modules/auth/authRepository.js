const { pool } = require('../../config/db');

/**
 * Finds a professor record by institutional email
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findProfessorByEmail(email) {
  const { rows } = await pool.query(`
    SELECT id, email, password_hash, full_name, created_at
    FROM professors
    WHERE LOWER(email) = LOWER($1);
  `, [email]);

  return rows[0] || null;
}

/**
 * Finds a professor record by UUID primary key (safe projection without password hash)
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findProfessorById(id) {
  const { rows } = await pool.query(`
    SELECT id, email, full_name, created_at
    FROM professors
    WHERE id = $1;
  `, [id]);

  return rows[0] || null;
}

module.exports = {
  findProfessorByEmail,
  findProfessorById,
};
