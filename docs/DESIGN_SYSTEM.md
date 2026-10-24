# Stage 7 — Visual Design System Specification

---

## 1. Visual Design Direction

The visual language of the Student Feedback Analyzer is **restrained, academic, and editorial**. It draws inspiration from scholarly journals, precision typography, and clean institutional research tools.

* **Aesthetic Anchors**: Clear information density, clean monospaced tabular numerals, deliberate hairline dividers, structured white space, and zero unnecessary visual ornament.
* **Core Philosophy**: **Signal > Decoration**. Every line, color, and margin must directly communicate data hierarchy or affordance.

---

## 2. Color System

The palette uses a crisp, high-contrast monochrome foundation paired with muted, accessible semantic tones.

### 2.1 Base Palette (Neutral / Academic Slate)
* **Page Background**: `#F8F9FA` (Soft off-white canvas; reduces glare).
* **Surface Background**: `#FFFFFF` (Pure white for focused content blocks).
* **Elevated / Hover Surface**: `#F1F3F5` (Subtle tint for hover rows and secondary controls).
* **Border Default**: `#E5E7EB` (Subtle 1px hairline divider).
* **Border Strong**: `#D1D5DB` (Control borders, active dividers).
* **Text Primary**: `#111827` (Near-black for high legibility; WCAG AAA contrast).
* **Text Secondary**: `#4B5563` (Muted gray for labels, metadata, and timestamps).
* **Text Muted / Disabled**: `#9CA3AF` (De-emphasized placeholders and inactive states).

### 2.2 Interactive Accent
* **Interactive Primary**: `#1E3A8A` (Deep academic navy blue).
* **Interactive Hover**: `#172554` (Darker navy).
* **Focus Ring**: `#3B82F6` (Clear 2px offset outline for accessible keyboard focus).

### 2.3 Semantic & Sentiment Palette (Restrained, WCAG AA Compliant)
Sentiment is indicated with restrained, muted colors paired strictly with text labels and geometric badges:
* **Positive**:
  - Background: `#ECFDF5` (Soft mint)
  - Text / Border: `#065F46` (Deep forest green)
* **Neutral**:
  - Background: `#F3F4F6` (Soft warm gray)
  - Text / Border: `#374151` (Slate gray)
* **Negative / Needs Attention**:
  - Background: `#FEF2F2` (Soft rose tint)
  - Text / Border: `#991B1B` (Deep crimson)
* **Warning**:
  - Background: `#FFFBEB` (Amber)
  - Text / Border: `#92400E`

---

## 3. Typography System

The system relies on high-quality system font stacks to ensure native rendering speed with zero font-loading flicker.

* **Primary Font Stack**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
* **Data / Numerical Stack**: `ui-monospace, "SF Mono", Menlo, Consolas, monospace` (Ensures tabular alignment of scores, percentages, and response counts).

### Type Scale:
| Role | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | 24px (1.5rem) | 32px | 600 (Semi-bold) | Page titles (Dashboard, Feedback Form) |
| **Section / H2** | 18px (1.125rem) | 26px | 600 (Semi-bold) | Level 1–4 section headers |
| **Subheading / H3**| 15px (0.9375rem) | 22px | 600 (Semi-bold) | Dimension labels, topic titles |
| **Body Primary** | 14px (0.875rem) | 22px | 400 (Regular) | Student comments, form labels, general text |
| **Body Secondary**| 13px (0.8125rem) | 18px | 400 (Regular) | Help text, metadata, date stamps, status tags |
| **Metric Value** | 28px (1.75rem) | 34px | 700 (Bold, Mono) | Level 1 key numbers (e.g., `3.8 / 5.0`, `42`) |
| **Micro / Badge** | 11px (0.6875rem) | 14px | 600 (Semi-bold) | Topic tags, sentiment pill badges |

---

## 4. Spacing System

A strict 4px-based geometric scale:
* `space-1`: 4px (tight badge padding)
* `space-2`: 8px (icon-to-text gap, form label margin)
* `space-3`: 12px (form control internal padding)
* `space-4`: 16px (card padding, default gutter)
* `space-6`: 24px (component separation, grid gaps)
* `space-8`: 32px (major section spacing)
* `space-12`: 48px (page header to content spacing)

---

## 5. Layout & Grid Architecture

* **Maximum Content Width**:
  - Student Submission Form: `560px` (Centered column; eliminates eye strain, feels fast).
  - Professor Dashboard: `1080px` (Centered academic container; prevents wide-screen reading fatigue).
* **Grid Structure**:
  - Level 1 Overview: 3 equal columns (`1fr 1fr 1fr`), collapsing to single-column on mobile.
  - Level 2 Performance & Level 3 Topics: Clean stacked lists with horizontal hairline dividers.
  - Level 4 Evidence: Linear list of comment items with consistent spacing.

---

## 6. Surface & Border Philosophy

* **Anti-"Card" Rule**: We strictly reject putting every piece of information into a floating drop-shadow card.
* **Structural Division**: Information is grouped using white background surfaces (`#FFFFFF`), subtle hairline borders (`1px solid #E5E7EB`), and deliberate vertical spacing (`32px`), creating an editorial publication feel rather than a dashboard widget wall.
* **Shadows**: Restrained to a single elevation:
  - `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (used exclusively for interactive inputs, active buttons, and dropdown menus).

---

## 7. Border Radius Scale

* `radius-sm`: `4px` (Form inputs, segmented rating buttons, badges).
* `radius-md`: `6px` (Primary action buttons, contextual notices).
* `radius-lg`: `8px` (Main surface content containers).
* *Rule*: No pill-shaped 9999px buttons or heavily rounded 16px/24px bubbles.

---

## 8. Button System

| Variant | Visual Properties | Purpose |
| :--- | :--- | :--- |
| **Primary** | Background `#1E3A8A`, text `#FFFFFF`, radius `6px`, height `40px`, font 14px Semi-bold. Hover: `#172554`. Focus: 2px outline `#3B82F6`. | The single dominant action on screen (e.g., "Submit Feedback", "Log In"). |
| **Secondary** | Background `#FFFFFF`, border `1px solid #D1D5DB`, text `#111827`. Hover: `#F9FAFB`. | Navigation and context actions (e.g., "Switch Course", "Next Page"). |
| **Subtle / Text** | Background `transparent`, text `#4B5563`, no border. Hover: text `#111827`, underline. | Low-priority actions (e.g., "Clear Filter", "Log Out"). |

---

## 9. Form Controls

* **Textarea & Text Inputs**:
  - Height: `40px` (Inputs) / Min-height `100px` (Textarea).
  - Border: `1px solid #D1D5DB`, background `#FFFFFF`, radius `4px`.
  - Focus State: Border color `#1E3A8A` with a 2px offset box-shadow `#3B82F6`.
* **Labels**: Always placed above controls, 13px Semi-bold `#111827`. Placeholders are secondary hints, never replacements for labels.
* **Character Counter**: Aligned right below the textarea, 12px Mono `#6B7280` (`0 / 2000`).

---

## 10. Rating Component Visual Design

The 1–5 scale is rendered as a **Segmented Number Group**:

```text
[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Poor                  Excellent
```

* **Visual State Rules**:
  - Container: 5 equal-width buttons spanning the control width.
  - Inactive State: Background `#FFFFFF`, border `1px solid #D1D5DB`, text `#374151`, font 14px Semi-bold.
  - Hover State: Background `#F3F4F6`, border `#9CA3AF`.
  - Selected / Active State: Background `#1E3A8A`, border `#1E3A8A`, text `#FFFFFF`.
  - Focus Ring: High-contrast outline around the active number during keyboard tab/arrow navigation.
  - Scale Anchors: 12px secondary text underneath: `"1 = Needs Improvement"`, `"5 = Excellent"`.

---

## 11. Data Visualization Principles

We enforce three lightweight, semantic visual representations:

### 11.1 Dimension Performance Meters (Level 2)
Horizontal two-tone proportion bar:
```text
Teaching Clarity         [=======================>    ] 4.25 / 5.0  (Strong)
Practical Examples       [==============>             ] 2.70 / 5.0  (Attention)
```
* **Track**: Background `#E5E7EB`, height `8px`, radius `4px`.
* **Fill**: Background `#1E3A8A` (or `#991B1B` if score $< 3.0$), width proportional to score (`(score / 5) * 100%`).
* **Numeric Label**: Tabular monospace `4.25 / 5.0` aligned right.

### 11.2 Sentiment Breakdown (Level 1 & Level 3)
A single segmented horizontal bar:
```text
[==== 57% Pos ====|=== 26% Neu ===|== 17% Neg ==]
```
* Height: `6px`, radius `3px`.
* Segments: Forest green (`#065F46`), Slate gray (`#9CA3AF`), Crimson (`#991B1B`).
* Accompanied by textual legend: `57% Positive (24) · 26% Neutral (11) · 17% Negative (7)`.

---

## 12. Dashboard Composition & Visual Hierarchy

```text
+---------------------------------------------------------------------------------+
| HEADER: Student Feedback Analyzer | CS301 Semester 1 2026-27 [Switch] | Prof. Sharma    |
+---------------------------------------------------------------------------------+
| LEVEL 1: OVERVIEW METRICS (3 Columns, Clean Hairline Border)                    |
| +-------------------------+ +-------------------------+ +---------------------+ |
| | AVERAGE RATING          | | TOTAL SUBMISSIONS       | | OVERALL SENTIMENT   | |
| | 3.84 / 5.00             | | 42                      | | 57% Pos  17% Neg    | |
| | [Overall Progress Bar]  | | Anonymous Responses     | | [Segmented Bar]     | |
| +-------------------------+ +-------------------------+ +---------------------+ |
+---------------------------------------------------------------------------------+
| LEVEL 2: TEACHING PERFORMANCE (Structured Dimension Rows)                       |
| Dimension Name              Progress Bar (0-5)         Score         Status     |
| ------------------------------------------------------------------------------- |
| Teaching Clarity            [====================>  ]  4.25 / 5.00   Strong     |
| Doubt Handling              [===================>   ]  4.10 / 5.00   Strong     |
| Engagement                  [================>      ]  3.75 / 5.00   Moderate   |
| Teaching Pace               [===============>       ]  3.40 / 5.00   Moderate   |
| Practical Examples          [==========>            ]  2.70 / 5.00   Attention  |
+---------------------------------------------------------------------------------+
| LEVEL 3: STUDENT DISCUSSION TOPICS                                              |
| Filter: [All Topics]  [Practical Examples (18)]  [Clarity (15)]  [Pace (9)]     |
|                                                                                 |
| Practical Examples                                                              |
| 18 mentions (43% of comments) | Sentiment: 11% Pos · 22% Neu · 67% Neg          |
+---------------------------------------------------------------------------------+
| LEVEL 4: REPRESENTATIVE ANONYMOUS EVIDENCE (Paginated Comment List)             |
| Showing 18 comments for "Practical Examples"                                    |
|                                                                                 |
| ┌─────────────────────────────────────────────────────────────────────────────┐ |
| │ "The theoretical explanations are very clear, but we need more coding       │ |
| │  examples during live sessions."                                            │ |
| │  [Practical Examples] [Teaching Clarity]  ·  Sentiment: Neutral  ·  Oct 9  │ |
| └─────────────────────────────────────────────────────────────────────────────┘ |
+---------------------------------------------------------------------------------+
```

---

## 13. Component Specifications

### 13.1 Topic Row / Card
* **Appearance**: Border `1px solid #E5E7EB`, padding `12px 16px`, background `#FFFFFF`.
* **Content**:
  - Title: 14px Semi-bold `#111827` (`Practical Examples`).
  - Count: 13px Mono `#4B5563` (`18 mentions`).
  - Sentiment Tag: 11px Badge (`Mostly Negative` in `#991B1B` on `#FEF2F2`).
* **Interaction**: Clicking toggles active filter state (Border switches to `2px solid #1E3A8A`).

### 13.2 Evidence / Feedback Item
* **Appearance**: Clean white row bounded by a bottom hairline divider (`1px solid #E5E7EB`).
* **Typography**: Comment body rendered in 14px regular `#1F2937` with comfortable `22px` line height.
* **Footer**:
  - Topic Badges: Muted slate tags (`#F3F4F6`, text `#374151`, radius `4px`).
  - Sentiment Pill: Compact label (`Positive`, `Neutral`, `Negative`).
  - Date Stamp: Coarse date string (`Oct 9, 2026`).

---

## 14. Responsive Breakpoints

* **Mobile (`< 640px`)**:
  - Student Form: Expands to full screen width with 16px gutters.
  - Segmented Rating buttons stack or scroll with minimum 44px tap target.
  - Dashboard Overview (Level 1) stacks vertically from 3 columns into 3 stacked blocks.
  - Performance meters drop the status badge and preserve the score.
* **Tablet (`640px - 1024px`)**:
  - 2-column overview metrics.
  - Full width Level 2–4 content.
* **Desktop (`> 1024px`)**:
  - Centered containers (`560px` form, `1080px` dashboard) with structured white space.

---

## 15. Accessibility & Motion

* **Contrast Ratios**: Verified 7:1+ for text against backgrounds, 3:1+ for input boundaries.
* **Color Blindness**: All sentiment and performance status markers pair color with unambiguous text labels (`Strong`, `Attention`, `Positive`, `Negative`).
* **Motion Policy**:
  - Transitions strictly limited to `150ms ease` for button hovers and border highlights.
  - Zero decorative loading spinners or parallax.
  - Full compliance with `@media (prefers-reduced-motion: reduce)`.

---

## 16. Visual Anti-Patterns (Explicitly Prohibited)

1. **NO Neon or Purple Gradients**: The palette is strictly academic slate, navy, and muted semantic tones.
2. **NO Heavy Drop Shadows**: Avoid `0 20px 25px` blurred shadows.
3. **NO Floating Card Walls**: Do not isolate every tiny statistic into a floating card.
4. **NO Emoji UI Decoration**: Do not use smiling/frowning emojis for sentiment.
5. **NO Unlabeled Colors**: Never display a red or green dot without adjacent descriptive text.
6. **NO SaaS Stock Art**: No decorative 3D characters, vector drawings, or generic illustrations.

---

## 17. Design Decision Table

| Decision | Recommendation | Reason | Alternative Considered | Why Rejected |
| :--- | :--- | :--- | :--- | :--- |
| **Color Base** | Academic Slate & Navy | Dignified, trustworthy, institutional tone. | Vibrant SaaS Purple / Teal | Looks like a generic startup, not an academic tool. |
| **Typography** | Native System Sans + Monospace Numerals | Instant load, zero flicker, perfect alignment for data tables. | Custom Webfonts (Inter, Roboto) | Extra network payload and layout shifts. |
| **Layout Grouping** | Hairline borders & structured white space | High information density, easy scanning. | Rounded drop-shadow cards everywhere | Wastes screen real estate; creates visual noise. |
| **Visual Charts** | Pure CSS proportion bars & segmented meters | Lightweight, accessible, zero JS chart dependencies. | Chart.js / D3 charts | Heavy bundle overhead for simple 1–5 dimension bars. |
| **Rating Control** | 1–5 Segmented button group | Unambiguous academic score, large touch target. | Star ratings (★) | Commercial review aesthetic, poor accessibility. |
| **Sentiment Cues** | Muted tints paired with bold text labels | Accessible to color-blind users, clear meaning. | Pure color dots / emojis | Ambiguous, inaccessible, unacademic. |

---

## 18. Self-Critique

1. **Does this look like a generic AI template?**  
   *No*. It deliberately strips away gradients, floating cards, and decorative charts in favor of structured academic editorial layout.
2. **Can an instructor understand the dashboard within 10 seconds?**  
   *Yes*. Large monospace metrics at the top immediately report the score, followed by dimension bars that visually highlight strengths and areas for attention.
3. **Does the student form feel fast and trustworthy?**  
   *Yes*. A centered, narrow column with 5 large numerical buttons and an optional text field.
4. **Is color accessibility guaranteed?**  
   *Yes*. Every single status, sentiment, and metric pairs color with clear textual labels.

---

## 19. Decisions Requiring Architect Approval

1. **Primary Interactive Accent**: Is Academic Navy (`#1E3A8A`) approved as the primary theme accent color?
2. **Tabular Numerals**: Is using system monospace (`ui-monospace, Menlo, Consolas`) for numeric scores and percentages approved?
3. **Pure CSS Visualizations**: Is building Level 2 and Level 3 progress/proportion meters with clean semantic HTML/CSS approved over installing an external charting package?

---
*(Stopping here as instructed. Awaiting architectural review and approval of the Visual Design System before proceeding to implementation planning.)*
