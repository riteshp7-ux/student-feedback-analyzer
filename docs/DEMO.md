# Demonstration Guide: Student Feedback Analyzer

A structured 5–10 minute demonstration flow for academic project evaluation, faculty review, or portfolio showcase.

---

## Demonstration Setup & Prerequisites

Ensure the 3 application processes are running:
1. **Python NLP Service**: `http://127.0.0.1:8000` (FastAPI daemon)
2. **Express API Gateway**: `http://localhost:5000` (Node.js runtime)
3. **React Client Application**: `http://localhost:5173` (Vite dev/preview server)

### Safe Demo Credentials

#### Faculty Accounts (5 Professors, 2 Courses Each, Password: `SecurePassword123!`):
1. **Dr. Ramesh Sharma** (CSE Department)
   * **Email**: `sharma@university.edu`
   * **Courses**: `CS301` (Database Management Systems, $N \ge 12$ ample data), `CS405` (Machine Learning Foundations, $N = 0$ empty state)
2. **Prof. Anita Desai** (Both CSE & IT Departments)
   * **Email**: `desai@university.edu`
   * **Courses**: `CS201` (Data Structures & Algorithms, $N = 2$ privacy threshold guard), `IT204` (Web Systems & Technologies)
3. **Prof. Kavya Menon** (IT Department)
   * **Email**: `kavya.menon@university.edu`
   * **Courses**: `IT101` (Information Technology Foundations), `IT302` (Cloud Computing & DevOps)
4. **Prof. Arjun Mehta** (Both CSE & IT Departments)
   * **Email**: `arjun.mehta@university.edu`
   * **Courses**: `CS305` (Computer Networks), `IT304` (Information Security & Cryptography)
5. **Dr. Vikram Singh** (CSE Department)
   * **Email**: `vikram.singh@university.edu`
   * **Courses**: `CS303` (Operating Systems), `CS402` (Artificial Intelligence & Expert Systems)

#### Demo Student Accounts (Password: `SecureStudent123!`):
* **Kabir Rao** (`kabir@student.university.edu`): Enrolled in **all 10 course offerings** across CSE & IT (ideal for testing complete form filling).
* **Priya Nair** (`priya@student.university.edu`): Enrolled in IT courses (`IT101`, `IT204`, `IT302`, `IT304`, `CS301`).
* **Aarav Sharma** (`aarav@student.university.edu`): Enrolled in `CS301` (submitted) & `CS201` (pending).
* **Diya Patel** (`diya@student.university.edu`): Enrolled in `CS301`.
* **Rohan Verma** (`rohan@student.university.edu`): Enrolled in `CS201`.

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
  1. Choose **Semester 1 2026-27**, then your department and `CS301: Database Management Systems`.
  2. Choose the professor/section matching your class. CSE students see both sections; IT students can select the cross-listed section.
  3. Observe the class details summary confirming department, professor, section, and semester.
  4. Fill out the 5 approved pedagogical rating dimensions (1 to 5 scale):
     * **Teaching Clarity**: 5 (Excellent)
     * **Teaching Pace**: 4 (Good)
     * **Doubt Handling**: 5 (Approachable)
     * **Student Engagement**: 4 (Active participation)
     * **Practical Examples**: 5 (Real-world examples)
  5. In the constructive feedback box, type:
     > *"The database indexing explanations were crystal clear and the live SQL query optimization examples really helped me understand the material, but homework assignments were slightly too long."*
  6. Note the live character counter tracking the 2,000-character upper limit.

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
* **Action**: Inspect the 4-tier analytical hierarchy on `CS301 (Semester 1 2026-27)`:
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
  1. Switch offering to `CS405 (Semester 1 2026-27)`:
     * **Empty State**: Demonstrates clean zero-response state ($N=0$) without UI crashes or division-by-zero errors.
  2. Sign out and sign in as `desai@university.edu` (`SecurePassword123!`):
     * Select `CS201 (Semester 1 2026-27)` ($N = 2$).
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
