# Stage 6 — UX Architecture & User Flows

---

## 1. UX Principles

1. **Signal Over Noise**: Present only actionable aggregate patterns. Eliminate decorative metrics, vanity gauges, and machine learning jargon.
2. **Progressive Disclosure**: Structure information so the user starts with the high-level pulse and drills down into evidence only when interested.
3. **Evidence Over Prescriptive Claims**: Show what students are saying and how frequently they say it. Never manufacture AI recommendations telling the professor how to teach.
4. **Honest Uncertainty**: Clearly communicate data insufficiency (e.g., $N < 5$, no written comments, or service downtime) rather than presenting misleading percentages.
5. **Calm, Academic Tone**: The interface should feel like an objective institutional tool—focused, respectful, and uncluttered.

---

## 2. Screen Inventory

The application requires only four dedicated screens:

1. **Student Submission Screen (`/` or `/student`)**:
   - Single-page responsive experience: student authentication prompt (if unauthenticated), authenticated student bar, enrolled course offerings selector, 5 structured ratings, optional written comment, and submission.
2. **Student Confirmation Screen (State on `/`)**:
   - In-place terminal state acknowledging receipt, explaining that the evaluation is final, and thanking the student for their contribution, anonymous to professors.
3. **Professor Login Screen (`/login`)**:
   - Focused, clean institutional login for faculty credentials.
4. **Professor Analytics Dashboard (`/dashboard` & `/dashboard/:offeringId`)**:
   - Primary analytical workstation: course switcher, overview banner (Level 1), dimension ratings (Level 2), topic cards (Level 3), and filterable comment evidence (Level 4).

---

## 3. Student Journey & User Flow

```text
       [ Student lands on / or /student ]
                 |
                 v
   +----------------------------+
   |   Student Authentication   | <--- Required (login card shown if unauthenticated)
   +----------------------------+
                 |
                 v
   +----------------------------+
   | Select Enrolled Course     | <--- Only student's enrolled courses shown
   +----------------------------+
                 |
                 +-----> [ Already Submitted? ] ---> Show "Feedback Already Submitted" badge
                 |                                    (Cannot edit or resubmit)
                 v
   +----------------------------+
   |   5 Structured Ratings     | <--- 1 to 5 segmented numeric buttons
   +----------------------------+
                 |
                 v
   +----------------------------+
   |  Optional Written Comment  | <--- Free text (0 - 2,000 chars)
   +----------------------------+
                 |
                 v
   +----------------------------+
   |       Submit Button        |
   +----------------------------+
                 |
         [ Client Validation ]
         /                   \
      [Pass]                [Fail] ---> Highlight missing rating inline
        |
        v
   [ Submitting State ] ---> Disable button, label "Submitting Feedback..."
        |
    [ POST /api/v1/feedback ]
    /                       \
 [ 201 Created ]          [ Network / Server Error ]
       |                            |
       v                            v
+-----------------------+   +------------------------------------+
|  Confirmation State   |   | Inline Alert: "Unable to submit.   |
| "Feedback Submitted   |   | Your responses have been saved.    |
|     Anonymously"      |   | Please retry." (Preserves form)    |
+-----------------------+   +------------------------------------+
```

### Detailed Steps:
1. **Entry & Course Selection**:
   - The student arrives at a clean, single-column page.
   - Course selection is progressive: year of study → semester → student’s department → course → professor/section when multiple classes match.
   - Program semesters 1–2 belong to Year 1, 3–4 to Year 2, 5–6 to Year 3, and 7–8 to Year 4. The academic session is shown separately.
   - Only semesters with an active feedback window appear. The selected class context confirms year, course, semester, student department, teaching department when different, professor, and section before ratings begin.
   - If accessed via course QR code/link (`/?offeringId=3fa8...`), the dropdown is automatically set to that offering.
2. **Anonymity Communication**:
   - A quiet, factual notice directly below the header states:
     > *"Professors cannot see who submitted. A restricted eligibility record is used to prevent repeat submissions; administrators may be able to infer eligibility. Avoid identifying yourself in comments."*
3. **Rating Interaction**:
   - 5 pedagogical dimensions presented in logical instructional sequence:
     1. Teaching Clarity
     2. Teaching Pace
     3. Doubt Handling
     4. Student Engagement
     5. Practical Examples
   - Each dimension uses a **horizontal segmented 1–5 button group** (semantic radio controls).
   - Clear anchor labels: `1 = Poor / Needs Improvement`, `5 = Excellent`.
4. **Written Feedback Area**:
   - An optional `<textarea>`:
     - Placeholder: *"What worked well, or what could be improved? (Optional)"*
     - Live character counter: `0 / 2000`.
     - Factual helper note: *"Avoid including your name or personal details to maintain anonymity."*
5. **Submission & Confirmation**:
   - Clicking "Submit Feedback" triggers client-side validation.
   - If valid, the button enters a disabled *"Submitting..."* state.
   - Upon `201 Created`, the form transitions smoothly to a calm confirmation state:
     - Header: *"Feedback Submitted"*
     - Body: *"Thank you for your feedback. Your response was recorded without your identity being shown to professors."*
     - No further prompts or clutter.

---

## 4. Rating Interaction Recommendation

| Pattern | Evaluation | Decision |
| :--- | :--- | :--- |
| **Star Ratings (★ ★ ★ ★ ★)** | Associated with commercial reviews (Amazon/Uber). Ambiguous academic meaning (is 3 stars bad or average?). Poor screen-reader mapping. | **Rejected** |
| **Slider / Range Bar** | Imprecise on mobile touchscreens. Hard to hit discrete integers. Requires fine motor coordination. | **Rejected** |
| **Segmented Number Buttons (1 | 2 | 3 | 4 | 5)** | Clear, unambiguous numerical scale. Large touch targets ($\ge 48\text{px}$). Built on semantic `<input type="radio">`. Flawless keyboard arrow navigation. | **Approved** |

---

## 5. Professor Journey & User Flow

```text
       [ Professor lands on /login ]
                     |
                     v
       +----------------------------+
       |   Enter Email & Password   |
       +----------------------------+
                     |
             [ Authenticated ]
                     |
                     v
       +----------------------------+
       |    Dashboard Context       | <--- Defaults to most recent offering
       |   (Course Offering Bar)    |
       +----------------------------+
                     |
         [ Response Count Check ]
         /                      \
    [ N < 5 ]                 [ N >= 5 ]
        |                         |
        v                         v
+-----------------------+   +---------------------------------------------+
| Privacy Threshold Card|   | Level 1: Overall Rating & Sentiment Pulse   |
| "Fewer than 5 responses|   | Level 2: 5 Structured Dimension Averages    |
| received. Analytics are|   | Level 3: Recurring Topics & Topic Sentiment |
| paused to preserve     |   | Level 4: Filterable Anonymous Evidence      |
| anonymity."           |   +---------------------------------------------+
+-----------------------+
```

---

## 6. Dashboard Information Hierarchy & Layout

The dashboard is structured vertically to match human cognitive processing:

```text
+---------------------------------------------------------------------------------+
| TOP BAR: [Course Code & Title] | [Term: Semester 1 2026-27] | [Switch Offering Dropdown] |
+---------------------------------------------------------------------------------+
| LEVEL 1: OVERALL PULSE                                                          |
| +-------------------------+ +-------------------------+ +---------------------+ |
| | Overall Average Rating  | | Total Responses         | | Overall Sentiment   | |
| | 3.8 / 5.0               | | 42 students             | | 57% Pos | 26% Neu   | |
| | [Progress Indicator]    | | (All anonymous)         | | 17% Neg             | |
| +-------------------------+ +-------------------------+ +---------------------+ |
+---------------------------------------------------------------------------------+
| LEVEL 2: TEACHING PERFORMANCE (STRUCTURED DIMENSIONS)                           |
| Teaching Clarity          [=============>      ] 4.2 / 5.0  (Strong)            |
| Doubt Handling            [============>       ] 4.1 / 5.0  (Strong)            |
| Student Engagement        [==========>         ] 3.7 / 5.0  (Moderate)          |
| Teaching Pace             [=========>          ] 3.4 / 5.0  (Moderate)          |
| Practical Examples        [======>             ] 2.7 / 5.0  (Attention)         |
+---------------------------------------------------------------------------------+
| LEVEL 3: RECURRING TOPICS (WHAT STUDENTS ARE DISCUSSING)                        |
| [All Topics]  [Practical Examples (18)]  [Teaching Clarity (15)]  [Pace (9)]    |
|                                                                                 |
| Card: Practical Examples                                                        |
| - 18 mentions (43% of all written comments)                                     |
| - Sentiment: 11% Positive | 22% Neutral | 67% Negative                          |
| - Signal: Frequent discussion; predominantly negative sentiment                 |
+---------------------------------------------------------------------------------+
| LEVEL 4: STUDENT VOICE (REPRESENTATIVE ANONYMOUS EVIDENCE)                      |
| Filter: [Practical Examples x] | [All Sentiments v]                             |
| Showing 18 representative comments                                              |
|                                                                                 |
| "The theory and slides are very clear, but we need more live coding examples    |
|  and practice problems during lectures."                                        |
|  Tags: [Practical Examples] [Teaching Clarity] | Date: Oct 9, 2026              |
|                                                                                 |
| "Would appreciate weekly practical assignments instead of just reading docs."   |
|  Tags: [Practical Examples] | Date: Oct 8, 2026                                 |
+---------------------------------------------------------------------------------+
```

---

## 7. Evidence & Topic Exploration UX

### Interactive Flow:
1. **Topic Selection**:
   - Clicking a topic pill or card in Level 3 (e.g., `Practical Examples (18)`) immediately scrolls to and filters the Level 4 Evidence section.
   - The filter badge displays: `Filtering by: Practical Examples [Clear]`.
2. **Evidence Presentation**:
   - Comments appear as clean, readable text cards.
   - Each card displays:
     - Verbatim anonymous text.
     - Extracted topic tags.
     - Sentiment label badge (`Positive`, `Neutral`, `Negative`).
     - Truncated date (`Oct 9, 2026` — never an exact hour/minute).
3. **Pagination & Volume Control**:
   - Initial display capped at 15 comments.
   - Standard "Previous / Next" pagination controls at the bottom prevent infinite scrolling disorientation.

---

## 8. Sentiment UX

* **No Standalone Colors**: Color is never the sole communicator of sentiment (accessibility requirement).
* **Clear Semantic Labels**: Every sentiment cue pairs color with text:
  - `Positive` (Green tone + "+")
  - `Neutral` (Slate/Gray tone + "=")
  - `Negative` (Amber/Rose tone + "-")
* **No Raw Confidence Percentages**: The dashboard presents counts and distributions (e.g., *"12 positive, 4 neutral, 2 negative"*), avoiding confusing model probability metrics like *"0.7812 confidence"*.

---

## 9. Data Sufficiency & Honest Uncertainty

The dashboard handles edge cases transparently:

| Condition | UX Presentation |
| :--- | :--- |
| **$N = 0$ (No Submissions)** | Clean empty state: *"No feedback has been submitted for this course offering yet."* |
| **$1 \le N < 5$ (Low Sample Size)** | Rating aggregates and written comments stay hidden until 5 responses. |
| **Fewer than 5 analyzed comments** | Show ratings when eligible, but keep comment sentiment and themes hidden until 5 comments are analyzed. |
| **Fewer than 5 comments match evidence filters** | Keep comment text hidden and explain that more matching comments are needed. |
| **No Written Comments** | Level 1 & 2 display fully. Level 3 & 4 display an informative notice: *"All 42 respondents submitted numerical ratings without written comments."* |
| **NLP Service Offline / Failed** | Level 1 & 2 display fully. Level 3 displays: *"Topic analysis is temporarily unavailable. Raw comments remain accessible below."* Level 4 displays comments without topic tags. |
| **Filtered Search Returns 0** | *"No comments match the selected filter."* Includes a prominent *"Reset filters"* button. |

---

## 10. Navigation Architecture

* **Student View**: Zero global navigation bars. Minimalist header containing only the university/app title to keep students focused entirely on the submission task.
* **Professor View**:
  - Top header containing:
    - App title ("Student Feedback Analyzer")
    - Course Offering switcher dropdown
    - User name / Log out button
  - No complex nested sidebars; the dashboard is a unified, linear analytical surface.

---

## 11. Mobile UX Adaptations

* **Student Experience (Mobile-First)**:
  - Form width fits $100\%$ of mobile viewports with comfortable $16\text{px}$ padding.
  - Number buttons ($1$ through $5$) expand to fill width horizontally with large tap targets.
  - Sticky "Submit" button remains visible or scrolls naturally into view.
* **Professor Dashboard (Responsive Adaptation)**:
  - On viewports $< 768\text{px}$:
    - Level 1 metric cards stack vertically.
    - Level 2 horizontal dimension bars span full width.
    - Level 3 topic pills wrap into a horizontally scrollable or stacked badge list.
    - Level 4 comment cards stack in a single column.

---

## 12. Accessibility Considerations (WCAG 2.1 AA)

1. **Keyboard Operability**:
   - Entire form operable via `Tab` and `Shift+Tab`.
   - Rating controls navigate via Arrow keys (`Left/Right` or `Up/Down`).
2. **Focus Indicators**: High-contrast, visible focus rings on all interactive elements.
3. **Contrast Ratios**: Minimum 4.5:1 for normal text, 3:1 for large headers and interactive boundaries.
4. **Form Labels & Error Associations**:
   - All inputs have explicit `<label>` or `<legend>` elements.
   - Validation errors use `aria-describedby` linked to error message IDs.
5. **Screen Readers**:
   - In-flight operations announce via `aria-live="polite"` regions.
   - Segmented buttons read: *"Teaching clarity, 4 of 5"*.

---

## 13. Microcopy Principles

* **Plain, Respectful Language**: Academic and straightforward.
* **Prohibited Terms**: `TF-IDF`, `Logistic Regression`, `Inference`, `Latent Dirichlet Allocation`, `Loss`, `Weights`.
* **Standard Phrasing**:
  - *"Anonymous Feedback Submission"* (Not *"Submit Survey"*)
  - *"Teaching Performance Dimensions"* (Not *"User Scores"*)
  - *"Student Discussion Topics"* (Not *"Extracted Topic Clusters"*)
  - *"Representative Evidence"* (Not *"Comment Dataset"*)

---

## 14. UX Decision Table

| Decision | Recommendation | Reason | Alternative Considered | Why Rejected |
| :--- | :--- | :--- | :--- | :--- |
| **Rating Interaction** | Segmented 1–5 buttons | Fast, clear, accessible, excellent touch targets. | Star ratings (★) | Ambiguous academic meaning, poor accessibility. |
| **Form Layout** | Single-column linear layout | Cleanest cognitive flow; mobile-friendly. | Multi-step wizard | Unnecessary friction for a 5-question form. |
| **Anonymity Framing** | Factual privacy disclosure | Builds trust without overpromising unattainable technical guarantees. | "100% untraceable" | Dishonest and legally inaccurate. |
| **Dashboard Structure** | 4-tier vertical hierarchy (Overall $\rightarrow$ Dimensions $\rightarrow$ Topics $\rightarrow$ Evidence) | Matches how professors naturally analyze evaluations. | Tabbed views / separate pages | Disconnects evidence from high-level signal. |
| **Topic Interaction** | Clicking a topic filters evidence below | Seamless transition from pattern to evidence. | Opening modal popups | Disrupts page context and loses place in hierarchy. |
| **Privacy Safeguard** | $N < 5$ threshold lock | Protects students in small course sections from re-identification. | Showing all comments unconditionally | Violates privacy guarantees. |
| **Navigation** | Minimal top header with course switcher | Fits small scope; avoids empty sidebar layouts. | Collapsible multi-level sidebar | Over-engineered for a 2-page professor app. |

---

## 15. Self-Review

1. **Can a student complete the form in under 60 seconds?**  
   *Yes*. 5 clicks on large numeric buttons and an optional text box.
2. **Can a professor evaluate course health within 10 seconds?**  
   *Yes*. Level 1 (Overall pulse) and Level 2 (Dimension strengths/weaknesses) are visible immediately.
3. **Does the UI make unsupported prescriptive recommendations?**  
   *No*. The system displays frequency and sentiment (e.g., *"Practical examples: 18 mentions, mostly negative"*), leaving pedagogical interpretation to the instructor.
4. **Is anonymity protected on small courses?**  
   *Yes*. The $N < 5$ threshold lock stops early comment inspection.
5. **Are error states clear and recoverable?**  
   *Yes*. Network errors preserve entered text and offer clear retry actions.

---

## 16. Decisions Requiring Architect Approval

1. **Rating Anchors**: Are the anchor labels *"1 = Needs Improvement"* and *"5 = Excellent"* approved for all 5 dimensions?
2. **Evidence Page Size**: Is 15 comments per page with Previous/Next pagination approved for Level 4?
3. **Direct Offering URL Support**: Is the `/?offeringId=<uuid>` direct deep-linking pattern approved for student QR codes/syllabi?

**Current-behavior note (10 Oct 2026):** Students choose year, department and semester, then course; professor/section appears only when multiple offerings match. A one-time token is required after course selection. The token is scoped to the exact semester/section offering and issued from a registrar roster; it is not stored on the feedback record or exposed to faculty. The token UI should explain where to obtain it and that it can be used once. See [API_CONTRACT.md](API_CONTRACT.md), [DATA_MODEL.md](DATA_MODEL.md), and [COURSE_CATALOG_SETUP.md](COURSE_CATALOG_SETUP.md).
