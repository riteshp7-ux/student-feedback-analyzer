const { z } = require('zod');
const { getOfferingStatus } = require('./feedbackRepository');
const { getOfferingFeedbackComments } = require('./commentRepository');
const { APPROVED_TOPICS } = require('../topics');

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(15),
  topic: z.enum(APPROVED_TOPICS).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
});

const paramSchema = z.object({
  courseOfferingId: z.string().uuid('Course offering ID must be a valid UUID.'),
});

async function handleGetOfferingFeedback(req, res, next) {
  try {
    // 1. Validate route params
    const paramResult = paramSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid course offering ID format.',
          details: { courseOfferingId: paramResult.error.issues[0]?.message },
        },
      });
    }

    // 2. Validate query params
    const queryResult = querySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: queryResult.error.format(),
        },
      });
    }

    const { courseOfferingId } = paramResult.data;
    const { page, pageSize, topic, sentiment } = queryResult.data;

    // 3. Verify offering exists
    const offeringStatus = await getOfferingStatus(courseOfferingId);
    if (!offeringStatus.exists) {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'The specified course offering was not found.',
        },
      });
    }

    // 4. Retrieve paginated comments
    const { total, comments, privacySuppressed } = await getOfferingFeedbackComments({
      offeringId: courseOfferingId,
      page,
      pageSize,
      topic,
      sentiment,
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      pagination: {
        currentPage: page,
        pageSize,
        totalComments: total,
        totalPages,
      },
      privacySuppressed,
      message: privacySuppressed
        ? 'Written feedback is hidden until at least 5 matching comments are available.'
        : null,
      comments,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetOfferingFeedback,
};
