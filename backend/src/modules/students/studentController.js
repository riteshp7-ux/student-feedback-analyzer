const {
  authenticateStudent,
  getStudentProfile,
  getStudentEnrolledOfferings,
} = require('./studentService');

/**
 * Controller: Handles Student Authentication (login).
 * Route: POST /api/v1/auth/student/login
 */
async function loginStudentHandler(req, res, next) {
  try {
    const { loginId, email, password } = req.body || {};
    const identifier = loginId || email;
    if (!identifier || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Student ID or email and password are required fields.',
        },
      });
    }

    const { token, student } = await authenticateStudent(identifier, password);

    return res.status(200).json({
      token,
      student,
    });
  } catch (err) {
    if (err.name === 'StudentDomainError') {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }
    return next(err);
  }
}

/**
 * Controller: Returns authenticated student's profile.
 * Route: GET /api/v1/student/me
 */
async function getStudentProfileHandler(req, res, next) {
  try {
    const studentProfile = await getStudentProfile(req.user.studentId);
    return res.status(200).json({
      student: studentProfile,
    });
  } catch (err) {
    if (err.name === 'StudentDomainError') {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }
    return next(err);
  }
}

/**
 * Controller: Returns enrolled offerings with submission status for authenticated student.
 * Route: GET /api/v1/student/offerings
 */
async function getStudentOfferingsHandler(req, res, next) {
  try {
    const offerings = await getStudentEnrolledOfferings(req.user.studentId);
    return res.status(200).json({
      offerings,
    });
  } catch (err) {
    if (err.name === 'StudentDomainError') {
      return res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
    }
    return next(err);
  }
}

module.exports = {
  loginStudentHandler,
  getStudentProfileHandler,
  getStudentOfferingsHandler,
};
