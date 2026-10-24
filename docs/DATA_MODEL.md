# Domain Model & Database Architecture Specification

Authoritative reference for PostgreSQL schema and persistence for Student Feedback Analyzer.

---

## 1. Relational Entities

### `professors`
* `id` (UUID, Primary Key, `gen_random_uuid()`): Unique identifier.
* `email` (VARCHAR(255), Unique, Not Null): Institutional email.
* `password_hash` (VARCHAR(255), Not Null): Hashed credentials (bcrypt).
* `full_name` (VARCHAR(255), Not Null): Instructor name.
* `created_at` (TIMESTAMPTZ, Default NOW()).

### `courses`
* `id` (UUID, Primary Key): Course subject identifier.
* `code` (VARCHAR(32), Unique, Not Null): Catalog code (e.g., `CS301`).
* `title` (VARCHAR(255), Not Null): Full title.
* `description` (TEXT): Catalog syllabus description.
* `created_at` (TIMESTAMPTZ, Default NOW()).

### `departments`
* `id` (UUID, Primary Key).
* `code` (VARCHAR(16), Unique, Not Null): stable short code such as `CS`.
* `name` (VARCHAR(128), Unique, Not Null).
* `is_active` (BOOLEAN, Default TRUE).

### `academic_terms`
* `id` (UUID, Primary Key).
* `label` (VARCHAR(64), Unique, Not Null): e.g. `Semester 1 2026-27`.
* `academic_year_start` (SMALLINT) and `semester_number` (SMALLINT 1–8): sortable academic-session and program-semester keys. The student's program year is derived as `ceil(semester_number / 2)`; semesters 1–2 are Year 1, 3–4 Year 2, 5–6 Year 3, and 7–8 Year 4.
* Optional start/end dates and feedback open/close timestamps.

### `course_offerings`
* `id` (UUID, Primary Key): Specific academic term delivery.
* `course_id` (UUID, Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE).
* `professor_id` (UUID, Foreign Key $\rightarrow$ `professors.id`, ON DELETE RESTRICT).
* `term` (VARCHAR(64), Not Null): academic semester and year, e.g., `Semester 1 2026-27`.
* `section` (VARCHAR(64), Not Null, Default `General`): section/cohort within the offering.
* `academic_term_id` (UUID, Foreign Key $\rightarrow$ `academic_terms.id`): normalized semester record.
* `department_id` (UUID, Foreign Key $\rightarrow$ `departments.id`): department delivering this course instance.
* `is_active` (BOOLEAN, Default TRUE): Feedback collection window active/closed.
* `created_at` (TIMESTAMPTZ, Default NOW()).
* *Constraint*: `UNIQUE(course_id, professor_id, academic_term_id, department_id, section)`.

Each offering is the exact feedback target. Professors can teach different courses, departments, sections, and semesters because those assignments live on separate offering rows.

### `offering_departments`
* `offering_id` (UUID, Foreign Key to `course_offerings.id`, ON DELETE CASCADE).
* `department_id` (UUID, Foreign Key to `departments.id`, ON DELETE RESTRICT).
* *Primary Key*: `(offering_id, department_id)`.

This mapping lists the student departments eligible to select an offering. It supports cross-listed courses while keeping the teaching department and professor assignment on the offering itself.

### `feedback_submissions`
* `id` (UUID, Primary Key): Anonymous feedback entry.
* `offering_id` (UUID, Foreign Key $\rightarrow$ `course_offerings.id`, ON DELETE CASCADE).
* `rating_clarity` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_pace` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_doubt_handling` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_engagement` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_practical_examples` (INTEGER, CHECK 1 to 5, Not Null).
* `comment_text` (TEXT, CHECK length $\le 2000$, Nullable).
* `analysis_status` (VARCHAR(32), CHECK IN (`not_applicable`, `pending`, `completed`, `failed`), Default `not_applicable`). Failed rows retry automatically with backoff, up to eight attempts.
* `idempotency_key` (UUID, Nullable, Unique when present): deduplicates retried anonymous submissions.
* `analysis_attempts` (INTEGER, Default 0) and `analysis_retry_at` (TIMESTAMPTZ, Default NOW()): schedule retries after NLP failures.
* `created_at` (TIMESTAMPTZ, Default NOW()).
* *Current privacy rule*: Contains NO student ID, student name, email, IP address, user-agent, or personal identifiers.
* *Level 1 Practical Anonymity*: Student identity verifies course enrollment and enforces exactly one submission per student per course offering via `feedback_submission_control`. The feedback submission row in `feedback_submissions` contains no student ID or foreign key to `feedback_submission_control`. Professors cannot view student identities. Privileged database administrators with low-level audit logs could theoretically correlate transaction timestamps; cryptographic unlinkability is not claimed.

### `students`
* `id` (UUID, Primary Key, `gen_random_uuid()`): Unique student identifier.
* `email` (VARCHAR(255), Unique, Not Null): Institutional student email (e.g., `aarav@student.university.edu`).
* `password_hash` (VARCHAR(255), Not Null): Hashed credentials (bcrypt).
* `student_id_number` (VARCHAR(64), Unique, Not Null): Student registration/roll number.
* `full_name` (VARCHAR(255), Not Null): Full name.
* `department_id` (UUID, Foreign Key $\rightarrow$ `departments.id`, ON DELETE RESTRICT): Major academic department.
* `created_at` (TIMESTAMPTZ, Default NOW()).

### `course_enrollments`
* `id` (UUID, Primary Key).
* `student_id` (UUID, Foreign Key $\rightarrow$ `students.id`, ON DELETE CASCADE).
* `course_offering_id` (UUID, Foreign Key $\rightarrow$ `course_offerings.id`, ON DELETE CASCADE).
* `enrolled_at` (TIMESTAMPTZ, Default NOW()).
* *Constraint*: `UNIQUE(student_id, course_offering_id)` guarantees a student is enrolled at most once per offering.

### `feedback_submission_control`
* `id` (UUID, Primary Key).
* `student_id` (UUID, Foreign Key $\rightarrow$ `students.id`, ON DELETE CASCADE).
* `course_offering_id` (UUID, Foreign Key $\rightarrow$ `course_offerings.id`, ON DELETE CASCADE).
* `submitted_at` (TIMESTAMPTZ, Default NOW()).
* *Constraint*: `UNIQUE(student_id, course_offering_id)` enforces exactly one submission per student per course offering.
* *Privacy Boundary*: Contains NO reference or foreign key to `feedback_submissions.id`. Professors cannot access this table.

*(Note: The legacy `feedback_eligibility_tokens` table has been dropped via migration 009 in favor of authenticated student enrollment and submission control).*

### `feedback_sentiment` (1:1 with `feedback_submissions`)
* `submission_id` (UUID, PK & FK $\rightarrow$ `feedback_submissions.id`, ON DELETE CASCADE).
* `label` (VARCHAR(16), CHECK IN (`positive`, `neutral`, `negative`), Not Null).
* `score` (REAL, CHECK 0.0 to 1.0, Not Null).
* `analyzed_at` (TIMESTAMPTZ, Default NOW()).

### `feedback_topic_mention` (1:N with `feedback_submissions`)
* `id` (UUID, Primary Key).
* `submission_id` (UUID, Foreign Key $\rightarrow$ `feedback_submissions.id`, ON DELETE CASCADE).
* `topic_key` (VARCHAR(64), Not Null): Controlled taxonomy key (`teaching_clarity`, `practical_examples`, etc.).
* `confidence` (REAL, CHECK 0.0 to 1.0, Not Null).
* *Constraint*: `UNIQUE(submission_id, topic_key)`.

---

## 2. Integrity Constraints & Foreign Key Rules

* **Ratings**: Enforced row-level `CHECK (rating_... BETWEEN 1 AND 5)` across all 5 dimensions.
* **Deletion Cascades**:
  - Dropping an offering deletes all associated submissions (`ON DELETE CASCADE`).
  - Dropping a submission automatically cleans up child sentiment and topic rows (`ON DELETE CASCADE`).
  - Deleting a professor is blocked (`ON DELETE RESTRICT`) if active course offerings exist.

---

## 3. Targeted Indexes

1. `idx_course_offerings_prof`: Accelerates finding offerings for a logged-in instructor.
2. `idx_feedback_offering`: Primary index powering all dashboard aggregate queries.
3. `idx_feedback_pending_analysis`: Partial index (`WHERE analysis_status IN ('pending', 'failed')`) for unanalyzed retry workers.
4. `idx_topic_mentions_lookup`: Speeds up topic count groupings and topic-filtered evidence queries.

---

## 4. Migration & Seeding Commands

```bash
# Run versioned migrations
npm --prefix backend run db:migrate

# Add development demo catalog without changing existing rows or feedback
npm --prefix backend run db:seed

# Destructive local demo reset (requires explicit environment/database confirmation)
npm --prefix backend run db:demo-reset
```
