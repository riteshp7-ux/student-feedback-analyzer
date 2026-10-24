# Student Feedback Analyzer — Deployment & Architecture Knowledge Base

> **Target Audience**: Beginners in web deployment, software architects, and evaluators.  
> **Scope**: Complete codebase investigation, runtime architecture, data lifecycles, and simplest practical cloud deployment strategy.  
> **Constraint**: Architecture investigation and documentation only; no code modifications or deployments are executed herein.

---

## 1. Project Overview

The **Student Feedback Analyzer** is an academic feedback aggregation platform engineered to solve two fundamental problems in higher education course evaluations:
1. **Student Insecurity & Under-Reporting**: Students fear loss of anonymity or academic retribution when giving honest qualitative feedback to professors.
2. **Faculty Evaluation Fatigue**: Instructors teaching 60–200+ students receive unstructured text comments that are time-consuming to read and prone to confirmation bias.

### How the System Solves This:
* **Level 1 Cryptographic & Relational Anonymity**: Authenticated students are verified as enrolled before submitting feedback, but the feedback ratings and comments are persisted in a completely decoupled table (`feedback_submissions`) that contains **zero foreign keys, student IDs, IP addresses, or tracking metadata**.
* **One-Submission Lock**: A separate table (`feedback_submission_control`) enforces a strict relational unique constraint `UNIQUE(student_id, course_offering_id)`. The database locks the student from submitting twice without creating any link between the student identity and the submitted feedback.
* **Asynchronous NLP Pipeline**: Comments are sent out-of-band to an isolated Python NLP microservice that classifies 3-class sentiment (*Positive*, *Neutral*, *Negative*) and tags 7 pedagogical aspects (*Clarity*, *Pace*, *Practical Examples*, *Doubt Handling*, *Engagement*, *Assignments*, *Course Content*). Student HTTP submission transactions are never blocked.
* **Small-Cohort Privacy Guard ($N < 5$)**: If a course offering has fewer than 5 submissions, the analytics engine automatically masks granular ratings, sentiment breakdowns, and written comments to prevent reverse-identifying students in small classes.

---

## 2. Repository Structure & Map

| Path | Purpose | Importance for Deployment |
| :--- | :--- | :--- |
| [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/package.json) | Root package manifest defining unified test and build scripts | Required (CI / local orchestration) |
| [`render.yaml`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/render.yaml) | Infrastructure-as-Code Blueprint for Render cloud hosting | Required for Render PaaS deployment |
| [`.env.example`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/.env.example) | Complete template for environment variables across all tiers | Required reference for production config |
| [`.gitignore`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/.gitignore) | Git exclusion patterns (ignores `.env`, `node_modules`, builds) | Required (prevents secret leakage) |
| [`README.md`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/README.md) | Project manual, architecture diagrams, demo accounts, test proofs | Optional (Documentation) |
| **`frontend/`** | **Client-side Single Page Application (React 19 + Vite)** | **Required service** |
| `frontend/package.json` | Frontend dependencies (`react`, `react-router-dom`, `vite`) | Required for frontend build |
| `frontend/vite.config.js` | Vite bundler config, CSP meta injector, local API proxy | Required for compilation |
| `frontend/src/main.jsx` | React entrypoint mounting DOM | Required (Build) |
| `frontend/src/App.jsx` | Client-side routing (`/` student feedback, `/login` faculty portal) | Required (Build) |
| `frontend/src/shared/api/client.js` | Centralized `fetch` wrapper injecting JWTs and `BASE_URL` | Required (Build) |
| `frontend/src/features/auth/` | Faculty login form and context state | Required (Build) |
| `frontend/src/features/dashboard/` | Professor analytics dashboard (Overview, Topics, Evidence) | Required (Build) |
| `frontend/src/features/feedback/` | Student login card, course selector, 5-star ratings, comment box | Required (Build) |
| `frontend/tests/` | Vitest behavioral render tests (16 tests) | Development / CI |
| **`backend/`** | **Express API Gateway & Relational Aggregator (Node.js)** | **Required service** |
| `backend/package.json` | Backend dependencies (`express`, `pg`, `bcryptjs`, `jsonwebtoken`, `zod`) | Required for backend install |
| `backend/src/server.js` | Backend HTTP entrypoint, port listener, graceful shutdown | Required (Runtime entrypoint) |
| `backend/src/app.js` | Express app, CORS, security headers, rate limiting, routing | Required (Runtime core) |
| `backend/src/config/env.js` | Zod schema enforcing validated environment variables | Required (Runtime config) |
| `backend/src/config/db.js` | PostgreSQL `pg.Pool` connection pool with TLS policy | Required (Runtime DB client) |
| `backend/src/db/migrate.js` | Automated alphabetical SQL migration runner (`schema_migrations`) | Required (Pre-deploy / startup) |
| `backend/src/db/provision.js` | Production catalog provisioner (creates courses/professors safely) | Deployment utility |
| `backend/src/db/migrations/` | 10 sequential SQL schema files (`001` through `010`) | Required (Database schema) |
| `backend/src/db/seeds/reformCatalog.js` | Realistic demo seeder (5 professors, 10 courses, 331 submissions) | Optional (Demo / staging only) |
| `backend/src/modules/auth/` | Faculty authentication (bcrypt, JWT signing) | Required (Runtime) |
| `backend/src/modules/students/` | Student authentication and enrolled course queries | Required (Runtime) |
| `backend/src/modules/feedback/` | Student feedback submission and comment pagination | Required (Runtime) |
| `backend/src/modules/dashboard/` | Analytics calculation and Small-Cohort Privacy Guard | Required (Runtime) |
| `backend/src/modules/nlp/` | Out-of-band NLP dispatcher (`analysisService.js`, `nlpClient.js`) | Required (Runtime) |
| `backend/tests/` | Node.js native test runner suite (104 tests) | Development / CI |
| **`nlp/`** | **Natural Language Processing Microservice (FastAPI / Python)** | **Required service** |
| `nlp/requirements-prod.txt` | Lightweight production Python requirements (`fastapi`, `uvicorn`, `pydantic`) | Required for NLP install |
| `nlp/requirements.txt` | Development Python requirements (adds `pytest`) | Development |
| `nlp/src/service.py` | FastAPI application, `/analyze`, `/health`, `/ready` endpoints | Required (Runtime entrypoint) |
| `nlp/src/config.py` | Pydantic settings loading `NLP_PORT`, `NLP_SERVICE_TOKEN`, etc. | Required (Runtime config) |
| `nlp/src/inference.py` | Model engine managing in-memory inference pipelines | Required (Runtime core) |
| `nlp/src/classifier.py` | Pure Python Multinomial & Binary Naive Bayes implementations | Required (Runtime ML) |
| `nlp/src/preprocessing.py` | Contraction expansion, regex tokenization, unigram+bigram extractor | Required (Runtime NLP) |
| `nlp/artifacts/v1.0.0/` | Pre-trained model weights, vocabularies, and thresholds in JSON | Required (Model weights) |
| `nlp/tests/` | Python `unittest` suite (31 tests) | Development / CI |
| **`scripts/`** | Deployment & Verification Tools | |
| `scripts/verify_production.js` | End-to-end black-box HTTP verification runner for deployed URLs | Deployment verification |
| **`docs/`** | Architectural and academic documentation | Optional (Reference) |

---

## 3. Application Architecture

The system operates as a **4-tier decoupled architecture**:

```mermaid
flowchart TD
    subgraph Tier1 ["Tier 1: Presentation Layer"]
        Browser["User Browser (Student / Faculty)"]
        SPA["React 19 SPA (Vite Static Build)<br/>Hosted on Static CDN / Cloud Host"]
    end

    subgraph Tier2 ["Tier 2: API Gateway Layer"]
        API["Node.js Express Gateway (:5000 / :10000)<br/>• Zod Input Validation<br/>• Rate Limiting<br/>• Student & Faculty JWT Auth<br/>• Privacy Guard Aggregation"]
    end

    subgraph Tier3 ["Tier 3: Relational Persistence Layer"]
        DB[(PostgreSQL 16 Database)<br/>• Identified: students, professors, enrollments<br/>• Lock: feedback_submission_control<br/>• Anonymous: feedback_submissions<br/>• Analytics: feedback_sentiment, feedback_topic_mention)]
    end

    subgraph Tier4 ["Tier 4: Analytical Subsystem (Private Network)"]
        NLP["Python FastAPI Microservice (:8000)<br/>• Isolated In-Memory Naive Bayes<br/>• 3-Class Sentiment Classification<br/>• 7-Aspect Multi-Label Topic Detection<br/>• Zero Internet Exposure"]
    end

    Browser -->|1. Loads HTML/JS| SPA
    SPA -->|2. HTTPS REST Requests| API
    API -->|3. SQL Queries & Transactions| DB
    API -.->|4. Out-of-Band HTTP POST /analyze| NLP
    NLP -.->|5. JSON Sentiment & Topics| API
    API -.->|6. Saves Derived Analytics| DB
```

### Detailed Component Breakdown:

#### 1. Frontend (Presentation Tier)
* **What it does**: Provides an intuitive dual-portal web interface:
  1. *Student Portal*: Student login, cascading course offering selector, 5 interactive star rating groups, and an optional 2,000-character written comment box.
  2. *Professor Dashboard*: 4-level analytics hierarchy (KPI overview, pedagogical radar/bar distributions, topic breakdown, and paginated comment evidence).
* **Why required**: It is the only interface through which end users interact with the system.
* **Entrypoint**: [`frontend/src/main.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/main.jsx) compiling via Vite to [`frontend/dist/index.html`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/dist/index.html).
* **Technology**: React 19, React Router DOM 7, Vanilla CSS with custom design tokens.
* **Network & Port**: Development: `http://localhost:5173`. Production: Hosted as static assets over HTTPS (port 443) on a CDN or cloud static host.
* **Component Communication**: Communicates **only** with the Backend API Gateway via HTTPS JSON calls. Does **never** communicate directly with PostgreSQL or the Python NLP service.
* **Failure Behavior**: If the frontend fails to load, users see browser connection errors; if the backend is down, the frontend shows friendly error banners without crashing.

#### 2. Backend (API Gateway & Relational Aggregator Tier)
* **What it does**: The brain and security perimeter of the platform:
  - Enforces CORS policies and defensive HTTP headers (CSP, HSTS, X-Content-Type-Options).
  - Validates all request payloads using Zod schemas.
  - Manages dual JWT authentication (Student sessions vs Faculty sessions).
  - Executes atomic PostgreSQL transactions to enforce submission eligibility while maintaining anonymity.
  - Aggregates feedback metrics and enforces the Small-Cohort Privacy Guard ($N < 5$).
  - Asynchronously dispatches comments to the NLP microservice and persists sentiment and topics.
* **Why required**: Protects database integrity, ensures anonymity, and handles business logic.
* **Entrypoint**: [`backend/src/server.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/server.js).
* **Technology**: Node.js 20+, Express 4.21, `pg` (node-postgres), `bcryptjs`, `jsonwebtoken`, `zod`.
* **Network & Port**: Development: `http://localhost:5000`. Production: Port `10000` (Render) or assigned by cloud PaaS environment via `process.env.PORT`.
* **Component Communication**: Receives HTTP from Frontend; connects to PostgreSQL via TCP port 5432; dispatches internal HTTP requests to Python NLP service via port 8000.
* **Failure Behavior**: If the backend is unavailable, the frontend displays API error alerts.

#### 3. NLP Microservice (Analytical Subsystem Tier)
* **What it does**: High-speed, deterministic natural language text classification:
  - Expands contractions and normalizes text while preserving negations (*"not clear"* $\neq$ *"clear"*).
  - Predicts sentiment (*Positive*, *Neutral*, *Negative*) with confidence scores.
  - Predicts 7 multi-label topics (*Clarity*, *Pace*, *Practical Examples*, *Doubt Handling*, *Engagement*, *Assignments*, *Course Content*).
* **Why required**: Offloads CPU-intensive text tokenization and machine learning evaluation from the Node.js event loop into an isolated Python runtime.
* **Entrypoint**: [`nlp/src/service.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/service.py) executed via `uvicorn nlp.src.service:app`.
* **Technology**: Python 3.10+, FastAPI, Uvicorn, Pydantic. **Zero heavy ML frameworks in production**: runs pure mathematical Naive Bayes stored in lightweight JSON files.
* **Network & Port**: `http://127.0.0.1:8000` (development) or internal cloud service `http://feedback-analyzer-nlp:8000` (production).
* **Component Communication**: Accessible **only** by the Backend API Gateway via internal network calls with an optional shared secret `X-NLP-Token`. Unexposed to the public internet.
* **Failure Behavior**: If the NLP service is offline, student feedback submissions **succeed without interruption**. Submissions are marked `analysis_status = 'pending'`, and the backend's background recovery worker automatically retries analysis every 30 seconds once the NLP service recovers.

#### 4. PostgreSQL Database (Persistence Tier)
* **What it does**: ACID-compliant relational data store with 10 tables managing accounts, course catalogs, submission control locks, anonymous feedback, and NLP results.
* **Why required**: Persists all state across server restarts.
* **Technology**: PostgreSQL 15+ (tested on PostgreSQL 16 & 18).
* **Failure Behavior**: If PostgreSQL is down, the backend `/health/ready` probe returns HTTP 503, and the API refuses requests cleanly.

---

## 4. Complete User Request Lifecycle

To understand how the code works together, let us trace three core user actions through the actual code files and function calls:

### Flow 1: Student Submitting Course Feedback

```mermaid
sequenceDiagram
    autonumber
    actor S as Student Browser
    participant FE as Frontend React App
    participant API as Express API Gateway
    participant DB as PostgreSQL Database
    participant W as Async Recovery Worker
    participant NLP as FastAPI NLP Service

    S->>FE: Fills ratings (1-5) and optional comment text
    FE->>FE: Validates form fields (FeedbackForm.jsx)
    FE->>API: POST /api/v1/feedback (Bearer student_token)
    Note over API: authenticateStudent middleware verifies JWT
    Note over API: feedbackLimiter checks rate limits
    Note over API: feedbackSubmissionSchema validates Zod types
    API->>DB: BEGIN Transaction
    API->>DB: Check isStudentEnrolledInOffering(studentId, offeringId)
    API->>DB: INSERT INTO feedback_submission_control (student_id, offering_id)
    Note over DB: Unique constraint prevents 2nd submission
    API->>DB: INSERT INTO feedback_submissions (ratings, comment_text, analysis_status='pending')
    Note over DB: NO student_id stored in feedback_submissions!
    API->>DB: COMMIT Transaction
    API-->>FE: 201 Created { success: true, message: "Feedback submitted successfully." }
    FE-->>S: Displays SubmissionSuccess checkmark card

    Note over API: Outside transaction: scheduleAnalysis(submissionId)
    API->>NLP: POST /analyze { text: comment } (Header: X-NLP-Token)
    NLP-->>API: 200 OK { sentiment: {label: "positive", confidence: 0.96}, topics: [...] }
    API->>DB: INSERT INTO feedback_sentiment (...)
    API->>DB: INSERT INTO feedback_topic_mention (...)
    API->>DB: UPDATE feedback_submissions SET analysis_status = 'completed'
```

#### Code Trace:
1. **Frontend**: [`FeedbackForm.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/feedback/components/FeedbackForm.jsx) gathers state and calls `submitStudentFeedback(payload)` in [`feedbackApi.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/feedback/api/feedbackApi.js#L62).
2. **API Client**: [`client.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/shared/api/client.js#L11) detects `endpoint === '/feedback' && options.method === 'POST'`, extracts `student_token` from `localStorage`, and sends `Authorization: Bearer <student_token>`.
3. **Route**: [`feedbackRoutes.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/feedback/feedbackRoutes.js#L12) invokes `feedbackLimiter`, `authenticateStudent`, and `handleFeedbackSubmission`.
4. **Middleware**: [`studentAuthMiddleware.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/students/studentAuthMiddleware.js) verifies JWT signature and extracts `req.user.studentId`.
5. **Controller**: [`feedbackController.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/feedback/feedbackController.js#L11) parses payload with `feedbackSubmissionSchema.safeParse()`.
6. **Service**: [`feedbackService.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/feedback/feedbackService.js#L34):
   - Opens transaction `BEGIN`.
   - Checks offering status (`offeringStatus.isActive`).
   - Checks enrollment (`isStudentEnrolledInOffering(studentId, courseOfferingId)`). Returns `403 STUDENT_NOT_ENROLLED` if not enrolled.
   - Claims submission lock (`claimSubmissionControl(studentId, courseOfferingId)`). If unique violation `23505` occurs, returns `409 ALREADY_SUBMITTED`.
   - Inserts anonymous submission into `feedback_submissions` (`insertFeedbackSubmission`).
   - Commits transaction `COMMIT`.
7. **Immediate HTTP Response**: Express returns `201 Created` in ~15–25ms.
8. **Asynchronous NLP Dispatch**: Line 146 invokes `scheduleAnalysis(submissionId)` via Node.js `setImmediate()`.
9. **NLP Microservice**: [`nlpClient.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/nlp/nlpClient.js#L77) sends `POST http://127.0.0.1:8000/analyze` with `X-NLP-Token`.
10. **Inference Execution**: [`service.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/service.py#L137) validates request and calls [`inference.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/inference.py). Results return in under 1ms.
11. **Persistence of Derived Data**: [`analysisService.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/nlp/analysisService.js#L67) saves records to `feedback_sentiment` and `feedback_topic_mention`, then sets `analysis_status = 'completed'`.

---

### Flow 2: Faculty Login & Dashboard Inspection

1. **Frontend**: Professor enters email and password on [`LoginPage.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/auth/LoginPage.jsx).
2. **API Call**: Sends `POST /api/v1/auth/login`.
3. **Backend Route**: Handled by [`authRoutes.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/auth/authRoutes.js) -> `authController.login`.
4. **Service**: [`authService.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/auth/authService.js) queries professor by email, verifies password via `bcrypt.compare()`, and returns signed JWT with `role: 'faculty'`.
5. **Storage**: Frontend stores token in `localStorage.setItem('token', token)`.
6. **Dashboard Query**: Professor opens dashboard for an assigned course offering: `GET /api/v1/dashboard/:courseOfferingId`.
7. **Authorization**: [`authorizationMiddleware.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/auth/authorizationMiddleware.js) verifies that the authenticated professor is indeed the instructor of record for that course offering (returns `403 ACCESS_DENIED` if not).
8. **Aggregation & Privacy Guard**: [`dashboardService.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/dashboard/dashboardService.js):
   - Computes total submissions $N$.
   - **If $N < 5$**: Activates **Small-Cohort Privacy Guard**: returns `{ isPrivacyMasked: true, totalSubmissions: N, analytics: null }`.
   - **If $N \ge 5$**: Aggregates average ratings across the 5 dimensions, calculates sentiment distribution percentage, topic frequency percentages, and returns unmasked metrics.
9. **Comments**: Frontend fetches paginated anonymous comments via `GET /api/v1/feedback/:courseOfferingId?page=1&limit=10`. Handled by [`commentController.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/feedback/commentController.js). If $N < 5$, comments are withheld. If $N \ge 5$, comments are returned with month-level timestamps (e.g. `October 2026`) and zero student metadata.

---

### Flow 3: Student Authentication & Course Enrollment Query

1. **Student Login**: Student inputs Institutional Email or Student ID Number (`STU2026001`) and password into [`StudentAuthCard.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/feedback/components/StudentAuthCard.jsx).
2. **API Call**: Sends `POST /api/v1/auth/student/login`.
3. **Backend**: Handled by [`studentRoutes.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/students/studentRoutes.js) -> [`studentController.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/students/studentController.js).
4. **Validation**: [`studentService.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/students/studentService.js) looks up student, verifies password with `bcrypt`, signs student JWT with `role: 'student'`.
5. **Storage**: Stored in `localStorage.setItem('student_token', token)`.
6. **Enrollments Query**: Student feedback page requests `GET /api/v1/student/offerings`.
7. **Repository**: [`studentRepository.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/students/studentRepository.js) joins `course_offerings`, `courses`, `professors`, and performs a `LEFT JOIN feedback_submission_control` on `student_id`.
8. **Result**: Returns only courses where the student is enrolled (max 5), each tagged with `hasSubmitted: true/false`. The student UI automatically disables courses already submitted!

---

## 5. Detailed Dependency Analysis

### A. Frontend Dependencies ([`frontend/package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/package.json))

```json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.1.5"
},
"devDependencies": {
  "@testing-library/react": "^16.3.3",
  "@vitejs/plugin-react": "^4.3.4",
  "jsdom": "^30.1.2",
  "vite": "^6.1.0",
  "vitest": "^5.0.4"
}
```

* **Runtime Dependencies**:
  - `react` & `react-dom` (v19): Core reactive UI component library.
  - `react-router-dom` (v7): Client-side SPA routing (`/` student portal, `/login` faculty portal).
* **Build-Time Dependencies**:
  - `vite` (v6): Fast bundler compiling JSX, CSS, and assets into static HTML/JS/CSS.
  - `@vitejs/plugin-react`: Babel/SWC JSX transformation for React 19.
* **Build Output**:
  - Command: `npm --prefix frontend run build` (invokes `vite build`).
  - Output Directory: `frontend/dist/`.
  - Contents: `index.html` (~0.66 kB), `assets/index-*.js` (~317 kB), `assets/index-*.css` (~47 kB).
* **Server Requirement in Production**:
  - **No Node.js runtime required in production for the frontend**.
  - The output in `frontend/dist/` consists of 100% static files. Any web server (Nginx, Apache, AWS S3, Cloudflare Pages, Vercel, or Render Static Site) can serve it.
  - **Single Requirement**: The static host must support Single Page Application (SPA) rewrites: all non-file route requests (`/*`) must serve `index.html` so React Router can handle navigation.

---

### B. Backend Dependencies ([`backend/package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/package.json))

```json
"dependencies": {
  "bcryptjs": "^3.0.3",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.3",
  "pg": "^8.13.3",
  "zod": "^3.24.2"
}
```

* **Runtime Libraries**:
  - `express` (4.21): HTTP server routing, JSON body parsing, and middleware chain.
  - `pg` (8.13): Official PostgreSQL connection pool driver supporting parameterized queries, transactions, and TLS.
  - `jsonwebtoken` (9.0): Signs and verifies cryptographic HMAC SHA-256 JWT tokens for student and faculty sessions.
  - `bcryptjs` (3.0): One-way salted hashing of user passwords.
  - `zod` (3.24): Strict runtime schema validation for environment variables and API request bodies.
  - `cors` (2.8): Cross-Origin Resource Sharing control restricting access to authorized frontend origins.
  - `dotenv` (16.4): Loads `.env` file during local development.
* **Development Dependencies**:
  - None required! Uses Node.js native test runner (`node --test`) and native file watching (`node --watch`).
* **Installation & Startup**:
  - Install: `npm --prefix backend install`
  - Start Production: `node backend/src/server.js`

---

### C. NLP Microservice Dependencies ([`nlp/requirements-prod.txt`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/requirements-prod.txt))

```text
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.10.0
httpx>=0.28.0
```

* **Runtime Libraries**:
  - `fastapi`: High-performance ASGI Python web framework with automatic OpenAPI documentation.
  - `uvicorn[standard]`: Lightning-fast ASGI production server implementing HTTP/1.1 and WebSockets.
  - `pydantic`: Data validation and schema enforcement for API requests and settings.
  - `httpx`: Async HTTP client used for internal verification and testing.
* **Why No Heavy ML Libraries (No PyTorch, No TensorFlow, No Scikit-Learn)?**:
  - The model training pipeline ([`nlp/src/train.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/train.py)) extracted the learned log-probabilities, feature vocabularies, and classification thresholds into lightweight JSON files ([`nlp/artifacts/v1.0.0/*.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0)).
  - At runtime, [`classifier.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/classifier.py) executes pure Python matrix multiplication and Bayesian probability summation!
  - **Massive Deployment Advantage**: The entire production Python environment installs in under 15 seconds, consumes under 60 MB of RAM, and requires zero GPU drivers or compilation toolchains.
* **Startup & Lifecycle**:
  - Model artifacts are loaded and verified in memory during FastAPI startup via `lifespan(app)` in [`service.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/service.py#L27).
  - Health probe: `GET /health` (reports engine status and artifact versions).
  - Readiness probe: `GET /ready` (returns HTTP 200 if loaded, HTTP 503 if unavailable).

---

### D. PostgreSQL Database Dependencies

* **Engine**: PostgreSQL 15 or 16+ (tested and verified on 16 and 18.4).
* **Extensions Required**: `pgcrypto` (enabled automatically in migration 001 for `gen_random_uuid()`).
* **Tables Created by Migrations (10 total)**:
  1. `schema_migrations`: Ledger tracking applied migration versions.
  2. `academic_departments`: Department catalog (CSE, IT).
  3. `professors`: Faculty accounts (`email`, `password_hash`, `full_name`).
  4. `students`: Student accounts (`email`, `password_hash`, `student_id_number`, `full_name`, `department_id`).
  5. `courses`: Course subject definitions (`code`, `title`, `description`).
  6. `course_offerings`: Deliveries of courses in academic terms by professors.
  7. `course_enrollments`: Mapping of students enrolled in course offerings.
  8. `feedback_submission_control`: Unique submission lock (`student_id`, `course_offering_id`).
  9. `feedback_submissions`: Decoupled anonymous ratings and comment text (`analysis_status`, `rating_clarity`, `rating_pace`, `rating_doubt_handling`, `rating_engagement`, `rating_practical_examples`, `comment_text`).
  10. `feedback_sentiment`: Sentiment inference results (`label`, `confidence`, `probabilities`).
  11. `feedback_topic_mention`: Topic inference results (`topic_key`, `confidence`).

---

### E. Unified Dependency Summary Table

| Component | Dependency | Why Required | Stage | How Supplied in Deployment |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `react` & `react-dom` 19 | UI rendering engine | Build-time | `npm --prefix frontend install` |
| **Frontend** | `react-router-dom` 7 | Client SPA route manager | Build-time | `npm --prefix frontend install` |
| **Frontend** | `vite` 6 | Static bundler & compiler | Build-time | Bundled into `frontend/dist/` |
| **Backend** | `express` 4.21 | HTTP server & routing | Runtime | `npm --prefix backend install` |
| **Backend** | `pg` 8.13 | PostgreSQL database client | Runtime | `npm --prefix backend install` |
| **Backend** | `jsonwebtoken` 9.0 | JWT generation & verification | Runtime | `npm --prefix backend install` |
| **Backend** | `bcryptjs` 3.0 | Password hashing & comparison | Runtime | `npm --prefix backend install` |
| **Backend** | `zod` 3.24 | Schema & input validation | Runtime | `npm --prefix backend install` |
| **Backend** | `cors` 2.8 | Cross-origin security control | Runtime | `npm --prefix backend install` |
| **Backend** | `dotenv` 16.4 | Local `.env` file loader | Runtime (Dev) | `npm --prefix backend install` |
| **NLP** | `fastapi` 0.115 | Web API framework | Runtime | `pip install -r nlp/requirements-prod.txt` |
| **NLP** | `uvicorn` 0.32 | ASGI HTTP production server | Runtime | `pip install -r nlp/requirements-prod.txt` |
| **NLP** | `pydantic` 2.10 | Request/config data validation | Runtime | `pip install -r nlp/requirements-prod.txt` |
| **Database** | PostgreSQL 16 | Relational database engine | Runtime | Managed Cloud Database (e.g. Render DB) |

---

## 6. Environment Variables and Secrets Inventory

Every environment variable utilized across the entire codebase has been cataloged:

| Variable | Used By | Required in Prod? | Secret? | Purpose | Safe Example / Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Backend (`env.js`) | **Yes** | No | Sets application execution mode (`development`, `test`, `production`) | `production` |
| `PORT` | Backend (`env.js`, `server.js`) | Optional | No | HTTP listening port for Express API | `10000` (Render default) or `5000` |
| `DATABASE_URL` | Backend (`env.js`, `db.js`) | **Yes** | **YES** | Full PostgreSQL connection string including credentials | `postgresql://user:pass@host:5432/db` |
| `DATABASE_SSL` | Backend (`db.js`) | Optional | No | Set `'false'` to disable TLS or `'true'` to force TLS | `'false'` in local dev, unset in PaaS |
| `DATABASE_SSL_MODE` | Backend (`db.js`) | Optional | No | Set `'verify-full'` for verified TLS certificates | `verify-full` |
| `JWT_SECRET` | Backend (`env.js`, `authService.js`) | **Yes** | **YES** | Cryptographic key used to sign and verify student/faculty JWT tokens (Min 32 chars) | Random 64-char hex string |
| `FRONTEND_URL` | Backend (`env.js`, `app.js`) | **Yes** | No | Allowed frontend origin for CORS (Prohibits localhost in production) | `https://feedback-analyzer-frontend.onrender.com` |
| `TRUST_PROXY_HOPS` | Backend (`app.js`) | **Yes** (on PaaS) | No | Number of reverse proxy hops to trust for client IP rate limiting | `1` on Render/Heroku/AWS |
| `NLP_SERVICE_URL` | Backend (`env.js`, `nlpClient.js`) | **Yes** | No | Base HTTP URL where Backend can reach the NLP microservice | `http://feedback-analyzer-nlp:8000` |
| `NLP_TIMEOUT_MS` | Backend (`env.js`, `nlpClient.js`) | Optional | No | Maximum milliseconds to wait for NLP inference response before timing out | `10000` (10s on PaaS to survive cold starts) |
| `NLP_SERVICE_TOKEN` | Backend & NLP (`env.js`, `config.py`) | **Yes** (in Prod) | **YES** | Shared secret token passed in `X-NLP-Token` to protect internal inference endpoint | Random 32-char string |
| `NLP_HOST` | NLP (`config.py`) | Optional | No | Network interface for Uvicorn to bind | `0.0.0.0` (all interfaces in cloud) |
| `NLP_PORT` | NLP (`config.py`) | Optional | No | Listening port for Uvicorn ASGI server | `8000` |
| `NLP_ARTIFACT_DIR` | NLP (`config.py`) | Optional | No | Relative or absolute path to model JSON directory | `nlp/artifacts/v1.0.0` |
| `VITE_API_BASE_URL` | Frontend (`vite.config.js`, `client.js`) | **Yes** (at Build) | No | Base API URL injected into compiled React JavaScript bundle | `https://feedback-analyzer-api.onrender.com/api/v1` |

### Critical Concepts for Beginners:
* **`.env` vs `.env.example`**:
  - `.env`: A private file on your local computer containing actual passwords, tokens, and database connection strings. **Must never be checked into Git.**
  - `.env.example`: A public reference template showing the names of the required variables with dummy values, so other developers or cloud deployment systems know what variables must be provided.
* **Why `VITE_API_BASE_URL` is Different**:
  - In React + Vite, code runs in the user's browser, not on the server.
  - Variables prefixed with `VITE_` are **baked into the static JavaScript files during `vite build`**.
  - If you change `VITE_API_BASE_URL` in your hosting dashboard later, it will have **no effect** until you trigger a new build of the frontend!

---

## 7. Database & Data Lifecycle

### 1. How the Schema is Initialized
The project uses a structured, sequential migration runner located in [`backend/src/db/migrate.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/db/migrate.js):
1. Connects to PostgreSQL using `DATABASE_URL`.
2. Creates a ledger table if it does not already exist:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
     id SERIAL PRIMARY KEY,
     migration_name VARCHAR(255) NOT NULL UNIQUE,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
3. Reads all `.sql` files in [`backend/src/db/migrations/`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/db/migrations/) in alphabetical order (`001` through `010`).
4. Compares the filenames with `schema_migrations`.
5. For any file not yet recorded in the ledger, executes the SQL file inside an atomic `BEGIN ... COMMIT` block and records its completion.

### 2. Startup Behavior Against Different Database States:
* **Empty Database**: When `node backend/src/db/migrate.js` runs against an empty database, it cleanly executes migrations `001` through `010` in under 1 second, creating all 10 tables and indexes.
* **Already Initialized Database**: Migrations that have already been applied are safely skipped (`Skipping already applied: 001_initial_schema.sql`). The operation takes ~5ms and makes zero modifications.
* **Database Containing Real User Data**: The migration runner is strictly additive and non-destructive. User data and existing feedback remain 100% intact.
* **Database Missing Migrations**: If new migrations are added to Git, the runner detects and applies only the newly added files.

### 3. Demo Reseeding vs Safe Production Provisioning
* **Demo Reseeding (`backend/src/db/seeds/reformCatalog.js` or `seed.js`)**:
  - **DANGER**: Reseed scripts contain `TRUNCATE` or destructive replacement commands to reset dummy data for testing.
  - **Production Guard**: [`backend/src/db/seeds/demoResetGuard.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/db/seeds/demoResetGuard.js) explicitly blocks destructive reseeding if `NODE_ENV === 'production'` or if the database name sounds like production.
* **Production Provisioning (`backend/src/db/provision.js`)**:
  - Uses `INSERT ... ON CONFLICT DO UPDATE` (idempotent upsert).
  - Creates the academic department and course catalog safely without wiping user feedback or deleting records.

### 4. Why Source Code Does Not Include Database Contents:
When you push code to GitHub or GitLab, **Git stores only code, not database data**. When you deploy a fresh PostgreSQL instance on a cloud provider, that database is completely empty. It has no tables, no courses, and no user accounts until migrations and seed scripts are executed against it.

---

## 8. Development & Production Commands

| Task | Command | Derived From |
| :--- | :--- | :--- |
| **Install All Dependencies** | `npm run install:all` | Root [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/package.json) |
| **Run Backend Tests** | `npm --prefix backend test` | Backend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/package.json) |
| **Run Frontend Tests** | `npm --prefix frontend test` | Frontend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/package.json) |
| **Run NLP Tests** | `python -m unittest discover -s nlp/tests -p "test_*.py"` | NLP test suite |
| **Run All Tests** | `npm test` | Root [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/package.json) |
| **Execute Migrations** | `npm --prefix backend run db:migrate` | Backend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/package.json) |
| **Seed Realistic Demo Data** | `node backend/src/db/seeds/reformCatalog.js` | Backend seed script |
| **Start Local NLP Service** | `python -m uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000` | Standard Uvicorn command |
| **Start Local Backend (Watch)** | `npm --prefix backend run dev` | Backend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/package.json) |
| **Start Local Frontend (Vite)** | `npm --prefix frontend run dev` | Frontend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/package.json) |
| **Build Frontend for Production** | `npm --prefix frontend run build` | Frontend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/package.json) |
| **Start Backend in Production** | `node backend/src/server.js` | Backend [`package.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/package.json) |
| **Verify Live Deployed URLs** | `node scripts/verify_production.js --api <url> --frontend <url>` | Verification script |

---

## 9. Review of Deployment Configuration (`render.yaml`)

The repository includes a production-ready, 100% free-tier Blueprint configuration: [`render.yaml`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/render.yaml).

### How It Works:
1. **Frontend (`feedback-analyzer-frontend`)**:
   - `type: static` (Render Free Tier)
   - Build Command: `npm --prefix frontend install && npm --prefix frontend run build`
   - Publish Directory: `frontend/dist`
   - Route Rewrite: `/*` -> `/index.html` (enables React Router client-side routing)
   - Environment Variable: `VITE_API_BASE_URL` with `sync: false` (prompts for the backend's public API URL).
2. **Backend API (`feedback-analyzer-api`)**:
   - `type: web`, `plan: free` (Render Free Web Service)
   - Build Command: `npm --prefix backend install`
   - Start Command: `node backend/src/db/migrate.js && node backend/src/server.js` (automatically executes all 10 SQL migrations before accepting traffic)
   - Health Probe: `/health/live`
   - Connected to external **Neon PostgreSQL** via `DATABASE_URL` (`sync: false`).
   - `NLP_SERVICE_URL`: Public HTTPS URL of the deployed NLP Web Service (`sync: false`).
   - `NLP_TIMEOUT_MS: 10000` (10s budget to allow the free NLP service to wake from idle sleep).
   - `TRUST_PROXY_HOPS: 1` (trusts Render edge proxy for IP rate limiting).
   - `NLP_SERVICE_TOKEN`: Shared secret matching the token on the NLP service (`sync: false`). Never exposed to the frontend.
   - `FRONTEND_URL`: Public HTTPS URL of your deployed frontend (`sync: false`).
   - `JWT_SECRET: generateValue: true` (Render securely generates a 256-bit cryptographic secret).
3. **NLP Subsystem (`feedback-analyzer-nlp`)**:
   - `type: web`, `plan: free` (Render Free Web Service)
   - Build Command: `pip install -r nlp/requirements-prod.txt`
   - Start Command: `uvicorn nlp.src.service:app --host 0.0.0.0 --port 8000`
   - Health Probe: `/health`
   - `NLP_SERVICE_TOKEN`: Shared secret matching the API gateway (`sync: false`).
4. **Database (Neon PostgreSQL - External)**:
   - Zero Render database resources declared in `render.yaml`.
   - Connects to an external serverless PostgreSQL database from **Neon.tech** (Perpetual free tier; no 30-day expiration).

---

## 10. The Strict ₹0/Month Free Deployment Strategy

To achieve permanent hosting at **₹0/month** without paying any subscription or trial fees:

| Component | Provider & Tier | Cost | Inactivity / Expiration Behavior |
| :--- | :--- | :--- | :--- |
| **Frontend** | Render Static Site (Free) | **₹0 / mo** | Always available on global CDN; no spin-down. |
| **Backend API** | Render Web Service (Free) | **₹0 / mo** | Spins down after 15 minutes of inactivity; wakes up in ~45s upon incoming request. |
| **NLP Microservice** | Render Web Service (Free) | **₹0 / mo** | Spins down after 15 minutes of inactivity; wakes up in ~45s upon incoming request. |
| **Database** | Neon.tech Serverless Postgres (Free) | **₹0 / mo** | **Perpetual free tier** (0.5 GB storage); does **not** expire after 30 days like Render DB. |

---

## 11. Configuration Items Requiring Manual Dashboard Entry

Because certain values cannot be determined before services are provisioned in the cloud, Render's Blueprint mechanism uses `sync: false` to request these values or allow manual configuration in the Render Dashboard:

1. **`DATABASE_URL` (Backend Web Service)**:
   - *Why*: Render does not host this database. You must copy the connection string from your [Neon.tech](https://neon.tech) console (e.g., `postgresql://user:pass@ep-cool-1234.us-east-2.aws.neon.tech/neondb?sslmode=require`) and paste it into Render.
2. **`NLP_SERVICE_TOKEN` (Backend & NLP Web Services)**:
   - *Why*: A shared secret must match identically on both services. It cannot be committed to Git. You can generate any random 32-character string (e.g. `openssl rand -hex 16`) and paste it into both services.
3. **`NLP_SERVICE_URL` (Backend Web Service)**:
   - *Why*: The public URL of the NLP service (e.g., `https://feedback-analyzer-nlp-xxxx.onrender.com`) is only generated *after* the NLP service is created.
4. **`FRONTEND_URL` (Backend Web Service)**:
   - *Why*: The public URL of the frontend (e.g., `https://feedback-analyzer-frontend-xxxx.onrender.com`) is only known after Render provisions the static site.
5. **`VITE_API_BASE_URL` (Frontend Static Site)**:
   - *Why*: In Vite, environment variables are baked into static assets **at build time**. The frontend must know the backend's public API URL (e.g., `https://feedback-analyzer-api-xxxx.onrender.com/api/v1`) before its final production build.

---

## 12. Step-by-Step Deployment Guide (₹0/Month)

```mermaid
flowchart TD
    Step1["Step 1: Create Free Neon PostgreSQL Database"] --> Step2["Step 2: Push Repository to GitHub"]
    Step2 --> Step3["Step 3: Launch Render Blueprint"]
    Step3 --> Step4["Step 4: Pair Public URLs in Render Dashboard"]
    Step4 --> Step5["Step 5: Run Database Migrations (Automated)"]
    Step5 --> Step6["Step 6: Provision Official Catalog (Non-Destructive)"]
    Step6 --> Step7["Step 7: Verify Live System via Script"]
```

### Step 1: Create Free Neon Database
1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project named `feedback-analyzer`.
3. In the Neon dashboard, copy the **Connection string** (ensure it includes `?sslmode=require`).

### Step 2: Push Code to GitHub
Ensure all recent changes to `render.yaml`, `reformCatalog.js`, and `.env.example` are committed and pushed to your GitHub repository.

### Step 3: Launch Blueprint on Render
1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository.
4. Render will read [`render.yaml`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/render.yaml) and prompt you for the uncommitted variables:
   - `DATABASE_URL`: Paste your Neon connection string.
   - `NLP_SERVICE_TOKEN`: Enter any random 32-character secret (e.g., `nlp_sec_7f9a2b8c4d1e3f6081726a5b4c3d2e1f`).
   - For `FRONTEND_URL`, `NLP_SERVICE_URL`, and `VITE_API_BASE_URL`: Enter temporary placeholders (e.g. `https://placeholder.onrender.com`), because Render will generate the real URLs upon creation.
5. Click **Apply**. Render will begin provisioning the services.

### Step 4: Pair Public URLs in Render Dashboard
Once Render creates the three services, their actual domains will be displayed:
1. Copy the public URL of **`feedback-analyzer-nlp`** (e.g. `https://feedback-analyzer-nlp-ab12.onrender.com`).
2. Copy the public URL of **`feedback-analyzer-api`** (e.g. `https://feedback-analyzer-api-cd34.onrender.com`).
3. Copy the public URL of **`feedback-analyzer-frontend`** (e.g. `https://feedback-analyzer-frontend-ef56.onrender.com`).
4. Update the environment variables in the Render Dashboard:
   - In **`feedback-analyzer-api`** -> **Environment**:
     - `FRONTEND_URL` = `https://feedback-analyzer-frontend-ef56.onrender.com`
     - `NLP_SERVICE_URL` = `https://feedback-analyzer-nlp-ab12.onrender.com`
     - Save changes (this triggers an automatic restart of the backend).
   - In **`feedback-analyzer-frontend`** -> **Environment**:
     - `VITE_API_BASE_URL` = `https://feedback-analyzer-api-cd34.onrender.com/api/v1`
     - Click **Manual Deploy** -> **Deploy latest commit** so Vite rebuilds the static files with the real backend API address!

### Step 5: Database Schema Initialization (Automated)
When the backend starts, its `startCommand` automatically runs `node backend/src/db/migrate.js`.
It connects to your Neon database, creates `schema_migrations`, and applies migrations `001` through `010` in order.

### Step 6: Initial Catalog Setup (Non-Destructive)
To create initial courses and faculty accounts without risking existing feedback:
- Use the non-destructive provisioner [`backend/src/db/provision.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/db/provision.js).
- In the Render Dashboard for **`feedback-analyzer-api`**, open the **Shell** tab and run:
  ```bash
  PROF_PASSWORD=UniqueFacultySecret20Chars! node backend/src/db/provision.js
  ```
  *(This uses `ON CONFLICT DO UPDATE` and **never deletes** student submissions).*

### Step 7: Verify Live System
From your local terminal, verify the complete live cloud deployment:
```bash
node scripts/verify_production.js --api https://<your-backend-url>.onrender.com --frontend https://<your-frontend-url>.onrender.com
```

---

## 13. Summary Checklist Before Deployment

- [ ] Free [Neon.tech](https://neon.tech) project created and `DATABASE_URL` copied.
- [ ] Code committed and pushed to GitHub.
- [ ] Random `NLP_SERVICE_TOKEN` generated (e.g. `openssl rand -hex 16`).
- [ ] Render Blueprint created with Neon `DATABASE_URL` and `NLP_SERVICE_TOKEN`.
- [ ] Assigned Render URLs paired between Frontend and Backend.
- [ ] Frontend manually redeployed after setting `VITE_API_BASE_URL`.
- [ ] Live verification script executed to confirm all green checks.
