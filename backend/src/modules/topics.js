/**
 * Single source of truth for the pedagogical topic taxonomy.
 *
 * Previously duplicated in nlpClient.js (contract validation), commentController.js
 * (query filters), and dashboardService.js (display labels); one authoritative copy
 * keeps the NLP response contract, the evidence filters, and the dashboard from
 * drifting apart.
 */

const APPROVED_TOPICS = [
  'teaching_clarity',
  'teaching_pace',
  'practical_examples',
  'doubt_handling',
  'engagement',
  'assignments',
  'course_content',
];

const TOPIC_LABELS = {
  teaching_clarity: 'Teaching Clarity',
  teaching_pace: 'Teaching Pace',
  practical_examples: 'Practical Examples',
  doubt_handling: 'Doubt Handling',
  engagement: 'Student Engagement',
  assignments: 'Assignments & Grading',
  course_content: 'Course Content & Curriculum',
};

module.exports = {
  APPROVED_TOPICS,
  TOPIC_LABELS,
};
