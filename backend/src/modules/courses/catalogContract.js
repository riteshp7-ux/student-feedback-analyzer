function isValidCatalogOffering(item) {
  return Boolean(item &&
    typeof item.id === 'string' &&
    typeof item.courseId === 'string' &&
    typeof item.courseCode === 'string' && item.courseCode.trim() &&
    typeof item.courseTitle === 'string' && item.courseTitle.trim() &&
    typeof item.academicTermId === 'string' &&
    typeof item.term === 'string' && item.term.trim() &&
    Number.isInteger(Number(item.academicYearStart)) &&
    Number.isInteger(Number(item.semesterNumber)) && Number(item.semesterNumber) >= 1 && Number(item.semesterNumber) <= 8 &&
    Number.isInteger(Number(item.studyYear)) && Number(item.studyYear) >= 1 && Number(item.studyYear) <= 4 &&
    typeof item.departmentId === 'string' &&
    typeof item.departmentCode === 'string' && item.departmentCode.trim() &&
    typeof item.departmentName === 'string' && item.departmentName.trim() &&
    typeof item.section === 'string' &&
    typeof (item.instructorName || item.professorName) === 'string' &&
    Array.isArray(item.eligibleDepartments) &&
    item.eligibleDepartments.every((department) => department &&
      typeof department.id === 'string' && typeof department.code === 'string' && typeof department.name === 'string'));
}

function validateCatalogOfferings(payload) {
  return Array.isArray(payload) && payload.every(isValidCatalogOffering);
}

module.exports = { isValidCatalogOffering, validateCatalogOfferings };
