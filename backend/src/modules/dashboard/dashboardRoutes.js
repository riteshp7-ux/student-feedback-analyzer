const express = require('express');
const { handleGetDashboard } = require('./dashboardController');
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

module.exports = router;
