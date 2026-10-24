const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { findProfessorById } = require('./authRepository');

/**
 * Middleware: Verifies Bearer JWT token and resolves professor identity.
 * Attaches req.user = { professorId, email, fullName } on success.
 */
async function authenticateToken(req, res, next) {
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
    if (!decoded.professorId || decoded.role === 'student') {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token payload does not contain required professor credentials.',
        },
      });
    }

    // Verify professor exists in database
    const professor = await findProfessorById(decoded.professorId);
    if (!professor) {
      return res.status(401).json({
        error: {
          code: 'PROFESSOR_NOT_FOUND',
          message: 'The professor associated with this token no longer exists.',
        },
      });
    }

    req.user = {
      professorId: professor.id,
      email: professor.email,
      fullName: professor.full_name,
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
  authenticateToken,
};
