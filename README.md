# Student Feedback Analyzer

A university course evaluation and analytics platform that transforms anonymous student feedback into structured, evidence-backed pedagogical insights for professors.

---

## 1. Problem Statement

End-of-semester course evaluations in higher education suffer from two critical breakdowns:
* **Information Overload**: In courses with 50 to 300 students, faculty receive hundreds of qualitative comments. Reading, categorizing, and synthesizing free-text comments manually is time-prohibitive, leading to missed patterns or cherry-picked observations.
* **The Candor-Anonymity Dilemma**: When students doubt institutional anonymity guarantees—fearing that evaluations can be traced through student accounts, submission timestamps, or network metadata—they submit sanitized, unhelpful praise or withhold constructive criticism.
* **Unstructured Feedback**: Numeric Likert scales alone lack context, while written comments lack aggregation. Professors need structured aggregate evidence to make pedagogical adjustments.

---

## 2. Proposed Solution

The **Student Feedback Analyzer** provides a privacy-preserving evaluation lifecycle:
* **Structured Ratings & Qualitative Feedback**: Collects 5 standard pedagogical ratings (1–5 scale) alongside constructive written comments.
* **Deterministic Statistical NLP**: Automatically classifies comment sentiment (`positive`, `neutral`, `negative`) and extracts multi-label pedagogical themes across 7 educational categories.
* **4-Tier Professor Dashboard**: Visualizes executive summaries, dimensional ratings, topic frequencies, and filterable qualitative evidence cards.
* **Strict Anonymity Guarantees**: Enforces zero student tracking at the database and API levels, truncates submission dates to `YYYY-MM-DD`, and automatically masks analytics for small cohorts ($N < 5$).

*Note: The system acts as an analytical synthesis tool for faculty; it does not make automated administrative decisions.*

---

## 3. System Architecture

The application is structured into four decoupled layers:

### Student Submission Flow
```text
Student Browser
       │
       │ HTTP POST (Unauthenticated, Zero PII)
       ▼
React Frontend SPA (localhost:5173)
       │
       │ REST API (Zod Validated)
       ▼
Node.js Express API Gateway (localhost:5000)
       │
       ├──────────────────────────────────────────┐
       │ 1. Atomic Transaction (status: pending)   │ 2. setImmediate() Async Dispatch
       ▼                                          ▼
PostgreSQL Database (localhost:5432)       Python FastAPI Microservice (127.0.0.1:8000)
(feedback_submissions, ratings)                   │ Sub-millisecond In-Memory Inference
                                                  ▼
                                           PostgreSQL Database (localhost:5432)
                                           (sentiment, topic_mentions, status: completed)
```

### Professor Analytical Flow
```text
Professor Browser
       │
       │ 1. Institutional Login (bcrypt + JWT)
       ▼
React Frontend SPA (localhost:5173)
       │
       │ 2. GET /api/v1/dashboard/:id (Bearer Token)
       ▼
Node.js Express API Gateway (localhost:5000)
       │
       │ 3. Ownership Verification (course_offerings.professor_id == token.professorId)
       │ 4. SQL Aggregations (AVG, COUNT, topic distribution, N >= 5 check)
       ▼
PostgreSQL Database (localhost:5432)
       │
       ▼ 5. Aggregated Analytics JSON
Professor Analytics Dashboard (localhost:5173/dashboard)
```

---

## 4. Technology Stack

* **Frontend**: React 19, Vite, Semantic Design Tokens / CSS Modules.
* **Backend**: Node.js 20+, Express 4.21, `pg` (PostgreSQL client pool), Zod (schema validation), bcryptjs (password hashing), jsonwebtoken (JWT).
* **Database**: PostgreSQL 15+ / 16 (relational schema, transactional migrations).
* **NLP Subsystem**: Python 3.10+ / 3.14, FastAPI, Pydantic, pure-Python Multinomial Naive Bayes and Binary Relevance linear models (zero compiled C/Cython DLL dependencies).
* **Authentication**: Institutional email & bcrypt-hashed passwords issuing 24-hour HMAC-SHA256 JWT bearer tokens.
* **Deployment**: PaaS Blueprint (`render.yaml`) with internal private networking for NLP.

---

## 5. User Flows

### Student Submission Flow
```text
Open student portal (/)
  → Select active course offering
  → Read Anonymous Feedback Guarantee
  → Rate 5 pedagogical dimensions (1 to 5 scale)
  → Enter constructive written comments (optional, max 2000 chars)
  → Click Submit Feedback
  → Immediate confirmation screen (<20ms); submission saved with status 'pending'
  → Background worker triggers NLP inference and transitions status to 'completed'
```

### Professor Dashboard Flow
```text
Open faculty login (/login)
  → Authenticate with institutional email & password
  → Receive JWT session and redirect to /dashboard
  → Select assigned course offering from dropdown
  → Level 1: Inspect executive cards (Response count, satisfaction score, sentiment distribution)
  → Level 2: Inspect 5 teaching performance dimensions
  → Level 3: Inspect pedagogical topic frequency breakdown
  → Level 4: Explore qualitative evidence with interactive topic and sentiment filters
```

---

## 6. NLP Analytical Pipeline

The analytical pipeline classifies student feedback using a deterministic statistical approach:

1. **Input**: Raw student comment text (up to 2,000 characters).
2. **Preprocessing**: Unicode NFKD normalization, lowercasing, punctuation stripping, and contraction expansion (e.g. *"didn't"* $\rightarrow$ *"did not"*).
3. **Feature Extraction**: Pure-Python n-gram vectorizer generating unigram and bigram term-frequency vectors.
4. **Sentiment Classification**: Multinomial Naive Bayes estimating posterior class probabilities across 3 classes (`positive`, `neutral`, `negative`):
   $$\hat{y} = \arg\max_{c \in C} \left[ \log P(c) + \sum_{i} x_i \log P(w_i | c) \right]$$
5. **Topic Classification**: Binary Relevance architecture using 7 independent binary Naive Bayes classifiers with decision threshold $\tau = 0.40$. A single comment can tag multiple topics or zero topics.
6. **Confidence & Storage**: Returned sentiment label, confidence score, and topic keys are stored in `feedback_sentiment` and `feedback_topic_mention`.
7. **Dashboard Presentation**: Synthesized into sentiment distribution progress bars and topic frequency breakdowns.

*Why Classical Naive Bayes?* It provides 100% deterministic reproducibility, sub-millisecond execution ($<1$ ms in RAM), zero recurring API token costs, zero LLM hallucinations, and eliminates OS-level C-extension DLL policy blocks on Windows. It does not possess human-like language understanding or parsing of complex multi-clause sarcasm.

---

## 7. Dataset Specification

* **Source**: Curated academic benchmark of 400 university course evaluation comments.
* **Dataset Type**: **The dataset is synthetic and was created for academic development/evaluation.** It does not represent live student records.
* **Splits**: Stratified 70% Train (280 samples) / 15% Validation (60 samples) / 15% Test (60 samples) with fixed random seed (`seed = 42`).
* **Taxonomy**:
  * 3 Sentiment Polarities: `positive`, `neutral`, `negative`.
  * 7 Pedagogical Topics: `teaching_clarity`, `teaching_pace`, `doubt_handling`, `student_engagement`, `practical_examples`, `course_material`, `workload_fairness`.
* **Limitations**: Does not capture informal regional slang, misspelled abbreviations, or complex nested idioms found in live university populations.

---

## 8. Model Evaluation

Evaluated against the holdout test split ($N = 60$):

### Sentiment Classification
* **Accuracy**: `76.7%`
* **Macro-Precision**: `0.79`
* **Macro-Recall**: `0.77`
* **Macro-F1**: `0.78`
* **Confusion Matrix**: High precision on unequivocal positive and negative feedback; minor confusion between neutral comments and mild praise.

### Multi-Label Topic Detection
* **Micro-Precision**: `0.76`
* **Micro-Recall**: `0.73`
* **Micro-F1**: `0.74`

*Evaluation Context: Metrics demonstrate a robust, reproducible baseline on domain lexicons without claiming human parity.*

---

## 9. Privacy & Anonymity Architecture

* **Zero Personal Identifiers**: No student accounts, student IDs, names, emails, IP addresses, or browser fingerprints are recorded in PostgreSQL.
* **Temporal Privacy Guard**: Feedback timestamps are truncated to `YYYY-MM-DD` in faculty views, eliminating time-correlation attacks where an instructor correlates a submission with when a student left the lecture hall.
* **Small Cohort Protection ($N < 5$)**: If a course offering has fewer than 5 submissions, the backend aggregation engine masks granular dimension averages, topic distributions, and qualitative comments (`privacyThresholdMet: false`).
* **Anonymity Limitations**: The system cannot prevent students from self-identifying in free-form written comments (e.g. *"As the only exchange student from Germany..."*). UI guidelines warn students against disclosing identifying details.

---

## 10. Security Implementation

* **SQL Injection Defense**: All database queries use parameterized `$1, $2` syntax. Enum parameters are validated against strict Zod allowlists.
* **XSS Defense**: Comment text is stored literally and safely escaped through React virtual DOM text nodes without innerHTML injection.
* **Authentication**: Faculty passwords hashed via bcrypt (salt cost factor 10). JWT tokens signed with minimum 32-character high-entropy secret.
* **Horizontal Authorization**: Database queries enforce that the requested course offering belongs to the authenticated instructor; cross-professor access is rejected with HTTP 403 Forbidden.
* **Defensive HTTP Headers**: `helmet` headers active (`nosniff`, `SAMEORIGIN`, CSP configured, `X-Powered-By` suppressed).
* **Payload Limits**: JSON request body capped at `100kb` (HTTP 413 `PAYLOAD_TOO_LARGE`); feedback comments capped at 2,000 characters.
* **Rate Limiting**: In-memory rate limiting on authentication (10 req/15 min) and feedback submission (30 req/min).

---

## 11. Database Schema & Domain Model

The database is normalized across 7 relational tables in PostgreSQL:

```text
  ┌────────────────┐         ┌────────────────┐
  │   professors   │         │    courses     │
  │ id (PK)        │         │ id (PK)        │
  │ email, name    │         │ code, title    │
  └───────┬────────┘         └────────┬───────┘
          │ 1                         │ 1
          │        ┌──────────────────┤
          ▼ N      ▼ N                │
       ┌─────────────────────┐        │
       │   course_offerings  │        │
       │ id (PK)             │        │
       │ term, is_active     │        │
       └──────────┬──────────┘        │
                  │ 1                 │
                  ▼ N                 │
       ┌─────────────────────┐        │
       │ feedback_submissions│        │
       │ id (PK)             │        │
       │ comment_text, status│        │
       └────┬──────────┬─────┘        │
            │ 1        │ 1            │
            │          ▼ 1            │
            │  ┌───────────────────┐  │
            │  │ feedback_ratings  │  │
            │  │ 5 dimension scores│  │
            │  └───────────────────┘  │
            │ 1                       │
            ├──────────────────────┐  │
            ▼ 1                    ▼ N│
  ┌───────────────────┐  ┌─────────────────────┐
  │feedback_sentiment │  │feedback_topic_mention│
  │sentiment, score   │  │topic_key            │
  └───────────────────┘  └─────────────────────┘
```

---

## 12. API Documentation

Key endpoints defined in `docs/API_CONTRACT.md`:

| Method | Path | Purpose | Auth | Request Body | Success Response | Errors |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| `GET` | `/api/v1/course-offerings` | List active courses | Public | None | `Array<Offering>` | `500` |
| `POST`| `/api/v1/feedback` | Submit student feedback | Public | `{ courseOfferingId, ratings, comment }` | `201 Created` | `400, 422` |
| `POST`| `/api/v1/auth/login` | Faculty authentication | Public | `{ email, password }` | `200 OK` (JWT + profile) | `401, 422` |
| `GET` | `/api/v1/auth/me` | Restore faculty session | Bearer | None | `200 OK` (Profile) | `401` |
| `GET` | `/api/v1/professor/offerings` | Faculty assigned courses | Bearer | None | `Array<Offering>` | `401` |
| `GET` | `/api/v1/dashboard/:id` | 4-tier analytics query | Bearer | None | `200 OK` (Analytics JSON) | `401, 403, 404`|
| `GET` | `/api/v1/feedback/:id` | Paginated evidence | Bearer | `?topic=&sentiment=&page=` | `200 OK` (Comments JSON) | `401, 403, 404`|
| `GET` | `/health/live` | Process liveness probe | Public | None | `200 OK` `{"status":"alive"}` | `500` |
| `GET` | `/health/ready` | DB pool readiness probe | Public | None | `200 OK` `{"status":"ready"}` | `503` |

---

## 13. Local Development Guide

### Prerequisites
* **Node.js**: `v20+` or `v24+`
* **Python**: `v3.10+` or `v3.14+`
* **PostgreSQL**: `v15+` running locally on port `5432`

### Setup Instructions
```bash
# 1. Install dependencies
npm --prefix backend install
npm --prefix frontend install
pip install -r nlp/requirements-prod.txt

# 2. Configure environment
cp .env.example backend/.env

# 3. Database migrations & seed data
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

### Recommended Startup Order
Start each service in a separate terminal:
1. **Python NLP Microservice**:
   ```bash
   python -m uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000
   ```
2. **Express API Gateway**:
   ```bash
   node backend/src/server.js
   ```
3. **React Frontend**:
   ```bash
   npm --prefix frontend run dev
   ```

### Running Automated Test Suites
```bash
# Backend unit & integration tests (77 tests)
npm --prefix backend test

# Python NLP tests (31 tests)
python -m unittest discover -s nlp/tests -p "test_*.py"

# Frontend component tests (15 tests)
npm --prefix frontend test

# Full live E2E verification suite (13 tests)
node scripts/verify_production.js
```

---

## 14. Local Application

Use these actual URLs to inspect and test the running system:

* **Frontend Root / Student Feedback**: [http://localhost:5173/](http://localhost:5173/)
* **Professor Sign-In**: [http://localhost:5173/login](http://localhost:5173/login)
* **Professor Analytics Dashboard**: [http://localhost:5173/dashboard](http://localhost:5173/dashboard)
* **Backend API Base**: [http://localhost:5000](http://localhost:5000)
* **Backend Liveness Probe**: [http://localhost:5000/health/live](http://localhost:5000/health/live)
* **Backend Readiness Probe**: [http://localhost:5000/health/ready](http://localhost:5000/health/ready)
* **API Version Probe**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
* **Python NLP Microservice**: `http://127.0.0.1:8000` *(Internal loopback private service; not directly exposed to browsers)*

---

## 15. Demo Faculty Credentials

| Faculty Account | Institutional Email | Demo Password | Assigned Offerings | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Dr. Ramesh Sharma** | `sharma@university.edu` | `SecurePassword123!` | CS301 (Fall 2026, $N \ge 15$)<br>CS405 (Fall 2026, $N = 0$) | Full 4-level dashboard, topic filters, empty state |
| **Prof. Anita Desai** | `desai@university.edu` | `SecurePassword123!` | CS201 (Fall 2026, $N = 2$) | Privacy threshold demonstration: Small cohort masking ($N < 5$) |
