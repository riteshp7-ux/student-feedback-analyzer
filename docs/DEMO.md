# Demonstration Guide: Student Feedback Analyzer

A structured 5–10 minute demonstration flow for academic project evaluation, faculty review, or portfolio showcase.

---

## Demonstration Setup & Prerequisites

Ensure the 3 application processes are running:
1. **Python NLP Service**: `http://127.0.0.1:8000` (FastAPI daemon)
2. **Express API Gateway**: `http://localhost:5000` (Node.js runtime)
3. **React Client Application**: `http://localhost:5173` (Vite dev/preview server)

### Safe Demo Credentials
* **Primary Faculty Account (Ample Data, $N \ge 14$)**:
  * **Email**: `sharma@university.edu`
  * **Password**: `SecurePassword123!`
  * **Courses**: CS301 (Database Management Systems), CS405 (Machine Learning Foundations)
* **Secondary Faculty Account (Small Cohort Privacy Guard, $N = 2$)**:
  * **Email**: `desai@university.edu`
  * **Password**: `SecurePassword123!`
  * **Courses**: CS201 (Data Structures & Algorithms)

---

## 10-Minute Demonstration Flow

### Step 1: Introduce the Problem (1 minute)
* **Speaking Points**:
  * Traditional university course evaluations generate two types of data: numeric Likert scales that lack actionable context, and free-text comments that are tedious to read manually.
  * In large cohorts (100+ students), professors struggle to synthesize unstructured comments, while students often withhold candid feedback due to fear of retaliation or doubt over anonymity.
  * *Student Feedback Analyzer* bridges this gap by decoupling student identity from feedback, processing comments with an isolated statistical NLP pipeline, and synthesizing aggregate pedagogical evidence for faculty.

---

### Step 2: Open Student Application (1 minute)
* **Action**: Open [http://localhost:5173/](http://localhost:5173/) in your browser.
* **Observe & Explain**:
  * **Header**: Institutional university portal branding.
  * **Anonymity Guarantee Banner**: Note the explicit policy stating that no student ID, name, email, IP address, or browser fingerprint is requested, tracked, or stored in PostgreSQL.
  * **Navigation**: Highlight that students do not log in. Submission is completely unauthenticated and public.

---

### Step 3: Select Course & Enter Ratings (2 minutes)
* **Action**:
  1. Click **Course Offering** dropdown and select `CS301: Database Management Systems — Dr. Ramesh Sharma (Fall 2026)`.
  2. Observe the course details badge that confirms the selected instructor and term.
  3. Fill out the 5 approved pedagogical rating dimensions (1 to 5 scale):
     * **Teaching Clarity**: 5 (Excellent)
     * **Teaching Pace**: 4 (Good)
     * **Doubt Handling**: 5 (Approachable)
     * **Student Engagement**: 4 (Active participation)
     * **Practical Examples**: 5 (Real-world examples)
  4. In the constructive feedback box, type:
     > *"The database indexing explanations were crystal clear and the live SQL query optimization examples really helped me understand the material, but homework assignments were slightly too long."*
  5. Note the live character counter tracking the 2,000-character upper limit.

---

### Step 4: Submit Feedback & Explain Anonymity (1 minute)
* **Action**: Click **Submit Feedback**.
* **Observe & Explain**:
  * **Immediate Confirmation**: Within ~15ms, the student receives HTTP `201 Created` with a clean confirmation screen (*"Feedback Submitted Successfully"*).
  * **Architectural Decoupling**: Explain that the student submission transaction committed directly to PostgreSQL with `analysis_status = 'pending'`. The student is **never** blocked waiting for the NLP microservice to run.
  * In the background, Express dispatches an asynchronous `setImmediate` task to the Python FastAPI microservice at `http://127.0.0.1:8000/analyze`, which completes in $<15$ms and updates PostgreSQL with sentiment and topic tags.

---

### Step 5: Log in as Professor (1 minute)
* **Action**:
  1. Navigate to [http://localhost:5173/login](http://localhost:5173/login).
  2. Enter:
     * **Email**: `sharma@university.edu`
     * **Password**: `SecurePassword123!`
  3. Click **Sign In**.
* **Observe & Explain**:
  * Authentication uses bcrypt password hashing and issues a signed HMAC-SHA256 JWT token.
  * The password hash is never exposed to the frontend.
  * Session automatically redirects to the Analytics Dashboard at `/dashboard`.

---

### Step 6: Inspect Analytics Dashboard (2 minutes)
* **Action**: Inspect the 4-tier analytical hierarchy on `CS301 (Fall 2026)`:
  1. **Level 1 (Executive Overview)**:
     * Total response count ($N \ge 15$).
     * Overall satisfaction metric ($4.2 / 5.0$).
     * Sentiment distribution percentage bar (predominantly positive).
  2. **Level 2 (Teaching Performance Dimensions)**:
     * 5 dimensional averages rendered as progress bars. Shows strong performance in *Clarity* and *Practical Examples*, with constructive opportunities in *Pacing*.
  3. **Level 3 (Pedagogical Topic Breakdown)**:
     * Multi-label frequency bars showing student discussions of `teaching_clarity`, `practical_examples`, `course_material`, and `teaching_pace`.
     * Note that a single comment can tag multiple topics simultaneously.
  4. **Level 4 (Evidence Explorer)**:
     * Qualitative feedback cards displaying extracted topic badges and sentiment labels.
     * **Temporal Privacy**: Note that submission dates are truncated to `YYYY-MM-DD` (no exact hour/minute timestamps), preventing timing correlation attacks.
     * Click a topic pill (e.g. `practical_examples`) to filter evidence dynamically.

---

### Step 7: Demonstrate Privacy Guard & Edge Cases (1 minute)
* **Action**:
  1. Switch offering to `CS405 (Fall 2026)`:
     * **Empty State**: Demonstrates clean zero-response state ($N=0$) without UI crashes or division-by-zero errors.
  2. Sign out and sign in as `desai@university.edu` (`SecurePassword123!`):
     * Select `CS201 (Fall 2026)` ($N = 2$).
     * **Privacy Guard ($N < 5$)**: The dashboard withholds granular rating averages and qualitative comments, showing:
       > *"Minimum response threshold not met (requires at least 5 submissions). Feedback details are hidden to protect student anonymity."*

---

### Step 8: Explain Architecture & Limitations (1 minute)
* **Speaking Points**:
  * **Zero C-Extension Pure-Python NLP**: Implemented classical Multinomial Naive Bayes and Binary Relevance using Python standard library math and vectors. 100% deterministic, reproducible, and loads in memory once on startup.
  * **Strict Horizontal Isolation**: Backend middleware verifies course offering ownership at the database layer. Cross-professor dashboard access is rejected with HTTP 403 Forbidden.
  * **Known Limitations**:
    1. Dataset is synthetic, curated for academic evaluation.
    2. Statistical Naive Bayes does not understand multi-sentence sarcasm or idiomatic nuance like a human.
    3. The system cannot stop a student from self-identifying in free text.
