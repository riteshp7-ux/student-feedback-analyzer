const express = require('express');
const { handleGetCourseOfferings, handleGetProfessorOfferings } = require('./courseController');
const { authenticateToken } = require('../auth/authMiddleware');

const router = express.Router();

// GET /api/v1/course-offerings - Public list of active offerings (Student view)
router.get('/course-offerings', handleGetCourseOfferings);

// GET /api/v1/professor/offerings - Protected list of offerings assigned to authenticated professor
router.get('/professor/offerings', authenticateToken, handleGetProfessorOfferings);

module.exports = router;
