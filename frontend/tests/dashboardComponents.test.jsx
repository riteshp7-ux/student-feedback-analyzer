import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import OverviewSection from '../src/features/dashboard/components/OverviewSection.jsx';
import PerformanceSection from '../src/features/dashboard/components/PerformanceSection.jsx';
import EvidenceSection from '../src/features/dashboard/components/EvidenceSection.jsx';

const fullPerformance = [
  { dimensionKey: 'teachingClarity', label: 'Teaching Clarity', averageScore: 4.5, status: 'strong' },
  { dimensionKey: 'doubtHandling', label: 'Doubt Handling', averageScore: 3.4, status: 'moderate' },
  { dimensionKey: 'engagement', label: 'Engagement', averageScore: 2.1, status: 'weak' },
  { dimensionKey: 'teachingPace', label: 'Teaching Pace', averageScore: 3.9, status: 'moderate' },
  { dimensionKey: 'practicalExamples', label: 'Practical Examples', averageScore: 4.1, status: 'strong' },
];

describe('OverviewSection (Level 1)', () => {
  it('shows aggregate metrics when the privacy threshold is met', () => {
    render(
      <OverviewSection
        overall={{
          responseCount: 12,
          averageRating: 4.2,
          sentimentDistribution: { positive: 8, neutral: 3, negative: 1 },
        }}
        performance={fullPerformance}
        privacyThresholdMet
      />
    );
    expect(screen.getByText('5+ responses')).toBeTruthy();
    expect(screen.getByText('4.20')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('suppresses metrics and displays the privacy banner when N < 5', () => {
    render(
      <OverviewSection
        overall={{ responseCount: 2, averageRating: null, sentimentDistribution: null }}
        performance={[]}
        privacyThresholdMet={false}
      />
    );
    expect(screen.getByText('Private until 5 responses')).toBeTruthy();
    expect(screen.getByText('Private for small groups')).toBeTruthy();
    // No average value is rendered for suppressed data
    expect(screen.queryByText(/^\d\.\d\d$/)).toBeNull();
  });
});

describe('PerformanceSection (Level 2)', () => {
  it('renders all five dimensions with accessible progressbars and status badges', () => {
    render(<PerformanceSection performance={fullPerformance} />);
    const section = screen.getByRole('region', { name: /teaching performance/i });
    const bars = within(section).getAllByRole('progressbar');
    expect(bars).toHaveLength(5);
    // Two dimensions carry the 'strong' status in this fixture
    expect(within(section).getAllByText('Strong')).toHaveLength(2);
    expect(within(section).getByText('Needs Attention')).toBeTruthy();
    expect(within(section).getByText('Engagement')).toBeTruthy();
  });

  it('renders nothing without data', () => {
    const { container } = render(<PerformanceSection performance={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('EvidenceSection (Level 4)', () => {
  const comments = [
    {
      id: 'sub-1',
      commentText: 'The pacing was excellent and examples were practical.',
      ratings: { teachingClarity: 4, teachingPace: 5, doubtHandling: 4, engagement: 4, practicalExamples: 5 },
      analysisStatus: 'completed',
      sentiment: 'positive',
      topics: ['teaching_pace', 'practical_examples'],
      submittedMonth: 'Oct 2026',
    },
    {
      id: 'sub-2',
      commentText: 'Assignments felt heavy this month.',
      analysisStatus: 'failed',
      sentiment: null,
      topics: ['assignments'],
      submittedMonth: 'Oct 2026',
    },
  ];

  it('renders comment text with month-level dates and never day-precision timestamps', () => {
    render(
      <EvidenceSection
        comments={comments}
        pagination={{ currentPage: 1, totalPages: 1, totalComments: 2 }}
      />
    );
    expect(screen.getByText(/The pacing was excellent/)).toBeTruthy();
    expect(screen.getAllByText('Oct 2026')).toHaveLength(2);
    // Privacy invariant: no YYYY-MM-DD (or finer) timestamps anywhere in output
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(document.body.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it('labels failed analyses as delayed rather than exposing retry counters', () => {
    render(<EvidenceSection comments={[comments[1]]} pagination={{ totalComments: 1 }} />);
    expect(screen.getByText('Analysis delayed')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/attempt/i);
  });

  it('shows the privacy suppression notice instead of comments below the threshold', () => {
    render(
      <EvidenceSection
        comments={[]}
        privacySuppressed
        privacyMessage="Written feedback is hidden until at least 5 matching comments are available."
      />
    );
    // The privacy notice appears in the header note and the empty-state block
    const notices = screen.getAllByText(/hidden until at least 5/);
    expect(notices.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Filter by topic or sentiment/)).toBeNull();
  });
});
