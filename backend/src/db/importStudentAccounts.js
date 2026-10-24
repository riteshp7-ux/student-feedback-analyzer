/*
 * Imports a sanitized registrar roster into student accounts.
 * Expected JSON: [{ studentId, email, fullName, departmentCode }].
 * The caller supplies an output path for a temporary credential manifest; do not
 * commit, log, or distribute that manifest except through an approved channel.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const RETAINED_DEPARTMENTS = new Set(['CSE', 'IT', 'DS']);
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

function readArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--input') {
      values.input = args[index + 1];
      index += 1;
    } else if (args[index] === '--credential-manifest') {
      values.credentialManifest = args[index + 1];
      index += 1;
    } else if (args[index] === '--reset-passwords') {
      values.resetPasswords = true;
    }
  }
  if (!values.input || !values.credentialManifest) {
    throw new Error('Usage: node src/db/importStudentAccounts.js --input <sanitized-roster.json> --credential-manifest <private-manifest.json> [--reset-passwords]');
  }
  return values;
}

function makeTemporaryPassword(length = 16) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('');
}

function validateRoster(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Roster must contain at least one student.');
  const seenIds = new Set();
  const seenEmails = new Set();
  return rows.map((row, index) => {
    const studentId = String(row.studentId || '').trim().toUpperCase();
    const email = String(row.email || '').trim().toLowerCase();
    const fullName = String(row.fullName || '').trim().replace(/\s+/g, ' ');
    const departmentCode = String(row.departmentCode || '').trim().toUpperCase();
    if (!studentId || !email || !fullName || !RETAINED_DEPARTMENTS.has(departmentCode)) {
      throw new Error(`Roster row ${index + 1} is missing a required account field or has an unsupported department.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Roster row ${index + 1} has an invalid email address.`);
    if (seenIds.has(studentId) || seenEmails.has(email)) throw new Error(`Roster contains a duplicate student ID or email at row ${index + 1}.`);
    seenIds.add(studentId);
    seenEmails.add(email);
    return { studentId, email, fullName, departmentCode };
  });
}

async function importStudentAccounts(options) {
  const inputPath = path.resolve(options.input);
  const manifestPath = path.resolve(options.credentialManifest);
  if (inputPath === manifestPath) throw new Error('Roster input and credential manifest must be different files.');
  if (fs.existsSync(manifestPath)) throw new Error('Credential manifest already exists; choose a new path to prevent accidental replacement.');
  const rows = validateRoster(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const { rows: departments } = await client.query(
      'SELECT id, code FROM departments WHERE code = ANY($1::text[]) AND is_active = TRUE',
      [[...RETAINED_DEPARTMENTS]]
    );
    const departmentIds = new Map(departments.map((department) => [department.code, department.id]));
    if (departmentIds.size !== RETAINED_DEPARTMENTS.size) throw new Error('Required CSE, IT, and DS departments are missing. Apply migrations first.');

    const credentials = [];
    for (const row of rows) {
      const existing = await client.query(
        'SELECT id, email, student_id_number FROM students WHERE student_id_number = $1 OR email = $2 FOR UPDATE',
        [row.studentId, row.email]
      );
      if (existing.rowCount) {
        const student = existing.rows[0];
        if (student.student_id_number !== row.studentId || student.email !== row.email) {
          throw new Error(`Student ID or email conflict for ${row.studentId}. Resolve it before importing.`);
        }
        if (options.resetPasswords) {
          const password = makeTemporaryPassword();
          const passwordHash = await bcrypt.hash(password, 12);
          await client.query(
            'UPDATE students SET full_name = $1, department_id = $2, password_hash = $3 WHERE id = $4',
            [row.fullName, departmentIds.get(row.departmentCode), passwordHash, student.id]
          );
          credentials.push({
            studentId: row.studentId,
            email: row.email,
            fullName: row.fullName,
            departmentCode: row.departmentCode,
            temporaryPassword: password,
          });
        } else {
          await client.query(
            'UPDATE students SET full_name = $1, department_id = $2 WHERE id = $3',
            [row.fullName, departmentIds.get(row.departmentCode), student.id]
          );
        }
        continue;
      }

      const password = makeTemporaryPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO students (email, password_hash, student_id_number, full_name, department_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.email, passwordHash, row.studentId, row.fullName, departmentIds.get(row.departmentCode)]
      );
      credentials.push({
        studentId: row.studentId,
        email: row.email,
        fullName: row.fullName,
        departmentCode: row.departmentCode,
        temporaryPassword: password,
      });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(credentials, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await client.query('COMMIT');
    committed = true;
    return { imported: credentials.length, existing: rows.length - credentials.length, credentials };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (!committed && fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  }
}

if (require.main === module) {
  try {
    const options = readArgs(process.argv.slice(2));
    importStudentAccounts(options)
      .then(async ({ imported, existing }) => {
        console.log(`Student account import complete: ${imported} created, ${existing} updated.`);
        await pool.end();
      })
      .catch(async (error) => {
        console.error(`[STUDENT IMPORT ERROR] ${error.message}`);
        await pool.end();
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(`[STUDENT IMPORT ERROR] ${error.message}`);
    pool.end().finally(() => { process.exitCode = 1; });
  }
}

module.exports = { importStudentAccounts, makeTemporaryPassword, validateRoster };
