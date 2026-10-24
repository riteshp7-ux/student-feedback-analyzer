const express = require('express');
const { handleGetDashboard, handleRequeueFailedAnalyses } = require('./dashboardController');
const { authenticateToken } = require('../auth/authMiddleware');
const { requireOfferingOwnership } = require('../auth/authorizationMiddleware');

const router = express.Router();

// GET /api/v1/dashboard/:courseOfferingId - Protected aggregate analytics for course offering
// Requires valid professor authentication AND ownership of the offering
router.get(
  '/dashboard/:courseOfferingId',
  authenticateToken,
  requireOfferingOwnership('courseOfferingId'),
  handleGetDashboard
);

// POST /api/v1/dashboard/:courseOfferingId/analysis/requeue
// Requeues exhausted NLP analyses for an owned offering (dead-letter recovery path)
router.post(
  '/dashboard/:courseOfferingId/analysis/requeue',
  authenticateToken,
  requireOfferingOwnership('courseOfferingId'),
  handleRequeueFailedAnalyses
);

module.exports = router;
