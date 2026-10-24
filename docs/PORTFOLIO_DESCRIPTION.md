# Portfolio Project Description & Engineering Summary

---

## 1. Executive Summary (Short Description)
A privacy-preserving academic feedback aggregation and natural language analytics system for higher education. Reconciles authenticated enrollment and a strict one-submission-per-course invariant with Level 1 practical anonymity, delivering asynchronous sentiment and multi-label pedagogical topic classification via an isolated Python NLP microservice and an interactive faculty analytics dashboard.

---

## 2. Technical Architecture & System Overview
Built with a production-grade decoupled architecture:
* **Frontend**: React 19 Single-Page Application (SPA) with Vite. Features responsive, mobile-first student feedback submission forms and an academic faculty dashboard.
* **API Gateway**: Node.js & Express API gateway coordinating authentication, Zod schema validation, horizontal authorization (IDOR prevention), in-process sliding-window rate limiting, and PostgreSQL connection pooling.
* **Persistence Engine**: PostgreSQL 16 relational database enforcing an unlinked data model: student authentication and submission tracking are stored separately from anonymous feedback records with zero foreign key linkage.
* **NLP Analytical Subsystem**: Independent, in-memory Python FastAPI microservice executing pure-Python CountVectorizer feature extraction and Multinomial Naive Bayes classification for 3-class sentiment estimation and 7-class multi-label topic categorization in <2ms.

---

## 3. Key Engineering Challenges & Solutions

### 1. Reconciling Enrollment Verification with Anonymity (Level 1 Practical Anonymity)
* *The Challenge*: Preventing ballot-stuffing and unauthorized voting requires authenticating student identities and verifying course enrollment; however, linking student identity to stored feedback destroys psychological safety.
* *The Engineering Solution*: Designed a decoupled two-table schema architecture. The `feedback_submission_control` table enforces a composite unique constraint `UNIQUE (student_id, course_offering_id)` to record participation. The `feedback_submissions` table stores ratings and comment text with **zero student identifiers**. The two tables have no relational linkage, making database `JOIN`s between students and feedback structurally impossible.

### 2. Zero-Loss Asynchronous NLP Failure Isolation
* *The Challenge*: Natural language inference introduces downstream processing latency and potential microservice failures that should never block student submissions or cause data loss.
* *The Engineering Solution*: Structured feedback submission as a resilient two-phase transaction. Feedback and submission-control records commit to PostgreSQL *before* asynchronous NLP dispatch. If the Python subservice is unreachable or times out, the submission persists safely with `analysis_status: 'failed'`. An idempotent background recovery sweeper polls and processes pending/failed records once service availability restores.

### 3. Small-Cohort Re-Identification Defense ($N < 5$)
* *The Challenge*: In small seminar courses with few enrolled students, granular rating patterns or distinctive comments can easily de-anonymize individual submitters.
* *The Engineering Solution*: Implemented an automated privacy threshold guard in the analytics service. Whenever total course respondents $N < 5$, granular dimension distributions are hidden and written comments are withheld, displaying a transparent informational state until sufficient sample sizes accumulate.

### 4. Horizontal Authorization & IDOR Defense
* *The Challenge*: Preventing authenticated faculty members from accessing ratings and comments for course sections taught by other professors.
* *The Engineering Solution*: Authored server-side `requireOfferingOwnership` middleware verifying `course_offerings.professor_id === req.user.professorId` at the database level. Manipulating offering UUIDs in query parameters or URL paths returns an immediate HTTP 403 Forbidden.

---

## 4. Technologies & Tools

* **Frontend**: React 19, React Router 7, Vite 6, CSS Custom Properties (Accessible Semantic Design System).
* **Backend**: Node.js 24, Express 4.21, Zod 3.24, JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `pg` (node-postgres), `helmet`.
* **NLP & Machine Learning**: Python 3.10+, FastAPI 0.143, Uvicorn, Pydantic 2, Pure-Python CountVectorizer & Multinomial Naive Bayes, Pytest.
* **Database & Infrastructure**: PostgreSQL 16/18, Render PaaS Blueprint (`render.yaml`), Docker/Containerization ready.

---

## 5. Measured Performance & Test Results

* **Automated Test Coverage**: 100% pass rate across all suites:
  - Frontend Component Suite: **19 / 19 passed**
  - Python NLP Evaluation Suite: **31 / 31 passed**
  - Backend Security & Privacy Hardening Suite: **9 / 9 passed**
  - End-to-End Integration Suite: **9 / 9 passed**
* **Inference Speed**: Pure-Python Naive Bayes executes in **<2ms** per feedback comment with zero GPU requirement.
* **NLP Classification Accuracy**: 81.25% sentiment accuracy (0.8139 Macro F1) and 0.1071 Hamming Loss across 7 multi-label pedagogical topics on held-out evaluation test splits.
* **Security & Vulnerability Status**: 0 vulnerabilities found via `npm audit` across full stack.

---

## 6. Concise Resume / LinkedIn Project Bullet Points

```text
Student Feedback Analyzer | React 19, Node.js, Express, PostgreSQL, Python, FastAPI
• Architected a privacy-preserving course evaluation platform reconciling verified enrollment and one-submission-per-course invariants with Level 1 practical anonymity across a decoupled PostgreSQL schema.
• Engineered an isolated Python FastAPI microservice executing pure-Python Multinomial Naive Bayes inference, classifying qualitative student text across 3 sentiment states and 7 pedagogical topics in <2ms.
• Designed an asynchronous submission pipeline that commits feedback transactionally before dispatching ML analysis, isolating downstream inference latency and achieving zero data loss during service downtime.
• Implemented an interactive faculty analytics dashboard featuring mathematical aggregation ground truth, automated small-cohort privacy guards (N < 5), and robust horizontal authorization (IDOR) controls.
• Achieved 100% automated test pass rate across 68 end-to-end, security, and component tests with 0 package vulnerabilities.
```
