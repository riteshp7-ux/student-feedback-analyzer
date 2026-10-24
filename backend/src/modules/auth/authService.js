const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { findProfessorByEmail } = require('./authRepository');

/**
 * Custom authentication domain error
 */
class AuthenticationError extends Error {
  constructor(message = 'Invalid email or password.', code = 'INVALID_CREDENTIALS', status = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Authenticates a professor using email and password, issuing a signed 24h JWT.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, professor: { id: string, email: string, fullName: string } }>}
 */
async function authenticateProfessor(email, password) {
  if (!email || !password) {
    throw new AuthenticationError('Invalid email or password.');
  }

  const professor = await findProfessorByEmail(email);
  if (!professor) {
    // Uniform timing attack mitigation: perform dummy comparison if user not found
    await bcrypt.compare(password, '$2b$10$1234567890123456789012345678901234567890123456789012');
    throw new AuthenticationError('Invalid email or password.');
  }

  const isPasswordMatch = await bcrypt.compare(password, professor.password_hash);
  if (!isPasswordMatch) {
    throw new AuthenticationError('Invalid email or password.');
  }

  // Construct signed JWT payload conforming to docs/API_CONTRACT.md:
  // payload: { professorId: uuid, email: string, role: 'faculty' }
  const tokenPayload = {
    professorId: professor.id,
    email: professor.email,
    role: 'faculty',
  };

  const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: '24h',
  });

  return {
    token,
    professor: {
      id: professor.id,
      email: professor.email,
      fullName: professor.full_name,
    },
  };
}

module.exports = {
  authenticateProfessor,
  AuthenticationError,
};
