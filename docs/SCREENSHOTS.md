# Demonstration & Screenshot Capture Checklist

A standardized checklist of key visual states and interfaces to capture for academic project defense, portfolio display, and documentation.

> **Security & Privacy Rules for Capturing**:
> * Use only the approved synthetic demo dataset (`CS301`, `CS201`, `CS405`).
> * Never include real student personal feedback or actual student names.
> * Never capture browser developer tools showing JWT secrets, bearer tokens, or database connection strings.

---

## Required Visual Artifacts

### 1. Student Landing & Anonymous Guarantee Banner
* **URL**: `http://localhost:5173/`
* **Elements to Capture**:
  * University portal header with clean academic typography.
  * The prominent **Anonymous Feedback Guarantee** card articulating zero tracking of student IDs, names, emails, and IP addresses.
* **Suggested Filename**: `01_student_landing_privacy_notice.png`

### 2. Course Selection & Metadata Badge
* **URL**: `http://localhost:5173/`
* **Elements to Capture**:
  * Dropdown expanded showing available active course offerings (`CS301`, `CS201`, `CS405`).
  * Selected course metadata badge showing Course Code (`CS301`), Title (`Database Management Systems`), Instructor (`Dr. Ramesh Sharma`), and Term (`Semester 1 2026-27`).
* **Suggested Filename**: `02_course_selection_badge.png`

### 3. Structured Rating Scale & Comment Field
* **URL**: `http://localhost:5173/`
* **Elements to Capture**:
  * 5 pedagogical rating dimension groups (Clarity, Pace, Doubts, Engagement, Practical Examples) with accessible radio buttons (1 to 5).
  * Constructive comments textarea showing the live character counter (`245 / 2000 characters`).
* **Suggested Filename**: `03_feedback_form_ratings_comment.png`

### 4. Submission Confirmation State
* **URL**: `http://localhost:5173/` (after clicking Submit)
* **Elements to Capture**:
  * Green success banner: *"Feedback Submitted Successfully"*.
  * Anonymity confirmation statement.
  * *"Submit Another Feedback"* action button.
* **Suggested Filename**: `04_submission_success_confirmation.png`

### 5. Professor Login Interface
* **URL**: `http://localhost:5173/login`
* **Elements to Capture**:
  * Faculty sign-in card with institutional email field and password field.
  * Security indicator note regarding faculty access boundaries.
* **Suggested Filename**: `05_professor_login_screen.png`

### 6. Dashboard Executive Overview (Level 1)
* **URL**: `http://localhost:5173/dashboard` (logged in as Dr. Sharma, CS301 selected)
* **Elements to Capture**:
  * Header showing active faculty member and course switcher dropdown.
  * Executive metric cards: Total Submissions ($15$), Overall Satisfaction ($4.2/5.0$), and Sentiment Distribution bar chart ($73\%$ positive, $13\%$ neutral, $13\%$ negative).
* **Suggested Filename**: `06_dashboard_level1_overview.png`

### 7. Teaching Performance Dimensions (Level 2)
* **URL**: `http://localhost:5173/dashboard`
* **Elements to Capture**:
  * 5 horizontal dimensional progress bars showing average scores for Teaching Clarity ($4.3$), Teaching Pace ($3.9$), Doubt Handling ($4.4$), Engagement ($4.1$), and Practical Examples ($4.4$).
  * Status badges indicating performance strengths and growth opportunities.
* **Suggested Filename**: `07_dashboard_level2_performance_dimensions.png`

### 8. Pedagogical Topic Frequencies & Sentiment Breakdown (Level 3)
* **URL**: `http://localhost:5173/dashboard`
* **Elements to Capture**:
  * Multi-label topic breakdown chart displaying frequency counts for `teaching_clarity`, `practical_examples`, `course_material`, and `teaching_pace`.
  * Visual sentiment sub-bars indicating positive vs. negative mentions within each topic.
* **Suggested Filename**: `08_dashboard_level3_topic_breakdown.png`

### 9. Evidence Explorer & Interactive Topic Filtering (Level 4)
* **URL**: `http://localhost:5173/dashboard`
* **Elements to Capture**:
  * Qualitative feedback cards showing extracted topic tags, sentiment indicator, and truncated submission date (`YYYY-MM-DD`).
  * Filter bar with active topic filter pill (e.g. `practical_examples` selected).
* **Suggested Filename**: `09_dashboard_level4_evidence_explorer.png`

### 10. Small Cohort Privacy Guard State ($N < 5$)
* **URL**: `http://localhost:5173/dashboard` (logged in as Prof. Anita Desai, CS201 selected)
* **Elements to Capture**:
  * Overview card showing $N = 2$ submissions.
  * Privacy guard notice: *"Minimum response threshold not met (requires at least 5 submissions). Feedback details are hidden to protect student anonymity."*
  * Detailed rating and comment sections masked to prevent deanonymization.
* **Suggested Filename**: `10_privacy_guard_small_cohort.png`

### 11. Empty Course State ($N = 0$)
* **URL**: `http://localhost:5173/dashboard` (logged in as Dr. Sharma, CS405 selected)
* **Elements to Capture**:
  * Clean zero-data empty state graphic indicating no feedback has been submitted yet for this course offering.
* **Suggested Filename**: `11_empty_state_zero_submissions.png`

### 12. Mobile Responsive Layout
* **URL**: `http://localhost:5173/` (Viewport: 375px or 390px mobile view)
* **Elements to Capture**:
  * Single-column responsive layout showing mobile-friendly touch targets for rating radio buttons and clean stacking of form fields.
* **Suggested Filename**: `12_mobile_responsive_student_view.png`
