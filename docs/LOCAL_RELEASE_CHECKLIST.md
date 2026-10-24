# Local Release Gate Checklist (Stage 10)

This checklist verifies that the Student Feedback Analyzer can be built, configured, and run in a clean local environment without relying on undocumented manual fixes or unapproved workarounds.

---

### 1. Environment & Prerequisites

* [x] **Runtime Versions Documented**:
  - Node.js: `v24.20.0`
  - npm: `11.19.0`
  - Python: `3.14.6`
  - PostgreSQL: `18.4 (x86_64-windows)`
  - Frontend: React `^19.0.0`, Vite `^6.1.0`
  - Backend: Express `^4.21.2`, pg `^8.13.3`, zod `^3.24.2`
  - NLP Microservice: FastAPI `0.143.0`, Uvicorn `0.54.0`, Pydantic `2.14.0`
* [x] **Environment Variables Documented**:
  - Root template: `.env.example` contains complete configuration variables.
  - Fail-fast production validation in `backend/src/config/env.js`.
* [x] **Secrets Hygiene**:
  - Zero plaintext passwords or private keys in repository code or bundles.
  - `.env` files strictly ignored in `.gitignore`.

---

### 2. Database & Migrations

* [x] **Clean Database Creation**:
  - Verified creation of new isolated PostgreSQL database (`test_release_gate`).
* [x] **Sequential Migration Reproducibility**:
  - All 9 migration scripts applied sequentially without manual SQL intervention:
    1. `001_initial_schema.sql`
    2. `002_indian_semester_terms.sql`
    3. `003_feedback_privacy_and_retries.sql`
    4. `004_department_and_academic_term_catalog.sql`
    5. `005_offering_department_eligibility.sql`
    6. `006_program_year_semesters.sql`
    7. `007_offering_eligibility_tokens.sql`
    8. `008_student_identity_enrollment_and_submission_control.sql`
    9. `009_drop_obsolete_feedback_eligibility_tokens.sql`
  - Result: 13 public tables and 113 relational constraints created.
* [x] **Seed Data Reproducibility**:
  - Verified seed script runs with explicit guard parameters (`ALLOW_DESTRUCTIVE_DEMO_RESET=YES`, `DEMO_RESET_DATABASE=feedback_analyzer`).
  - Realistic, strictly anonymized mock academic data seeded (3 students, 2 professors, 4 enrollments, 14 submissions).

---

### 3. Backend & NLP Services

* [x] **Backend Service Startup**:
  - Starts cleanly via `node backend/src/server.js` on port `5000`.
  - Health probes functional: `GET /health/live` (HTTP 200 alive) and `GET /health/ready` (HTTP 200 ready, database verified).
* [x] **NLP Microservice Startup**:
  - Starts cleanly via `uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000`.
  - Health & Readiness functional: `GET /health` (HTTP 200 healthy, v1.0.0) and `GET /ready` (HTTP 200 ready).
  - Model loads successfully and evaluates sentiment and topics with correct confidence scores.
  - Rejects empty strings (HTTP 422) and oversized payloads > 5000 characters (HTTP 422).

---

### 4. Student Flow Verification

* [x] **Student Authentication**:
  - Login via `POST /api/v1/auth/student/login` returns student profile and signed JWT token.
* [x] **Course Offering Discovery**:
  - `GET /api/v1/student/offerings` returns only offerings for which the student is enrolled, complete with submission status flags (`hasSubmitted`).
* [x] **Feedback Submission**:
  - `POST /api/v1/feedback` accepts all 5 approved rating dimensions and optional comment text.
  - Commits feedback and creates control record in `feedback_submission_control`.
  - Triggered async NLP processing in the background.
* [x] **One-Submission Enforcement**:
  - Subsequent submission attempt for the same course offering is immediately rejected with **HTTP 409 CONFLICT** (`DUPLICATE_SUBMISSION`).
* [x] **Enrollment Enforcement**:
  - Submission attempt for an offering in which the student is not enrolled is rejected with **HTTP 403 FORBIDDEN** or **404 NOT FOUND**.
* [x] **Anonymity Storage**:
  - Feedback record in PostgreSQL contains zero student identifiers (`student_id`, email, or IP address).

---

### 5. Professor Flow & Privacy Verification

* [x] **Professor Authentication**:
  - Login via `POST /api/v1/auth/login` returns professor profile and signed faculty JWT token.
* [x] **Course Offering Discovery**:
  - `GET /api/v1/professor/offerings` returns only assigned course offerings for the authenticated faculty member.
* [x] **Dashboard Analytics Correctness**:
  - `GET /api/v1/dashboard/:courseOfferingId` matches mathematical ground truth of PostgreSQL records (Total responses: 12, Overall average: 3.50, all 5 dimension averages agree).
* [x] **Qualitative Evidence Anonymity**:
  - `GET /api/v1/feedback/:courseOfferingId` returns comments with coarse submission dates (`submittedDate`, `submittedMonth`).
  - Zero student identity attributes leak into the API response or DOM.
* [x] **Cross-Professor IDOR Barrier**:
  - Accessing another professor's course offering returns **HTTP 403 FORBIDDEN**.
* [x] **Small-Cohort Privacy Guard ($N < 5$)**:
  - Course offerings with $N < 5$ return `privacyThresholdMet: false`, suppressing granular rating distributions and withholding qualitative comments.

---

### 6. Security, Hardening & Concurrency

* [x] **SQL Injection**: 100% parameterized SQL; injection probes safely neutralized without database errors.
* [x] **XSS Defense**: Comments stored verbatim; rendered safely via React text nodes; zero `dangerouslySetInnerHTML`.
* [x] **HTTP Headers**: Enforced via `helmet`; `X-Powered-By` stripped.
* [x] **Rate Limiting**: In-process sliding windows enforce 30 req/min general limit and 10 req/15min auth limit.
* [x] **Payload Ceilings**: Express body parser enforces 100kb limit (HTTP 413); comments bounded to 2,000 characters.
* [x] **Concurrency Safety**: 5 simultaneous submission requests from the same student result in exactly 1 HTTP 201 and 4 HTTP 409 conflicts. Exactly 1 control record in DB.
* [x] **Dependency Audits**: 0 vulnerabilities found in `npm audit` across backend and frontend.

---

### 7. Frontend Production Build & Test Suites

* [x] **Production Build**: `npm --prefix frontend run build` completes cleanly with 0 errors (321.78 kB JS, 46.02 kB CSS).
* [x] **Secret Scan**: Production bundle contains no leaked secrets, database URLs, or private keys.
* [x] **Frontend Unit & Component Tests**: 19/19 passing (`npm --prefix frontend test -- --run`).
* [x] **NLP Microservice Tests**: 31/31 passing (`python -m pytest nlp/tests`).
* [x] **Backend Security Audit Tests**: 9/9 passing (`node --test backend/tests/securityAudit.test.js`).
