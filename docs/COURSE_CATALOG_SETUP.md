# Course Catalog Setup

The student feedback form lists offerings created in `course_offerings`. Each row is one exact teaching assignment: one course, professor, academic term, teaching department, and section. A feedback response stores only that row's offering ID.

## Provisioning an offering

Run the production provisioner for a professor and a set of courses. Set the department, semester, and section for that assignment. `PROVISION_COURSES_JSON` can replace the sample catalog, and a course can list the student departments eligible to select it.

Example configuration values:

```text
PROF_EMAIL=professor@university.edu
PROF_NAME=Dr. Example
ACADEMIC_DEPARTMENT_CODE=IT
ACADEMIC_DEPARTMENT_NAME=Information Technology
ACADEMIC_TERM=Semester 1 2026-27
ACADEMIC_SECTION=A
PROVISION_COURSES_JSON=[{"code":"IT204","title":"Database Systems","desc":"Database design and SQL","eligibleDepartments":[{"code":"IT","name":"Information Technology"},{"code":"CS","name":"Computer Science"}]}]
```

The department and semester describe where and when the class is taught. `eligibleDepartments` describes which student departments can find it. If omitted, the offering is available to students in its teaching department. Keep credentials in the deployment secret store; do not commit them to the repository.

Run the provisioner separately for each professor/term/department assignment. The uniqueness key includes course, professor, term, department, and section, so parallel sections and cross-department teaching remain separate feedback targets.

## Local demo catalog

After migrations, run `npm --prefix backend run db:seed` to add the example CSE and IT departments, program semesters 1–8 for two academic sessions, demo faculty accounts, offerings across all four study years, and one cross-listed CSE course visible to IT students. This command is additive: conflicts preserve existing department names, term windows, professor credentials, course details, and offering state; feedback is never touched. `db:catalog-demo` is an alias for the same command.

Demo faculty accounts use `SecurePassword123!` only for a local development fixture. Set `DEMO_FACULTY_PASSWORD` to a unique local value before seeding if desired. The catalog command never logs the password and never changes the password of an existing professor account. Do not use demo credentials outside local development.

The destructive fixture reset is separate: `npm --prefix backend run db:demo-reset`. It is blocked unless `NODE_ENV` is explicitly `development` or `test`, `ALLOW_DESTRUCTIVE_DEMO_RESET=YES`, and `DEMO_RESET_DATABASE` exactly matches the configured database name. The reset also checks `current_database()` before deleting anything. It erases feedback and course/catalog demo rows; do not use it on shared or production data.

| Faculty | Login | Example assignment |
| --- | --- | --- |
| Prof. Kavya Menon | `kavya.menon@university.edu` | CSE DBMS section B; IT Web Systems |
| Prof. Arjun Mehta | `arjun.mehta@university.edu` | IT Foundations across current and past semesters |

## Student selection and feedback attribution

The public catalog returns only active offerings with an open collection window. The form filters by program year, semester, the student's department, and course. Program year comes from the semester pair (1–2, 3–4, 5–6, 7–8), while academic session remains an independent label. It asks for professor/section when several assignments match. The submission sends the selected `courseOfferingId`; the API resolves all other context from that record.

## Dashboard scope

Faculty dashboards remain scoped to the professor's own offerings. Each offering has independent counts and privacy thresholds. Cross-listed students' feedback contributes to the same exact class offering, not to a department-wide or professor-wide pool.

## One-time feedback eligibility

Each enrollment receives one token for its exact offering (course, semester, and section). The recommended issuing authority is the registrar using an authoritative roster; course staff should not create or reuse shared tokens. After migrations, configure a stable production `FEEDBACK_ELIGIBILITY_PEPPER`, then run from `backend/`:

```text
npm run tokens:issue -- --offering <course-offering-uuid> --roster <secured-roster.txt> --output <secured-token-distribution.csv>
```

The UTF-8 roster contains one student ID per line. The issuer normalizes IDs, rejects duplicate IDs and repeat issuance for the same student/offering, and writes the token distribution file only if the destination does not already exist. The CSV carries both student IDs and bearer tokens: use an institution-approved individual delivery method, restrict access, and delete the file and source roster per registrar retention policy. Database records hold only a token hash and offering-scoped keyed student pseudonym. Feedback submissions have no link to eligibility rows; faculty views cannot access them. This protects identity from professors, but privileged system operators with roster and pepper access may still infer eligibility information.

Tokens are one-use and are consumed atomically with feedback creation. A network retry using the same idempotency key returns the original acceptance. If a token is lost or already used, the student must contact the course office for a replacement; do not issue another token to an already-issued student without an approved recovery process.
