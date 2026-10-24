import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrivacyNotice from '../src/features/feedback/components/PrivacyNotice.jsx';
import RatingGroup from '../src/features/feedback/components/RatingGroup.jsx';

describe('PrivacyNotice', () => {
  it('explains the anonymity model and month-level date granularity', () => {
    render(<PrivacyNotice />);
    expect(screen.getByText('Your privacy')).toBeTruthy();
    expect(screen.getByText(/not shown to professors with your student identity/)).toBeTruthy();
    // Updated privacy copy: month granularity, no day-precision dates
    expect(screen.getByText(/month granularity/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/YYYY-MM-DD/);
  });
});

describe('RatingGroup', () => {
  const baseProps = {
    id: 'clarity',
    title: 'Teaching Clarity',
    description: 'How clear were the explanations?',
    error: undefined,
  };

  it('renders exactly five rating options', () => {
    render(<RatingGroup {...baseProps} value={null} onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: /teaching clarity/i });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(5);
  });

  it('marks the selected value and reports selections through onChange', () => {
    const onChange = vi.fn();
    render(<RatingGroup {...baseProps} value={3} onChange={onChange} />);
    const option5 = screen.getByRole('radio', { name: '5 - Excellent' });
    fireEvent.click(option5);
    expect(onChange).toHaveBeenCalledWith(5);
    expect(screen.getByRole('radio', { name: '3 - Satisfactory' }).checked).toBe(true);
  });

  it('associates validation errors with the group for accessibility', () => {
    render(<RatingGroup {...baseProps} value={null} onChange={() => {}} error="Clarity rating is required." />);
    expect(screen.getByText('Clarity rating is required.')).toBeTruthy();
  });
});
