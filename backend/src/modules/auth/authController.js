const { z } = require('zod');
const { authenticateProfessor } = require('./authService');
const { findProfessorById } = require('./authRepository');

const loginSchema = z.object({
  email: z.string().email('A valid email address is required.').trim(),
  password: z.string().min(1, 'Password is required.'),
}).strict({ message: 'Unrecognized properties in login payload.' });

/**
 * Controller: Handles POST /api/v1/auth/login
 */
async function handleLogin(req, res, next) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid login request payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { email, password } = parseResult.data;
    const result = await authenticateProfessor(email, password);

    return res.status(200).json(result);
  } catch (err) {
    if (err.name === 'AuthenticationError') {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }
    next(err);
  }
}

/**
 * Controller: Handles GET /api/v1/auth/me (returns authenticated professor identity)
 */
async function handleGetMe(req, res, next) {
  try {
    const professor = await findProfessorById(req.user.professorId);
    if (!professor) {
      return res.status(404).json({
        error: {
          code: 'PROFESSOR_NOT_FOUND',
          message: 'Professor profile not found.',
        },
      });
    }

    return res.status(200).json({
      professor: {
        id: professor.id,
        email: professor.email,
        fullName: professor.full_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleLogin,
  handleGetMe,
};
