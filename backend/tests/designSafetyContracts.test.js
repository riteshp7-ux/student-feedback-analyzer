const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateDemoResetTarget } = require('../src/db/seeds/demoResetGuard');
const { validateCatalogOfferings } = require('../src/modules/courses/catalogContract');
const { provisionProductionData } = require('../src/db/provision');
const { createRateLimiter } = require('../src/middlewares/rateLimiter');
const { getApiMetadata } = require('../src/apiMetadata');

const offering = {
  id: 'offering-1', courseId: 'course-1', courseCode: 'IT101', courseTitle: 'Foundations of IT',
  academicTermId: 'term-1', term: 'Semester 1 2026-27', academicYearStart: 2026,
  semesterNumber: 1, studyYear: 1, departmentId: 'dept-1', departmentCode: 'IT',
  departmentName: 'Information Technology', section: 'A', instructorName: 'Prof Arjun Mehta',
  eligibleDepartments: [{ id: 'dept-1', code: 'IT', name: 'Information Technology' }],
};

test('destructive demo reset requires safe environment, explicit confirmation and matching database', () => {
  const valid = {
    nodeEnv: 'development', databaseUrl: 'postgresql://user:pass@localhost:5432/feedback_demo',
    allowedDatabase: 'feedback_demo', confirmation: 'YES',
  };
  assert.equal(validateDemoResetTarget(valid).allowed, true);
  assert.equal(validateDemoResetTarget({ ...valid, nodeEnv: 'production' }).allowed, false);
  assert.equal(validateDemoResetTarget({ ...valid, confirmation: '' }).allowed, false);
  assert.equal(validateDemoResetTarget({ ...valid, allowedDatabase: 'feedback_prod' }).allowed, false);
  assert.equal(validateDemoResetTarget({ ...valid, databaseUrl: 'not a URL' }).allowed, false);
});

test('normal seed command uses additive catalog loader and catalog conflicts do not overwrite live data', () => {
  const packageJson = require('../package.json');
  assert.match(packageJson.scripts['db:seed'], /catalogDemo\.js/);
  assert.match(packageJson.scripts['db:demo-reset'], /seeds\/seed\.js/);
  const catalogSeed = fs.readFileSync(path.join(__dirname, '../src/db/seeds/catalogDemo.js'), 'utf8');
  assert.match(catalogSeed, /ON CONFLICT \(email\) DO NOTHING/);
  assert.match(catalogSeed, /ON CONFLICT \(label\) DO NOTHING/);
  assert.match(catalogSeed, /ON CONFLICT \(course_id, professor_id, academic_term_id, department_id, section\)\s+DO NOTHING/);
  assert.doesNotMatch(catalogSeed, /DELETE FROM feedback_submissions|DELETE FROM course_offerings|UPDATE course_offerings/);
});

test('catalog contract accepts department/semester eligibility shape and rejects legacy payloads', () => {
  assert.equal(validateCatalogOfferings([offering]), true);
  assert.equal(validateCatalogOfferings([]), true);
  assert.equal(validateCatalogOfferings([{ id: 'old-api', courseCode: 'IT101', term: 'Semester 1' }]), false);
  assert.equal(validateCatalogOfferings([{ ...offering, eligibleDepartments: [{ code: 'IT' }] }]), false);
  assert.equal(validateCatalogOfferings({ data: [offering] }), false);
});

test('production provisioner rejects missing/weak credentials before opening a database connection', async () => {
  const previous = process.env.PROF_PASSWORD;
  try {
    delete process.env.PROF_PASSWORD;
    await assert.rejects(provisionProductionData(), /unique secret of at least 20 characters/);
    process.env.PROF_PASSWORD = 'short';
    await assert.rejects(provisionProductionData(), /unique secret of at least 20 characters/);
  } finally {
    if (previous === undefined) delete process.env.PROF_PASSWORD;
    else process.env.PROF_PASSWORD = previous;
  }
});

test('IP limiter groups callers sharing a campus NAT address; it is not student identity', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, forceEnable: true });
  const responseFor = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  });
  let firstAllowed = false;
  limiter({ ip: '198.51.100.20' }, responseFor(), () => { firstAllowed = true; });
  const secondResponse = responseFor();
  limiter({ ip: '198.51.100.20' }, secondResponse, () => {});
  assert.equal(firstAllowed, true);
  assert.equal(secondResponse.statusCode, 429);
});

test('API metadata exposes a compatible version and build identifier', () => {
  const metadata = getApiMetadata('commit-abc');
  assert.deepEqual(metadata, { apiVersion: 'v1', buildId: 'commit-abc' });
});
