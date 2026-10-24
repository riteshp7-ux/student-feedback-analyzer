# Student Feedback Analyzer — Product Improvement Report

> **Historical recommendations.** This report was written against an earlier build. Several findings (including route restoration, course selectors, and submission confirmation) were addressed afterward. See [SYSTEM_DESIGN_AUDIT.md](SYSTEM_DESIGN_AUDIT.md) for the current verified baseline; revalidate every item before implementation.

**Purpose:** Convert the black-box audit into a practical, prioritized plan for improving reliability, trust, usability, and visual simplicity without removing useful capabilities.

**Evidence base:** Findings in [USER_AUDIT.md](USER_AUDIT.md), with alignment checks against [UX_SPEC.md](UX_SPEC.md), [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [PRODUCT.md](PRODUCT.md), and [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md). This is a recommendation report; no product code changes have been made.

## Executive summary

The product already has a useful core: students can submit course ratings and optional comments, and faculty can inspect course-level summaries and filter written evidence. The audit found that some key journeys are not dependable and that the dashboard can present misleading demo data as genuine student evidence. Those issues undermine trust more than the visual styling does.

Prioritize reliable route restoration and trustworthy data first. Then correct privacy and submission messaging, expose analysis status, and fix mobile layout. Reduce cognitive load through stronger hierarchy, plain language, good defaults, and progressive disclosure. Keep the full analysis and filtering capabilities available; make the common path obvious and let users open detail when they need it.

## Prioritized findings and improvements

| Priority | Finding | Improvement | Acceptance outcome |
|---|---|---|---|
| **P1 — release blocker** | **AUD-01: Faculty routes do not survive direct navigation or refresh.** `/login` and `/dashboard` render the student page when opened directly; refreshing `/dashboard` loses the view. | Make the URL the source of truth for student, login, and dashboard routes. Restore authenticated state safely, protect dashboard routes, and redirect signed-out users to login with a return path. Keep browser back/forward behavior coherent. Add a visible route back to the student portal. | Direct load, refresh, browser back/forward, logout, and expired-session flows all land on an intentional page with a clear next action. No dashboard data is exposed to a signed-out user. |
| **P1 — release blocker** | **AUD-02: CS201 demo evidence conflicts with the documented N=2 fixture and contains repeated QA/security strings.** It appears as ordinary student feedback and affects counts and sentiment. | Establish one deterministic, documented demo-fixture source. Remove QA and security test payloads from ordinary demo data, or place them in a clearly marked isolated test fixture that cannot be confused with real evidence. Make displayed totals, topic counts, and sentiment derive from the same eligible responses. | Demo course counts match documentation. No test/security payload appears as normal feedback. Reset/reseed is documented and repeatable. Small-cohort masking is demonstrable. |
| **P2 — trust** | **AUD-03: “100% Anonymous” overstates privacy.** Students can identify themselves in comments; request IP is used transiently for rate limiting. | Replace absolute guarantees with bounded, plain-language disclosure: what is stored with a response, what faculty see, the small-group privacy threshold, and the risk of identifying details in comments. Keep the notice concise, with an expandable “Privacy details” section if more explanation is needed. | Wording matches actual data handling and does not imply untraceability. A student can understand the key limitation before typing. |
| **P2 — trust** | **AUD-04: Confirmation displays `SUBMISSION_RECORDED` as an ID.** | Remove the placeholder ID. Show a simple “Feedback submitted” confirmation and explain what happens next. If a real receipt is later introduced, make it intentionally generated, privacy-safe, and useful; do not expose an internal constant. | No internal token or fake reference appears. Confirmation is understandable and does not imply a feature that does not exist. |
| **P2 — comprehension** | **AUD-06: Pending NLP comments have no visible processing status.** | Give each eligible comment a clear status such as “Analysis pending,” “Analyzed,” or “Could not analyze,” with a concise explanation. Keep raw written evidence available when permitted, even if analysis fails. Provide retry/reprocess controls only to authorized faculty/admin roles and only if supported by backend behavior. | Faculty can distinguish no comments from comments awaiting or failing analysis. Status is accessible to screen readers and does not silently distort analytics. |
| **P2 — responsive usability** | **AUD-05: Faculty dashboard overflows horizontally at a phone viewport and topic headings become cramped.** | Reflow layout at narrow widths. Stack or compact metric cards, wrap long topic labels, make charts legible without sideways page scrolling, and keep filters reachable. If a data table truly requires horizontal scrolling, constrain scrolling to that table and label it; do not let the whole page overflow. | At 390×844 and common desktop widths, all primary actions and labels are visible and usable without page-level horizontal scrolling. |
| **P2 — navigation** | **AUD-07: Login has no visible return path to student feedback.** | Add a persistent, plainly labeled “Student feedback” link from login and a useful destination after logout. Ensure it uses the same route model as AUD-01. | Users can recover from entering the wrong portal without browser-history knowledge. |
| **P3 — interpretation** | **AUD-08: Signed sentiment shorthand (`-22% Neg`, `+7 =0 -0`) is hard to decode.** | Label values directly (for example “Negative 22%,” “Positive 7,” “Neutral 0”) and state the denominator or sample count. Pair colors with text and symbols; never rely on color alone. | A first-time faculty user can explain what the number means without guessing. |

Audit details and screenshots/evidence are in [USER_AUDIT.md](USER_AUDIT.md). The audit also verified useful behaviors to preserve: required rating validation, course selection, optional comment guidance and character counter, submission confirmation, rapid double-click duplicate prevention, zero-response masking, and topic/sentiment evidence filters.

## Cognitive-load plan: simpler appearance, full capability

The goal is to reduce the number of things users must notice, interpret, remember, and decide at once—not to delete the analysis tools.

### Student experience

1. **One clear purpose and one primary action.** Keep the page centered on “Share feedback for a course.” Use a single-column form with a clear course selector, five consistently structured rating questions, one optional comment area, and one submit button.
2. **Use plain-language rating anchors.** Explain what 1 and 5 mean at the point of choice; show selected state clearly. Keep each rating question visually grouped and keyboard-operable.
3. **Make optional items visibly optional.** Label the comment optional and keep its guidance short. Put longer privacy detail behind an expandable disclosure, while keeping the essential privacy caveat visible before entry.
4. **Reduce memory and error recovery costs.** Preserve entered values after a recoverable submission/network error. Place validation next to the affected field and move focus or provide a summary so errors are easy to find.
5. **Make the end state calm and definite.** Confirm success in plain language, remove the form after successful submission to prevent accidental duplicates, and provide only a useful next step.

### Faculty experience

1. **Lead with context.** Keep course, term, and response count visible. Make the selected course obvious and avoid hiding a course switcher in an unrelated menu.
2. **Use a summary-first hierarchy.** Show a compact top-level overview first: response count, overall result, and any sample-size/privacy status. Follow with rating dimensions, topics, then written evidence.
3. **Progressively disclose detail.** Topic filters, sentiment filters, and evidence remain available, but secondary controls can live in a clearly named “Filters” area. Keep active filters visible as removable chips and provide “Clear filters.” Do not hide critical privacy or data-quality status.
4. **Connect summary to evidence.** A topic selection should update the evidence list in place and visibly identify the active topic. Preserve the current page context and explain when there are no matching comments.
5. **Use labels before abbreviations.** Prefer “Positive” and “Negative” over `Pos`/`Neg`; define averages, percentages, and mention counts. Show denominators and small-sample caveats near the statistic.
6. **Keep screen density adjustable through layout, not feature removal.** Use whitespace, consistent card grouping, restrained color, and responsive stacking. Avoid putting every chart, filter, and comment at equal visual weight.

### Shared visual and interaction rules

- Establish a predictable page grid, spacing scale, typography hierarchy, and a small set of semantic colors consistent with `DESIGN_SYSTEM.md`.
- Use one strong page heading, descriptive section headings, and consistent card patterns. Avoid excessive uppercase micro-labels and decorative labels that compete with the task.
- Give every async operation explicit loading, success, empty, and recoverable error states. Follow the state-machine intent already described in `FRONTEND_ARCHITECTURE.md`.
- Use accessible semantic controls, visible keyboard focus, sufficient contrast, touch targets, and announced validation/status messages. Test keyboard-only use and at least one screen reader.
- Do not use color as the sole indicator for rating, sentiment, validation, or processing state.
- Avoid modal dialogs for routine filtering or evidence exploration; retain context and use inline disclosure where possible.

## Additional improvements to include in implementation planning

These are cross-cutting safeguards that make the visible fixes durable:

- **Data integrity and auditability:** Identify whether a record is demo, synthetic, or production data at the data-source boundary. Prevent synthetic fixtures from entering normal analytics. Document seed/reset steps and expected counts.
- **Analytics semantics:** Define whether topic totals count comments or topic mentions, how multi-topic comments are counted, which responses are eligible, and what denominator each percentage uses. Display those definitions briefly in context or a help disclosure.
- **Privacy thresholds:** Apply the same small-cohort rule consistently to aggregate charts and raw comments. Show a clear locked state and threshold rationale without leaking individual records. Verify filters, deep links, and API responses cannot bypass the rule.
- **Safe evidence rendering:** Render comments strictly as text; never interpret user-supplied HTML. Add regression coverage using HTML/script-shaped strings and verify they display inertly.
- **Resilient async behavior:** Confirm loading, empty, timeout/network, server error, pending-analysis, and retry behavior. Preserve form inputs after recoverable failures. Avoid duplicate submissions and stale dashboard results after rapid filter changes.
- **Authentication and authorization:** Test route guards and server-side authorization independently. Client-side route protection alone is not access control. Ensure logout clears client credentials and private cached data.
- **Accessibility and responsive review:** Check semantic headings, labels, keyboard operation, focus management, contrast, zoom/reflow, and narrow screens for both personas.
- **Privacy-safe product analytics:** If usage measurement is added, collect only what is needed, avoid recording feedback text or identity, document retention, and keep it separate from response records.
- **Product language review:** Use the same terms (“course,” “course offering,” “response,” “comment,” “topic”) consistently and explain technical terms the first time they appear.
- **Operational readiness:** Add a short faculty-facing explanation for delayed or unavailable analysis, and a support route for service failures. Do not imply analysis is real-time if it is asynchronous.

## Recommended delivery order

1. Fix direct routes, refresh behavior, access guards, and student-portal return navigation (AUD-01, AUD-07).
2. Reconcile demo fixtures and analytics provenance; remove ordinary-feed QA/security artifacts (AUD-02).
3. Correct privacy wording and success receipt (AUD-03, AUD-04).
4. Add clear NLP processing states and robust async/error behavior (AUD-06).
5. Repair mobile layout and simplify labels/visual hierarchy without removing filters (AUD-05, AUD-08 plus cognitive-load plan).
6. Complete accessibility, security, privacy-threshold, and regression checks; update product and UX documentation to match implemented behavior.

## Copy-ready implementation prompt

```text
You are improving the Student Feedback Analyzer in this repository. Implement the prioritized product, functionality, and UX improvements in docs/PRODUCT_IMPROVEMENT_REPORT.md, using docs/USER_AUDIT.md as the evidence record and reading docs/PRODUCT.md, docs/UX_SPEC.md, docs/DESIGN_SYSTEM.md, and docs/FRONTEND_ARCHITECTURE.md before editing.

Objective
Make the system reliable and trustworthy, and make the interface feel simple at first glance while retaining all current useful functionality. Reduce cognitive load with hierarchy, sensible defaults, plain language, progressive disclosure, and clear states. Do not achieve simplicity by deleting filters, analytics, evidence, privacy safeguards, or supported workflows.

First inspect the current implementation and confirm each audit finding against the code and current data model. Treat the report as a prioritized specification, but resolve any discrepancy by following actual product behavior and documenting it. Fix root causes rather than adding cosmetic workarounds. Preserve existing conventions and avoid unrelated rewrites or new dependencies unless the repository architecture requires them.

Priority 1 — routing, sessions, and data trust
1. Make student, faculty login, and faculty dashboard pages addressable by stable URLs. Direct navigation, refresh, and browser back/forward must restore the right view. Restore sessions safely, guard protected routes, return signed-out users to login with a safe return path, and clear private client state on logout. Include an obvious route back to student feedback.
2. Find the source of the demo dataset mismatch. Make demo fixtures deterministic and consistent with documented counts. Remove QA/security test strings from ordinary demo feedback or isolate and label them as test-only data so they cannot influence real-looking analytics. Ensure counts, ratings, topic totals, sentiment, and evidence all use the same eligible dataset. Document seed/reset behavior.
3. Ensure user comments are rendered as inert text. Add regression coverage for HTML/script-shaped comment content.

Priority 2 — privacy, receipts, analysis state, and mobile
4. Replace absolute anonymity promises with concise, accurate privacy language describing what is associated with a response, what faculty can see, small-cohort protection, transient abuse-prevention processing where relevant, and the possibility of self-identification in free text. Keep the essential caveat visible and place secondary detail in an accessible disclosure if helpful. Match wording to actual code and data handling.
5. Remove the literal SUBMISSION_RECORDED placeholder from the success screen. Provide a clear confirmation without inventing a receipt or identifier. Preserve duplicate-submit protection and entered values after recoverable errors.
6. Show explicit pending, completed, and failed/unavailable analysis status for comments. Make aggregate behavior clear while analysis is pending or failed; do not silently count unavailable NLP results as a confident sentiment/topic result. Keep evidence accessible when policy permits. Any retry action must be authorized and supported by the backend.
7. Fix the faculty layout at narrow widths, including the audited 390×844 viewport. Remove page-level horizontal overflow, wrap long topics, make filters and evidence usable, and preserve the same capabilities on mobile.

Priority 3 — clarity and cognitive load
8. Keep the student journey single-column and linear: choose course, answer five consistently grouped ratings with clear anchors, optionally comment, submit, and see a calm confirmation. Use plain language and field-level validation. Clearly mark optional content.
9. Make the faculty dashboard summary-first: course/term/sample context, key metrics, rating dimensions, topics, then evidence. Keep filters available through a compact, clearly labeled area; show active filters and a one-action clear control. Selecting a topic must keep context and connect the summary to matching evidence.
10. Replace ambiguous signed shorthand with explicit labels and denominators. Define whether counts represent responses or mentions, explain multi-topic counting, and add sample-size caveats close to metrics. Use text/icons as well as color.
11. Apply the existing design system consistently. Use a clear type/spacing hierarchy, restrained color, predictable grouping, semantic controls, visible focus, keyboard access, suitable contrast and touch targets, and accessible announcements for validation and async status. Avoid adding unnecessary dialogs or competing visual elements.

Cross-cutting requirements
- Preserve the existing useful behavior verified in docs/USER_AUDIT.md: required rating validation, course selection, optional comment, character count, successful submission, double-submit prevention, zero/small-cohort privacy protection, and topic/sentiment evidence filtering.
- Verify authorization on the server/API, not only in client routes. Confirm no private dashboard data leaks when signed out or after logout.
- Implement intentional loading, empty, error, retry, pending-analysis, and no-filter-results states. Prevent stale responses from replacing current results when filters change quickly.
- Keep privacy controls consistent across aggregates, raw evidence, search/filter paths, direct URLs, and API responses.
- Update docs to describe actual implemented behavior and fixtures. Do not claim a test passed unless it was run.

Validation before completion
Run the repository's relevant lint/build/test commands and add or update focused tests for route restoration and guards, demo fixture counts, privacy threshold enforcement, inert comment rendering, submission duplicate protection/error recovery, analysis statuses, filter consistency, and responsive layout. Exercise student and faculty flows end-to-end at desktop and mobile sizes. Check keyboard-only operation, focus behavior, and accessible labels/status announcements. Report commands and outcomes, list changed files, note any unverified risks, and do not leave temporary test records or credentials in the development data.

Work in small, coherent changes. Do not change production data, deploy, publish, or introduce external services as part of this repository implementation. If a requested behavior conflicts with the backend contract or documented privacy policy, explain the conflict and make the safest compatible implementation rather than inventing behavior.
```

## Scope note

The audit did not verify slow-network/backend outage behavior, forced NLP failure, expired sessions, server-side authorization, or formal keyboard/screen-reader accessibility. These remain explicit validation items for implementation. The audit’s synthetic local test response is disclosed in [USER_AUDIT.md](USER_AUDIT.md); this report does not modify or clean local data.
