export function validateCatalogOfferings(offerings) {
  return Array.isArray(offerings) && offerings.every((item) => item &&
    typeof item.id === 'string' && typeof item.courseId === 'string' &&
    typeof item.courseCode === 'string' && typeof item.courseTitle === 'string' &&
    typeof item.academicTermId === 'string' && typeof item.term === 'string' &&
    Number.isInteger(Number(item.academicYearStart)) &&
    Number.isInteger(Number(item.semesterNumber)) && Number(item.semesterNumber) >= 1 && Number(item.semesterNumber) <= 8 &&
    Number.isInteger(Number(item.studyYear)) && Number(item.studyYear) >= 1 && Number(item.studyYear) <= 4 &&
    typeof item.departmentId === 'string' && typeof item.departmentCode === 'string' &&
    typeof item.departmentName === 'string' && typeof item.section === 'string' &&
    typeof (item.instructorName || item.professorName) === 'string' &&
    Array.isArray(item.eligibleDepartments) && item.eligibleDepartments.every((department) =>
      department && typeof department.id === 'string' && typeof department.code === 'string' && typeof department.name === 'string'));
}
