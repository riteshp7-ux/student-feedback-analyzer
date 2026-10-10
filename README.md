# Student Feedback Analyzer

The **Student Feedback Analyzer** is a university course evaluation and analytics system designed to collect authentic, anonymous student feedback and synthesize it into actionable pedagogical insights for professors.

By separating quantitative ratings from qualitative comments, classifying comments with a deterministic statistical Natural Language Processing (NLP) pipeline, and enforcing strict privacy barriers, the system helps instructors identify specific strengths and areas for improvement without compromising student anonymity.

---

## 1. System Architecture

The application implements a decoupled, privacy-conscious four-tier architecture:

```text
                                  PUBLIC INTERNET / BROWSER
                                               │
                                               ▼ HTTPS
                                ┌─────────────────────────────┐
                                │       React 19 Client       │
                                │   (Student Portal & Dash)   │
                                └──────────────┬──────────────┘
                                               │ HTTPS / REST
                                               ▼
                                ┌─────────────────────────────┐
                                │     Express API Gateway     │
                                │   Node.js 20+ Orchestrator  │
                                └──────────────┬──────────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           │ Database Pool                         │ Private Internal Network
                           ▼ (TCP / SSL)                           ▼ (HTTP, 2000ms timeout)
              ┌─────────────────────────────┐         ┌─────────────────────────────┐
              │     PostgreSQL Database     │         │   Python NLP Microservice   │
              │  - feedback_submissions     │         │ - FastAPI Service           │
              │  - feedback_ratings         │         │ - Pure-Python Naive Bayes   │
              │  - feedback_sentiment       │         │ - In-Memory Artifacts       │
              │  - feedback_topic_mention   │         │ - Sub-millisecond Inference │
              └─────────────────────────────┘         └─────────────────────────────┘
```

### Key Architectural Boundaries
1. **Student Submission Anonymity**: Zero student identifiers (`student_id`, name, email, IP address, user agent) are accepted or stored in the database.
2. **Asynchronous NLP Decoupling**: Student submissions commit immediately in PostgreSQL with `analysis_status = 'pending'`. NLP inference is dispatched asynchronously outside the submission request loop. Temporary NLP downtime does not disrupt student submissions.
3. **Internal NLP Service**: The Python FastAPI service is bound strictly to loopback or an internal private subnet. The browser never connects directly to the NLP service.
4. **Horizontal Faculty Isolation**: Professors authenticate via JWT and can only view dashboard analytics for courses they are assigned to teach. Cross-professor access is rejected with HTTP 403 Forbidden.
5. **Small Cohort Privacy Guard**: When a course offering has fewer than 5 submissions ($N < 5$), detailed dimension averages and qualitative feedback are masked to prevent deanonymization.

---

## 2. Technology Stack

* **Frontend**: React 19, Vite, CSS Modules / Semantic Design Tokens, Vitest / Node Test Runner.
* **Backend**: Node.js 20+, Express 4.21, `pg` (PostgreSQL client pool), Zod (schema validation), bcryptjs (password hashing), jsonwebtoken (JWT).
* **Database**: PostgreSQL 15+ / 16 (relational schema, transactional migrations).
* **NLP Subsystem**: Python 3.10+ / 3.14, FastAPI, Pydantic, pure-Python Multinomial Naive Bayes & Binary Relevance topic models (zero compiled C/Cython DLL dependencies).
* **Deployment / PaaS**: Render Blueprint (`render.yaml`), Docker-ready.

---

## 3. Repository Structure

```text
NLP-sys-minor/
├── backend/                  # Node.js Express REST API Gateway
│   ├── src/
│   │   ├── config/           # Environment validation (Zod) and DB pool
│   │   ├── db/               # SQL migrations and seed data scripts
│   │   ├── middlewares/      # Auth, authorization, rate limiting, security headers
│   │   ├── modules/          # Auth, courses, dashboard, feedback, NLP modules
│   │   ├── app.js            # Express app configuration
│   │   └── server.js         # HTTP server listener & graceful shutdown
│   └── tests/                # Automated backend unit & integration tests
│
├── frontend/                 # React 19 Single-Page Application (Vite)
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/         # Faculty login page and authentication context
│   │   │   ├── dashboard/    # 4-tier analytics dashboard & evidence explorer
│   │   │   └── feedback/     # Student feedback submission journey
│   │   ├── shared/           # API client, header component, design system CSS
│   │   └── App.jsx           # Top-level routing and state management
│   └── tests/                # Component and accessibility test suites
│
├── nlp/                      # Python Analytical Subsystem
│   ├── artifacts/v1.0.0/     # Pre-trained JSON model parameters & vocabulary
│   ├── data/                 # Stratified train/val/test dataset splits
│   ├── src/
│   │   ├── classifier.py     # Pure-Python Naive Bayes linear models
│   │   ├── inference.py      # In-memory inference engine with warmup
│   │   ├── pipeline.py       # Unified sentiment and multi-label topic pipeline
│   │   ├── preprocessing.py  # Unicode normalization & text cleaning
│   │   ├── service.py        # FastAPI HTTP application (/health, /ready, /analyze)
│   │   └── vectorizer.py     # Pure-Python n-gram feature extractor
│   └── tests/                # Microservice & model unit tests
│
├── docs/                     # Authoritative system documentation
│   ├── ARCHITECTURE.md       # Tier boundaries and communication protocols
│   ├── API_CONTRACT.md       # REST endpoint schemas and error codes
│   ├── DATA_MODEL.md         # Database schema and relational constraints
│   ├── DECISIONS.md          # Architectural Decision Records (ADRs)
│   ├── DEPLOYMENT.md         # Operations, environment variables, PaaS guide
│   ├── DESIGN_SYSTEM.md      # Typography, color tokens, responsive layout
│   ├── NLP_SPEC.md           # Taxonomy, labeling rules, baseline pipeline
│   └── SECURITY.md           # Defense-in-depth, rate limiting, privacy rules
│
├── scripts/                  # Verification and acceptance test runners
│   ├── run_acceptance.js     # Stage 22 localhost acceptance runner
│   └── verify_production.js  # Stage 23 live production verification runner
│
├── .env.example              # Environment variable template
├── package.json              # Monorepo task orchestration
└── render.yaml               # Infrastructure-as-Code PaaS Blueprint
```

---

## 4. Local Setup & Running Locally

### Prerequisites
* **Node.js**: v20+ or v24+
* **npm**: v10+
* **Python**: v3.10+
* **PostgreSQL**: v15+ running locally on port `5432`

### Step 1: Install Dependencies
```bash
# Backend dependencies
npm --prefix backend install

# Frontend dependencies
npm --prefix frontend install

# Python NLP dependencies
pip install -r nlp/requirements-prod.txt
```

### Step 2: Environment Configuration
Copy the template configuration:
```bash
cp .env.example backend/.env
```
Ensure `backend/.env` has a valid `DATABASE_URL`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/feedback_analyzer
```

### Step 3: Database Migration & Seeding
```bash
# Create database (if needed) and run non-destructive migrations
npm --prefix backend run db:migrate

# Seed development/demo data (courses, faculty, synthetic feedback)
npm --prefix backend run db:seed
```

### Step 4: Run Services
Start the 3 services in separate terminal tabs:

**Tab 1: Python NLP Microservice (Port 8000)**
```bash
python -m uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000
```
*Health probe*: `http://127.0.0.1:8000/health`

**Tab 2: Express Backend API (Port 5000)**
```bash
node backend/src/server.js
```
*Health probe*: `http://localhost:5000/health/live`

**Tab 3: React Frontend (Port 5173)**
```bash
npm --prefix frontend run dev
```
*Application URL*: `http://localhost:5173`

---

## 5. Automated Tests

The application contains 123 automated tests across all 3 tiers with a 100% pass rate:

```bash
# Run backend tests (77 tests: auth, DB, feedback, NLP integration, read APIs, security)
npm --prefix backend test

# Run Python NLP tests (31 tests: health, API contracts, model math, preprocessing)
python -m unittest discover -s nlp/tests -p "test_*.py"

# Run frontend tests (15 tests: components, rating scales, dashboard hierarchy)
npm --prefix frontend test

# Run full live end-to-end verification suite
node scripts/verify_production.js
```

---

## 6. NLP Training & Evaluation

The NLP analytical engine relies on classical statistical learning using pure-Python standard libraries (`math`, `collections`, `json`), avoiding compiled Cython dependencies.

### Pedagogical Taxonomy
* **Sentiment**: 3-class classification (`positive`, `neutral`, `negative`).
* **Topics**: Multi-label Binary Relevance across 7 approved educational categories:
  1. `teaching_clarity`
  2. `teaching_pace`
  3. `doubt_handling`
  4. `student_engagement`
  5. `practical_examples`
  6. `course_material`
  7. `workload_fairness`

### Reproducibility Pipeline
```bash
# 1. Validate dataset format and labels
python -m nlp.src.validate_data

# 2. Split dataset with fixed seed (seed = 42: 70% train, 15% val, 15% test)
python -m nlp.src.split_data

# 3. Train models and generate JSON parameters
python -m nlp.src.train

# 4. Evaluate against holdout test split
python -m nlp.src.evaluate
```

Model artifacts are stored deterministically as JSON in `nlp/artifacts/v1.0.0/`.

---

## 7. Demo Faculty Accounts

The development database seeds two faculty accounts for evaluation:

| Faculty Member | Email | Password | Assigned Courses | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Dr. Ramesh Sharma** | `sharma@university.edu` | `SecurePassword123!` | CS301 (DBMS), CS405 (ML) | CS301 has ample feedback ($N \ge 5$) demonstrating the full 4-tier analytics dashboard. CS405 has $N=0$ demonstrating the empty state. |
| **Prof. Anita Desai** | `desai@university.edu` | `SecurePassword123!` | CS201 (DSA) | Has 2 submissions ($N=2 < 5$), demonstrating the small-cohort privacy guard masking. |

---

## 8. Privacy & Anonymity Considerations

1. **Zero Personal Identifiers**: No student accounts, logins, session cookies, IP addresses, or browser fingerprints are recorded upon feedback submission.
2. **Granular Temporal Privacy**: Timestamps on qualitative comments are truncated to `YYYY-MM-DD` in professor views, preventing timing correlation attacks where instructors deduce a student's identity based on when they left lecture.
3. **Small Sample Protection ($N < 5$)**: If a course offering has fewer than 5 submissions, granular performance ratings, topic frequency charts, and comment text are withheld by the backend aggregation engine.
4. **Anonymity Limitations**: The system cannot prevent a student from self-identifying in free-form written comments (e.g., *"As the only exchange student from Germany..."*). UI guidelines advise students not to include personally identifying details.

---

## 9. Known Operational Limitations

1. **Classical In-Memory Classifier**: The NLP model uses a Multinomial Naive Bayes classifier trained on academic feedback lexicons. It is fast and deterministic (<1 ms inference), but may misclassify complex sarcasm, highly nested idioms, or out-of-domain slang.
2. **In-Memory Rate Limiting**: Request rate limiting uses an in-process sliding window. In multi-instance load-balanced deployments, rate limits apply per container instance rather than globally.
3. **Asynchronous Sweeping**: If the backend process is abruptly killed mid-flight while a submission is in `pending` status, the recovery sweeper (`processPendingBatch`) must be triggered to reconcile pending items.

---

## 10. Turnkey Cloud Deployment (Render PaaS)

The repository includes a declarative Infrastructure-as-Code Blueprint (`render.yaml`) for one-click deployment:

1. Push code to GitHub/GitLab.
2. In [Render Dashboard](https://dashboard.render.com/), choose **New -> Blueprint** and connect the repository.
3. Render automatically provisions:
   * **Managed PostgreSQL 16**: Relational storage with automated daily backups.
   * **Python FastAPI Service**: Deployed as an internal private service on a private subnet.
   * **Express API Gateway**: Node.js web service linked to database and internal NLP.
   * **React 19 Frontend**: Static site served on a global CDN.
4. Run migrations from the backend shell:
   ```bash
   npm --prefix backend run db:migrate
   npm --prefix backend run db:provision
   ```
5. Run the live verification runner to validate health and security:
   ```bash
   node scripts/verify_production.js --api <YOUR_API_URL> --frontend <YOUR_FRONTEND_URL>
   ```
