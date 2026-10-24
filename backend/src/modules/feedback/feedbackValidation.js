const { z } = require('zod');

/**
 * Strict Zod schema for anonymous feedback submission
 * Conforms to docs/API_CONTRACT.md:
 * - courseOfferingId: required UUID string
 * - ratings: required object with exactly the 5 approved dimensions (integers between 1 and 5)
 * - comment: optional string (max 2000 chars, whitespace trimmed, null/undefined converted to null)
 * - strict(): rejects unexpected properties (e.g. studentId, email, IP)
 */
const feedbackSubmissionSchema = z.object({
  idempotencyKey: z.string().uuid('Idempotency key must be a valid UUID.').optional(),
  courseOfferingId: z
    .string({ required_error: 'Course offering ID is required.' })
    .uuid('Course offering ID must be a valid UUID.'),
  ratings: z
    .object({
      teachingClarity: z
        .number({ required_error: 'Teaching clarity rating is required.' })
        .int('Teaching clarity must be an integer.')
        .min(1, 'Teaching clarity must be at least 1.')
        .max(5, 'Teaching clarity cannot exceed 5.'),
      teachingPace: z
        .number({ required_error: 'Teaching pace rating is required.' })
        .int('Teaching pace must be an integer.')
        .min(1, 'Teaching pace must be at least 1.')
        .max(5, 'Teaching pace cannot exceed 5.'),
      doubtHandling: z
        .number({ required_error: 'Doubt handling rating is required.' })
        .int('Doubt handling must be an integer.')
        .min(1, 'Doubt handling must be at least 1.')
        .max(5, 'Doubt handling cannot exceed 5.'),
      engagement: z
        .number({ required_error: 'Engagement rating is required.' })
        .int('Engagement must be an integer.')
        .min(1, 'Engagement must be at least 1.')
        .max(5, 'Engagement cannot exceed 5.'),
      practicalExamples: z
        .number({ required_error: 'Practical examples rating is required.' })
        .int('Practical examples must be an integer.')
        .min(1, 'Practical examples must be at least 1.')
        .max(5, 'Practical examples cannot exceed 5.'),
    })
    .strict('Unknown rating dimension provided.'),
  comment: z
    .string()
    .trim()
    .max(2000, 'Comment text cannot exceed 2000 characters.')
    .nullable()
    .optional()
    .transform((val) => {
      if (!val || val.trim().length === 0) return null;
      return val.trim();
    }),
}).strict('Unknown fields in submission payload are not permitted.');

module.exports = {
  feedbackSubmissionSchema,
};
