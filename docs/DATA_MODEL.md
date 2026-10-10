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

### `course_offerings`
* `id` (UUID, Primary Key): Specific academic term delivery.
* `course_id` (UUID, Foreign Key $\rightarrow$ `courses.id`, ON DELETE CASCADE).
* `professor_id` (UUID, Foreign Key $\rightarrow$ `professors.id`, ON DELETE RESTRICT).
* `term` (VARCHAR(64), Not Null): e.g., `Fall 2026`.
* `is_active` (BOOLEAN, Default TRUE): Feedback collection window active/closed.
* `created_at` (TIMESTAMPTZ, Default NOW()).
* *Constraint*: `UNIQUE(course_id, professor_id, term)`.

### `feedback_submissions`
* `id` (UUID, Primary Key): Anonymous feedback entry.
* `offering_id` (UUID, Foreign Key $\rightarrow$ `course_offerings.id`, ON DELETE CASCADE).
* `rating_clarity` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_pace` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_doubt_handling` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_engagement` (INTEGER, CHECK 1 to 5, Not Null).
* `rating_practical_examples` (INTEGER, CHECK 1 to 5, Not Null).
* `comment_text` (TEXT, CHECK length $\le 2000$, Nullable).
* `analysis_status` (VARCHAR(32), CHECK IN (`not_applicable`, `pending`, `completed`, `failed`), Default `not_applicable`).
* `created_at` (TIMESTAMPTZ, Default NOW()).
* *ANONYMITY RULE*: Contains strictly ZERO student_id, IP address, user-agent, or personal identifiers.

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

# Seed development/demo data
npm --prefix backend run db:seed
```
