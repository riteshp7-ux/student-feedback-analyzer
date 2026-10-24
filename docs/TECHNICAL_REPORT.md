# Student Feedback Analyzer: Academic Technical Report

**Project Title**: Privacy-Preserving Academic Feedback Aggregation and Natural Language Analytics System  
**Course Context**: Minor Project in Natural Language Processing & Systems Engineering  
**Version**: `1.0.0` (Git Commit: `e1c0cd1b8fee78d611cccaa7602d3546c03c5430`)  
**Date**: October 2026  

---

## 1. Abstract

Student feedback provides indispensable formative assessment data for teaching faculty, yet conventional evaluation mechanisms in higher education face severe challenges: low response veracity caused by student retaliation fears, and qualitative analysis bottlenecks caused by the manual labor of reviewing voluminous unstructured text. This report presents the design, formal implementation, and empirical verification of the **Student Feedback Analyzer**, an end-to-end full-stack software system. The architecture guarantees **Level 1 Practical Anonymity** by decoupling authenticated student enrollment and unique submission verification from stored anonymous feedback records. Qualitative commentary is processed using an asynchronous, pure-Python in-memory natural language processing microservice utilizing Multinomial Naive Bayes classification for 3-class sentiment estimation and 7-class multi-label pedagogical topic categorization. An interactive faculty dashboard synthesizes multi-dimensional ratings and qualitative evidence while strictly enforcing privacy threshold guards ($N \ge 5$) on small student cohorts.

---

## 2. Introduction & Motivation

Feedback collection is an essential component of quality assurance in collegiate education. However, paper-based forms and naive public online surveys exhibit critical failure modes:
1. **Public/Unauthenticated Surveys**: Vulnerable to spam, ballot-stuffing, external manipulation, and multiple submissions by single actors wishing to distort ratings.
2. **Authenticated Linked Surveys**: Students recognize that institutional logins can track individual comments, causing them to self-censor legitimate critiques regarding course pacing, conceptual clarity, or grading fairness.
3. **Cognitive Overload**: Faculty members teaching large class cohorts (60–200+ students) struggle to extract actionable pedagogical trends from dense collections of unstructured text without systematic analytical tooling.

The Student Feedback Analyzer reconciles these tensions by creating an unlinked two-table database boundary: identity verifies eligibility and records completion, while feedback persists completely unlinked to any student identifier.

---

## 3. Problem Statement & Measurable Objectives

### Problem Statement
To design and construct a resilient, secure academic feedback system that authoritatively verifies student enrollment and limits submissions to exactly once per course offering, while rendering it structurally impossible for faculty members to identify student authors through standard application pathways, paired with explainable NLP for thematic and sentiment analysis.

### Measurable Objectives
1. **Eligibility Enforcement**: Guarantee that 100% of feedback submissions originate from enrolled students.
2. **Uniqueness Invariant**: Enforce a strict one-submission-per-course rule, rejecting duplicate attempts with HTTP 409.
3. **Anonymity Boundary**: Ensure zero student identifiers (`student_id`, email, name, IP address) are stored in feedback tables or transmitted in faculty APIs.
4. **NLP Latency & Isolation**: Complete NLP inference in <5ms without blocking client transactions, isolating downstream ML failures from database commits.
5. **Data Correctness**: Attain 100% mathematical agreement between database aggregations and dashboard metrics without SQL join distortion.
6. **Small-Cohort Privacy**: Hide granular distributions and qualitative comments whenever cohort respondents $N < 5$.

---

## 4. System Architecture & Component Decomposition

```text
Student Client                               Professor Client
 (React 19 SPA)                               (React 19 SPA)
       │                                            │
       │ HTTPS / REST                               │ HTTPS / REST
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────┐
│                 Express API Gateway (Node.js)                │
│   - Rate Limiting (30 req/min general, 10 req/15m auth)     │
│   - Helmet Security Headers, JSON Size Limit (100kb)         │
│   - JWT Session Verification (Student vs Faculty Roles)       │
│   - Horizontal Ownership Guard (requireOfferingOwnership)    │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
               │ PostgreSQL Connection Pool   │ Loopback HTTP (Private)
               │ (100% Parameterized SQL)     │ (Timeout: 2000ms)
               ▼                              ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│   PostgreSQL 16 Relational   │   │ Python FastAPI NLP Subsystem │
│ - students                   │   │ - Multinomial Naive Bayes    │
│ - course_enrollments         │   │ - Binary Relevance Topics    │
│ - feedback_submission_control│   │ - Pre-trained JSON Artifacts │
│ - feedback_submissions       │   │ - Deterministic (<2ms latency│
│ - feedback_sentiment/topics  │   └──────────────────────────────┘
└──────────────────────────────┘
```

The system comprises three decoupled operational tiers:
1. **Frontend Presentation Layer**: Built with React 19 and Vite. Implements separate, role-gated interfaces for student submissions and professor analytics.
2. **Express API Gateway & Persistence Coordinator**: Node.js/Express service enforcing authentication, schema validation (Zod), horizontal authorization (IDOR protection), and transactional persistence.
3. **NLP Analytical Subsystem**: Isolated FastAPI microservice running in Python 3.10+. Binds strictly to private loopback networking (`127.0.0.1:8000`) and executes deterministic Naive Bayes inference over pre-trained parameter dictionaries.

---

## 5. Database Schema & Privacy Boundary

The PostgreSQL relational schema enforces **Level 1 Practical Anonymity**:

```text
students (id, email, password_hash, student_id_number, full_name)
   │
   ├──< course_enrollments (id, student_id, course_offering_id)
   │
   └──< feedback_submission_control (id, student_id, course_offering_id [UNIQUE], submitted_at)

══════════════════════════════════════════════════════════════════════════════════════════════
               ARCHITECTURAL PRIVACY BOUNDARY (ZERO RELATIONAL KEYS)
══════════════════════════════════════════════════════════════════════════════════════════════

feedback_submissions (id, offering_id, rating_clarity, rating_pace, rating_doubt_handling,
                      rating_engagement, rating_practical_examples, comment_text,
                      analysis_status, created_at)
   │
   ├──< feedback_sentiment (submission_id, label, score, analyzed_at)
   │
   └──< feedback_topic_mention (id, submission_id, topic_key, confidence)
```

### Relational Schema Properties
* **Decoupled Entities**: `feedback_submissions` contains no `student_id`. A relational `JOIN` between `students` and `feedback_submissions` is structurally impossible in the database schema.
* **Submission Control**: The `feedback_submission_control` table enforces a composite unique constraint `UNIQUE (student_id, course_offering_id)`. Attempting a second submission triggers a PostgreSQL unique violation mapped cleanly to **HTTP 409 CONFLICT**.
* **Date Discretization**: Exact transaction timestamps (`created_at`) are truncated to coarse dates (`YYYY-MM-DD` and `Mon YYYY`) in SQL queries before reaching client APIs, preventing temporal correlation with classroom dismissal times.

---

## 6. NLP Analytical Methodology

### 6.1 Dataset & Context
* **Volume**: 100 annotated feedback examples situated in an Indian engineering collegiate context (e.g., references to *viva*, *lab records*, *semester credits*, *math proofs*).
* **Partitions**: Train (69 examples), Validation (15 examples), Test (16 examples).
* **Controlled Taxonomy**:
  - **Sentiment (3-class single-label)**: `positive`, `neutral`, `negative`.
  - **Topics (7-class multi-label)**: `teaching_clarity`, `teaching_pace`, `practical_examples`, `doubt_handling`, `engagement`, `assignments`, `course_content`.

### 6.2 Feature Extraction & Model Formulation
Text is tokenized, lowercased, and stripped of punctuation. A pure-Python CountVectorizer extracts unigram and bigram counts across a controlled vocabulary of 144 terms.

1. **Multinomial Naive Bayes (Sentiment)**:
   Computes class posterior probabilities using class priors $P(c)$ and feature likelihoods with Laplace smoothing ($\alpha = 1.0$):
   $$\hat{c} = \arg\max_{c \in C} \left[ \log P(c) + \sum_{i=1}^V x_i \cdot \log P(w_i \mid c) \right]$$
2. **Binary Relevance (Multi-label Topics)**:
   Constructs 7 independent binary Naive Bayes classifiers. Each classifier determines whether topic $t_k$ is present based on log-odds thresholding.

### 6.3 Empirical Evaluation Results (Held-out Test Split)

| Task | Metric | Value |
| :--- | :--- | :---: |
| **Sentiment Analysis** | Accuracy | **81.25%** |
| | Macro Precision | 80.24% |
| | Macro Recall | 84.13% |
| | Macro F1-Score | **0.8139** |
| **Topic Categorization** | Subset Accuracy | 37.50% |
| | Hamming Loss | **0.1071** |
| | Macro F1-Score | **0.6650** |

*Per-Topic Performance Highlights*:
- `teaching_pace`: Precision 1.00, Recall 1.00, F1 **1.00** (Support: 5)
- `practical_examples`: Precision 1.00, Recall 1.00, F1 **1.00** (Support: 3)
- `teaching_clarity`: Precision 0.60, Recall 1.00, F1 **0.75** (Support: 3)
- `assignments`: Precision 1.00, Recall 1.00, F1 **1.00** (Support: 1)

---

## 7. Security Hardening & Defenses

1. **Password Hashing**: Passwords stored via `bcrypt` (10 salt rounds). Uniform comparison paths prevent account enumeration attacks.
2. **Object-Level Authorization (IDOR)**: `requireOfferingOwnership` middleware verifies `course_offerings.professor_id === req.user.professorId`. Unauthorized access returns **HTTP 403 FORBIDDEN**.
3. **SQL Injection**: 100% of SQL queries utilize PostgreSQL positional parameters (`$1`, `$2`). Zero dynamic SQL string concatenations exist.
4. **Cross-Site Scripting (XSS)**: Feedback comments are stored verbatim as text and safely rendered via React text nodes (`<p>"{comment.commentText}"</p>`). Zero `dangerouslySetInnerHTML` occurrences.
5. **Rate Limiting & Payload Boundaries**: Express limits JSON bodies to `100kb` (HTTP 413) and bounds comments to 2,000 characters. In-process rate limiters enforce 30 req/min general traffic and 10 req/15min authentication attempts.

---

## 8. Limitations & Honest Scope

* **Dataset Scale**: Evaluated on an academic dataset of 100 examples. Generalization to other disciplines (humanities, medicine) requires larger domain-specific datasets.
* **Lexical Baseline**: Uses bag-of-words Naive Bayes rather than transformer embeddings (e.g. BERT). While inference is exceptionally fast (<2ms) and fully explainable, subtle sarcasm or complex syntactic negation can be misclassified.
* **Level 1 Practical Anonymity**: Cryptographic zero-knowledge unlinkability is not claimed. Privileged database administrators with access to low-level transaction logs could theoretically correlate timestamps.
* **Student Self-Disclosure**: If a student writes their own name or unique personal identifying scenario in the comment box, the application cannot magically prevent that. A prominent warning disclaimer advises students against personal disclosure.

---

## 9. Future Work

1. **Pre-Submission Anonymization Assistance**: Client-side NER (Named Entity Recognition) to automatically highlight and prompt students to redact names, dates, or contact info before submitting.
2. **Expanded Multi-Lingual Support**: Training Naive Bayes dictionaries on regional Indian languages and code-mixed collegiate slang (Hinglish).
3. **Longitudinal Pedagogical Tracking**: Analyzing topic sentiment trajectories across consecutive academic semesters to measure faculty improvement.

---

## 10. Conclusion

The Student Feedback Analyzer demonstrates that robust student identity enforcement and genuine feedback anonymity are not mutually exclusive. By establishing an unlinked relational data model, pairing it with asynchronous, explainable NLP, and enforcing strict privacy threshold guards, the system provides higher education institutions with a dependable, transparent platform for constructive academic evaluation.
