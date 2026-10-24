# Engineering Architecture Decisions Log

## ADR-001: Separation of Express Backend and NLP Analytical Subsystem
- **Status**: Approved & Implemented
- **Context**: The application requires high-performance transaction processing for student feedback persistence, along with statistical NLP for comment categorization.
- **Decision**: Express.js with PostgreSQL handles transactions, schema migrations, and secure API routing. Python handles NLP modeling. The two systems interact via clean REST API boundaries.

## ADR-002: No Direct Student Identity in Feedback Records
- **Status**: Approved & Implemented
- **Context**: Student feedback must be authentically anonymous to encourage honest reporting.
- **Decision**: No `student_id`, IP address, user-agent, browser fingerprint, or eligibility token is stored in a feedback record. Requests containing unexpected identity headers or body fields are rejected (HTTP 422). A separate restricted eligibility table holds an offering-scoped HMAC roster pseudonym and token-use timestamp, without a feedback submission foreign key. This is anonymity from professors, not from privileged operators who may have roster and pepper access.

## ADR-003: Pure-Python Classical NLP Pipeline (Zero C-Extension Dependency)
- **Status**: Approved & Implemented (Stage 14)
- **Context**: The Windows host environment enforces Windows Application Control policies that block compiled C/Cython binary DLLs (such as those bundled with binary wheels of scikit-learn).
- **Decision**: Implement classical Multinomial Naive Bayes and Binary Relevance classification using pure Python standard library (`math`, `collections`, `re`, `json`). This provides 100% deterministic reproducibility, zero OS policy blockers, instant execution (<60ms), and full JSON serializability of learned model parameters.

## ADR-004: Multi-Label Topic Classification with Zero-Topic Support
- **Status**: Approved & Implemented (Stage 14)
- **Context**: A single feedback comment can discuss multiple aspects (e.g., both pacing and assignments), or discuss no specific aspect (e.g., general praise).
- **Decision**: Model topics as independent binary classifiers across the 7 approved categories with decision threshold $\tau = 0.40$ and keyword overlap priors. Feedback lacking pedagogical topic evidence produces an empty array (`[]`).

## ADR-005: Handling Mixed Sentiment
- **Status**: Approved & Implemented (Stage 14)
- **Context**: Comments may exhibit both positive and negative clauses.
- **Decision**: Adhere strictly to the approved 3-state sentiment taxonomy (`positive`, `neutral`, `negative`). Annotators and the classifier assign the dominant primary sentiment. No fourth "mixed" state is introduced.

## ADR-006: Aggregation Privacy Guard ($N \ge 5$)
- **Status**: Approved & Implemented (Stage 13)
- **Context**: Small cohorts risk deanonymizing students through distinctive ratings or comments.
- **Decision**: The dashboard endpoint masks ratings and sentiment distributions when offering response count $N < 5$, returning zero feedback comments.

## ADR-007: Isolated In-Memory Python Inference Microservice
- **Status**: Approved & Implemented (Stage 15)
- **Context**: NLP inference must be cleanly decoupled from transactional database operations and runnable independently.
- **Decision**: Deploy FastAPI with lifespan model warming that loads JSON model artifacts into memory once on startup. The service enforces strict Pydantic schemas, forbids unexpected client metadata, disables CORS, logs zero sensitive comment text, and returns sub-millisecond predictions.

## ADR-008: Asynchronous NLP Execution with Database Transaction Decoupling
- **Status**: Approved & Implemented (Stage 16)
- **Context**: Feedback submissions must not fail or hang due to temporary NLP microservice outages or latency spikes.
- **Decision**: Student feedback and ratings persist immediately in an atomic PostgreSQL transaction with `analysis_status = 'pending'`. NLP analysis is dispatched asynchronously outside the submission transaction boundary via `setImmediate` with bounded timeout (2000ms). NLP results are validated by Express with Zod before being persisted in a secondary transaction (`analysis_status = 'completed'`). If NLP fails, the submission remains intact and `analysis_status` transitions to `'failed'`, enabling idempotent background recovery without data loss.

## ADR-009: Professor Authentication & Course Offering Authorization Boundary
- **Status**: Approved & Implemented (Stage 18)
- **Context**: Faculty members need access to analytical dashboards and student comments for their assigned courses, while student submission must remain decoupled and anonymous to professors.
- **Decision**: Authenticate professors using email and bcrypt-hashed passwords (`POST /api/v1/auth/login`), issuing signed 24-hour JWT tokens (`Authorization: Bearer <token>`) with payload `{ professorId: uuid, email: string }`. Protect analytical endpoints (`GET /api/v1/dashboard/:id`, `GET /api/v1/feedback/:id`, `GET /api/v1/professor/offerings`) with server-side middleware (`authenticateToken` and `requireOfferingOwnership`). Authorization is strictly enforced by querying PostgreSQL to guarantee `course_offerings.professor_id == token.professorId`; cross-professor access is rejected with HTTP 403 Forbidden. Student submission (`POST /api/v1/feedback`) is public without account login but requires the one-time eligibility token in ADR-012; professors cannot inspect eligibility records.

## ADR-010: Full-System Integration, Aggregation Integrity & Temporal Privacy Verification
- **Status**: Approved & Implemented (Stage 20)
- **Context**: Before proceeding to production hardening, the entire connected application topology (Student UI → Express API → PostgreSQL → Python NLP → PostgreSQL → Professor Dashboard) must be verified for architectural consistency, mathematical aggregation accuracy, avoidance of SQL Cartesian explosion, anonymity from professors, and strict cross-professor isolation.
- **Decision**: 
  1. **Decoupled Asynchronous NLP**: Feedback submission persistence (`201 Created`) is never blocked by or coupled to NLP microservice availability. Submissions safely persist with `analysis_status = 'pending'` or `'failed'`, recoverable via background sweeping.
  2. **SQL Join Decoupling**: Dashboard queries calculate response counts, dimensional averages, sentiment distributions, and topic frequencies across distinct queries, preventing row inflation from 1:N `feedback_topic_mention` relations.
  3. **Temporal Privacy Enforcement**: Qualitative evidence views strictly truncate timestamps to `YYYY-MM-DD`, preventing fine-grained timing correlation attacks against anonymous submissions.
  4. **Privacy Guard ($N < 5$)**: Course offerings with fewer than 5 submissions return `privacyThresholdMet: false` and empty arrays for performance dimensions and topic breakdowns.
  5. **Strict Horizontal Isolation**: Backend middleware enforces course offering ownership at the database level, blocking cross-professor dashboard and comment inspection with HTTP 403 Forbidden.

## ADR-011: Production Hardening, Defensive Headers, Rate Limiting & Fail-Fast Configuration
- **Status**: Approved & Implemented (Stage 21)
- **Context**: Preparing the Student Feedback Analyzer for deployment requires defense-in-depth against credential stuffing, DoS/resource exhaustion, insecure environment fallbacks, and information disclosure.
- **Decision**:
  1. **Fail-Fast Environment Validation**: Zod configuration strictly validates `NODE_ENV === 'production'`, immediately halting process boot if `JWT_SECRET` is shorter than 32 characters or uses the development fallback, if `DATABASE_URL` uses default local credentials, or if `FRONTEND_URL` is configured with localhost.
  2. **Defensive Security Headers**: Express sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';`, and `Strict-Transport-Security: max-age=31536000; includeSubDomains` in production, while suppressing `X-Powered-By`.
  3. **In-Memory Rate Limiting**: Implemented lightweight, zero-dependency token/window rate limiters with automatic memory eviction for authentication (`POST /api/v1/auth/login`, 10 req/15 min) and feedback submission (`POST /api/v1/feedback`, 30 req/min).
  4. **Strict Request Boundaries**: Express limits JSON request bodies to `100kb` (returning HTTP 413 `PAYLOAD_TOO_LARGE`) and enforces a 2,000 character maximum across frontend, backend, database constraints, and NLP microservice.
  5. **Separate Liveness and Readiness Probes**: Implemented `GET /health/live` (lightweight process liveness) and `GET /health/ready` (PostgreSQL connection pool validation), matching container orchestrator semantics.

## ADR-012: One-Time Registrar Token Per Exact Offering (Deprecated)
- **Status**: Superseded by ADR-013
- **Context**: The user required at most one feedback response per student for a course while keeping students anonymous to professors.
- **Decision**: Historically used an out-of-band bearer token system with HMAC roster pseudonyms. Superseded by ADR-013 in favor of authenticated student login, database enrollment verification, and submission control.

## ADR-013: Student Authentication, Course Enrollment Verification, and Level 1 Practical Anonymity
- **Status**: Approved & Implemented (Migration Complete)
- **Supersedes**: ADR-012
- **Context**: The bearer token issuance system introduced administrative friction (distributing individual 32-character tokens out-of-band) while not integrating directly with institutional enrollment records.
- **Decision**:
  1. **Application-Managed Student Authentication**: Students authenticate via email and password (`POST /api/v1/auth/student/login`), receiving signed 24-hour JWT tokens (`role: student`).
  2. **Course Enrollment Verification**: `POST /api/v1/feedback` verifies that the student is actively enrolled in the requested course offering in `course_enrollments` (HTTP 403 `STUDENT_NOT_ENROLLED`).
  3. **One-Submission-Per-Offering Enforcement**: Enforced atomically via unique constraint `UNIQUE(student_id, course_offering_id)` in `feedback_submission_control` (HTTP 409 `ALREADY_SUBMITTED`). Feedback cannot be edited or resubmitted.
  4. **Anonymous Feedback Persistence**: `feedback_submissions` stores ratings and comments with zero student identifier (`student_id`, email, name, or account link). Neither table references the other's primary key.
  5. **Level 1 Practical Anonymity**: Course instructors and normal application APIs cannot view student identity. Privileged database/application administrators with access to low-level transaction logs could theoretically correlate activity timestamps; cryptographic unlinkability is not claimed.
  6. **Complete Retirement of Legacy Token System**: Dropped `feedback_eligibility_tokens` table via migration 009, removed `FEEDBACK_ELIGIBILITY_PEPPER`, removed legacy CLI scripts and repositories, and updated the student frontend to reflect enrolled courses and clear submission status.






