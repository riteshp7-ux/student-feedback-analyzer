const express = require('express');
const {
  loginStudentHandler,
  getStudentProfileHandler,
  getStudentOfferingsHandler,
} = require('./studentController');
const { authenticateStudent } = require('./studentAuthMiddleware');
const { authIdentityLimiter, authLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// Public: Student Login (Rate limited against brute-force attacks)
router.post('/auth/student/login', authIdentityLimiter, authLimiter, loginStudentHandler);

// Protected: Student Profile
router.get('/student/me', authenticateStudent, getStudentProfileHandler);

// Protected: Student Enrolled Offerings with submission status
router.get('/student/offerings', authenticateStudent, getStudentOfferingsHandler);

module.exports = router;
