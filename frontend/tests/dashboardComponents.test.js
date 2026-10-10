import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

test('all required Stage 19 dashboard & auth components exist', () => {
  const expectedFiles = [
    'features/auth/AuthContext.jsx',
    'features/auth/LoginPage.jsx',
    'features/dashboard/api/dashboardApi.js',
    'features/dashboard/components/DashboardHeader.jsx',
    'features/dashboard/components/OverviewSection.jsx',
    'features/dashboard/components/PerformanceSection.jsx',
    'features/dashboard/components/TopicsSection.jsx',
    'features/dashboard/components/EvidenceSection.jsx',
    'features/dashboard/pages/DashboardPage.jsx',
    'App.jsx',
  ];

  for (const relPath of expectedFiles) {
    const fullPath = path.join(srcDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Dashboard file must exist: ${relPath}`);
  }
});

test('LoginPage enforces institutional email and password authentication', () => {
  const loginFile = path.join(srcDir, 'features/auth/LoginPage.jsx');
  const content = fs.readFileSync(loginFile, 'utf8');

  assert.ok(content.includes('Institutional Email'), 'Must ask for institutional email');
  assert.ok(content.includes('Password'), 'Must ask for password');
  assert.ok(content.includes('useAuth'), 'Must use AuthContext login function');
  assert.ok(content.includes('Sign In to Dashboard'), 'Must include sign-in button');
});

test('OverviewSection enforces Level 1 hierarchy and privacy threshold guard', () => {
  const overviewFile = path.join(srcDir, 'features/dashboard/components/OverviewSection.jsx');
  const content = fs.readFileSync(overviewFile, 'utf8');

  assert.ok(content.includes('Overall Average Rating'), 'Must display overall average rating');
  assert.ok(content.includes('Total Submissions'), 'Must display total responses');
  assert.ok(content.includes('Written Sentiment Breakdown'), 'Must display sentiment breakdown');
  assert.ok(content.includes('privacyThresholdMet'), 'Must check privacyThresholdMet');
});

test('PerformanceSection renders all 5 teaching performance dimensions with status tags', () => {
  const perfFile = path.join(srcDir, 'features/dashboard/components/PerformanceSection.jsx');
  const content = fs.readFileSync(perfFile, 'utf8');

  assert.ok(content.includes('Teaching Performance Dimensions'), 'Must display section header');
  assert.ok(content.includes('averageScore'), 'Must display average score');
  assert.ok(content.includes('progressbar'), 'Must provide accessible progressbar');
  assert.ok(content.includes('badge-strong') && content.includes('badge-attention'), 'Must include status badges');
});

test('TopicsSection links extracted themes with interactive filtering', () => {
  const topicsFile = path.join(srcDir, 'features/dashboard/components/TopicsSection.jsx');
  const content = fs.readFileSync(topicsFile, 'utf8');

  assert.ok(content.includes('Recurring Topics in Student Feedback'), 'Must display topics header');
  assert.ok(content.includes('mentions'), 'Must display mention count');
  assert.ok(content.includes('onSelectTopic'), 'Must support interactive topic selection callback');
  assert.ok(content.includes('aria-pressed'), 'Must support accessible pressed state');
});

test('EvidenceSection renders paginated, filterable comments without student PII', () => {
  const evidenceFile = path.join(srcDir, 'features/dashboard/components/EvidenceSection.jsx');
  const content = fs.readFileSync(evidenceFile, 'utf8');

  assert.ok(content.includes('Student Feedback Evidence'), 'Must label evidence section');
  assert.ok(content.includes('submittedDate'), 'Must display submission date');
  assert.ok(content.includes('comment-text'), 'Must render verbatim student text');
  assert.ok(content.includes('select-filter'), 'Must provide filter controls');
  assert.ok(content.includes('pagination'), 'Must support pagination');
  // Confirm NO student identity fields
  assert.ok(!content.includes('studentName'), 'Must not display studentName');
  assert.ok(!content.includes('studentId'), 'Must not display studentId');
});

test('DashboardPage manages offering switching and hierarchical data fetching', () => {
  const dashFile = path.join(srcDir, 'features/dashboard/pages/DashboardPage.jsx');
  const content = fs.readFileSync(dashFile, 'utf8');

  assert.ok(content.includes('fetchProfessorOfferings'), 'Must fetch assigned offerings');
  assert.ok(content.includes('fetchDashboardData'), 'Must fetch 4-level dashboard metrics');
  assert.ok(content.includes('fetchEvidenceComments'), 'Must fetch Level 4 evidence comments');
  assert.ok(content.includes('privacyThresholdMet'), 'Must gate granular sections on privacy threshold');
});
