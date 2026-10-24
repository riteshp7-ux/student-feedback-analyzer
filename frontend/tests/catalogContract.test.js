import { describe, it, expect } from 'vitest';
import { validateCatalogOfferings } from '../src/features/feedback/api/catalogContract.js';

const currentOffering = {
  id: 'offering-1', courseId: 'course-1', courseCode: 'CS301', courseTitle: 'Database Systems',
  academicTermId: 'term-1', term: 'Semester 1 2026-27', academicYearStart: 2026,
  semesterNumber: 1, studyYear: 1, departmentId: 'cse-1', departmentCode: 'CSE',
  departmentName: 'Computer Science & Engineering', section: 'A', instructorName: 'Dr. Sharma',
  eligibleDepartments: [{ id: 'cse-1', code: 'CSE', name: 'Computer Science & Engineering' }],
};

describe('catalogContract', () => {
  it('accepts the current catalog and empty active catalog', () => {
    expect(validateCatalogOfferings([currentOffering])).toBe(true);
    expect(validateCatalogOfferings([])).toBe(true);
  });

  it('rejects legacy or incomplete catalog data instead of showing a false empty state', () => {
    expect(validateCatalogOfferings([{ id: 'old', courseCode: 'CS301', term: 'Fall' }])).toBe(false);
    expect(validateCatalogOfferings([{ ...currentOffering, semesterNumber: 9 }])).toBe(false);
    expect(validateCatalogOfferings([{ ...currentOffering, eligibleDepartments: null }])).toBe(false);
    expect(validateCatalogOfferings({ data: [currentOffering] })).toBe(false);
  });
});
