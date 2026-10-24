# Student Feedback Analyzer: System Design & Architecture Walkthrough

> **Executive Overview**  
> The **Student Feedback Analyzer** is an end-to-end institutional platform designed to solve a fundamental dilemma in university teaching evaluations: **How do you ensure only verified, enrolled students submit exactly one review per course, while guaranteeing that their ratings and written comments remain strictly anonymous to faculty, department heads, and administrators?**

---

## 1. High-Level Architecture & System Topology

The system is architected as a **3-tier decoupled microservice architecture** backed by a relational database with strict schema-level privacy guarantees:

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Presentation Layer (Vite + React 19 SPA)"]
        UI_Student["Student Feedback Portal<br/>(Course Cascading Selector, 5 Star Ratings, Comments)"]
        UI_Prof["Professor Analytics Dashboard<br/>(4-Level Hierarchy, Sentiment Breakdown, Privacy Guard)"]
    end

    subgraph GatewayLayer ["2. Application Gateway (Express 4.21 / Node.js)"]
        AuthModule["Auth & Security Guards<br/>(JWT, Bcrypt, Role-Based Access Control, Rate Limiter)"]
        FeedbackSvc["Feedback Service<br/>(Enrollment Check, Atomic Transaction Decoupling)"]
        DashboardSvc["Dashboard Aggregation Engine<br/>(Decoupled SQL, N < 5 Small-Cohort Privacy Guard)"]
        AsyncDispatcher["Asynchronous Dispatcher<br/>(setImmediate non-blocking job dispatcher)"]
    end

    subgraph DataLayer ["3. Relational Persistence (PostgreSQL 18.4)"]
        T_Identities["Identified Tables<br/>(students, enrollments, professors)"]
        T_Control["Submission Lock Table<br/>(feedback_submission_control: student_id + offering_id)"]
        T_Feedback["Anonymous Feedback Tables<br/>(feedback_submissions: ratings, comment_text)"]
        T_Analysis["Derived Analytics Tables<br/>(feedback_sentiment, feedback_topic_mention)"]
    end

    subgraph NLPLayer ["4. NLP Microservice (FastAPI / Python 3.12)"]
        SentimentPipeline["Sentiment Classifier<br/>(DistilRoBERTa + VADER Fallback)"]
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

    classDef client fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef gateway fill:#ede7f6,stroke:#512da8,stroke-width:2px;
    classDef data fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef nlp fill:#fff3e0,stroke:#e65100,stroke-width:2px;

    class UI_Student,UI_Prof client;
    class AuthModule,FeedbackSvc,DashboardSvc,AsyncDispatcher gateway;
    class T_Identities,T_Control,T_Feedback,T_Analysis data;
    class SentimentPipeline,TopicPipeline nlp;
```

---

## 2. The Core Innovation: "Level 1 Practical Anonymity"

In naive evaluation systems, student IDs are either stored directly in the feedback row (destroying anonymity) or not checked at all (allowing unverified or duplicate spam submissions).

Our architecture implements **Level 1 Practical Anonymity** through **Cryptographic & Relational Decoupling**:

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

---

## 3. The 4-Level Pedagogical Analytics Hierarchy

Instead of dumping raw feedback on professors, the dashboard structures information into **4 progressive cognitive levels**:

```mermaid
flowchart TD
    L1["Level 1: Executive Overview<br/>• Overall Average Rating (1.0 - 5.0)<br/>• Response Volume (N count)<br/>• Macro Sentiment Distribution (% Pos, % Neu, % Neg)"]
    L2["Level 2: Pedagogical Performance Breakdown<br/>• Teaching Clarity (1-5)<br/>• Pace of Teaching (1-5)<br/>• Doubt Resolution (1-5)<br/>• Class Engagement (1-5)<br/>• Practical Examples (1-5)"]
    L3["Level 3: Extracted Pedagogical Themes<br/>• Topic mention frequency<br/>• Sentiment polarity per theme<br/>(e.g., Clarity: 85% Positive, Pace: 60% Negative)"]
    L4["Level 4: Verifiable Qualitative Evidence<br/>• Paginated, filterable comments<br/>• Interactive filtering by Topic + Sentiment<br/>• Zero student metadata or timestamps exposed"]

    L1 --> L2 --> L3 --> L4
```

### The Small-Cohort Privacy Guard ($N < 5$)
If a course has fewer than 5 submissions (e.g., an elective with 3 students):
- **Problem**: In small classes, a professor could easily identify an individual student's writing style or score.
- **Solution**: The backend automatically enforces the **Small-Cohort Privacy Guard**:
  - The aggregate score is hidden.
  - Granular pedagogical dimensions and extracted topics are suppressed.
  - Raw comments are completely redacted.
  - The UI displays an explicit institutional privacy banner:  
    *"Analytics locked until threshold of 5 submissions is reached to protect student privacy."*

---

## 4. Asynchronous NLP Pipeline & Fault-Tolerant Resilience

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

### Multi-Model NLP Stack:
1. **Sentiment Classification**:
   - Primary: Pre-trained transformer model (`distilroberta-base-sentiment`).
   - Fallback: VADER lexicon-based sentiment analysis when running in lightweight or resource-constrained environments.
2. **Multi-Label Topic Classification**:
   - 7 Institutional Pedagogical Topics:
     * `clarity` (Concept explanation, structure)
     * `pace` (Speed of curriculum delivery)
     * `doubt_handling` (Responsiveness to student questions)
     * `engagement` (Interactive class environment)
     * `practical_examples` (Real-world applications, code samples)
     * `course_materials` (Slides, assignments, notes)
     * `exam_grading` (Fairness and alignment of tests)
   - Evaluated using TF-IDF feature extraction and Scikit-learn multi-label classification.

---

## 5. Security & Defense-in-Depth

The application implements defense mechanisms across every layer:

| Security Vector | Implementation Mechanism | Purpose |
|---|---|---|
| **SQL Injection (SQLi)** | Parameterized queries via `pg` pool + Zod schema typing | Guarantees user input cannot modify SQL syntax. |
| **Cross-Site Scripting (XSS)** | React JSX HTML entity encoding + string sanitization | Comments are stored as plaintext and rendered safely. |
| **IDOR Prevention** | Route-level ownership checks (`verifyOfferingOwnership`) | Professors cannot query analytics or comments for other faculty. |
| **Role Separation** | JWT payload verification (`role: 'student'` vs `'professor'`) | Student tokens are rejected on faculty routes; faculty tokens rejected on student routes. |
| **Brute Force Protection** | Sliding window rate limiting (`authLimiter`) | Restricts authentication attempts to 10 requests per 15-minute window. |
| **Denial of Service (DoS)** | Strict Express body limits (`100kb`) and comment length limits (`2,000 chars`) | Protects database and memory from buffer exhaustion. |
| **Fingerprinting Prevention** | Helmet middleware + `app.disable('x-powered-by')` | Masks server tech stack from automated vulnerability scanners. |

---

## 6. How to Explain the Project During a Presentation or Viva

When asked to explain the system in 2 minutes:

> 1. **The Problem**: Traditional faculty feedback either lacks authenticity because students fear retaliation, or lacks credibility because anyone can post multiple unverified reviews.
> 2. **The Architecture**: We built an Express + React + PostgreSQL + FastAPI system with **Level 1 Practical Anonymity**. We use a dual-table transactional separation: one table locks the student's submission token to prevent duplicate voting, while the feedback itself is written into a completely disconnected table with zero student foreign keys.
> 3. **The Intelligence**: As soon as feedback is saved, a non-blocking asynchronous dispatcher sends the comment to a Python NLP service. DistilRoBERTa and Scikit-learn classify the sentiment and identify up to 7 pedagogical themes (like doubt handling, pacing, and clarity).
> 4. **The Faculty Experience**: Professors get a 4-level dashboard showing overall satisfaction down to specific themes, but with a built-in privacy guard: if fewer than 5 students submit feedback, all individual comments and detailed metrics are masked to prevent reverse-identifying student writing styles.
