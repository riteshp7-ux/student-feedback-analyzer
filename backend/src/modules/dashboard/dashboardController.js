const { z } = require('zod');
const { getDashboardData } = require('./dashboardService');

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

module.exports = {
  handleGetDashboard,
};
