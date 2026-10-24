const { z } = require('zod');
const { getDashboardData } = require('./dashboardService');
const { requeueFailedAnalyses } = require('../nlp/analysisService');

const paramSchema = z.object({
  courseOfferingId: z.string().uuid('Course offering ID must be a valid UUID.'),
});

async function handleGetDashboard(req, res, next) {
  try {
    const parseResult = paramSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid course offering ID format.',
          details: { courseOfferingId: parseResult.error.issues[0]?.message },
        },
      });
    }

    const data = await getDashboardData(parseResult.data.courseOfferingId);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * Controller for POST /api/v1/dashboard/:courseOfferingId/analysis/requeue
 * Requeues permanently-failed NLP analyses for an owned offering. Ownership is
 * enforced upstream by requireOfferingOwnership; there is no admin surface.
 */
async function handleRequeueFailedAnalyses(req, res, next) {
  try {
    const parseResult = paramSchema.safeParse(req.params);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid course offering ID format.',
          details: { courseOfferingId: parseResult.error.issues[0]?.message },
        },
      });
    }

    const requeued = await requeueFailedAnalyses(parseResult.data.courseOfferingId);
    return res.status(200).json({ requeued });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetDashboard,
  handleRequeueFailedAnalyses,
};
