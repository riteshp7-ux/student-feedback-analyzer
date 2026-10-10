import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('all required Stage 17 feedback components exist', () => {
  const expectedFiles = [
    'features/feedback/pages/StudentFeedbackPage.jsx',
    'features/feedback/components/FeedbackForm.jsx',
    'features/feedback/components/CourseSelector.jsx',
    'features/feedback/components/RatingGroup.jsx',
    'features/feedback/components/CommentField.jsx',
    'features/feedback/components/PrivacyNotice.jsx',
    'features/feedback/components/SubmissionSuccess.jsx',
    'features/feedback/api/feedbackApi.js',
    'shared/components/Header.jsx',
    'shared/styles/index.css',
  ];

  for (const relPath of expectedFiles) {
    const fullPath = path.join(srcDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Component file must exist: ${relPath}`);
  }
});

test('FeedbackForm includes all 5 approved rating dimensions', () => {
  const formFile = path.join(srcDir, 'features/feedback/components/FeedbackForm.jsx');
  const content = fs.readFileSync(formFile, 'utf8');

  const dimensions = [
    'teachingClarity',
    'teachingPace',
    'doubtHandling',
    'engagement',
    'practicalExamples',
  ];

  for (const dim of dimensions) {
    assert.ok(
      content.includes(`key: '${dim}'`) || content.includes(dim),
      `FeedbackForm must configure rating dimension: ${dim}`
    );
  }
});

test('CommentField enforces 2000 character maximum limit and guidance', () => {
  const commentFile = path.join(srcDir, 'features/feedback/components/CommentField.jsx');
  const content = fs.readFileSync(commentFile, 'utf8');

  assert.ok(content.includes('MAX_CHARS = 2000'), 'Must define MAX_CHARS = 2000');
  assert.ok(content.includes('char-counter'), 'Must include char-counter');
  assert.ok(content.includes('Constructive Comments'), 'Must label constructive comments field');
  assert.ok(content.includes('Optional'), 'Must designate comments as optional');
});

test('PrivacyNotice articulates zero student tracking policy', () => {
  const privacyFile = path.join(srcDir, 'features/feedback/components/PrivacyNotice.jsx');
  const content = fs.readFileSync(privacyFile, 'utf8');

  assert.ok(content.includes('Anonymous Feedback Guarantee'), 'Must display anonymous guarantee');
  assert.ok(content.includes('not'), 'Must state what is not collected');
  assert.ok(content.includes('student ID') || content.includes('IP address'), 'Must mention no tracking of student identity');
});

test('RatingGroup specifies 1 to 5 scale with accessible radio groups', () => {
  const ratingFile = path.join(srcDir, 'features/feedback/components/RatingGroup.jsx');
  const content = fs.readFileSync(ratingFile, 'utf8');

  assert.ok(content.includes('role="radiogroup"'), 'Must have role=radiogroup');
  assert.ok(content.includes('1 - Poor') && content.includes('5 - Excellent'), 'Must have anchors 1 to 5');
});

test('SubmissionSuccess provides confirmation and reset option', () => {
  const successFile = path.join(srcDir, 'features/feedback/components/SubmissionSuccess.jsx');
  const content = fs.readFileSync(successFile, 'utf8');

  assert.ok(content.includes('Feedback Submitted Successfully'), 'Must show confirmation title');
  assert.ok(content.includes('onReset'), 'Must provide reset action');
});
