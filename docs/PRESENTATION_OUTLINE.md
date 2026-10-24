# Project Presentation Outline & Slide Deck Architecture

**Project Title**: Student Feedback Analyzer — Privacy-Preserving Academic Feedback & NLP Analytics  
**Course Context**: Minor Project in NLP & Systems Engineering  
**Target Duration**: 12–15 Minutes (15 Slides)  

---

### Slide 1: Title & Overview
* **Header**: Student Feedback Analyzer
* **Subtitle**: A Privacy-Preserving Feedback Aggregation and NLP Analytics Platform for Higher Education
* **Presenters**: Implementation Engineer / Project Team
* **Affiliation**: Department of Computer Science & Engineering
* **Key Takeaway**: Reconciling strict student identity verification with genuine feedback anonymity.

---

### Slide 2: The Core Dilemma in University Feedback
* **Points**:
  - Student Retaliation Fear: Linked surveys cause self-censorship; students withhold critical critiques.
  - Ballot Stuffing Risk: Public surveys suffer from lack of verification, multiple submissions, and spam.
  - Faculty Cognitive Overload: Instructors teaching 100+ students receive dense, unorganized free text.
* **Core Problem Statement**: How do we guarantee that *only enrolled students submit exactly once*, while ensuring *professors can never identify who submitted what*?

---

### Slide 3: The Architecture Solution: Decoupled Submission
* **Visual**: Identity flow vs. Feedback flow diagram.
* **Points**:
  - Student identity is used exclusively for *Authentication* and *Eligibility Verification*.
  - A dedicated `feedback_submission_control` table enforces one submission per student per course.
  - The actual `feedback_submissions` table contains **zero student identifiers**.
  - A structural database barrier prevents relational joins between students and feedback.

---

### Slide 4: System Architecture & Service Topology
* **Visual**: Three-tier architecture block diagram (Frontend, Express API, PostgreSQL, Python NLP).
* **Points**:
  - **React 19 SPA**: Mobile-first student submission form and comprehensive professor analytics dashboard.
  - **Node.js Express API**: Transactional persistence, rate limiting, and horizontal authorization.
  - **PostgreSQL 16**: Relational storage enforcing Level 1 practical anonymity.
  - **Python FastAPI Subservice**: Isolated, in-memory microservice executing deterministic NLP.

---

### Slide 5: Student User Experience & Privacy Notice
* **Visual**: Screenshot/Mockup of Student Feedback Page & Privacy Notice.
* **Points**:
  - Clear dashboard showing enrolled courses and current submission status (Submitted vs Pending).
  - Prominent "Your Privacy" card explaining Level 1 practical anonymity in plain academic English.
  - Multi-dimensional rating scale across 5 teaching aspects (1–5 scale).
  - Live character-limited free-text comment box (max 2,000 characters).

---

### Slide 6: One-Submission Invariant & Integrity Enforcement
* **Visual**: Database sequence flowchart of submission vs rejection.
* **Points**:
  - Backend verifies enrollment before accepting feedback.
  - Composite unique constraint `UNIQUE (student_id, course_offering_id)`.
  - Re-submission attempts are rejected immediately with **HTTP 409 CONFLICT**.
  - Non-enrolled students are rejected with **HTTP 404/403**.

---

### Slide 7: NLP Analytical Methodology: Sentiment & Topics
* **Points**:
  - **Sentiment Analysis**: 3-class single-label (`positive`, `neutral`, `negative`).
  - **Multi-Label Topics**: 7 pedagogical dimensions (*Teaching Clarity*, *Pace*, *Practical Examples*, *Doubt Handling*, *Engagement*, *Assignments*, *Course Content*).
  - **Zero-Topic Handling**: Non-pedagogical comments receive empty topic arrays (`[]`).
  - **Pure-Python Naive Bayes**: Pre-trained CountVectorizer and class log-likelihood parameter dictionaries.

---

### Slide 8: Dataset & Experimental Evaluation
* **Points**:
  - **Dataset**: 100 annotated collegiate feedback samples situated in an Indian engineering context.
  - **Splits**: 69 Train / 15 Validation / 16 Held-out Test.
  - **Sentiment Accuracy**: `81.25%` (Macro F1: `0.8139`).
  - **Multi-label Topic Categorization**: Hamming Loss `0.1071` (Macro F1: `0.6650`).
  - Top Performing Topics: *Teaching Pace* (1.00 F1), *Practical Examples* (1.00 F1), *Teaching Clarity* (0.75 F1).

---

### Slide 9: Asynchronous NLP & Failure Isolation
* **Visual**: Asynchronous sequence diagram.
* **Points**:
  - Student submission transaction commits to PostgreSQL *before* NLP inference is triggered.
  - Downstream ML latency or service downtime never causes student submission loss.
  - If NLP is down, record is stored with `analysis_status: 'failed'`.
  - Background recovery sweeper automatically processes pending/failed records once healthy.

---

### Slide 10: Professor Analytics Dashboard
* **Visual**: Screenshot/Mockup of Faculty Dashboard Page.
* **Points**:
  - High-Level Summary: Total respondents ($N$), overall course rating, response status.
  - 5-Dimension Performance Breakdown: Colored status tags (*Strength*, *Moderate*, *Weak*).
  - Multi-Label Topic Matrix: Shows discussion volume and dominant sentiment per topic.
  - Sentiment Distribution: Stacked visual representation of student sentiment.

---

### Slide 11: Qualitative Evidence & Temporal Discretization
* **Visual**: Comment cards with coarse dates.
* **Points**:
  - Authenticity: Comments represent genuine stored feedback.
  - Temporal Privacy: Submission timestamps are discretized to coarse date strings (`YYYY-MM-DD` and `Mon YYYY`).
  - Zero PII Leakage: Complete audit confirms zero student names, IDs, or emails in faculty payloads.

---

### Slide 12: Small-Cohort Privacy Guard ($N < 5$)
* **Points**:
  - Re-identification Risk: In small seminar classes (e.g., $N = 2$), individual ratings and phrasing can easily identify students.
  - Privacy Threshold: Dashboard hides granular distributions and withholds written comments when $N < 5$.
  - Transparency: Shows clean informational state explaining that more responses are required.

---

### Slide 13: Full-Stack Security & Hardening Controls
* **Points**:
  - **Authentication**: Bcrypt (10 rounds) + signed HMAC-SHA256 JWTs (24h expiration).
  - **IDOR Protection**: `requireOfferingOwnership` blocks faculty from accessing peer courses (HTTP 403).
  - **Injection Defense**: 100% parameterized SQL queries; XSS neutralized via React text interpolation.
  - **Denial of Service**: 100kb payload ceiling (HTTP 413) and in-process rate limiters.

---

### Slide 14: Academic Limitations & Honesty
* **Points**:
  - **No LLM Hallucinations**: Zero generative prompts; the system never invents recommendations.
  - **Level 1 Practical Anonymity**: Cryptographic unlinkability is not claimed; operational logs could correlate timestamps.
  - **Lexical Classifier**: Bag-of-words Naive Bayes model has limitations on complex syntactic negation and sarcasm.
  - **Student Self-Disclosure**: The system cannot prevent a student from voluntarily writing their name in the comment text.

---

### Slide 15: Conclusion & Live Demonstration
* **Summary**:
  - Reconciled verified enrollment with anonymous qualitative feedback.
  - Implemented explainable, sub-millisecond asynchronous NLP classification.
  - Built an intuitive, secure faculty analytics dashboard grounded in mathematical ground truth.
* **Next**: Live System Demonstration.
