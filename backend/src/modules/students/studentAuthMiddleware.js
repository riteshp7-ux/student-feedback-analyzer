const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { findStudentById } = require('./studentRepository');

/**
 * Middleware: Verifies Bearer JWT token and resolves student identity.
 * Rejects tokens that do not have studentId or have a different role.
 * Attaches req.user = { studentId, email, fullName, role: 'student' } on success.
 */
async function authenticateStudent(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication credential is required. Provide a valid Bearer token.',
      },
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({
      error: {
        code: 'MALFORMED_TOKEN',
        message: 'Authorization header must adhere to Bearer token format.',
      },
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Explicit student credential check
    if (!decoded.studentId || decoded.role !== 'student') {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token payload does not contain required student credentials.',
        },
      });
    }

    const student = await findStudentById(decoded.studentId);
    if (!student) {
      return res.status(401).json({
        error: {
          code: 'STUDENT_NOT_FOUND',
          message: 'The student associated with this token no longer exists.',
        },
      });
    }

    req.user = {
      studentId: student.id,
      email: student.email,
      fullName: student.full_name,
      studentIdNumber: student.student_id_number,
      role: 'student',
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please log in again.',
        },
      });
    }

    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or corrupted authentication token.',
      },
    });
  }
}

module.exports = {
  authenticateStudent,
};
