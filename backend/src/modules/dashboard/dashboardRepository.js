const { pool } = require('../../config/db');

/**
 * Checks offering metadata and existence
 * @param {string} offeringId
 * @returns {Promise<object|null>}
 */
async function getOfferingDetails(offeringId) {
  const { rows } = await pool.query(`
    SELECT 
      o.id,
      c.id AS "courseId",
      c.code AS "courseCode",
      c.title AS "courseTitle",
      t.id AS "academicTermId",
      t.label AS term,
      ((t.semester_number + 1) / 2)::int AS "studyYear",
      d.id AS "departmentId",
      d.code AS "departmentCode",
      d.name AS "departmentName",
      p.id AS "professorId",
      p.full_name AS "professorName",
      o.section,
      o.is_active AS "isActive"
    FROM course_offerings o
    JOIN courses c ON c.id = o.course_id
    JOIN academic_terms t ON t.id = o.academic_term_id
    JOIN departments d ON d.id = o.department_id
    JOIN professors p ON p.id = o.professor_id
    WHERE o.id = $1;
  `, [offeringId]);

  return rows[0] || null;
}

/**
 * Retrieves Level 1 & Level 2 summary aggregations for a course offering:
 * - total response count
 * - overall average rating
 * - average score per dimension (1 to 5)
 * - sentiment distribution breakdown (positive, neutral, negative)
 * @param {string} offeringId
 * @returns {Promise<object>}
 */
async function getOfferingMetrics(offeringId) {
  // Query 1: Response counts & Dimension averages (Direct on feedback_submissions to avoid join row multiplication)
  const { rows: perfRows } = await pool.query(`
    SELECT 
      COUNT(id)::int AS "responseCount",
      ROUND(AVG(rating_clarity)::numeric, 2)::float AS "avgClarity",
      ROUND(AVG(rating_pace)::numeric, 2)::float AS "avgPace",
      ROUND(AVG(rating_doubt_handling)::numeric, 2)::float AS "avgDoubt",
      ROUND(AVG(rating_engagement)::numeric, 2)::float AS "avgEngagement",
      ROUND(AVG(rating_practical_examples)::numeric, 2)::float AS "avgExamples",
      ROUND(AVG((rating_clarity + rating_pace + rating_doubt_handling + rating_engagement + rating_practical_examples) / 5.0)::numeric, 2)::float AS "overallAverage",
      COUNT(*) FILTER (WHERE analysis_status = 'pending')::int AS "pendingCommentCount",
      COUNT(*) FILTER (WHERE analysis_status = 'failed' AND analysis_attempts < 8)::int AS "retryingCommentCount",
      COUNT(*) FILTER (WHERE analysis_status = 'failed' AND analysis_attempts >= 8)::int AS "failedCommentCount",
      COUNT(*) FILTER (WHERE comment_text IS NOT NULL AND TRIM(comment_text) != '')::int AS "commentSubmissionCount"
    FROM feedback_submissions
    WHERE offering_id = $1;
  `, [offeringId]);

  // Query 2: Sentiment distribution from feedback_sentiment
  const { rows: sentRows } = await pool.query(`
    SELECT 
      COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS positive,
      COUNT(CASE WHEN sent.label = 'neutral' THEN 1 END)::int AS neutral,
      COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS negative,
      COUNT(sent.submission_id)::int AS "analyzedCommentCount"
    FROM feedback_sentiment sent
    JOIN feedback_submissions sub ON sub.id = sent.submission_id
    WHERE sub.offering_id = $1;
  `, [offeringId]);

  return {
    performance: perfRows[0] || {
      responseCount: 0,
      avgClarity: null, avgPace: null, avgDoubt: null,
      avgEngagement: null, avgExamples: null, overallAverage: null,
      pendingCommentCount: 0, retryingCommentCount: 0, failedCommentCount: 0, commentSubmissionCount: 0,
    },
    sentiment: sentRows[0] || { positive: 0, neutral: 0, negative: 0 },
  };
}

/**
 * Retrieves Level 3 Topic mention frequencies and per-topic sentiment distributions
 * @param {string} offeringId
 * @returns {Promise<Array<object>>}
 */
async function getOfferingTopicSummary(offeringId) {
  const { rows } = await pool.query(`
    SELECT 
      t.topic_key AS "topicKey",
      COUNT(t.id)::int AS "mentionCount",
      COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS positive,
      COUNT(CASE WHEN sent.label = 'neutral' THEN 1 END)::int AS neutral,
      COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS negative
    FROM feedback_topic_mention t
    JOIN feedback_submissions sub ON sub.id = t.submission_id
    LEFT JOIN feedback_sentiment sent ON sent.submission_id = sub.id
    WHERE sub.offering_id = $1
    GROUP BY t.topic_key
    ORDER BY "mentionCount" DESC;
  `, [offeringId]);

  return rows;
}

module.exports = {
  getOfferingDetails,
  getOfferingMetrics,
  getOfferingTopicSummary,
};
