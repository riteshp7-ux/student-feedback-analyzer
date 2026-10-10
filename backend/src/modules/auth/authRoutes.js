const express = require('express');
const { handleLogin, handleGetMe } = require('./authController');
const { authenticateToken } = require('./authMiddleware');
const { authLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// POST /api/v1/auth/login - Authenticate professor with email & password (Rate limited)
router.post('/auth/login', authLimiter, handleLogin);

// GET /api/v1/auth/me - Retrieve authenticated professor session identity
router.get('/auth/me', authenticateToken, handleGetMe);

module.exports = router;
