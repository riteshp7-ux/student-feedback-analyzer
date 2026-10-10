const {
  getOfferingDetails,
  getOfferingMetrics,
  getOfferingTopicSummary,
} = require('./dashboardRepository');

const TOPIC_LABELS = {
  teaching_clarity: 'Teaching Clarity',
  teaching_pace: 'Teaching Pace',
  practical_examples: 'Practical Examples',
  doubt_handling: 'Doubt Handling',
  engagement: 'Student Engagement',
  assignments: 'Assignments & Grading',
  course_content: 'Course Content & Curriculum',
};

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

  // 3. Evaluate Privacy Threshold (N >= 5)
  if (totalResponses < 5) {
    return {
      courseOffering: {
        id: courseOffering.id,
        courseCode: courseOffering.courseCode,
        courseTitle: courseOffering.courseTitle,
        term: courseOffering.term,
      },
      privacyThresholdMet: false,
      overall: {
        responseCount: totalResponses,
        averageRating: null,
        sentimentDistribution: null,
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
  const rawTopics = await getOfferingTopicSummary(offeringId);
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
      courseCode: courseOffering.courseCode,
      courseTitle: courseOffering.courseTitle,
      term: courseOffering.term,
    },
    privacyThresholdMet: true,
    overall: {
      responseCount: totalResponses,
      averageRating: performance.overallAverage,
      sentimentDistribution: {
        positive: sentiment.positive,
        neutral: sentiment.neutral,
        negative: sentiment.negative,
      },
    },
    performance: structuredPerformance,
    topics,
  };
}

module.exports = {
  getDashboardData,
};
