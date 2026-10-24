# Student Feedback Analyzer: System Design Audit

**Initial audit:** 10 October 2026  
**Implementation update:** 10 October 2026  
**Purpose:** Track verified design findings and the status of approved fixes. Treat remaining policy/architecture questions as open; do not infer that a requirement is implemented because it is described here.

## Executive summary

The local student selection flow was verified across CSE/IT and multiple semesters. A stale backend once returned an older catalog payload; a frontend contract validator and a backend `/api/v1/meta` version/build endpoint now make incompatibility visible. The stale API process itself was fixed by restart.

The destructive fixture reset is now a separate guarded command, while normal `db:seed` uses an additive loader. Production provisioning now refuses missing/weak passwords before connecting to the database. Focused backend tests pass (6/6), frontend tests pass (18/18), and the production build succeeds. No database was seeded or reset.

The user approved one-time course tokens, following the recommendation of one token per exact semester/section offering issued from a registrar roster. This implementation now validates, locks, and consumes tokens atomically with submission; the roster identifier is represented only by an offering-scoped keyed pseudonym in a restricted eligibility table. Feedback rows have no token/identity link and faculty cannot access that table. Department selection continues to filter eligible offerings only and is not persisted. The dashboard polls every 15 seconds and NLP is asynchronous; metrics distinguish received rating responses from analyzed comments and expose pending/retrying/exhausted analysis counts.

## Scope and verification

- Inspected the current React student and faculty flows, Express API, catalog, feedback and NLP paths, authentication, database scripts, and existing product/UX documentation.
- Ran the local student flow against the live app: Year 1 → IT → Semester 1 → IT101; Year 1 → CSE → Semester 1 → CS301 and its two instructor/section options; Year 4 → IT → Semester 7 → IT401. The selections displayed the expected context.
- Observed the previous API mismatch and confirmed that the current API payload includes course, term, year, department, section, and eligible-department fields after restarting the stale backend.
- No feedback was submitted during the live check.
- A final visual/keyboard verification attempt was blocked because the Windows computer-use helper could not confidently identify the browser's current URL; no UI actions were taken in that attempt.
- This is not a production deployment audit. I did not verify production credentials/configuration, database backup restoration, multi-instance behavior, formal accessibility, or current mobile layouts. Findings below distinguish confirmed issues from recommendations and policy decisions.
- Existing `USER_AUDIT.md` and `PRODUCT_IMPROVEMENT_REPORT.md` contain observations from earlier builds. Some reported issues (such as direct routes and department selection) are already fixed in current source; do not treat those documents as a current defect list without rechecking them.

## Findings

### RESOLVED IN CODE — Normal seed is additive; destructive reset is guarded

The old `seed.js` reset still deletes demo data, but `db:seed` now maps to the additive catalog loader. The destructive path is `db:demo-reset`, and it requires an explicitly configured development/test environment, matching database name, and confirmation value; it checks `current_database()` before destructive statements. Catalog conflicts use `DO NOTHING`, so existing accounts, course/term details, active state, and submissions are preserved.

**Verification still needed:** Run the new guard/preservation tests. Do not invoke either seed command against the working database during verification.

### RESOLVED IN CODE — Production provisioning rejects default/weak passwords

`backend/src/db/provision.js` now requires an explicit unique `PROF_PASSWORD` of at least 20 characters before it opens a database connection. The local demo seed retains a clearly scoped development fixture credential and no longer logs it. There is no forced password-rotation feature in the application; operational rotation must use an approved secure channel.

**Verification still needed:** Run the focused provisioner test and confirm production deployment secrets meet the minimum.

### RESOLVED IN CODE — Catalog contract mismatch has an explicit error state

**Confirmed in the live local run.** A stale backend returned an older catalog payload without the IDs and department/year fields the current selector needs. The UI rendered empty selection options instead of explaining that the catalog response was incompatible. Restarting the current server fixed the data, but a restart is not a durable safeguard.

Frontend and backend validate the required catalog shape; malformed server data becomes `503 CATALOG_CONTRACT_INVALID`; an incompatible frontend payload produces an actionable retry message. `/api/v1/meta` returns API/build identifiers. A current catalog contract test covers department, semester and eligible-department fields. Deployment health checks still need to compare frontend/backend compatibility.

### P1 decision — Anonymous feedback has no verified enrollment or duplicate-vote rule

The feedback flow accepts an offering and ratings without student identity. The idempotency key protects retries of the same request; it is not a one-vote-per-enrolled-student control. IP rate limiting is in-memory and per backend process, so it is not a durable campus-wide eligibility or duplicate-prevention mechanism.

**User decision and implementation:** Anonymous to professors, enforced with one-time roster tokens per exact offering. The registrar issues tokens using the CLI documented in `COURSE_CATALOG_SETUP.md`; duplicate roster issuance is blocked by a unique offering-scoped HMAC pseudonym. Token hashes are consumed in the feedback transaction. The eligibility table is restricted and intentionally has no feedback submission foreign key. The CSV and roster are sensitive operational files, and the HMAC pseudonym is still sensitive pseudonymous data. University owners must set retention/deletion policy before production rollout. Response revision behavior remains undecided; department-level breakdowns and a registrar/admin web role also need separate product/privacy decisions.

### P2 — Department selection is a filter, not a reporting dimension

The student chooses a department to filter cross-listed offerings. The feedback submission is stored against the course offering; the chosen student department is not persisted. Faculty results therefore cannot be split by the student's home department. This may be the right privacy choice, but it should be explicit because the interface can imply that department context is part of the feedback record.

**Decision required:** Keep department ephemeral and explain that it only finds eligible courses, or retain a privacy-reviewed cohort field and enforce minimum cohort thresholds before any breakdown. Do not add department-level reporting without reviewing re-identification risk.

### P2 — Academic catalog and offering operations are developer-led

Current catalog data is created through scripts and environment configuration. There is no registrar/admin workflow in the inspected UI for maintaining departments, academic years/semesters, course offerings, instructor assignments, sections, feedback windows, or eligibility. This is workable for a prototype, but it creates operational friction and raises the risk of incorrect mappings as the university expands.

**Change needed:** Define an authorized catalog-administrator role and a small management workflow (or a controlled import tool) with validation, preview, audit history, and safe term rollover. Do not create a broad admin console before confirming who owns these records and what source of truth the university uses.

### P2 — “Real time” expectations exceed asynchronous analysis and polling

Feedback submission schedules NLP analysis asynchronously. The faculty dashboard polls every 15 seconds and may show aggregate rating counts before comment analysis completes. The system is therefore near-real-time at best, not instant. A submission can be accepted while sentiment/topics are still pending or temporarily unavailable.

**Change needed:** Show distinct states for received, analysis pending, analyzed, and analysis failed/retrying. Label dashboard refresh timing and last update. Keep rating metrics and comment-analysis counts separate so users do not infer that all results are complete at once. Define a service target for analysis latency before promising “real time.”

### P2 — Current rate limiting is process-local

**Confirmed in** `backend/src/middlewares/rateLimiter.js`: counters live in an in-memory `Map`. Restarting the service clears them, and separate backend instances do not share limits. It is acceptable as a lightweight local safeguard but insufficient as the only abuse-control layer in a horizontally scaled deployment.

**Change needed:** If deploying multiple instances, move counters to a shared store or gateway and configure trusted proxy handling deliberately. Reassess thresholds for a campus network where many students may share an IP. Keep rate limiting separate from enrollment verification.

### P2 — Privacy wording needs to match the data and access model

The notice explains anonymity, temporary IP use for abuse prevention, aggregate reporting, written comments, and small-group thresholds. This is more informative than an absolute anonymity claim, but “anonymous” can still be interpreted as impossible to identify, while free-text comments may self-identify a student. The notice's detailed explanation is behind a disclosure.

**Change needed:** Have the institution's privacy owner approve exact wording. On the first view, state what faculty can see and that comments can contain identifying details; keep the deeper retention/access explanation expandable. Avoid promising anonymity beyond what storage, access, logs, and comment content can guarantee.

### P2 — Faculty dashboard can be clearer about denominators and analysis coverage

The dashboard has separate response, comment-analysis, sentiment, and topic measures plus a privacy threshold. These are useful, but users can mistake analyzed comments for all submissions or interpret a sentiment share as a share of all respondents. Keep each metric's denominator and minimum-count rule adjacent to the value, and distinguish missing/pending analysis from zero sentiment.

**Change needed:** Use labels such as “17 rating responses” and “14 comments analyzed”; state that sentiment percentages use analyzed comments. Give pending/failed analysis a clear count/state. Do not use color as the only signal for sentiment.

### P2 — Existing design/product documents have drifted from implementation

Earlier audit documents describe several problems that the current implementation has since fixed, while the code has materially changed. Conflicting “current state” descriptions waste debugging time and can lead future work to undo working behavior.

Historical audit files now carry a stale-snapshot banner. API, data model, security, catalog, and UX specifications describe current behavior and call out the unenforced one-response policy.

### P3 — Visual hierarchy should stay calm as the dashboard grows

The current student path has a sensible sequence (year, department/semester, course, instructor/section when needed). Retain progressive disclosure and the restrained visual style. For faculty, keep the top of the page to course context, response count, average rating, and one clearly labeled sentiment summary; place detailed topic evidence and comments below or in tabs. Use a table for comparable high-volume records and cards only for distinct takeaways/actions. Revalidate current mobile and keyboard/screen-reader behavior before release; those were not fully tested in this audit.

## Recommended order

1. Run focused safety, contract and UI tests/builds; inspect responsive and keyboard behavior.
2. Resolve the identity-proof mechanism, per-course scope, and response revision policy; implement the privacy-preserving one-response control.
3. Add deployment-level API compatibility checks and gateway rate controls.
4. Define catalog ownership and safe term/course/faculty maintenance.
5. Reconcile remaining specifications and perform the formal accessibility/deployment review.

## Implementation prompt (original approved scope)

The non-policy portions of this prompt have now been implemented in code. The one-response policy was clarified afterward; its identity-proof mechanism remains an explicit integration/privacy decision.

```text
Work in the Student Feedback Analyzer repository. First inspect the current source and canonical specifications; do not assume older audit documents describe the current code. Use docs/SYSTEM_DESIGN_AUDIT.md as a set of findings to verify, not as permission to make policy decisions.

Implement only the approved, non-policy fixes below:

1. Protect data seeding. Separate destructive demo reset from normal catalog setup. Destructive reset must fail closed outside explicitly configured development/test environments and must verify the target database. Normal seed/catalog commands must not delete feedback, professors, courses, or live offerings. Preserve the CSE/IT catalog and existing feedback when loading demo/catalog data. Add focused tests for the safety guard and preservation behavior.
2. Remove known production credential defaults. Production provisioning must fail before making database changes when a strong secret/invitation flow is not configured. Keep demo credentials isolated to development fixtures, and document first-login reset/rotation. Do not expose secrets in logs or responses.
3. Harden the catalog API contract. Validate required course/term/department/year/section fields in the frontend and backend contract. Add an explicit API/build version or compatible health response. An old or malformed response must display a recoverable, actionable catalog-load error, never a misleading “no courses available” state. Add contract tests that cover the current department and semester eligibility shape.
4. Make feedback analysis lifecycle understandable. Preserve asynchronous analysis, but distinguish accepted, pending, completed, retrying, and failed states. Clearly label rating-response versus analyzed-comment denominators and the 15-second dashboard refresh behavior. Ensure pending or failed NLP data is not presented as zero/negative sentiment.
5. Review rate-limiter configuration for production deployment. If the backend supports multiple instances, use a shared rate-limit store or document/configure a trusted gateway strategy; make proxy/IP trust explicit and test shared-campus-IP behavior. Do not treat IP limiting as enrollment verification.
6. Keep the student form progressive: select year, then department and semester, then course, and request professor/section only when a course has multiple offerings. Preserve clear loading, retry, empty, and incompatible-catalog states. Keep the first view concise, with detailed privacy guidance expandable but the key visibility/anonymity caveat visible before submission.
7. Improve dashboard clarity without adding decorative clutter: prioritize course context, response count, average rating, and labeled sentiment summary; disclose denominators and privacy thresholds near metrics; put detailed comments/topics behind clear navigation; use tables for comparable large datasets; ensure color is never the only status cue. Verify responsive layout, keyboard flow, focus, and screen-reader labels.
8. Reconcile docs/USER_AUDIT.md, docs/PRODUCT_IMPROVEMENT_REPORT.md, docs/UX_SPEC.md, and related canonical docs with verified current behavior. Remove or mark stale claims and keep one source of truth for privacy, eligibility, metrics, and catalog rules.

The product policy is implemented as one response per student per exact offering, using a one-time registrar-issued token. Before production, the university must approve retention/deletion timing for roster distribution files and eligibility pseudonyms. Department-level breakdowns, response revisions, and a registrar/admin web role remain separate decisions.

Before editing, report the files and risks you found. Make focused changes, avoid unrelated redesign, and run only the specifically requested focused tests/builds. Report exact results and list deployment steps. Do not seed or reset a database as part of verification.
```

## Decisions for the next review

1. What retention and deletion schedule should apply to issued token CSVs, source rosters, and keyed eligibility pseudonyms?
2. Can students revise a submitted response, and if so, how should the university preserve anonymity and prevent multiple active responses?
3. Should student department remain a temporary course filter, or be retained for reporting after a privacy review?
4. Who owns the official catalog and semester windows: registrar staff, a SIS integration, or controlled imports? (The current token CLI is registrar-operated; no registrar web role has been added.)
