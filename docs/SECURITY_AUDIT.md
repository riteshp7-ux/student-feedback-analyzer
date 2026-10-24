# Production Hardening, Security & Reliability Audit (Stage 9)

**Date**: 2026-10-10  
**Status**: `SECURITY HARDENING PASS`  
**Scope**: Full-stack audit across Backend (Express/Node.js), Frontend (React/Vite), NLP Microservice (FastAPI/Python), Database (PostgreSQL 16), authentication, authorization, privacy boundary, input validation, concurrency, dependencies, and operational readiness.

---

## 1. Threat Model & Security Posture

The Student Feedback Analyzer is evaluated against five concrete adversarial threat actors operating within higher education environments:

1. **External Attacker**:
   - *Goal*: Exploit public web endpoints to compromise infrastructure, exfiltrate private institutional feedback, flood services, or inject malicious payloads.
   - *Mitigations*: Strict CORS whitelist, defensive HTTP security headers (`nosniff`, `DENY`, `CSP`, HSTS in production), disabled `X-Powered-By`, in-process rate limiters (30 req/min general, 10 req/15min auth), 100kb request body size limits, 100% parameterized SQL queries, zero exposure of internal database IDs or stack traces.
   - *Audit Status*: **VERIFIED**.

2. **Malicious / Curious Student**:
   - *Goal*: Submit multiple feedback responses to skew ratings, submit feedback for courses they are not enrolled in, discover identities of peer submitters, or compromise professor dashboards.
   - *Mitigations*: Enforced student authentication via institutional JWT; strict server-side enrollment verification before submission acceptance; composite unique constraint `(student_id, course_offering_id)` on `feedback_submission_control` preventing duplicate submissions; 401/403 authorization barriers preventing student tokens from accessing faculty analytics endpoints (`GET /api/v1/dashboard/:id`, `GET /api/v1/feedback/:id`); raw comments rendered safely without XSS.
   - *Audit Status*: **VERIFIED**.

3. **Malicious / Curious Professor**:
   - *Goal*: Identify which specific student provided critical feedback, or access ratings/comments for courses taught by other faculty colleagues (IDOR).
   - *Mitigations*: Zero student foreign key or identifier in `feedback_submissions`; zero linkage between `feedback_submission_control` and `feedback_submissions`; timestamp truncation to coarse date (`YYYY-MM-DD`); $N \ge 5$ privacy threshold hiding ratings and comments in small cohorts; server-side ownership checks (`requireOfferingOwnership`) returning HTTP 403 `FORBIDDEN` when accessing unauthorized course offering IDs.
   - *Audit Status*: **VERIFIED**.

4. **Compromised Account (Stolen JWT / Credentials)**:
   - *Goal*: Impersonate another student or professor to view or alter data.
   - *Mitigations*: Bcrypt hashing (10 salt rounds); uniform credential verification timing preventing username enumeration; signed HMAC-SHA256 tokens bounded to 24-hour expiration; strict role checks (`role: 'student'` vs `role: 'faculty'`); feedback submissions are immutable (no edit/update endpoint exists anywhere in the API).
   - *Audit Status*: **VERIFIED**.

5. **Database Intruder / Compromise (Level 1 Practical Anonymity)**:
   - *Goal*: Correlate raw database rows to identify student authors.
   - *Mitigations*: Schema design decouples student identity completely. The `feedback_submissions` table contains only `(id, course_offering_id, teaching_score, ..., comment_text, created_at)`. No student ID, name, or IP exists in that table. Even with full read access to tables, feedback submissions cannot be joined to students via relational keys.
   - *Known Scope Limit*: Under Level 1 Practical Anonymity, a root database administrator inspecting low-level PostgreSQL WAL/transaction logs with millisecond timestamps could theoretically correlate transaction execution order. Cryptographic zero-knowledge unlinkability is not claimed.
   - *Audit Status*: **VERIFIED**.

---

## 2. Authentication Hardening & Identity Verification

* **Password Security**:
  - Algorithm: `bcrypt` with work factor 10.
  - Implemented in: `backend/src/modules/auth/authService.js` and `backend/src/modules/student/studentService.js`.
  - Passwords and password hashes are never logged, never returned in API payloads, and never cached.
  - Audit Status: **VERIFIED**.
* **Account Enumeration Defense**:
  - Nonexistent email addresses and incorrect passwords execute uniform timing paths and return identical error structures (`401 INVALID_CREDENTIALS`, *"Invalid institutional email or password."*).
  - Verified by automated test: `Security Audit: Nonexistent email and wrong password yield identical 401 error`.
  - Audit Status: **VERIFIED**.
* **Token Architecture**:
  - Transport: `Authorization: Bearer <token>`.
  - Signature: HMAC-SHA256 (`jsonwebtoken`).
  - Production enforcement: Fails startup immediately if `JWT_SECRET` is missing or under 32 characters (`backend/src/config/env.js`).
  - Expiration: Fixed 24-hour lifetime. Expired or tampered tokens return HTTP 401 `TOKEN_EXPIRED` or `INVALID_TOKEN`.
  - Separation: Distinct student tokens (`role: 'student'`) and faculty tokens (`role: 'faculty'`).
  - Audit Status: **VERIFIED**.

---

## 3. Authorization & Insecure Direct Object Reference (IDOR) Audit

* **Object-Level Access Control**:
  - Middleware: `requireOfferingOwnership('courseOfferingId')` in `backend/src/middleware/auth.js`.
  - Verification: Queries `course_offerings` ensuring `professor_id === req.user.professorId`.
  - Behavior on unauthorized access: Returns HTTP 403 `FORBIDDEN` with code `FORBIDDEN_RESOURCE`.
  - Behavior on non-existent offering UUID: Returns HTTP 404 `NOT_FOUND` with code `RESOURCE_NOT_FOUND`.
  - Behavior on student attempting professor endpoint: Returns HTTP 403 `FORBIDDEN`.
  - Behavior on missing token: Returns HTTP 401 `UNAUTHORIZED`.
* **Empirical Verification**:
  - `GET /api/v1/dashboard/:id` with Professor Desai accessing Professor Sharma's course (CS301) yields **HTTP 403 FORBIDDEN** (Verified).
  - `GET /api/v1/feedback/:id` with Professor Desai accessing Professor Sharma's course (CS301) yields **HTTP 403 FORBIDDEN** (Verified).
  - Automated test: `GET /api/v1/dashboard/:id - Forbidden` and `GET /api/v1/feedback/:id - Forbidden` passing cleanly.
  - Audit Status: **VERIFIED**.

---

## 4. Input Validation & Request Boundaries

* **Payload Ceiling (DoS Mitigation)**:
  - Express JSON body parser explicitly configured: `express.json({ limit: '100kb' })`.
  - Payloads exceeding 100kb are aborted by body-parser before routing, returning **HTTP 413 Payload Too Large**.
  - Verified by test: `Security Audit: Rejects oversized JSON payload exceeding 100kb limit (413 Payload Too Large)`.
  - Audit Status: **VERIFIED**.
* **Character Limits & Field Lengths**:
  - Comment text strictly validated to 2,000 characters maximum across four defensive rings:
    1. Frontend UI (`CommentField.jsx` character counter with hard cut-off).
    2. Backend validator (`feedbackValidator.js` rejecting comments > 2000 chars with HTTP 422 `VALIDATION_ERROR`).
    3. Database column constraint (`VARCHAR(2000)` / `TEXT` length check).
    4. Python NLP service validator (`InferenceRequest` text length bounds).
  - Verified by test: `Security Audit: Strictly enforces 2000 character maximum on feedback comments`.
  - Audit Status: **VERIFIED**.
* **Query Parameter Allowlisting**:
  - Sentiment filter strictly permits `positive`, `neutral`, `negative`. Malformed or injection inputs return HTTP 422 `VALIDATION_FAILED`.
  - Topic filter strictly permits approved schema enum topics (`teaching_clarity`, `teaching_pace`, `practical_examples`, `doubt_handling`, `engagement`, `assignments`, `course_content`).
  - Audit Status: **VERIFIED**.

---

## 5. SQL Injection Resilience

* **Parameterized Queries**:
  - 100% of all database queries in the application use PostgreSQL positional parameters (`$1`, `$2`, etc.) through `pg.Pool.query`.
  - Zero dynamic SQL string concatenations or template literal interpolations into SQL clauses exist in the repository.
* **Filter Parameter Robustness**:
  - Tested payloads: `cs301' OR '1'='1`, `'; DROP TABLE feedback_submissions; --`, `positive' UNION SELECT * FROM users --`.
  - All injection attempts either fail JSON schema validation (HTTP 422) or pass as harmless string literal parameter values that match zero records without causing SQL syntax errors.
  - Verified by test: `Security Audit: Rejects SQL injection attempts in query parameters without DB errors`.
  - Audit Status: **VERIFIED**.

---

## 6. Cross-Site Scripting (XSS) & Content Injection

* **Storage Safety**:
  - Comments containing HTML/script tags (e.g. `<script>alert('XSS')</script>`, `<img src=x onerror=alert(1)>`) are stored verbatim in PostgreSQL as literal text strings without server execution.
* **Rendering Safety**:
  - The React frontend strictly renders comment text through standard React text node interpolation (`<p className="comment-text">"{comment.commentText}"</p>`).
  - The entire frontend codebase contains zero occurrences of `dangerouslySetInnerHTML`, `.innerHTML`, `eval()`, or `document.write()`.
  - React automatically escapes HTML entities, neutralizing script execution in all modern browsers.
* **Audit Status**: **VERIFIED**.

---

## 7. HTTP Headers, CORS & CSRF Defense

* **Security Headers**:
  - `helmet` middleware applied globally:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `X-XSS-Protection: 0`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';`
    - `Cross-Origin-Opener-Policy: same-origin`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (in production)
    - `X-Powered-By` header explicitly stripped via `app.disable('x-powered-by')`.
  - Verified by test: `Security Audit: Enforces defensive security headers and strips X-Powered-By`.
* **CORS Architecture**:
  - Configured in `backend/src/app.js` using `cors`.
  - In production, requests without allowed origins or from non-whitelisted domains are rejected.
  - In development, `localhost:5173` and `127.0.0.1:5173` are permitted.
* **CSRF Analysis**:
  - The application uses stateless Bearer JWT authentication transmitted via standard `Authorization` headers.
  - No credentials or authentication states are stored in ambient browser cookies.
  - Because browsers do not automatically attach Bearer headers on cross-site requests, traditional CSRF attacks are fundamentally inapplicable.
* **Audit Status**: **VERIFIED**.

---

## 8. NLP Microservice Security Boundary

* **Network Isolation**:
  - Bound strictly to loopback interface `127.0.0.1:8000`.
  - Not exposed to the public internet or external reverse proxies.
* **CORS Restriction**:
  - CORS disabled on FastAPI; direct browser invocations are blocked.
* **Input Ceiling**:
  - Rejects text payloads exceeding 5,000 characters with HTTP 422.
* **Error Sanitization**:
  - Internal Python stack traces, model weights paths, and library versions are stripped from responses; client receives clean JSON error responses.
* **Audit Status**: **VERIFIED**.

---

## 9. Reliability, Concurrency & Failure Isolation

* **Asynchronous NLP Isolation**:
  - When a student submits feedback, the feedback record and submission-control entry are committed in a PostgreSQL transaction first.
  - The subsequent HTTP call to the NLP service runs asynchronously in the background.
  - If the NLP service is down (HTTP 503) or times out, the student receives HTTP 201 `CREATED` with `analysis_status: 'failed'`.
  - The feedback submission is never lost or rolled back due to downstream ML latency.
  - Background recovery sweeper (`processPendingBatch`) automatically recovers pending and failed records when NLP availability resumes.
  - Verified by automated test: `E2E Flow 9: NLP outage marks submission failed without student disruption; recovery sweeper processes on restore`.
* **Duplicate Submission Concurrency**:
  - Concurrent duplicate submissions for the same `(student_id, course_offering_id)` trigger a PostgreSQL unique constraint violation (`23505`).
  - The backend catches the unique violation in `feedbackService.js` and cleanly maps it to **HTTP 409 CONFLICT** (`DUPLICATE_SUBMISSION`).
  - Zero duplicate records can be created under high concurrency.
* **Transaction Rollback Integrity**:
  - In `feedbackService.submitFeedback`, operations execute within `BEGIN ... COMMIT` blocks.
  - If any failure occurs during database insertion, an explicit `ROLLBACK` executes, leaving database state completely untainted.
* **Audit Status**: **VERIFIED**.

---

## 10. Dependency Vulnerability Audit

* **Backend Dependencies**:
  - Command: `npm --prefix backend audit`
  - Result: **0 vulnerabilities** found.
* **Frontend Dependencies**:
  - Command: `npm --prefix frontend audit`
  - Result: **0 vulnerabilities** found.
* **Lockfile Integrity**:
  - `package-lock.json` files present and consistent across both `backend` and `frontend`.
* **Audit Status**: **VERIFIED**.

---

## 11. Secrets Management & Environment Hygiene

* **Source Code Scan**:
  - Scanned all repository files for hardcoded passwords, API keys, and production private keys.
  - Zero plaintext secrets found in version control.
  - `.env` files are properly listed in `.gitignore` and excluded from repository commits.
  - `.env.example` provides parameter names and placeholder instructions without secret exposure.
* **Fail-Fast Boot Checks**:
  - In `backend/src/config/env.js`, when `NODE_ENV === 'production'`:
    - Application immediately throws and refuses to boot if `JWT_SECRET` is unset, uses the default fallback string, or has fewer than 32 characters.
    - Rejects default local database URLs (`postgres:postgres@localhost`).
    - Enforces explicitly defined `FRONTEND_URL`.
* **Audit Status**: **VERIFIED**.

---

## 12. Privacy, Logging & Telemetry Audit

* **Comment Redaction in Logs**:
  - Express logger and Python FastAPI service log only operational metrics: `duration`, `sentiment`, `topics` count, and `submissionId`.
  - Raw student feedback comment text is never written to console logs, log files, or error messages.
* **Temporal Discretization**:
  - Professor-facing feedback API returns coarse dates (`YYYY-MM-DD` via PostgreSQL `TO_CHAR(created_at, 'YYYY-MM-DD')`).
  - Exact submission timestamps (hours, minutes, seconds) are stripped to prevent correlating submissions with class exit times.
* **Cohort Privacy Guard ($N \ge 5$)**:
  - When fewer than 5 students have submitted feedback for a course offering, the dashboard API redacts granular rating breakdowns and withholds comment text, returning `privacyThresholdMet: false`.
  - Protects student confidentiality in small seminar cohorts.
* **Audit Status**: **VERIFIED**.

---

## 13. Health Probes & Operational Readiness

* **Liveness Probe**:
  - `GET /health/live` returns HTTP 200 `{ status: "ok", uptime: ... }` immediately without hitting downstream dependencies.
* **Readiness Probe**:
  - `GET /health/ready` executes a lightweight query (`SELECT 1`) against PostgreSQL and checks NLP service reachability, returning HTTP 200 when ready and HTTP 503 if the database is unreachable.
* **Verified by test**: `Security Audit: /health/live returns immediate 200; /health/ready probes DB connectivity`.
* **Audit Status**: **VERIFIED**.

---

## 14. Remaining Non-Blocking Operational Recommendations

1. **Multi-Replica Rate Limiting**:
   - The current rate limiting store is in-memory. For multi-replica horizontal autoscaling behind a load balancer, rate limits operate per instance. Recommendation: Deploy an API gateway or ingress rate limiter in high-scale multi-replica production.
2. **Reverse Proxy Configuration**:
   - `TRUST_PROXY_HOPS` is defaulted to `0`. Production deployments behind Nginx or AWS ALB should set `TRUST_PROXY_HOPS` to match the exact hop count to prevent IP spoofing while avoiding throttling shared institutional networks.
3. **Student Self-Identification**:
   - The system mathematically decouples student identity from feedback data; however, students may voluntarily write identifying personal details in free-text comments. The frontend prominently displays warning guidance advising students against writing personal names or identifiable references.

---

## 15. Audit Verification Summary

| Component / Invariant | Status | Evidence |
| :--- | :---: | :---: |
| Student Authentication & Enrollment Verification | **VERIFIED** | Auth middleware + enrollment check in `studentService.js` |
| One-Submission-Per-Offering Rule | **VERIFIED** | Unique constraint on `feedback_submission_control` |
| Level 1 Practical Anonymity Storage | **VERIFIED** | `feedback_submissions` decoupled from students |
| Professor IDOR Protection & Authorization Barriers | **VERIFIED** | `requireOfferingOwnership` returns HTTP 403 / 401 |
| Input Boundaries (100kb payload, 2000 char comments) | **VERIFIED** | Express JSON limit + validator test passed |
| SQL Injection Resilience | **VERIFIED** | 100% parameterized queries, injection tests passed |
| XSS Protection | **VERIFIED** | React text interpolation, zero `dangerouslySetInnerHTML` |
| Security Headers & Power By Stripping | **VERIFIED** | Helmet headers active, `X-Powered-By` absent |
| In-Process Rate Limiting | **VERIFIED** | 30 req/min general, 10 req/15min auth, HTTP 429 verified |
| Dependency Vulnerabilities | **VERIFIED** | `npm audit` returned 0 vulnerabilities (backend & frontend) |
| Async NLP Failure Isolation & Recovery | **VERIFIED** | Submission commits first, recovery sweeper verified |
| Health Probes (`/health/live`, `/health/ready`) | **VERIFIED** | Automated live/ready tests passing |

**Conclusion**: All production hardening, security, privacy, and reliability controls are verified and operational.

**Final Audit Result**: `SECURITY HARDENING PASS`
