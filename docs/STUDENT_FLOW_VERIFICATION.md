# Full Student Submission Flow & Architecture Verification Report

**Document Status:** Complete and Verified  
**System:** Student Feedback Analyzer  
**Scope:** Browser to PostgreSQL & Asynchronous NLP Pipeline  
**Privacy Level:** Level 1 Practical Anonymity  

---

## 1. Tested Architecture

The complete student submission architecture was verified end-to-end against live runtime services (React on `:5173`, Express API on `:5000`, FastAPI NLP microservice on `:8000`, and PostgreSQL 16 on `:5432`):

```text
Student
   ↓
Student Authentication (POST /api/v1/auth/student/login)
   ↓
Scoped JWT Session ({ studentId, email, role: 'student' })
   ↓
Enrolled Offerings Query (GET /api/v1/student/offerings)
   ↓
Course Selection & Submission Status Check
   ↓
Feedback Form (5 structured ratings + optional comment)
   ↓
Submission Dispatch (POST /api/v1/feedback)
   ↓
Enrollment Check (course_enrollments)
   ↓
Submission-Control Check & Atomicity (UNIQUE(student_id, course_offering_id))
   ↓
Anonymous Feedback Persistence (feedback_submissions - NO student columns)
   ↓
Commit Transaction
   ↓
Asynchronous NLP Worker Dispatch (POST http://127.0.0.1:8000/analyze)
   ↓
Analysis & Topics Persistence (submission_analysis & submission_topics)
```

### Verification Status Matrix
* **Architecture Integrity:** `VERIFIED`
* **Student Identity Isolation:** `VERIFIED`
* **Zero PII in Feedback Storage:** `VERIFIED`
* **Level 1 Practical Anonymity:** `VERIFIED`

---

## 2. Authentication Flow

* **Endpoint:** `POST /api/v1/auth/student/login`
  * Valid login returns `HTTP 200 OK` with scoped JWT (`role: 'student'`).
  * Invalid password returns `HTTP 401 INVALID_CREDENTIALS`.
  * Unknown email returns generic `HTTP 401 INVALID_CREDENTIALS` (preventing account enumeration).
  * Missing credentials return `HTTP 400 VALIDATION_ERROR`.
  * Brute force mitigation: Protected by `authLimiter` (max 10 requests per 15-minute window), returning `HTTP 429 AUTH_RATE_LIMIT_EXCEEDED` on subsequent attempts.
* **Student Profile:** `GET /api/v1/student/me`
  * Returns authenticated student profile without password hash.
  * URL and query parameter tampering (`?studentId=...`) are ignored; identity is strictly derived from verified JWT session (`req.user.studentId`).
* **Verification Status:** `VERIFIED`

---

## 3. Enrollment Authorization

* **Endpoint:** `GET /api/v1/student/offerings`
  * Accurately filters course offerings by student enrollment (`course_enrollments`).
  * Returns `hasSubmitted: true/false` and timestamp for each enrolled offering.
* **Submission Authorization Guard (`POST /api/v1/feedback`):**
  * **Case A (Enrolled Student):** Can submit feedback for enrolled offering. Returns `HTTP 201 Created`.
  * **Case B (Non-Enrolled Student):** Attempting to submit feedback returns `HTTP 403 Forbidden` (`STUDENT_NOT_ENROLLED`).
  * **Case C (Manipulated Request):** Submitting an unauthorized offering UUID via curl/network request is intercepted by backend enrollment verification and rejected with `HTTP 403 Forbidden`.
* **Verification Status:** `VERIFIED`

---

## 4. One-Submission Enforcement

* **Mechanism:**
  * Enforced at the storage layer via table `feedback_submission_control` with `CONSTRAINT uq_student_offering_submission UNIQUE(student_id, course_offering_id)`.
* **Observations:**
  * First submission for an enrolled offering: `HTTP 201 Created`.
  * Second submission by same student with new idempotency key: `HTTP 409 Conflict` (`ALREADY_SUBMITTED`).
  * Second submission by same student with different payload: `HTTP 409 Conflict` (`ALREADY_SUBMITTED`).
  * Database state: Exactly 1 row exists in `feedback_submission_control` for that `(student_id, course_offering_id)`.
  * UI state: When `hasSubmitted = true`, form controls are disabled and replaced with the banner: *"Feedback Already Submitted — In accordance with university policy, feedback cannot be edited or resubmitted."*
* **Verification Status:** `VERIFIED`

---

## 5. Idempotency Behavior

* **Idempotency vs One-Submission Separation:**
  * **Exact Network Retry:** Replaying identical submission payload with the same idempotency key returns `HTTP 201/200` without inserting a second row into `feedback_submissions` or `feedback_submission_control`.
  * **Key Reused for Different Payload:** Returns `HTTP 409 Conflict` (`IDEMPOTENCY_KEY_REUSED`).
  * **New Submission for Already Submitted Course:** Returns `HTTP 409 Conflict` (`ALREADY_SUBMITTED`).
* **Verification Status:** `VERIFIED`

---

## 6. Transaction Behavior & Concurrency

* **Atomic Transaction Execution:**
  * `feedback_submission_control` claim and `feedback_submissions` insert occur within a single `BEGIN ... COMMIT` block.
* **Failure Simulation:**
  * Injected a database CHECK constraint violation (`rating_clarity = 99`) during feedback insertion.
  * Transaction rolled back cleanly. `feedback_submission_control` records remained at 0.
* **Concurrent Submission Stress Test:**
  * Fired two simultaneous requests (`Promise.all`) for the same student and course offering with distinct idempotency keys.
  * Exactly one request succeeded (`HTTP 201 Created`); the competing request failed atomically with `HTTP 409 Conflict` (`ALREADY_SUBMITTED`) via PostgreSQL error `23505`. Zero duplicate records were created.
* **Verification Status:** `VERIFIED`

---

## 7. Privacy Boundary & Data Isolation

* **Physical Schema Inspection:**
  * `feedback_submissions` columns: `id`, `offering_id`, `rating_clarity`, `rating_pace`, `rating_doubt_handling`, `rating_engagement`, `rating_practical_examples`, `comment_text`, `analysis_status`, `created_at`, `idempotency_key`, `analysis_attempts`, `analysis_retry_at`.
  * Zero student identity columns exist.
* **Decoupled Control Table:**
  * `feedback_submission_control` columns: `id`, `student_id`, `course_offering_id`, `submitted_at`.
  * No foreign key or attribute points to `feedback_submissions` or `submission_id`.
* **Payload Sanitation:**
  * Submissions injecting fields (`studentId`, `email`, `studentName`, `userId`) are rejected with `HTTP 422 VALIDATION_ERROR` by strict Zod schema validation.
* **Verification Status:** `VERIFIED`

---

## 8. NLP Behavior & Resilience

* **Minimal Data Exposure:**
  * The Express backend transmits only `{ text: comment_text }` to `http://127.0.0.1:8000/analyze`.
  * No student metadata, IDs, emails, names, or offering IDs are sent to the NLP microservice.
* **Inference Lifecycle:**
  * Comment submissions are initially persisted with `analysis_status = 'pending'`.
  * Asynchronous worker completes inference in background: sentiment and extracted topics are saved to `submission_analysis` and `submission_topics`. `analysis_status` updates to `'completed'`.
* **Outage Resilience:**
  * Simulated NLP microservice outage (`HTTP 503` / network timeout).
  * The student feedback submission transaction committed safely (`HTTP 201 Created`).
  * `analysis_status` marked `'failed'` with exponential backoff retry timestamp (`analysis_retry_at`).
  * Background recovery sweeper (`processPendingBatch`) automatically processed and resolved failed records upon service restore.
* **Verification Status:** `VERIFIED`

---

## 9. Professor Privacy Verification

* **API Response Audit:**
  * Faculty tokens calling `GET /api/v1/dashboard/:offeringId` and `GET /api/v1/feedback/:offeringId` receive aggregate metrics and qualitative comments with truncated dates (`YYYY-MM-DD`).
  * Recursive key search across responses revealed **zero student identity attributes**.
* **Role Boundary Defense:**
  * Student token attempting faculty dashboard: `HTTP 401 INVALID_TOKEN`.
  * Faculty token attempting student submission: `HTTP 401 INVALID_TOKEN`.
  * Faculty token attempting other professors' courses: `HTTP 403 FORBIDDEN`.
* **Verification Status:** `VERIFIED`

---

## 10. Security Tests

* **SQL Injection Defense:** Parameterized SQL queries in repository layers prevent SQL injection in form inputs and query params (query injection rejected with `HTTP 422`).
* **XSS Defense:** Script tags (`<script>alert(1)</script>`) in written comments are stored safely as inert text strings and rendered without execution in React UI.
* **Input Validation:**
  * Max comment length of 2,000 characters strictly enforced (`HTTP 422`).
  * Numeric ratings capped strictly to integers 1–5 (`HTTP 422`).
* **Expired & Tampered Tokens:**
  * Expired JWT $\rightarrow$ `HTTP 401 UNAUTHORIZED`.
  * Tampered token signature $\rightarrow$ `HTTP 401 UNAUTHORIZED`.
* **Verification Status:** `VERIFIED`

---

## 11. Obsolete Architecture Findings

* **Legacy Bearer / Eligibility Token Subsystem:**
  * Table `feedback_eligibility_tokens` was dropped in Migration 009.
  * Codebase search for `FEEDBACK_ELIGIBILITY_PEPPER`, `feedback_eligibility_tokens`, and bearer eligibility token helpers confirmed complete elimination.
  * Classification: `REMOVE` (Completed and Cleaned).
* **Verification Status:** `VERIFIED`

---

## 12. Browser Tests & Regression Results

* **Automated Suites:**
  * Backend test suite (`npm --prefix backend test`): **104/104 passing** (0 failures).
  * Frontend test suite (`npm --prefix frontend test`): **19/19 passing** (0 failures).
  * Frontend production build (`npm --prefix frontend run build`): **Clean compilation** (0 errors).
  * Live production verifier (`scripts/verify_production.js`): **17/17 passing** (0 failures).
* **Interactive Browser Flow:**
  1. Student login as Diya (`diya@student.university.edu`) $\rightarrow$ authenticated session initialized.
  2. Enrolled offerings loaded $\rightarrow$ `CS301` selected.
  3. Form submission completed with 5 dimension ratings and comment $\rightarrow$ confirmed.
  4. Portal reload $\rightarrow$ `CS301` displayed as *"Submitted"*; resubmission actions disabled.
  5. Faculty login as Dr. Sharma $\rightarrow$ aggregate ratings updated and comment displayed anonymously.
* **Verification Status:** `VERIFIED`

---

## 13. Bugs Found & Fixed

1. **Offering ID Mapping Mismatch:**
   * *Problem:* Backend returned `offeringId`, but frontend component expected `id`.
   * *Severity:* P1.
   * *Root Cause:* Key naming drift between backend SQL aliasing and legacy catalog schema.
   * *Fix:* Added `id: o.offeringId || o.id` normalization in `StudentFeedbackPage.jsx`.
   * *Verification:* Verified course selector populates and pre-selects correctly.
2. **Missing Rate Limiting on Student Sign-In:**
   * *Problem:* `POST /api/v1/auth/student/login` was missing rate limiting.
   * *Severity:* P1.
   * *Root Cause:* Rate limiter was mounted only on faculty login.
   * *Fix:* Mounted `authLimiter` middleware on `POST /api/v1/auth/student/login`.
   * *Verification:* Verified live brute-force rejection returning `HTTP 429`.
3. **Internal Feedback ID Rendered on Confirmation:**
   * *Problem:* `SubmissionSuccess.jsx` rendered internal feedback UUID.
   * *Severity:* P2.
   * *Root Cause:* Legacy receipt display code.
   * *Fix:* Removed receipt ID display; updated confirmation text to state that submission is final.
   * *Verification:* Verified confirmation screen displays only evaluated course title and professor name.

---

## 14. Remaining Risks

* **P0 / P1 / P2:** None.
* **P3 (Non-blocking):** Minor visual styling parity between student and faculty login cards will be addressed in the planned design system phase.

---

## 15. Architectural Questions

* No open architectural questions. All implementations adhere strictly to the approved Level 1 practical anonymity architecture.

---

## Final Status

STUDENT SYSTEM VERIFIED
