const { feedbackSubmissionSchema } = require('./feedbackValidation');
const { submitFeedback } = require('./feedbackService');

/**
 * Controller handling POST /api/v1/feedback
 * Validates request body, calls service layer, and maps response.
 */
async function handleFeedbackSubmission(req, res, next) {
  try {
    // 1. Validate payload using strict Zod schema
    const validationResult = feedbackSubmissionSchema.safeParse(req.body);
    if (!validationResult.success) {
      const fieldErrors = {};
      for (const issue of validationResult.error.issues) {
        const pathKey = issue.path.join('.');
        fieldErrors[pathKey] = issue.message;
      }

      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The submitted feedback contains invalid data.',
          details: fieldErrors,
        },
      });
    }

    // 2. Delegate to service layer
    await submitFeedback(validationResult.data);

    // 3. Return canonical 201 response adhering strictly to API_CONTRACT.md
    // (Never returns the internal submission ID or metadata to the anonymous student client)
    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleFeedbackSubmission,
};
