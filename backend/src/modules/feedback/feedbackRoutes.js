const express = require('express');
const { handleFeedbackSubmission } = require('./feedbackController');
const { handleGetOfferingFeedback } = require('./commentController');
const { authenticateToken } = require('../auth/authMiddleware');
const { requireOfferingOwnership } = require('../auth/authorizationMiddleware');
const { feedbackLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// POST /api/v1/feedback - Anonymous student feedback submission (Public, Rate limited)
router.post('/feedback', feedbackLimiter, handleFeedbackSubmission);

// GET /api/v1/feedback/:courseOfferingId - Paginated anonymous comment retrieval (Protected, professor only)
// Requires valid professor authentication AND ownership of the offering
router.get(
  '/feedback/:courseOfferingId',
  authenticateToken,
  requireOfferingOwnership('courseOfferingId'),
  handleGetOfferingFeedback
);

module.exports = router;
