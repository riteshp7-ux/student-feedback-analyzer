import React from 'react';

export default function StudentBar({ student, onSignOut }) {
  if (!student) return null;

  return (
    <div
      className="student-bar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg-secondary, #f8fafc)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '8px',
        padding: '0.625rem 1rem',
        marginBottom: '1.25rem',
        fontSize: '0.875rem',
      }}
      role="region"
      aria-label="Student Identity"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-success, #10b981)',
          }}
          aria-hidden="true"
        />
        <span>
          Authenticated Student: <strong>{student.fullName}</strong>
          {student.studentIdNumber && ` (${student.studentIdNumber})`}
        </span>
        <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>
          • {student.email}
        </span>
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
        onClick={onSignOut}
      >
        Sign Out / Switch
      </button>
    </div>
  );
}
