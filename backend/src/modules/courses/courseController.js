const { getActiveCourseOfferings, getOfferingsByProfessorId } = require('./courseRepository');

/**
 * Public endpoint: GET /api/v1/course-offerings
 */
async function handleGetCourseOfferings(req, res, next) {
  try {
    const offerings = await getActiveCourseOfferings();
    return res.status(200).json(offerings);
  } catch (err) {
    next(err);
  }
}

/**
 * Protected endpoint: GET /api/v1/professor/offerings
 * Returns course offerings assigned to req.user.professorId
 */
async function handleGetProfessorOfferings(req, res, next) {
  try {
    const professorId = req.user.professorId;
    const offerings = await getOfferingsByProfessorId(professorId);
    return res.status(200).json(offerings);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetCourseOfferings,
  handleGetProfessorOfferings,
};
