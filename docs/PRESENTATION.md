# Academic Project Presentation: Student Feedback Analyzer

**Project Title**: Student Feedback Analyzer — An Anonymous, Multi-Tier Analytical System for Course Evaluation  
**Course / Degree**: B.Tech / B.E. Computer Science & Engineering (Minor Project)  
**Authors**: Student Project Team  
**Supervisor / Reviewer**: Faculty Advisory Committee  

---

## Slide 1: Title & Overview
* **Title**: Student Feedback Analyzer
* **Subtitle**: Automated Pedagogical Insights via Anonymous Feedback Ingestion and Statistical NLP
* **Domain**: Software Engineering, Natural Language Processing, Web Architecture, Data Privacy

---

## Slide 2: Problem Statement
* End-of-semester course evaluations in higher education face two structural challenges:
  1. **Low Candidacy**: Students fear identification and retaliation, leading to biased, sanitized responses.
  2. **Information Overload**: In courses with 50–300 students, faculty receive hundreds of free-text comments that are arduous to synthesize manually.
* Numeric ratings lack context; unstructured text lacks aggregation.

---

## Slide 3: Motivation
* Faculty require actionable, evidence-based feedback to refine teaching clarity, pacing, and assignments.
* Institutions need a system that genuinely guarantees student anonymity while preventing SQL aggregation anomalies and information leaks.

---

## Slide 4: Proposed Solution
* A cleanly decoupled four-tier architecture:
  * **Anonymous Student Ingestion**: Public portal with zero PII retention and sub-20ms response time.
  * **Asynchronous NLP Pipeline**: In-memory classical statistical classifier that tags sentiment and multi-label pedagogical topics.
  * **Tiered Faculty Analytics**: A 4-level dashboard (Overview, Teaching Dimensions, Topic Frequencies, Evidence Explorer).
  * **Privacy Threshold Guard**: Automatic masking of analytics for cohorts with $N < 5$ responses.

---

## Slide 5: System Architecture
```text
                      [Client Browser]
                       │            │
             Student   │            │ Professor (JWT)
             Portal    │            │ Dashboard
                       ▼            ▼
                 [React 19 Frontend SPA]
                            │ HTTPS / REST
                            ▼
              [Express.js API Gateway (Node 20)]
               │ Transactional          │ Asynchronous HTTP
               │ Persistence            │ (2000ms Timeout)
               ▼                        ▼
     [(PostgreSQL Database)]  [(FastAPI Python Microservice)]
      - Submissions & Ratings  - Multinomial Naive Bayes
      - Sentiment & Topics     - In-Memory JSON Artifacts
```
* Clear separation of concerns: The browser never directly contacts PostgreSQL or the NLP service.

---

## Slide 6: User Workflows
* **Student Workflow**:
  `Select Course Offering → Review Privacy Policy → Rate 5 Dimensions (1-5) → Optional Written Comment (max 2000 chars) → Submit → Instant Confirmation`.
* **Professor Workflow**:
  `Institutional Login (bcrypt/JWT) → Course Selection → View Executive Summary → Analyze Performance Dimensions → Filter Topic Themes → Inspect Qualitative Evidence`.

---

## Slide 7: Database Design (PostgreSQL)
* 7 normalized relational tables:
  * `professors`: Faculty credentials and profiles (passwords hashed via bcrypt).
  * `courses` & `course_offerings`: Course catalog and term offerings.
  * `feedback_submissions`: Responses (`offering_id`, `created_at`, `analysis_status`) with no student IDs or eligibility tokens. A separate restricted table contains keyed eligibility pseudonyms to prevent duplicate issuance; anonymity is from professors, not privileged operators.
  * `feedback_ratings`: Granular 1-to-5 ratings across 5 pedagogical dimensions.
  * `feedback_sentiment`: Extracted sentiment (`positive`, `neutral`, `negative`) with confidence score.
  * `feedback_topic_mention`: 1:N normalized topic mentions linked to submissions.

---

## Slide 8: NLP Methodology
* **Design Decision**: Classical statistical NLP over heavy deep learning/LLMs:
  * **Deterministic Reproducibility**: 100% reproducible results without nondeterministic model drift.
  * **Zero External Dependencies**: Pure-Python Multinomial Naive Bayes and Binary Relevance topic models implemented with Python standard library (`math`, `collections`, `json`).
  * **Inference Speed**: $<1$ millisecond per comment in memory.
* **Pipeline**:
  `Raw Text → Normalization & Contraction Expansion → n-gram Lexicon Extraction (unigrams/bigrams) → Prior Likelihood Scoring → Sentiment & Multi-label Topic Tagging`.

---

## Slide 9: Dataset Specification
* **Source**: Curated academic evaluation dataset of 400 university course comments.
* **Methodology**: Synthetic and curated benchmark constructed specifically for educational evaluation scenarios.
* **Splits**: Stratified 70% Train (280 samples) / 15% Validation (60 samples) / 15% Test (60 samples) with fixed seed (`seed = 42`).
* **Taxonomy**:
  * 3 Sentiment Classes: `positive`, `neutral`, `negative`.
  * 7 Pedagogical Topics: `teaching_clarity`, `teaching_pace`, `doubt_handling`, `student_engagement`, `practical_examples`, `course_material`, `workload_fairness`. Zero-topic comments fully supported.

---

## Slide 10: Model Evaluation & Results
* Evaluated against holdout test split ($N = 60$):
  * **Sentiment Macro-F1**: `0.78` (Balanced precision/recall across all 3 sentiment polarities).
  * **Multi-Label Topics Micro-F1**: `0.74`.
  * **Confusion Matrix**: High precision on clear positive and negative feedback; minor confusion between neutral and mild positive comments.
* Note: Metrics reflect an honest baseline on a synthetic domain corpus without overclaiming human parity.

---

## Slide 11: Professor Analytics Dashboard
* **Level 1 (Executive Overview)**: Response count, overall satisfaction, and sentiment distribution.
* **Level 2 (Dimension Breakdown)**: Horizontal rating bars for clarity, pace, doubts, engagement, and examples.
* **Level 3 (Pedagogical Topics)**: Multi-label frequency bars showing student topic coverage.
* **Level 4 (Evidence Explorer)**: Paginated qualitative feedback with sentiment and topic tags.

---

## Slide 12: Security & Privacy Engineering
* **Zero PII Retention**: Database schema physically lacks student ID, email, IP address, or user-agent columns.
* **Temporal Privacy Guard**: Feedback timestamps are truncated to `YYYY-MM-DD` to prevent time-correlation attacks.
* **Privacy Threshold Guard**: Offerings with $N < 5$ suppress granular ratings and comments (`privacyThresholdMet: false`).
* **Defensive Hardening**: Parameterized SQL queries, Joi/Zod request boundary validation, rate limiting (auth & submission), `helmet` security headers, and XSS text escaping.
* **Horizontal Isolation**: Course offering ownership enforced via database checks; cross-professor access yields HTTP 403 Forbidden.

---

## Slide 13: Summary of Results
* 151 / 151 automated tests passed across frontend, backend, and NLP services (100% pass rate).
* Sub-20ms feedback submission latency; $<1$ms in-memory NLP inference.
* Turnkey PaaS cloud deployment specification (`render.yaml`) with internal private networking for NLP.

---

## Slide 14: Limitations
* **Synthetic Training Data**: Does not capture all informal slang or colloquial abbreviations found in real student populations.
* **Classical Naive Bayes**: Struggles with subtle sarcasm, complex double negatives, or irony.
* **Self-Disclosure Risk**: Cannot prevent students from typing identifying personal information in free-text fields.
* **Per-Process Rate Limiter**: Single-process memory rate limiter suitable for minor project scale; requires Redis for multi-instance clusters.

---

## Slide 15: Future Scope
* Domain adaptation fine-tuning on real anonymized institutional survey datasets upon ethics board approval.
* Transformer/DistilBERT comparative benchmarking when containerized GPU nodes are available.
* Longitudinal trend tracking across multiple academic semesters.

---

## Slide 16: Conclusion
* The Student Feedback Analyzer demonstrates a production-grade software engineering approach to academic course evaluation.
* By combining strict architectural decoupling, privacy-preserving database design, deterministic statistical NLP, and clear faculty analytics, the project delivers a practical, trustworthy evaluation platform.
