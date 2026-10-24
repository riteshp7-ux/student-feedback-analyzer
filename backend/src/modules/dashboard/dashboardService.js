const {
  getOfferingDetails,
  getOfferingMetrics,
  getOfferingTopicSummary,
} = require('./dashboardRepository');
const { TOPIC_LABELS } = require('../topics');

function getDimensionStatus(score) {
  if (score === null || score === undefined) return 'neutral';
  if (score >= 4.0) return 'strong';
  if (score < 3.0) return 'weak';
  return 'moderate';
}

function getDominantSentiment(sentiment) {
  const { positive, neutral, negative } = sentiment;
  const max = Math.max(positive, neutral, negative);
  if (max === 0) return 'neutral';
  if (positive === max) return 'positive';
  if (negative === max) return 'negative';
  return 'neutral';
}

/**
 * Builds the application-level dashboard response conforming strictly to docs/API_CONTRACT.md
 * Enforces Privacy Guard: if responseCount < 5, suppress granular breakdowns to protect anonymity.
 * @param {string} offeringId
 * @returns {Promise<object>}
 */
async function getDashboardData(offeringId) {
  // 1. Validate offering existence
  const courseOffering = await getOfferingDetails(offeringId);
  if (!courseOffering) {
    const error = new Error('The specified course offering was not found.');
    error.code = 'RESOURCE_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  // 2. Fetch raw aggregates
  const { performance, sentiment } = await getOfferingMetrics(offeringId);
  const totalResponses = performance.responseCount;
  const commentInsightsAvailable = sentiment.analyzedCommentCount >= 5;
  const analysisLifecycleAvailable = totalResponses >= 5 && performance.commentSubmissionCount >= 5;
  const analysisLifecycle = analysisLifecycleAvailable ? {
    pending: performance.pendingCommentCount || 0,
    retrying: performance.retryingCommentCount || 0,
    failed: performance.failedCommentCount || 0,
    analyzed: sentiment.analyzedCommentCount || 0,
  } : null;

  // 3. Evaluate Privacy Threshold (N >= 5)
  if (totalResponses < 5) {
    return {
      courseOffering: {
        id: courseOffering.id,
        courseId: courseOffering.courseId,
        courseCode: courseOffering.courseCode,
        courseTitle: courseOffering.courseTitle,
        academicTermId: courseOffering.academicTermId,
        term: courseOffering.term,
        studyYear: courseOffering.studyYear,
        departmentId: courseOffering.departmentId,
        departmentCode: courseOffering.departmentCode,
        departmentName: courseOffering.departmentName,
        professorId: courseOffering.professorId,
        professorName: courseOffering.professorName,
        section: courseOffering.section,
      },
      privacyThresholdMet: false,
      commentInsightsAvailable: false,
      commentInsightsMessage: 'Comment themes and sentiment appear after at least 5 comments are analyzed.',
      overall: {
        responseCount: totalResponses,
        averageRating: null,
        sentimentDistribution: null,
        analysisLifecycle: null,
      },
      performance: [],
      topics: [],
      message: 'Minimum response threshold not met (requires at least 5 submissions). Feedback details are hidden to protect student anonymity.',
    };
  }

  // 4. Transform Level 2 Performance Dimensions
  const structuredPerformance = [
    {
      dimensionKey: 'teachingClarity',
      label: 'Teaching Clarity',
      averageScore: performance.avgClarity,
      status: getDimensionStatus(performance.avgClarity),
    },
    {
      dimensionKey: 'doubtHandling',
      label: 'Doubt Handling',
      averageScore: performance.avgDoubt,
      status: getDimensionStatus(performance.avgDoubt),
    },
    {
      dimensionKey: 'engagement',
      label: 'Engagement',
      averageScore: performance.avgEngagement,
      status: getDimensionStatus(performance.avgEngagement),
    },
    {
      dimensionKey: 'teachingPace',
      label: 'Teaching Pace',
      averageScore: performance.avgPace,
      status: getDimensionStatus(performance.avgPace),
    },
    {
      dimensionKey: 'practicalExamples',
      label: 'Practical Examples',
      averageScore: performance.avgExamples,
      status: getDimensionStatus(performance.avgExamples),
    },
  ];

  // 5. Transform Level 3 Topics
  const rawTopics = commentInsightsAvailable
    ? await getOfferingTopicSummary(offeringId)
    : [];
  const topics = rawTopics.map((t) => ({
    topicKey: t.topicKey,
    label: TOPIC_LABELS[t.topicKey] || t.topicKey,
    mentionCount: t.mentionCount,
    dominantSentiment: getDominantSentiment({
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
    }),
    sentimentDistribution: {
      positive: t.positive,
      neutral: t.neutral,
      negative: t.negative,
    },
  }));

  return {
    courseOffering: {
      id: courseOffering.id,
      courseId: courseOffering.courseId,
      courseCode: courseOffering.courseCode,
      courseTitle: courseOffering.courseTitle,
      academicTermId: courseOffering.academicTermId,
      term: courseOffering.term,
      studyYear: courseOffering.studyYear,
      departmentId: courseOffering.departmentId,
      departmentCode: courseOffering.departmentCode,
      departmentName: courseOffering.departmentName,
      professorId: courseOffering.professorId,
      professorName: courseOffering.professorName,
      section: courseOffering.section,
    },
    privacyThresholdMet: true,
    commentInsightsAvailable,
    commentInsightsMessage: commentInsightsAvailable
      ? null
      : 'Comment themes and sentiment appear after at least 5 comments are analyzed.',
    overall: {
      responseCount: totalResponses,
      averageRating: performance.overallAverage,
      analysisLifecycle,
      sentimentDistribution: commentInsightsAvailable ? {
        positive: sentiment.positive,
        neutral: sentiment.neutral,
        negative: sentiment.negative,
      } : null,
    },
    performance: structuredPerformance,
    topics,
  };
}

module.exports = {
  getDashboardData,
};
