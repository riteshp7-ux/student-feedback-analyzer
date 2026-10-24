# Student Feedback Analyzer

> **An end-to-end, privacy-preserving academic feedback aggregation and natural language analytics system for higher education courses.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-brightgreen.svg)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org)
[![Test Suites](https://img.shields.io/badge/Test-Suites-All%20Green-success.svg)](#9-automated-test-verification-suites)

---

## 1. Problem Statement

Course feedback in higher education frequently suffers from two compounding structural issues:
1. **Psychological Insecurity & Low Response Honesty**: When students fear potential academic retaliation or loss of anonymity, written feedback becomes superficial, overly flattering, or completely withheld.
2. **Qualitative Evaluation Bottlenecks**: Faculty members and department chairs teaching classes of 60 to 200+ students receive dozens of unstructured free-text comments. Reading, categorizing, and aggregating qualitative feedback manually across multiple course sections is time-consuming and prone to subjective confirmation bias.

---

## 2. Solution Overview

The **Student Feedback Analyzer** provides a secure, decoupled feedback architecture that reconciles two conflicting requirements:
* **Strict Submission Eligibility & Uniqueness**: Authenticated institutional accounts verify that submitters are actually enrolled in the course offering and enforce a strict **one-submission-per-course** rule.
* **Level 1 Practical Anonymity**: Feedback submissions are stored completely decoupled from student accounts. Course instructors view aggregate performance distributions, topic distributions, sentiment analyses, and anonymous written comments without access to student identifiers.
* **Asynchronous NLP Pipeline**: Comments are processed out-of-band by a dedicated Python microservice without slowing down or blocking student submission transactions.
* **Small-Cohort Privacy Guard**: If a course has fewer than 5 submissions ($N < 5$), detailed metrics and written comments are automatically suppressed to prevent reverse-identifying students.

---

## 3. High-Level Architecture & System Topology

The system is architected as a **3-tier decoupled microservice architecture** backed by PostgreSQL:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Presentation Layer (Vite + React 19 SPA @ :5173)"]
        UI_Student["Student Feedback Portal<br/>(Cascading Course Selector, 5 Star Ratings, Comments)"]
        UI_Prof["Professor Analytics Dashboard<br/>(4-Level Hierarchy, Sentiment Breakdown, Privacy Guard)"]
    end

    subgraph GatewayLayer ["2. Application Gateway (Express 4.21 / Node.js @ :5000)"]
        AuthModule["Auth & Security Guards<br/>(JWT, Bcrypt, Role-Based Access Control, Rate Limiter)"]
        FeedbackSvc["Feedback Service<br/>(Enrollment Check, Atomic Transaction Decoupling)"]
        DashboardSvc["Dashboard Aggregation Engine<br/>(Decoupled SQL, N < 5 Small-Cohort Privacy Guard)"]
        AsyncDispatcher["Asynchronous Dispatcher<br/>(setImmediate non-blocking job dispatcher)"]
    end

    subgraph DataLayer ["3. Relational Persistence (PostgreSQL 18.4 @ :5432)"]
        T_Identities["Identified Tables<br/>(students, enrollments, professors)"]
        T_Control["Submission Lock Table<br/>(feedback_submission_control: student_id + offering_id)"]
        T_Feedback["Anonymous Feedback Tables<br/>(feedback_submissions: ratings, comment_text)"]
        T_Analysis["Derived Analytics Tables<br/>(feedback_sentiment, feedback_topic_mention)"]
    end

    subgraph NLPLayer ["4. NLP Microservice (FastAPI / Python 3.12 @ :8000)"]
        SentimentPipeline["Sentiment Classifier<br/>(Multinomial Naive Bayes, 3-class)"]
        TopicPipeline["Multi-Label Topic Classifier<br/>(TF-IDF + Scikit-Learn Multilabel Model)"]
    end

    UI_Student -->|HTTPS / JSON| AuthModule
    UI_Prof -->|HTTPS / JWT| AuthModule
    AuthModule --> FeedbackSvc
    AuthModule --> DashboardSvc

    FeedbackSvc -->|Atomic Transaction 1| T_Control
    FeedbackSvc -->|Atomic Transaction 2| T_Feedback
    FeedbackSvc -.->|Non-blocking trigger| AsyncDispatcher

    AsyncDispatcher -->|HTTP POST :8000/analyze| NLPLayer
    NLPLayer -->|Sentiment & Topics| AsyncDispatcher
    AsyncDispatcher -->|Write NLP Results| T_Analysis

    DashboardSvc -->|Read Aggregates| T_Feedback
    DashboardSvc -->|Read Metrics| T_Analysis
```

---

## 4. Privacy Model: Level 1 Practical Anonymity

The core innovation is **Cryptographic & Relational Decoupling**:

```mermaid
erDiagram
    students ||--o{ student_enrollments : "enrolls in"
    course_offerings ||--o{ student_enrollments : "has"
    
    students ||--o{ feedback_submission_control : "claims one-time lock"
    course_offerings ||--o{ feedback_submission_control : "per offering"

    course_offerings ||--o{ feedback_submissions : "receives"
    feedback_submissions ||--o| feedback_sentiment : "analyzed for"
    feedback_submissions ||--o{ feedback_topic_mention : "mentions"

    students {
        uuid id PK
        string email
        string full_name
        string student_id_number
    }

    feedback_submission_control {
        uuid id PK
        uuid student_id FK
        uuid course_offering_id FK
        timestamp submitted_at
    }

    feedback_submissions {
        uuid id PK
        uuid offering_id FK
        int rating_clarity
        int rating_pace
        int rating_doubt_handling
        int rating_engagement
        int rating_practical_examples
        text comment_text
        string analysis_status
    }
```

### Why this design cannot be compromised:
1. **Zero Relational Link**: There is **no foreign key**, no shared primary key, and no reference connecting `feedback_submission_control` and `feedback_submissions`.
2. **One-Submission Enforcement**: The control table enforces `UNIQUE(student_id, course_offering_id)`. If a student attempts to submit again, PostgreSQL aborts with a unique constraint violation (`HTTP 409 ALREADY_SUBMITTED`).
3. **No Foreign Keys to Student**: The `feedback_submissions` table contains only the `offering_id`, the numerical ratings, and the written text. Even a direct SQL database query cannot prove which student authored which feedback.
4. **Honest Scope**: We do not claim cryptographic zero-knowledge unlinkability. A privileged system database administrator with physical access to raw PostgreSQL transaction logs could theoretically correlate write execution timestamps. Normal application users and faculty have zero access to student identities.

---

## 5. The 4-Level Pedagogical Analytics Hierarchy

Instead of dumping raw feedback on professors, the dashboard structures information into **4 progressive cognitive levels**:

```mermaid
flowchart TD
    L1["Level 1: Executive Overview<br/>• Overall Average Rating (1.0 - 5.0)<br/>• Response Volume (N count)<br/>• Macro Sentiment Distribution (% Pos, % Neu, % Neg)"]
    L2["Level 2: Pedagogical Performance Breakdown<br/>• Teaching Clarity (1-5)<br/>• Pace of Teaching (1-5)<br/>• Doubt Resolution (1-5)<br/>• Class Engagement (1-5)<br/>• Practical Examples (1-5)"]
    L3["Level 3: Extracted Pedagogical Themes<br/>• Topic mention frequency<br/>• Sentiment polarity per theme<br/>(e.g., Clarity: 85% Positive, Pace: 60% Negative)"]
    L4["Level 4: Verifiable Qualitative Evidence<br/>• Paginated, filterable comments<br/>• Interactive filtering by Topic + Sentiment<br/>• Month-level dates only; no student metadata or exact timestamps"]

    L1 --> L2 --> L3 --> L4
```

### The Small-Cohort Privacy Guard ($N < 5$)
If a course has fewer than 5 submissions (e.g., an elective with 2 or 3 students):
- **Problem**: In small classes, a professor could easily identify an individual student's writing style or score.
- **Solution**: The backend automatically enforces the **Small-Cohort Privacy Guard**:
  - The aggregate score is hidden.
  - Granular pedagogical dimensions and extracted topics are suppressed.
  - Raw comments are completely redacted.
  - The UI displays an explicit institutional privacy banner:  
    *"Analytics locked until threshold of 5 submissions is reached to protect student privacy."*

---

## 6. Asynchronous NLP Pipeline & Fault-Tolerant Resilience

The natural language processing of feedback comments runs **out-of-band** to ensure that student submissions are never blocked or lost due to ML processing delays:

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Browser
    participant API as Express API Gateway
    participant DB as PostgreSQL Database
    participant Queue as Async Job Dispatcher
    participant NLP as FastAPI NLP Service

    Student->>API: POST /api/v1/feedback (ratings + comment)
    Note over API: Verify student JWT & enrollment
    API->>DB: BEGIN Transaction
    API->>DB: INSERT INTO feedback_submission_control (student_id, offering_id)
    API->>DB: INSERT INTO feedback_submissions (status='pending')
    API->>DB: COMMIT Transaction
    API-->>Student: 201 Created (Instant Confirmation in ~18ms)

    API->>Queue: setImmediate(processSubmissionAnalysis)
    Queue->>NLP: POST /analyze {text: comment}
    alt NLP Service Healthy
        NLP-->>Queue: 200 OK {sentiment: 'positive', topics: ['clarity', 'doubt_handling']}
        Queue->>DB: INSERT feedback_sentiment, INSERT feedback_topic_mention
        Queue->>DB: UPDATE feedback_submissions SET analysis_status = 'completed'
    else NLP Service Timeout or Offline (503)
        Queue->>DB: UPDATE feedback_submissions SET analysis_status = 'pending', analysis_attempts = 1
        Note over Queue,DB: Background retry sweep automatically reprocesses pending items
    end
```

### NLP Pipeline (as implemented):
* **Sentiment Classification**: 3-class Multinomial Naive Bayes over cleaned unigram+bigram features with contraction expansion that preserves negation (`nlp/src/classifier.py`, `nlp/src/preprocessing.py`). No transformer or lexicon fallback is used.
* **Multi-Label Topic Classification**: one independent Binary Naive Bayes classifier per topic (threshold 0.40) covering 7 pedagogical aspects (*Teaching Clarity*, *Teaching Pace*, *Practical Examples*, *Doubt Handling*, *Engagement*, *Assignments*, and *Course Content*).
* **Honest evaluation caveat**: the training, validation, and test splits are all drawn from the same hand-curated synthetic corpus (`nlp/src/generate_dataset.py`). Reported metrics therefore measure in-domain performance on the authors' own phrasing distribution, **not** generalization to real student writing. See [`docs/NLP_BASELINE_EVALUATION.md`](docs/NLP_BASELINE_EVALUATION.md).

---

## 7. Development & Deployment

### Option A: Cloud Deployment (Recommended for Sharing via Public URL)

The application is pre-configured for automated cloud deployment via **Render Blueprint** (`render.yaml`). All four tiers (React Static Site, Node.js API Gateway, Private Python NLP Microservice, and Managed PostgreSQL Database) deploy in tandem with private network isolation and zero open NLP ports.

#### Deployment Steps:
1. Push your repository to **GitHub** or **GitLab**.
2. Log into [Render](https://render.com) and navigate to **Blueprints** -> **New Blueprint Instance**.
3. Select your repository. Render automatically reads `render.yaml` and provisions:
   * **`feedback-analyzer-frontend`**: Static Site publishing `frontend/dist` with automatic client-side SPA rewrites.
   * **`feedback-analyzer-api`**: Node.js Web Service running migrations (`npm --prefix backend run db:migrate`) and the Express gateway.
   * **`feedback-analyzer-nlp`**: Private Python Service (unexposed to internet) executing FastAPI + Uvicorn on Render's internal network (`http://feedback-analyzer-nlp:8000`).
   * **`feedback-analyzer-db`**: Managed PostgreSQL 16 instance automatically injected into the API gateway via `DATABASE_URL`.
4. Render handles TLS certificates (HTTPS), private networking, database credentials, and production secrets automatically.
5. Share the generated `https://feedback-analyzer-frontend.onrender.com` URL with colleagues or evaluators.

---

### Option B: Local Standalone Development (Host Machine)

To run all services directly on your local machine:

#### Prerequisites
* **Node.js**: v20+ (tested on `v20.x` & `v24.x`)
* **Python**: 3.10+ (tested on `3.12.x` & `3.14.x`)
* **PostgreSQL**: 15+ (tested on `16.x` & `18.4`)

#### 1. Environment Configuration
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` in `.env` points to your running PostgreSQL instance:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/feedback_analyzer
```

#### 2. Run Database Migrations & Initial Seed
```bash
# Run sequential database migrations (001 through 010)
npm --prefix backend run db:migrate

# Seed realistic demo data (5 professors, 10 courses across CSE & IT)
node backend/src/db/seeds/reformCatalog.js
```

#### 3. Start Services
In three separate terminal windows:

```bash
# Terminal 1: NLP Microservice
python -m uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000

# Terminal 2: Express API Gateway
npm --prefix backend run dev

# Terminal 3: React Frontend SPA
npm --prefix frontend run dev
```

* **Frontend**: [http://localhost:5173](http://localhost:5173)
* **Backend API Gateway**: [http://localhost:5000](http://localhost:5000)
* **NLP Microservice**: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 8. Test Accounts

### Student Portal Demo Accounts
All student passwords are: `SecureStudent123!`

| Student | Department | Email / Login ID | Enrolled Courses (Max 5) | Testing State |
| :--- | :--- | :--- | :--- | :--- |
| **Kabir Rao** | **CSE** | `kabir@student.university.edu` / `STU2026005` | 5 CSE Courses (`CS301`, `CS201`, `CS303`, `CS305`, `CS402`) | Clean state (0 submissions locked) |
| **Aarav Sharma** | **CSE** | `aarav@student.university.edu` / `STU2026001` | 5 CSE Courses (`CS301`, `CS201`, `CS303`, `CS305`, `CS405`) | Clean state (0 submissions locked) |
| **Rohan Verma** | **CSE** | `rohan@student.university.edu` / `STU2026003` | 5 CSE Courses (`CS201`, `CS303`, `CS305`, `CS402`, `CS405`) | Clean state (0 submissions locked) |
| **Diya Patel** | **IT** | `diya@student.university.edu` / `STU2026002` | 4 IT Courses (`IT101`, `IT204`, `IT302`, `IT304`) | Clean state (0 submissions locked) |
| **Priya Nair** | **IT** | `priya@student.university.edu` / `STU2026004` | 4 IT Courses (`IT101`, `IT204`, `IT302`, `IT304`) | Clean state (0 submissions locked) |

### Faculty Portal Demo Accounts
All faculty passwords are: `SecurePassword123!`

| Professor | Email | Department | Courses Assigned & Status |
| :--- | :--- | :--- | :--- |
| **Dr. Ramesh Sharma** | `sharma@university.edu` | CSE & IT | **CS301** (14 responses, active feedback window)<br/>**IT304** (13 responses, active feedback window) |
| **Prof. Anita Desai** | `desai@university.edu` | CSE & IT | **CS201** (90 responses out of 100 students)<br/>**IT204** (90 responses out of 100 students) |
| **Dr. Vikram Singh** | `vikram.singh@university.edu` | CSE & IT | **CS303** (0 responses, Privacy Guard $N < 5$ active)<br/>**IT302** (38 responses, full stats & avg rating) |
| **Prof. Arjun Mehta** | `arjun.mehta@university.edu` | CSE only | **CS305** (18 responses, full stats)<br/>**CS402** (18 responses, full stats) |
| **Prof. Kavya Menon** | `kavya.menon@university.edu` | CSE & IT | **CS405** (25 responses, full stats)<br/>**IT101** (25 responses, full stats) |

---

## 9. Automated Test Verification Suites

The repository contains an exhaustive test suite covering unit tests, contract tests, security audits, and full end-to-end integration:

```bash
# 1. Backend Unit, Integration, & Security Suite (104/104 passing)
npm --prefix backend test

# 2. Frontend Behavioral Suite — Vitest + Testing Library render tests (16/16 passing)
npm --prefix frontend test

# 3. NLP Pipeline & Service Suite (31/31 passing)
python -m unittest discover -s nlp/tests -p "test_*.py"
```

> Note: the backend suite runs migrations and a destructive demo reseed against the database in `DATABASE_URL`. The seed guard refuses test-mode resets of non-local databases and of databases whose names look production-related (see `backend/src/db/seeds/demoResetGuard.js`).

---

## 10. Key Documentation References

For exhaustive technical specifications, audits, and architectural decisions, refer to:
* [`docs/SYSTEM_DESIGN_REPORT.md`](docs/SYSTEM_DESIGN_REPORT.md) — Comprehensive design walkthrough and presentation guide
* [`docs/BUG_REMEDIATION_REPORT.md`](docs/BUG_REMEDIATION_REPORT.md) — Defect reconciliation, regression results, and release gate report
* [`docs/FULL_SYSTEM_AUDIT.md`](docs/FULL_SYSTEM_AUDIT.md) — Multi-role black-box and white-box audit report
* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Detailed engineering architecture and boundaries
* [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — PostgreSQL relational schema specification
* [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — REST API schemas, request/response structures, and error codes
* [`docs/SECURITY.md`](docs/SECURITY.md) — Threat modeling, privacy invariants, and attack surface hardening

---

## 11. License & Academic Attribution

Developed as an academic minor project in Natural Language Processing and Systems Engineering. Released under the [MIT License](LICENSE).
