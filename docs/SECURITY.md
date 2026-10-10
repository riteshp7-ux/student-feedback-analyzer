# Security & Privacy Architecture

## 1. Threat Model & Privacy Principles

Student feedback requires authentic anonymity to guarantee psychological safety and uninhibited, honest feedback on university instruction.

### Core Privacy Guarantees
1. **Zero Identity Persistence**:
   - The database schema completely excludes student identification attributes (`student_id`, IP addresses, cookies, browser fingerprints).
   - API endpoints enforce strict request validation: unexpected identity fields are rejected with HTTP 422 (`VALIDATION_ERROR`).
2. **Aggregated Analytical Guard ($N \ge 5$)**:
   - The Express dashboard endpoint hides granular rating distributions and feedback comments when total respondents $N < 5$, preventing re-identification in small class cohorts.
3. **Temporal Privacy (Date Truncation)**:
   - Feedback comments expose only coarse submission dates formatted as `YYYY-MM-DD` (`TO_CHAR(created_at, 'YYYY-MM-DD')`). Exact timestamps are never returned in public or professor-facing APIs, preventing correlation with classroom dismissal times.
4. **Redaction of Sensitive Text from Logs**:
   - Both Express and the Python NLP service log only transaction durations, predicted sentiment labels, and topic counts.
   - Raw student feedback comments are **never** logged to stdout, stderr, or system log files.

---

## 2. Internal Microservice Security Boundary

1. **Network Isolation**:
   - The NLP microservice binds exclusively to loopback (`127.0.0.1:8000`) or a private internal subnet.
   - It is never exposed directly to public internet or browser traffic.
2. **No CORS Wildcard**:
   - CORS is disabled on the NLP service, rejecting cross-origin browser requests.
3. **Payload Size Limits**:
   - The NLP service rejects request payloads with text exceeding 5,000 characters (HTTP 422), mitigating memory exhaustion attacks.
4. **Information Leakage Prevention**:
   - Internal stack traces, model file paths, and dependency versions are stripped from client-facing error responses.

---

## 3. Professor Authentication & Authorization Architecture

### 1. Separation of Concerns
* **Student Interface**: Fully public and anonymous. Does not require login, does not issue tokens, and never stores or links user identifiers to submissions.
* **Professor Interface**: Protected behind institutional credentials. Faculty members must authenticate to access course evaluations.

### 2. Password Security & Credential Storage
* Passwords are stored in PostgreSQL using `bcrypt` (work factor 10) with per-user salt.
* Plaintext passwords and password hashes are never logged, never returned in API payloads, and never cached.
* Login timing attack mitigation: queries execute uniform verification paths to prevent username enumeration via response latency.

### 3. Token Architecture
* Transport: Standard HTTP header (`Authorization: Bearer <token>`).
* Format: Signed HMAC-SHA256 JSON Web Token (JWT) with minimum 32-character server secret in production.
* Payload: `{ "professorId": "<uuid>", "email": "<string>" }`.
* Expiration: Fixed 24-hour expiration (`expiresIn: "24h"`). Expired or tampered tokens return HTTP 401 with `TOKEN_EXPIRED` or `INVALID_TOKEN`.

### 4. Course Offering Authorization Matrix
Server-side middleware (`requireOfferingOwnership`) validates that the requesting professor strictly owns the course offering before any feedback or aggregate analytics are returned:

| Resource / Endpoint | Student | Unauthenticated | Assigned Professor | Non-Assigned Professor |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api/v1/course-offerings` | Allowed | Allowed | Allowed | Allowed |
| `POST /api/v1/feedback` | Allowed (Rate-limited) | Allowed (Rate-limited) | Allowed | Allowed |
| `POST /api/v1/auth/login` | N/A | Allowed (Rate-limited) | Allowed | Allowed |
| `GET /api/v1/auth/me` | Denied (`401`) | Denied (`401`) | Allowed | Allowed |
| `GET /api/v1/professor/offerings` | Denied (`401`) | Denied (`401`) | Own Assigned Data | Own Assigned Data |
| `GET /api/v1/dashboard/:courseOfferingId` | Denied (`401`) | Denied (`401`) | Allowed (`200`) | Denied (`403 FORBIDDEN`) |
| `GET /api/v1/feedback/:courseOfferingId` | Denied (`401`) | Denied (`401`) | Allowed (`200`) | Denied (`403 FORBIDDEN`) |

---

## 4. Production Hardening & Defensive Controls

### 1. HTTP Security Headers
All backend responses enforce standard defensive headers:
- `X-Content-Type-Options: nosniff` — prevents MIME confusion attacks.
- `X-Frame-Options: DENY` — prevents clickjacking.
- `X-XSS-Protection: 0` — disables legacy, buggy browser XSS audits in favor of modern CSP.
- `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer metadata.
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none';` — locks down API responses.
- `Cross-Origin-Opener-Policy: same-origin` — isolates browsing contexts.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — enforces HTTPS in production.
- `X-Powered-By` header is explicitly suppressed via `app.disable('x-powered-by')`.

### 2. Request Size Limits & Input Boundaries
- **JSON Body Parser**: Bounded strictly to `100kb`. Payloads exceeding 100kb are rejected with HTTP 413 `PAYLOAD_TOO_LARGE`.
- **Feedback Comments**: Strictly bounded to 2,000 characters across frontend, Express backend, database constraint, and NLP microservice.
- **Query Parameter Allowlisting**: Topic filtering enforces an approved enum allowlist (`teaching_clarity`, `teaching_pace`, `practical_examples`, `doubt_handling`, `engagement`, `assignments`, `course_content`). SQL injection attempts are rejected at the schema boundary with HTTP 422.

### 3. API Abuse Protection & Rate Limiting
- **Authentication Limiter (`POST /api/v1/auth/login`)**: Bounded to 10 attempts per 15 minutes per IP address. Mitigates automated credential stuffing and brute-force password guessing.
- **Submission Limiter (`POST /api/v1/feedback`)**: Bounded to 30 submissions per minute per IP address. Mitigates automated form spamming.
- In-memory rate limiting stores automatically prune expired IP entries to avoid unbounded memory usage.

### 4. Cross-Origin Resource Sharing (CORS)
- Production CORS allows only explicitly approved frontend web origins matching `FRONTEND_URL`.
- Development mode permits `localhost:5173` and `127.0.0.1:5173`.
- Arbitrary cross-origin origins are rejected with an explicit CORS policy error.

### 5. Content Rendering & XSS Protection
- React client renders student feedback strictly within JSX text nodes (`<p>"{comment.commentText}"</p>`).
- Zero instances of `dangerouslySetInnerHTML`, `innerHTML`, or raw HTML injection exist in the frontend codebase.

---

## 5. Fail-Fast Configuration & Secret Management

1. **Production Validation**:
   - When `NODE_ENV === 'production'`, the backend fails startup immediately if `JWT_SECRET` is missing, shorter than 32 characters, or uses the development fallback string.
   - Production forbids default `postgres:postgres@localhost` database URLs.
   - Production requires an explicit `FRONTEND_URL` matching the live deployment domain.
2. **Secret Hygiene**:
   - No plaintext passwords, private keys, or API tokens are tracked in version control.
   - `.env` files are excluded via `.gitignore`.
   - `.env.example` provides parameter names and placeholder instructions without live credentials.

---

## 6. Verifiable Security Claims & Known Limitations

### Verifiable Security Claims
- The application does not collect or persist student names, IDs, email addresses, IP addresses, or device fingerprints in the feedback submission pathway.
- The application strictly parameterizes all database queries using PostgreSQL positional parameters (`$1`, `$2`), preventing SQL injection.
- Unauthorized callers and non-assigned professors cannot retrieve feedback comments or analytics for courses they do not teach (enforced via database ownership checks returning HTTP 401/403).

### Known Operational Limitations
- **In-Memory Rate Limiting**: The rate limiting store is currently in-process memory. In multi-instance horizontal scaling behind a round-robin load balancer, limits apply per instance rather than globally across all instances unless centralized caching (e.g. Redis) is introduced in a future stage.
- **Reverse Proxy Client IPs**: In deployments behind reverse proxies (Nginx, AWS ALB, Cloudflare), `app.set('trust proxy', 1)` must be configured according to proxy hops to ensure `req.ip` reflects the true client IP rather than the load balancer.
- **Student Content Self-Disclosure**: While the system collects zero identity metadata, students can inadvertently write their own names or identifiable scenarios inside the free-text comment box. The frontend explicitly warns students before submission: *"Please share specific, actionable feedback... Remember to avoid including personal identifying details."*
