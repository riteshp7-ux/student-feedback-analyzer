# Portfolio Case Study: Student Feedback Analyzer

**A privacy-preserving course evaluation platform that synthesizes qualitative student feedback into structured faculty analytics using statistical NLP.**

---

## Short Description
The Student Feedback Analyzer is a full-stack web platform built with React 19, Express, PostgreSQL, and Python FastAPI. Students submit course feedback anonymously to professors using one-time registrar-issued offering tokens. Professors receive an evidence-backed analytics dashboard featuring sentiment classification and multi-label pedagogical topic extraction.

---

## Technical Highlights
* **Decoupled Multi-Tier Architecture**: Built with clear architectural boundaries—React 19 SPA frontend, Express Node.js API Gateway, PostgreSQL relational database, and an isolated Python FastAPI NLP microservice.
* **Anonymous-to-Faculty Ingestion**: One-time course tokens enforce one response per roster entry and exact offering without storing direct student identity or tokens on feedback rows. A restricted table keeps a keyed roster pseudonym; privileged infrastructure operators may infer eligibility when they also have roster and pepper access.
* **Deterministic Statistical NLP**: Engineered a pure-Python Multinomial Naive Bayes sentiment classifier and a Binary Relevance multi-label topic classifier without external LLM dependencies, running in $<1$ ms in memory.
* **Asynchronous Inference & Resilience**: Submission transactions commit immediately to PostgreSQL (`analysis_status = 'pending'`), with NLP analysis dispatched asynchronously outside the request loop. Temporary NLP microservice downtime never disrupts student submissions.
* **Role-Based Authentication & Horizontal Isolation**: Secured faculty dashboard with bcrypt password hashing and HMAC-SHA256 JWT tokens. Enforces course-offering ownership at the database level to block cross-faculty data inspection.
* **Small Cohort Privacy Guard**: Backend aggregation queries enforce an $N \ge 5$ response threshold, automatically withholding detailed ratings and qualitative comments for small classes to prevent deanonymization.
* **Automated Testing & PaaS Deployment**: Maintained a 100% test pass rate across 151 automated tests (unit, integration, and E2E) and packaged the stack with a turnkey Render Blueprint (`render.yaml`).

---

## Key Engineering Decisions & Rationale

### 1. Why PostgreSQL Instead of MongoDB / NoSQL?
* **Decision**: Selected PostgreSQL 16 relational database with strict schema migrations.
* **Rationale**: Course evaluation data is fundamentally relational: courses have offerings, offerings have professors, submissions have dimensional ratings, and submissions have 1:N topic mentions. Relational integrity guarantees foreign-key constraints, while transactional ACID guarantees ensure submissions and ratings persist atomically without orphaned records.

### 2. Why an Isolated Python NLP Service Instead of In-Node NLP?
* **Decision**: Deployed the NLP pipeline as a standalone FastAPI microservice on an internal private network rather than running NLP libraries inside Node.js.
* **Rationale**: Separates high-throughput I/O gateway concerns from CPU-bound analytical feature extraction. Python provides standard scientific computing libraries, and the microservice can be scaled, retrained, or swapped without touching the core Express transaction logic.

### 3. Why Classical Statistical NLP (Naive Bayes) Over Deep Learning / Generative LLMs?
* **Decision**: Implemented classical Multinomial Naive Bayes with n-gram TF-IDF rather than fine-tuning a deep transformer or calling third-party LLM APIs.
* **Rationale**:
  1. **Determinism**: Produces 100% reproducible classifications without prompt drift or hallucinations.
  2. **Zero Operating Cost**: Runs locally in RAM with sub-millisecond latency (<1 ms) without recurring API token expenses.
  3. **Operational Simplicity**: Avoids compiled C/Cython DLLs that conflict with Windows Application Control policies, allowing instant execution on any host environment.

### 4. Why Asynchronous Background NLP Dispatch?
* **Decision**: Decoupled feedback persistence from NLP inference using `setImmediate` and transactional state transitions (`pending` -> `completed` / `failed`).
* **Rationale**: Students should never experience submission delays or failures because the analytical service is under load or temporarily restarting. Submissions commit in $<20$ ms, and an idempotent background recovery sweeper handles unanalyzed records.

### 5. Why Truncate Feedback Timestamps to `YYYY-MM-DD`?
* **Decision**: Truncated timestamps in faculty evidence queries to the date only, discarding hours, minutes, and seconds.
* **Rationale**: In small to medium cohorts, a professor who sees a comment submitted at *11:05 AM* could easily correlate that submission with a student who left lecture at that exact time. Temporal truncation eliminates this deanonymization vector.

### 6. Why Calculate Dashboard Aggregates Directly from Source Records?
* **Decision**: Derived dashboard metrics are computed dynamically using mathematical SQL aggregation (`AVG`, `COUNT`, `ROUND`) rather than pre-aggregating in mutable summary tables.
* **Rationale**: Guarantees strict data provenance and prevents cache invalidation inconsistencies or Cartesian join explosion. The dashboard numbers match the mathematical reality of source database records at all times.
