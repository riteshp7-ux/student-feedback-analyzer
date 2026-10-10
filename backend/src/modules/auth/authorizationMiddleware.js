const { pool } = require('../../config/db');

/**
 * Middleware factory: Enforces that the authenticated professor owns the target course offering.
 * Expects req.user.professorId and req.params[paramName] (default: 'courseOfferingId').
 * Returns 404 if offering does not exist, 403 if offering belongs to another professor.
 */
function requireOfferingOwnership(paramName = 'courseOfferingId') {
  return async function (req, res, next) {
    const offeringId = req.params[paramName];
    const professorId = req.user?.professorId;

    if (!offeringId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: `Missing offering identifier parameter :${paramName}`,
        },
      });
    }

    // Standard UUID validation
    const { z } = require('zod');
    const uuidSchema = z.string().uuid();
    if (!uuidSchema.safeParse(offeringId).success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid courseOfferingId format. Must be a valid UUID.',
        },
      });
    }

    try {
      const { rows } = await pool.query(`
        SELECT id, professor_id
        FROM course_offerings
        WHERE id = $1;
      `, [offeringId]);

      if (rows.length === 0) {
        return res.status(404).json({
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: `Course offering with ID '${offeringId}' was not found.`,
          },
        });
      }

      const offering = rows[0];

      if (offering.professor_id !== professorId) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to access feedback or dashboard analytics for this course offering.',
          },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireOfferingOwnership,
};
