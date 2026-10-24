const { pool } = require('../../config/db');
const MINIMUM_GROUP_SIZE = 5;

/**
 * Retrieves paginated, filterable comments for Level 4 evidence view
 * Exposes only month-level granularity (never day/hour timestamps) and orders
 * results by month + stable id so exact submission order is not observable.
 * @param {object} params
 * @param {string} params.offeringId
 * @param {number} params.page
 * @param {number} params.pageSize
 * @param {string} [params.topic]
 * @param {string} [params.sentiment]
 * @returns {Promise<{ total: number, comments: Array<object> }>}
 */
async function getOfferingFeedbackComments({ offeringId, page, pageSize, topic, sentiment }) {
  const offset = (page - 1) * pageSize;

  const { rows: responseRows } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM feedback_submissions WHERE offering_id = $1;',
    [offeringId]
  );
  if ((responseRows[0]?.total || 0) < MINIMUM_GROUP_SIZE) {
    return { total: 0, comments: [], privacySuppressed: true };
  }

  const whereConditions = [
    'sub.offering_id = $1',
    'sub.comment_text IS NOT NULL',
  ];
  const queryParams = [offeringId];
  let paramIdx = 2;

  if (sentiment) {
    whereConditions.push(`sent.label = $${paramIdx}`);
    queryParams.push(sentiment);
    paramIdx++;
  }

  if (topic) {
    whereConditions.push(`EXISTS (
      SELECT 1 FROM feedback_topic_mention tm 
      WHERE tm.submission_id = sub.id AND tm.topic_key = $${paramIdx}
    )`);
    queryParams.push(topic);
    paramIdx++;
  }

  const whereClause = whereConditions.join(' AND ');

  // 1. Total Count Query
  const countSql = `
    SELECT COUNT(DISTINCT sub.id)::int AS total
    FROM feedback_submissions sub
    LEFT JOIN feedback_sentiment sent ON sent.submission_id = sub.id
    WHERE ${whereClause};
  `;
  const { rows: countRows } = await pool.query(countSql, queryParams);
  const total = countRows[0]?.total || 0;

  // 2. Data Query with aggregate topics, ratings, and coarse truncated date
  const dataSql = `
    SELECT 
      sub.id,
      sub.comment_text AS "commentText",
      JSON_BUILD_OBJECT(
        'teachingClarity', sub.rating_clarity,
        'teachingPace', sub.rating_pace,
        'doubtHandling', sub.rating_doubt_handling,
        'engagement', sub.rating_engagement,
        'practicalExamples', sub.rating_practical_examples
      ) AS ratings,
      sub.analysis_status AS "analysisStatus",
      sent.label AS sentiment,
      COALESCE(
        ARRAY_AGG(t.topic_key) FILTER (WHERE t.topic_key IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS topics,
      TO_CHAR(sub.created_at, 'Mon YYYY') AS "submittedMonth"
    FROM feedback_submissions sub
    LEFT JOIN feedback_sentiment sent ON sent.submission_id = sub.id
    LEFT JOIN feedback_topic_mention t ON t.submission_id = sub.id
    WHERE ${whereClause}
    GROUP BY sub.id, sub.comment_text, sub.rating_clarity, sub.rating_pace,
      sub.rating_doubt_handling, sub.rating_engagement, sub.rating_practical_examples,
      sub.analysis_status, sent.label, sub.created_at
    ORDER BY sub.created_at DESC, sub.id DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  const dataParams = [...queryParams, pageSize, offset];
  const { rows: comments } = await pool.query(dataSql, dataParams);

  return { total, comments, privacySuppressed: false };
}

module.exports = {
  getOfferingFeedbackComments,
};
