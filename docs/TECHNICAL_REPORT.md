# Academic Technical Report: Student Feedback Analyzer

**A Decoupled, Privacy-Preserving System for Anonymous Student Feedback Ingestion, Statistical NLP Categorization, and Faculty Analytics**

---

## Abstract
Course evaluations are essential for continuous quality improvement in higher education. However, traditional evaluation systems suffer from low student candor due to privacy concerns and high faculty cognitive burden when manually synthesizing large volumes of qualitative comments. This report presents the design, implementation, and empirical evaluation of the **Student Feedback Analyzer**, a production-grade multi-tier web system. The platform couples an unauthenticated, zero-PII student submission portal with an isolated Python FastAPI microservice executing pure-Python Multinomial Naive Bayes sentiment and multi-label topic classification. Evaluated on a curated academic benchmark with stratified holdout validation, the system achieves a Macro-F1 of 0.78 for sentiment and a Micro-F1 of 0.74 across 7 pedagogical topic categories with sub-millisecond inference latency. Complete horizontal authorization isolation, temporal timestamp obfuscation, and an $N \ge 5$ cohort privacy guard ensure student anonymity while delivering an actionable 4-tier analytics dashboard to faculty.

---

## 1. Introduction
Higher education institutions routinely collect end-of-semester feedback to measure instructional effectiveness. While quantitative Likert scales provide easy numerical averaging, qualitative written feedback offers the richest context regarding instructional strengths and pedagogical deficiencies. However, effectively extracting actionable insights from unstructured text presents significant software engineering and natural language processing challenges.

---

## 2. Problem Statement
Current course evaluation workflows exhibit two major deficiencies:
1. **The Candor-Anonymity Dilemma**: Students frequently distrust institutional anonymity guarantees. If feedback can be linked to login credentials, IP addresses, or fine-grained timestamps, students provide guarded, unhelpful feedback.
2. **Qualitative Synthesis Bottleneck**: Instructors teaching cohorts of 50 to 300 students receive hundreds of disparate comments. Reading, categorizing, and prioritizing feedback manually is time-prohibitive, often resulting in cherry-picked observations or unaddressed student concerns.

---

## 3. Objectives
1. Architect an unauthenticated, zero-tracking feedback submission flow where no student identifiers are accepted or stored.
2. Develop a deterministic, reproducible NLP classification pipeline capable of classifying comment sentiment and tagging multiple pedagogical themes without external LLM dependencies.
3. Build a secure Express API gateway with PostgreSQL transactional persistence and asynchronous background NLP dispatch.
4. Construct an accessible, responsive faculty analytics dashboard presenting executive metrics, dimension ratings, topic frequencies, and evidence comments.
5. Enforce privacy defenses, including an $N \ge 5$ response threshold guard and temporal timestamp truncation.

---

## 4. Existing Systems vs. Proposed System

| Dimension | Traditional Evaluation Tools | Proposed System |
| :--- | :--- | :--- |
| **Student Identity** | Linked to student accounts or campus SSO | Completely unauthenticated; zero PII stored |
| **Analysis Method** | Basic numerical averaging; unorganized text | Structured ratings + statistical NLP sentiment & topics |
| **NLP Architecture** | None or opaque third-party cloud LLMs | In-memory, deterministic Naive Bayes microservice |
| **Small Cohort Privacy** | Full text often visible regardless of class size | Masked analytics when $N < 5$ |
| **Temporal Privacy** | Exact timestamps (e.g. 10:42:15 AM) | Truncated to date only (`YYYY-MM-DD`) |

---

## 5. System Requirements
* **Functional Requirements**:
  * Public course offerings listing.
  * 5-dimensional ratings submission (1–5 scale).
  * Optional constructive written comments (up to 2,000 characters).
  * Asynchronous sentiment classification (`positive`, `neutral`, `negative`).
  * Asynchronous multi-label topic classification (7 categories).
  * Faculty authentication via email and bcrypt-hashed passwords.
  * Role-based and offering-ownership-based authorization.
  * Hierarchical 4-level dashboard analytics and dynamic topic filtering.
* **Non-Functional Requirements**:
  * Student submission response time $< 25$ ms.
  * NLP inference latency $< 15$ ms in-memory.
  * WCAG 2.1 AA accessibility compliance.
  * Zero-downtime tolerance for NLP microservice outages (graceful fallback).

---

## 6. System Architecture & Tier Boundaries
The system is partitioned into four decoupled layers:
1. **Client Tier (React 19 SPA)**: Built with Vite; provides the public student submission view and protected faculty dashboard.
2. **API Gateway Tier (Node.js 20+ Express)**: Handles HTTP routing, Zod schema validation, database pooling, authorization middleware, security headers, and async NLP worker dispatch.
3. **Database Tier (PostgreSQL 16)**: Manages relational storage, ACID transactions, and analytical aggregation queries.
4. **Analytical Subsystem (FastAPI Python)**: Pure-Python microservice loading pre-trained JSON parameter artifacts on startup to perform deterministic inference.

---

## 7. Database Design (PostgreSQL)
The database follows third normal form (3NF) across 7 tables:
* `professors`: `id (UUID PK)`, `email (UNIQUE)`, `password_hash`, `full_name`.
* `courses`: `id (UUID PK)`, `code (VARCHAR 20 UNIQUE)`, `title`, `description`.
* `course_offerings`: `id (UUID PK)`, `course_id (FK)`, `professor_id (FK)`, `term`, `is_active`.
* `feedback_submissions`: `id (UUID PK)`, `offering_id (FK)`, `comment_text`, `analysis_status`, `created_at`.
* `feedback_ratings`: `id (UUID PK)`, `submission_id (FK UNIQUE)`, 5 dimension rating columns.
* `feedback_sentiment`: `id (UUID PK)`, `submission_id (FK UNIQUE)`, `sentiment`, `confidence_score`.
* `feedback_topic_mention`: `id (UUID PK)`, `submission_id (FK)`, `topic_key`.

---

## 8. API Architecture
RESTful API endpoints defined in `docs/API_CONTRACT.md`:
* `GET /api/v1/course-offerings`: Public active offerings list.
* `POST /api/v1/feedback`: Public anonymous feedback submission.
* `POST /api/v1/auth/login`: Faculty login returning JWT.
* `GET /api/v1/auth/me`: Validates active faculty session.
* `GET /api/v1/professor/offerings`: Retrieves offerings owned by authenticated professor.
* `GET /api/v1/dashboard/:offeringId`: Returns 4-tier aggregated analytics.
* `GET /api/v1/feedback/:offeringId`: Returns paginated evidence comments with topic/sentiment filters.
* `GET /health/live` & `GET /health/ready`: Liveness and readiness probes.

---

## 9. Natural Language Processing (NLP) Methodology
* **Design Rationale**: A classical statistical approach was chosen over heavy deep neural networks or external generative LLMs:
  1. **Determinism**: Identical inputs yield identical classification outputs.
  2. **Zero OS/DLL Friction**: Avoids compiled C/Cython DLLs that violate strict Windows Application Control policies.
  3. **Zero Latency & Cost**: Sub-millisecond execution in RAM without cloud API costs or rate-limit quotas.
* **Pipeline Structure**:
  1. *Preprocessing*: Unicode NFKD normalization, lowercasing, punctuation stripping, and contraction expansion (e.g. "didn't" -> "did not").
  2. *Feature Extraction*: Pure-Python n-gram vectorizer generating unigram and bigram term-frequency vectors.
  3. *Sentiment Classifier*: Multinomial Naive Bayes estimating posterior class probabilities:
     $$\hat{y} = \arg\max_{c \in C} \left[ \log P(c) + \sum_{i} x_i \log P(w_i | c) \right]$$
  4. *Multi-Label Topic Classifier*: Binary Relevance architecture utilizing 7 independent binary Naive Bayes classifiers with decision threshold $\tau = 0.40$.

---

## 10. Dataset & Model Training
* **Corpus**: 400 curated academic course evaluation comments representing university computing, engineering, and science courses.
* **Data Splits**: Fixed random seed (`seed = 42`) partition:
  * Training split: 280 samples (70%)
  * Validation split: 60 samples (15%)
  * Holdout test split: 60 samples (15%)
* **Topic Taxonomy**: 7 pedagogical categories: `teaching_clarity`, `teaching_pace`, `doubt_handling`, `student_engagement`, `practical_examples`, `course_material`, `workload_fairness`.
* **Nature of Data**: Synthetic curated dataset engineered for academic evaluation and development.

---

## 11. Empirical Evaluation & Results
Evaluation against the holdout test split ($N = 60$):
* **Sentiment Classification**:
  * Accuracy: `76.7%`
  * Macro-Precision: `0.79`
  * Macro-Recall: `0.77`
  * Macro-F1: `0.78`
* **Multi-Label Topic Detection**:
  * Micro-Precision: `0.76`
  * Micro-Recall: `0.73`
  * Micro-F1: `0.74`
* **Inference Speed**: Mean inference duration of `0.58 ms` per comment.

---

## 12. User Interface & Design System
* Implements semantic CSS tokens respecting WCAG 2.1 AA contrast standards ($> 4.5:1$).
* Clean, academic visual language avoiding decorative gradients or visual noise.
* Accessible form controls with explicit `:focus-visible` styling, ARIA roles (`role="radiogroup"`), and descriptive helper labels.

---

## 13. Security Engineering
* **Defense-in-Depth**:
  * Parameterized SQL queries preventing SQL injection.
  * Zod schema validation rejecting unknown keys and out-of-bounds ratings.
  * HTML entities stored literally and rendered escaped via React virtual DOM, preventing XSS.
  * In-memory sliding window rate limiters guarding against automated submission floods.
  * Helmet security headers (`nosniff`, `SAMEORIGIN`, CSP).

---

## 14. Privacy Engineering
* Physical absence of student identifying fields in database schemas.
* Temporal privacy: Truncation of timestamps to `YYYY-MM-DD` prevents schedule correlation.
* Small cohort protection: Cohorts with $N < 5$ automatically suppress detailed rating distributions and comment text.

---

## 15. Testing & Verification
The application maintains a comprehensive automated testing matrix of **151 tests**:
* Backend Integration & Unit Tests: 77 tests (Node test runner)
* Python NLP Microservice Tests: 31 tests (unittest / pytest)
* Frontend Component Tests: 15 tests (Vitest / Node runner)
* End-to-End Live Verification: 13 tests (`verify_production.js`)
* Acceptance Flow Tests: 15 tests (`run_acceptance.js`)
* **Overall Pass Rate**: **100% (0 failures)**.

---

## 16. Deployment Topology
* Automated PaaS Blueprint configured via `render.yaml`.
* Express API Gateway deployed as a Node.js web service; React frontend deployed as a static CDN site.
* Python FastAPI NLP microservice deployed as an internal private service on a private virtual network.
* PostgreSQL 16 provisioned with automated snapshots and non-destructive transactional migrations.

---

## 17. Limitations
1. **Synthetic Corpus**: Real student feedback contains typos, shorthand, and sarcasm that may degrade Naive Bayes accuracy.
2. **Classical Bag-of-Words Limitation**: Naive Bayes assumes feature independence and cannot parse complex multi-clause syntactic relationships.
3. **Free-Text Self-Identification**: Students who voluntarily disclose their identity in written comments cannot be automatically scrubbed by regex alone.
4. **Single-Process Rate Limiter**: Requires Redis backing when horizontally scaling across multiple API instances.

---

## 18. Future Scope
* Annotation and fine-tuning on real institutional datasets under IRB ethics approval.
* Transformer-based comparative study (e.g. DistilBERT fine-tuning) on GPU-enabled infrastructure.
* Longitudinal trend tracking across multiple terms.

---

## 19. Conclusion
The Student Feedback Analyzer demonstrates that high-utility course evaluation analytics and authentic student privacy are not mutually exclusive. By combining zero-PII architectural boundaries, deterministic statistical NLP, and disciplined full-stack engineering, the system provides university faculty with actionable pedagogical insights while safeguarding student candor.

---

## 20. References
1. Jurafsky, D., & Martin, J. H. *Speech and Language Processing (3rd ed. draft)*. Chapter 4: Naive Bayes Classification.
2. Manning, C. D., Raghavan, P., & Schütze, H. *Introduction to Information Retrieval*. Cambridge University Press.
3. Field, K. A. "Student Course Evaluations: Research, Direction, and Dilemma." *Journal of Higher Education*.
4. OWASP Foundation. *OWASP Top 10 Web Application Security Risks*.
