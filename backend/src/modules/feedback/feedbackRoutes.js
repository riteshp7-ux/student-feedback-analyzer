const express = require('express');
const { handleFeedbackSubmission } = require('./feedbackController');
const { handleGetOfferingFeedback } = require('./commentController');
const { authenticateToken } = require('../auth/authMiddleware');
const { requireOfferingOwnership } = require('../auth/authorizationMiddleware');
const { authenticateStudent } = require('../students/studentAuthMiddleware');
const { feedbackLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// POST /api/v1/feedback - Authenticated student feedback submission (Student Auth, Rate limited)
router.post('/feedback', feedbackLimiter, authenticateStudent, handleFeedbackSubmission);

// GET /api/v1/feedback/:courseOfferingId - Paginated anonymous comment retrieval (Protected, professor only)
// Requires valid professor authentication AND ownership of the offering
router.get(
  '/feedback/:courseOfferingId',
  authenticateToken,
  requireOfferingOwnership('courseOfferingId'),
  handleGetOfferingFeedback
);

module.exports = router;
