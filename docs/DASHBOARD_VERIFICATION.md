# Stage 6 — Professor Analytics & Dashboard Correctness Verification

**Status**: `DASHBOARD VERIFIED`  
**Execution Date**: October 10, 2026  
**Auditor**: Senior Systems Implementation Engineer  
**System Target**: Student Feedback Analyzer — Professor Analytics, Dashboard Presentation, and Evidence Inspection

---

## 1. Executive Summary

This audit rigorously inspects and verifies the professor analytics layer, backend aggregations, SQL query construction, privacy enforcement guards, and React dashboard display against authoritative project specifications (`PRODUCT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `UX_SPEC.md`, `DESIGN_SYSTEM.md`, and `NLP_SPEC.md`).

### Key Findings
1. **Cartesian Product Immunity**: Aggregations across multi-dimensional rating metrics and multi-topic qualitative comment mentions are executed in decoupled SQL queries within [`dashboardRepository.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/dashboard/dashboardRepository.js), completely avoiding Cartesian multiplication artifacts.
2. **Small-Sample Privacy Guard**: Cohorts with fewer than 5 submissions ($N < 5$) enforce strict masking across both backend services and frontend components. Response counts are visible, but numeric rating averages, sentiment breakdowns, topic aggregations, and qualitative comments are suppressed.
3. **Evidence Over Prescriptive Claims**: The interface strictly adheres to *Numbers $\rightarrow$ Patterns $\rightarrow$ Evidence*. There are zero generative AI models, zero LLM hallucinations, and zero prescriptive teaching commands.
4. **End-to-End Metric Provenance**: Every metric displayed on the dashboard was mathematically reconciled from raw PostgreSQL database rows through SQL aggregations, JSON API payloads, and frontend React rendering components.

---

## 2. Complete Metric Provenance Table

| # | Metric Name | Source Table(s) & Column(s) | SQL Aggregation Expression | Backend Service / Transform | API Response Field | Frontend Component & Rendered Element | Manual vs DB vs UI Reconciled? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Total Responses** | `feedback_submissions.id` | `COUNT(*)::int AS "responseCount"` | `performance.responseCount` | `overall.responseCount` | [`OverviewSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/OverviewSection.jsx#L59) (`<span className="metric-value mono">`) | **YES** (12 = 12 = 12) |
| 2 | **Overall Average Rating** | `rating_clarity`, `rating_pace`, `rating_doubt_handling`, `rating_engagement`, `rating_practical_examples` | `ROUND(AVG((clarity + pace + doubt + engagement + examples) / 5.0), 2)::float` | `performance.overallAverage` | `overall.averageRating` | [`OverviewSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/OverviewSection.jsx#L44) (`<span className="metric-value mono">{Number(averageRating).toFixed(2)}</span>`) | **YES** (3.50 = 3.50 = 3.50) |
| 3 | **Teaching Clarity Average** | `feedback_submissions.rating_clarity` | `ROUND(AVG(rating_clarity), 2)::float AS "avgClarity"` | `getDimensionStatus(avgClarity)` $\rightarrow$ `status: 'moderate'` | `performance[0].averageScore` | [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx#L51) (`<strong>{score.toFixed(2)}</strong>`) | **YES** (3.92 = 3.92 = 3.92) |
| 4 | **Doubt Handling Average** | `feedback_submissions.rating_doubt_handling` | `ROUND(AVG(rating_doubt_handling), 2)::float AS "avgDoubt"` | `getDimensionStatus(avgDoubt)` $\rightarrow$ `status: 'moderate'` | `performance[1].averageScore` | [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx#L51) (`<strong>{score.toFixed(2)}</strong>`) | **YES** (3.92 = 3.92 = 3.92) |
| 5 | **Engagement Average** | `feedback_submissions.rating_engagement` | `ROUND(AVG(rating_engagement), 2)::float AS "avgEngagement"` | `getDimensionStatus(avgEngagement)` $\rightarrow$ `status: 'moderate'` | `performance[2].averageScore` | [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx#L51) (`<strong>{score.toFixed(2)}</strong>`) | **YES** (3.67 = 3.67 = 3.67) |
| 6 | **Teaching Pace Average** | `feedback_submissions.rating_pace` | `ROUND(AVG(rating_pace), 2)::float AS "avgPace"` | `getDimensionStatus(avgPace)` $\rightarrow$ `status: 'moderate'` | `performance[3].averageScore` | [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx#L51) (`<strong>{score.toFixed(2)}</strong>`) | **YES** (3.25 = 3.25 = 3.25) |
| 7 | **Practical Examples Average** | `feedback_submissions.rating_practical_examples` | `ROUND(AVG(rating_practical_examples), 2)::float AS "avgExamples"` | `getDimensionStatus(avgExamples)` $\rightarrow$ `status: 'weak'` | `performance[4].averageScore` | [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx#L51) (`<strong>{score.toFixed(2)}</strong>`) | **YES** (2.75 = 2.75 = 2.75) |
| 8 | **Sentiment Breakdown (Pos / Neu / Neg)** | `feedback_sentiment.label` | `COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int` (and neutral, negative) | Filtered by `analyzedCommentCount >= 5` guard | `overall.sentimentDistribution` | [`OverviewSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/OverviewSection.jsx#L69-L77) (Stacked bar & percentage legend) | **YES** (5/1/5 = 5/1/5 = 45%/9%/45%) |
| 9 | **Analysis Lifecycle** | `feedback_submissions.analysis_status` | `COUNT(CASE WHEN analysis_status = 'pending' THEN 1 END)` (and failed, retrying) | Formats lifecycle object if $N \ge 5$ and comments $\ge 5$ | `overall.analysisLifecycle` | [`OverviewSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/OverviewSection.jsx#L91-L99) (Lifecycle status alert) | **YES** (11 analyzed, 0 pending, 0 failed) |
| 10 | **Topic Mention Counts** | `feedback_topic_mention.topic_key` | `COUNT(t.id)::int AS "mentionCount"` | Mapped with human-readable topic labels | `topics[].mentionCount` | [`TopicsSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/TopicsSection.jsx#L55) (`<span className="topic-count mono">{totalMentions} mentions</span>`) | **YES** (Practical Examples: 5 mentions) |
| 11 | **Topic Sentiment Distribution** | `feedback_topic_mention` + `feedback_sentiment` | `COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int` | Evaluates dominant sentiment: `getDominantSentiment()` | `topics[].dominantSentiment`, `topics[].sentimentDistribution` | [`TopicsSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/TopicsSection.jsx#L58-L67) (Sentiment tag and tri-color bar) | **YES** (0 pos, 1 neu, 4 neg $\rightarrow$ 'negative') |
| 12 | **Evidence Comments** | `feedback_submissions.comment_text`, `created_at` | Paginated query with `TO_CHAR(created_at, 'YYYY-MM-DD')` and `ARRAY_AGG(topic_key)` | Enforces temporal coarse date truncation and privacy threshold | `comments[].commentText`, `comments[].submittedDate`, `comments[].topics` | [`EvidenceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/EvidenceSection.jsx#L114-L200) (Card list with topic tags and ratings) | **YES** (11 comments retrieved, 0 student PII) |

---

## 3. SQL Query & Cartesian Join Audit

### 3.1 Separation of Rating Dimensions and Sentiment Aggregations
A common anti-pattern in relational databases is joining 1-to-many child tables (such as comments or topic mentions) directly to parent feedback submissions when calculating dimension averages. Because a comment can produce multiple topic mentions (e.g., 2 topics per comment), joining `feedback_submissions JOIN feedback_topic_mention` multiplies the ratings rows by the number of topics, skewing average calculations.

In [`backend/src/modules/dashboard/dashboardRepository.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/dashboard/dashboardRepository.js):
```javascript
// Query 1: Purely on feedback_submissions (Isolated from topic joins)
const { rows: perfRows } = await pool.query(`
  SELECT 
    COUNT(id)::int AS "responseCount",
    COUNT(CASE WHEN comment_text IS NOT NULL AND TRIM(comment_text) != '' THEN 1 END)::int AS "commentSubmissionCount",
    COUNT(CASE WHEN analysis_status = 'pending' THEN 1 END)::int AS "pendingCommentCount",
    COUNT(CASE WHEN analysis_status = 'failed' AND analysis_attempts < 8 THEN 1 END)::int AS "retryingCommentCount",
    COUNT(CASE WHEN analysis_status = 'failed' AND analysis_attempts >= 8 THEN 1 END)::int AS "failedCommentCount",
    ROUND(AVG(rating_clarity), 2)::float AS "avgClarity",
    ROUND(AVG(rating_pace), 2)::float AS "avgPace",
    ROUND(AVG(rating_doubt_handling), 2)::float AS "avgDoubt",
    ROUND(AVG(rating_engagement), 2)::float AS "avgEngagement",
    ROUND(AVG(rating_practical_examples), 2)::float AS "avgExamples",
    ROUND(
      AVG(
        (rating_clarity + rating_pace + rating_doubt_handling + rating_engagement + rating_practical_examples) / 5.0
      ), 2
    )::float AS "overallAverage"
  FROM feedback_submissions
  WHERE offering_id = $1;
`, [offeringId]);
```
**Audit Assessment**: Zero joins are performed in Query 1. The denominator $N$ is strictly the count of unique submissions. There is no row duplication.

### 3.2 Decoupled Sentiment Query
```javascript
// Query 2: Aggregate sentiment from feedback_sentiment
const { rows: sentRows } = await pool.query(`
  SELECT 
    COUNT(sent.id)::int AS "analyzedCommentCount",
    COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS positive,
    COUNT(CASE WHEN sent.label = 'neutral' THEN 1 END)::int AS neutral,
    COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS negative
  FROM feedback_sentiment sent
  JOIN feedback_submissions sub ON sub.id = sent.submission_id
  WHERE sub.offering_id = $1;
`, [offeringId]);
```
**Audit Assessment**: `feedback_sentiment` maintains a 1-to-1 relationship with `feedback_submissions` (`submission_id UNIQUE` constraint). Joining `feedback_submissions` to `feedback_sentiment` produces exactly one row per analyzed submission. There is no row multiplication.

### 3.3 Decoupled Topic Mentions Query
```javascript
// Query 3: Topic frequencies and topic sentiment
SELECT 
  t.topic_key AS "topicKey",
  COUNT(t.id)::int AS "mentionCount",
  COUNT(CASE WHEN sent.label = 'positive' THEN 1 END)::int AS positive,
  COUNT(CASE WHEN sent.label = 'neutral' THEN 1 END)::int AS neutral,
  COUNT(CASE WHEN sent.label = 'negative' THEN 1 END)::int AS negative
FROM feedback_topic_mention t
JOIN feedback_submissions sub ON sub.id = t.submission_id
LEFT JOIN feedback_sentiment sent ON sent.submission_id = sub.id
WHERE sub.offering_id = $1
GROUP BY t.topic_key
ORDER BY "mentionCount" DESC;
```
**Audit Assessment**: Grouping is performed strictly by `t.topic_key`. Since `sent` is 1-to-1 with `sub`, each topic mention has at most one sentiment record associated with it. Counts accurately reflect true mentions per topic without Cartesian distortion.

---

## 4. Controlled Test Dataset Verification (CS301)

A controlled dataset verification was performed on the canonical course offering `CS301: Database Management Systems` (Section: General, Instructor: Dr. Ramesh Sharma):

### 4.1 Controlled Numbers Comparison
- **Total Submissions in Database**: $N = 12$
- **Submissions with Qualitative Comments**: $11$
- **Submissions Analyzed by NLP**: $11$ ($0$ pending, $0$ failed)
- **Submissions Rating-Only**: $1$ (`analysis_status: not_applicable`)

### 4.2 Rating Dimensions Verification
| Dimension | Raw Database Sum | Formula ($\frac{\sum}{12}$) | SQL Repository Result | API Response (`performance`) | UI Displayed Score | Status Label |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Teaching Clarity** | $47$ | $\frac{47}{12} = 3.9167$ | `3.92` | `3.92` | `3.92 / 5.0` | `Moderate` |
| **Doubt Handling** | $47$ | $\frac{47}{12} = 3.9167$ | `3.92` | `3.92` | `3.92 / 5.0` | `Moderate` |
| **Engagement** | $44$ | $\frac{44}{12} = 3.6667$ | `3.67` | `3.67` | `3.67 / 5.0` | `Moderate` |
| **Teaching Pace** | $39$ | $\frac{39}{12} = 3.2500$ | `3.25` | `3.25` | `3.25 / 5.0` | `Moderate` |
| **Practical Examples** | $33$ | $\frac{33}{12} = 2.7500$ | `2.75` | `2.75` | `2.75 / 5.0` | `Needs Attention` (`weak`) |
| **Overall Average** | $210$ total across 5 dims | $\frac{3.9167 + 3.9167 + 3.6667 + 3.25 + 2.75}{5} = 3.5000$ | `3.50` | `3.50` | `3.50 / 5.0` | — |

*Mathematical reconciliation: 100% exact match across raw math, SQL query, JSON API, and UI display.*

### 4.3 Sentiment Distribution Verification
- **Positive Sentiment Rows**: $5$
- **Neutral Sentiment Rows**: $1$
- **Negative Sentiment Rows**: $5$
- **Total Analyzed Comments**: $11$
- **Percentages**:
  - Positive: $\frac{5}{11} \times 100 = 45.45\% \approx 45\%$
  - Neutral: $\frac{1}{11} \times 100 = 9.09\% \approx 9\%$
  - Negative: $\frac{5}{11} \times 100 = 45.45\% \approx 45\%$
- **UI Stacked Bar Aria Label**: `"Sentiment distribution: 45% positive, 9% neutral, 45% negative"`
- **Subtext**: `"Based on 11 analyzed comments"`

### 4.4 Topic Frequencies and Dominant Sentiment
| Topic Key | Display Label | Mention Count | Positive | Neutral | Negative | Dominant Sentiment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `practical_examples` | Practical Examples | 5 | 0 | 1 | 4 | `negative` |
| `teaching_clarity` | Teaching Clarity | 4 | 2 | 1 | 1 | `positive` |
| `teaching_pace` | Teaching Pace | 3 | 0 | 0 | 3 | `negative` |
| `assignments` | Assignments & Grading | 1 | 0 | 0 | 1 | `negative` |
| `doubt_handling` | Doubt Handling | 1 | 1 | 0 | 0 | `positive` |
| `engagement` | Student Engagement | 1 | 1 | 0 | 0 | `positive` |
| `course_content` | Course Content & Curriculum | 1 | 1 | 0 | 0 | `positive` |

---

## 5. Small-Sample Privacy Guard & Boundary Verification

The privacy threshold rules defined in `API_CONTRACT.md` and `UX_SPEC.md` require suppression of detailed metrics when sample size is insufficient to prevent deanonymization:

### 5.1 Verification Matrix
| Scenario | Course / Offering | Submissions ($N$) | `privacyThresholdMet` | Ratings Returned? | Topics Returned? | Evidence Comments Returned? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Zero Submissions** | `CS405` | $N = 0$ | `false` | `null` / `[]` | `[]` | `comments: []`, `privacySuppressed: true` |
| **Small Cohort ($< 5$)** | `CS201` | $N = 2$ | `false` | `null` / `[]` | `[]` | `comments: []`, `privacySuppressed: true` |
| **Sufficient Cohort ($\ge 5$)** | `CS301` | $N = 12$ | `true` | Full 5 dimensions | Full topic breakdown | Paginated comments with coarse date |

### 5.2 Privacy Threshold Response Payloads
- **CS201 ($N = 2$)**:
  ```json
  {
    "privacyThresholdMet": false,
    "commentInsightsAvailable": false,
    "overall": {
      "responseCount": 2,
      "averageRating": null,
      "sentimentDistribution": null,
      "analysisLifecycle": null
    },
    "performance": [],
    "topics": [],
    "message": "Minimum response threshold not met (requires at least 5 submissions). Feedback details are hidden to protect student anonymity."
  }
  ```
- **Evidence API Response for $N = 2$**:
  ```json
  {
    "pagination": { "currentPage": 1, "pageSize": 15, "totalComments": 0, "totalPages": 0 },
    "privacySuppressed": true,
    "message": "Written feedback is hidden until at least 5 matching comments are available.",
    "comments": []
  }
  ```

---

## 6. Qualitative Evidence & Temporal Privacy Audit

In [`backend/src/modules/feedback/commentRepository.js`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/backend/src/modules/feedback/commentRepository.js):
1. **Zero Student PII Columns**:
   - `feedback_submissions` table contains NO `student_id`, NO email, NO username, and NO IP address.
   - The query selects: `sub.id`, `sub.comment_text`, `ratings` (JSON object), `sub.analysis_status`, `sent.label`, `ARRAY_AGG(t.topic_key)`, `TO_CHAR(sub.created_at, 'YYYY-MM-DD')`.
2. **Temporal Anonymization**:
   - Raw timestamp `created_at` (with hour, minute, second, and microsecond) is stripped.
   - `TO_CHAR(sub.created_at, 'YYYY-MM-DD')` outputs coarse date only (e.g., `2026-10-10`).
   - String verification: `assert.match(c.submittedDate, /^\d{4}-\d{2}-\d{2}$/)` passes; `!c.submittedDate.includes('T')` passes.
3. **Evidence Filtering**:
   - Filter by topic (`?topic=practical_examples`): strictly returns comments containing `practical_examples` in `topics` array.
   - Filter by sentiment (`?sentiment=positive`): strictly returns comments where `sentiment === 'positive'`.
   - Pagination: default `pageSize = 15`, total counts match actual records.

---

## 7. Role & Authorization Isolation Audit

Authorization enforcement is implemented in `authMiddleware.js`:
1. **Professor Ownership Isolation**:
   - `GET /api/v1/dashboard/:courseOfferingId` enforces `requireOfferingOwnership('courseOfferingId')`.
   - Professor Sharma attempting to access CS301 (owned offering): `HTTP 200 OK`.
   - Professor Desai attempting to access CS301 (Sharma's offering): `HTTP 403 FORBIDDEN` (`code: 'FORBIDDEN'`).
   - Professor Desai attempting to access CS301 feedback comments: `HTTP 403 FORBIDDEN` (`code: 'FORBIDDEN'`).
2. **Role Boundaries**:
   - Student JWT token attempting to access `GET /api/v1/dashboard/:id`: `HTTP 401 INVALID_TOKEN` (Student role rejected by `authenticateFaculty`).
   - Student JWT token attempting to access `GET /api/v1/professor/offerings`: `HTTP 401 INVALID_TOKEN`.
   - Unauthenticated caller attempting dashboard: `HTTP 401 UNAUTHORIZED`.

---

## 8. Absence of Prescriptive AI Advice

A thorough scan of all frontend dashboard components was conducted:
- [`OverviewSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/OverviewSection.jsx)
- [`PerformanceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/PerformanceSection.jsx)
- [`TopicsSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/TopicsSection.jsx)
- [`EvidenceSection.jsx`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/frontend/src/features/dashboard/components/EvidenceSection.jsx)

### Audit Verification:
- **No Generative AI Prompts or Output**: The dashboard contains no LLM-generated sentences instructing the faculty how to teach or conduct classes.
- **Pure Factual Presentation**:
  - Highlights are based purely on mathematical extrema: `focusDimension = performance.find(d => d.status === 'weak')` (e.g. `Focus area: Practical Examples`).
  - Sentiment badges are strictly factual: `Positive`, `Neutral`, `Negative`.
  - Topic tags are strictly descriptive: `Practical Examples (5 mentions)`, `Teaching Clarity (4 mentions)`.
  - The design faithfully complies with the core UX principle: **Numbers $\rightarrow$ Patterns $\rightarrow$ Evidence**.

---

## 9. Test Suite & Verification Results

1. **Frontend Test Suite**:
   ```
   > feedback-analyzer-frontend@0.1.0 test
   ✔ all required Stage 19 dashboard & auth components exist
   ✔ LoginPage enforces institutional email and password authentication
   ✔ OverviewSection enforces Level 1 hierarchy and privacy threshold guard
   ✔ PerformanceSection renders all 5 teaching performance dimensions with status tags
   ✔ TopicsSection links extracted themes with interactive filtering
   ✔ EvidenceSection renders paginated, filterable comments without student PII
   ✔ DashboardPage manages offering switching and hierarchical data fetching
   ℹ pass 19, fail 0 (100% passing)
   ```

2. **Frontend Production Build**:
   ```
   > vite build
   ✓ 63 modules transformed.
   dist/index.html                   0.41 kB
   dist/assets/index-CWlET5ib.css   46.02 kB
   dist/assets/index-CFCTjFDd.js   321.78 kB
   ✓ built in 988ms (0 errors, 0 warnings)
   ```

3. **Backend Dashboard & Database Integrity Tests**:
   - `backend/tests/readApis.test.js`: All 11 dashboard, offerings, and feedback tests pass.
   - `backend/tests/database.test.js`: All constraints and cascade verifications pass.
   - `backend/tests/e2eIntegration.test.js`: All 9 end-to-end integration flows pass.

---

## 10. Audit Conclusion

The professor analytics layer, backend aggregations, SQL joins, privacy threshold guards, and React dashboard display are **completely correct, mathematically consistent, secure, and fully aligned with specifications**.

**FINAL VERDICT TOKEN**: `DASHBOARD VERIFIED`
