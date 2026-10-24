# Live Demonstration Script & Presenter Guide

This script provides a 5-minute step-by-step walkthrough of the Student Feedback Analyzer for faculty evaluators, reviewers, and project examiners.

---

## 1. Pre-Demo Setup & Environment Verification

Before beginning the live presentation:
1. Ensure all services are running:
   - Backend on `http://127.0.0.1:5000`
   - NLP service on `http://127.0.0.1:8000`
   - Frontend on `http://localhost:5173`
2. Ensure clean seeded data:
   ```bash
   node -e "process.env.ALLOW_DESTRUCTIVE_DEMO_RESET='YES'; process.env.DEMO_RESET_DATABASE='feedback_analyzer'; require('./backend/src/db/seeds/seed').seedDatabase().then(() => process.exit(0));"
   ```
3. Open two browser windows (or an Incognito window):
   - Window A: Student Interface (`http://localhost:5173`)
   - Window B: Professor Portal (`http://localhost:5173/login`)

---

## 2. Demonstration Walkthrough (5 Minutes)

### Step 1: Student Login & Offering Discovery (1 Minute)
* **Action**:
  - In Window A, navigate to `http://localhost:5173`.
  - Enter student credentials:
    - Email: `diya@student.university.edu`
    - Password: `SecureStudent123!`
  - Click **Sign In**.
* **Presenter Script**:
  > *"Notice that the student authenticates using their institutional email. The portal loads only the course offerings in which Diya is actively enrolled: CS301 (Database Systems). The status clearly displays 'Not Submitted'."*

### Step 2: Privacy Notice & One-Submission Submission (1.5 Minutes)
* **Action**:
  - Scroll down to highlight the **Your privacy** banner. Click to expand **How privacy works**.
  - Fill out the feedback ratings:
    - Teaching Clarity: `5`
    - Teaching Pace: `4`
    - Doubt Handling: `5`
    - Engagement: `4`
    - Practical Examples: `5`
  - In the comment box, type:
    > *"The indexing diagrams and B-tree walkthroughs made relational storage very clear and intuitive!"*
  - Click **Submit Feedback**.
  - Show the immediate green confirmation message.
  - Attempt to submit a second time by selecting CS301 again.
* **Presenter Script**:
  > *"The privacy notice transparently explains Level 1 Practical Anonymity. Upon clicking Submit, the feedback record is committed to PostgreSQL immediately. When we attempt to submit again, the system immediately blocks it with a conflict error. Notice that Diya cannot vote twice."*

### Step 3: Database Decoupling Inspection (30 Seconds - Optional / Technical)
* **Action**:
  - Open terminal and show:
    ```bash
    node -e "require('./backend/src/config/db').pool.query('SELECT * FROM feedback_submissions ORDER BY created_at DESC LIMIT 1').then(r => { console.log(r.rows[0]); process.exit(0); });"
    ```
* **Presenter Script**:
  > *"Examining the raw database row proves our privacy guarantee: the feedback record contains ratings and comment text, but completely lacks student_id, student email, or student name. Relational joins between students and feedback are structurally impossible."*

### Step 4: Asynchronous NLP Processing (30 Seconds)
* **Action**:
  - In terminal, show the NLP inference output for that submission:
    ```bash
    node -e "require('./backend/src/config/db').pool.query('SELECT s.label, s.score, json_agg(t.topic_key) as topics FROM feedback_sentiment s JOIN feedback_topic_mention t ON s.submission_id = t.submission_id WHERE s.submission_id = (SELECT id FROM feedback_submissions ORDER BY created_at DESC LIMIT 1) GROUP BY s.label, s.score').then(r => { console.log(r.rows[0]); process.exit(0); });"
    ```
* **Presenter Script**:
  > *"Without blocking the user's submission, our in-memory Naive Bayes microservice analyzed the text asynchronously: sentiment was classified as 'positive' with 99% confidence, and topics 'teaching_clarity' and 'practical_examples' were automatically extracted."*

### Step 5: Professor Dashboard Analytics & Anonymity (1.5 Minutes)
* **Action**:
  - In Window B, navigate to the professor portal.
  - Log in with faculty credentials:
    - Email: `sharma@university.edu`
    - Password: `SecurePassword123!`
  - Select **CS301 (Database Management Systems)**.
  - Review the dashboard components:
    - Overall summary card ($N = 13$, overall average $3.6/5.0$).
    - 5-Dimension Performance breakdown (showing Practical Examples as a weakness, Clarity as a strength).
    - Topic Matrix showing discussion volumes.
    - Sentiment Distribution bar.
    - Scroll to the bottom to view the Qualitative Comments section.
* **Presenter Script**:
  > *"Dr. Sharma views an aggregate overview of his teaching performance. The dashboard synthesizes numbers and text without hallucinating AI advice. In the qualitative comments section, Dr. Sharma can read Diya's comment, but notice that Diya's identity is completely absent, and the date is discretized to 'Oct 2026'. The feedback is actionable, honest, and anonymous."*

### Step 6: Small-Cohort Privacy Guard ($N < 5$) (30 Seconds)
* **Action**:
  - Log in as `desai@university.edu` (`SecurePassword123!`).
  - Select **CS201 (Data Structures & Algorithms)** ($N = 2$).
  - Show that granular distributions and written comments are hidden behind the privacy threshold guard.
* **Presenter Script**:
  > *"Finally, when Prof. Desai views CS201 with only 2 responses, the system protects student privacy by withholding granular breakdowns until at least 5 responses are received. This prevents instructors from de-anonymizing students in small seminar classes."*

---

## 3. Evaluator Q&A Reference Sheet

| Likely Evaluator Question | Recommended Grounded Answer |
| :--- | :--- |
| **"Why not use an LLM like GPT-4?"** | *"LLMs introduce non-deterministic outputs, API latency (1–3s), ongoing subscription costs, and potential privacy leaks if external APIs are called with institutional feedback. Our in-memory Naive Bayes runs deterministically in under 2ms on university hardware at zero recurring cost."* |
| **"Could an administrator identify the student?"** | *"Yes. We claim Level 1 Practical Anonymity, not cryptographic unlinkability. A DBA with physical access to raw PostgreSQL transaction logs could correlate timestamps. However, normal application APIs and faculty dashboards make identification impossible."* |
| **"How is the one-submission rule enforced?"** | *"Via a composite unique constraint on an isolated table: `feedback_submission_control (student_id, course_offering_id)`. The table records that a student completed feedback for a course, but contains no foreign key linking to the feedback row."* |
