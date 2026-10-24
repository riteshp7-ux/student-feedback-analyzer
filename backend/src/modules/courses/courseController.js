const { getActiveCourseOfferings, getOfferingsByProfessorId } = require('./courseRepository');
const { validateCatalogOfferings } = require('./catalogContract');

/**
 * Public endpoint: GET /api/v1/course-offerings
 */
async function handleGetCourseOfferings(req, res, next) {
  try {
    const offerings = await getActiveCourseOfferings();
    if (!validateCatalogOfferings(offerings)) {
      const error = new Error('The course catalog contains incomplete offering data.');
      error.code = 'CATALOG_CONTRACT_INVALID';
      error.status = 503;
      throw error;
    }
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
