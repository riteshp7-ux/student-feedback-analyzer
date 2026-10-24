# Deployment Specification & Operations Guide

## 1. System Architecture & Required Services

The Student Feedback Analyzer is composed of three independently deployable services and one database instance:

```text
               +----------------------------------+
               |        Static Web Host / CDN     |
               |     (React 19 Frontend Assets)    |
               +-----------------+----------------+
                                 |
                                 | HTTPS / REST
                                 v
               +-----------------+----------------+
               |      Node.js Express API         |
               |      Gateway & Aggregation       |
               +--------+----------------+--------+
                        |                |
         Database Pool  |                | Loopback / Internal Subnet
      (pg, max 10 conn) |                | (HTTP, 2000ms timeout)
                        v                v
     +------------------+---+      +-----+------------------+
     |   PostgreSQL 15+     |      | Python FastAPI Microsvc|
     | Relational Database  |      | Pure-Python In-Memory  |
     | (Feedback & Auth)    |      | (Naive Bayes NLP v1.0) |
     +----------------------+      +------------------------+
```

### Service Summary
1. **Frontend**: Static single-page application built with React 19 and Vite. Served by any static web server (Nginx, Caddy, Cloudflare Pages, S3/CloudFront).
2. **Backend**: Express API gateway running on Node.js 20+. Coordinates authentication, authorization, transactional persistence, aggregation queries, and asynchronous NLP dispatch.
3. **NLP Subservice**: Python 3.10+ FastAPI microservice. Pure-Python Naive Bayes classifier; loads pre-trained parameters into memory on startup and executes deterministic inference (<1ms).
4. **Database**: PostgreSQL 15+ relational database.

---

## 2. Environment Variables

### Backend (`backend/.env` or container environment)

| Variable | Type | Required in Prod | Development Default | Description |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | Enum | Yes | `development` | Set to `production` in live environments. |
| `PORT` | Number | No | `5000` | Port on which Express listens. |
| `DATABASE_URL` | URL | Yes | `postgresql://postgres:...@localhost:5432/...` | PostgreSQL connection string. Must not use development fallback credentials in production. |
| `JWT_SECRET` | String | Yes | `development_jwt_secret...` | Minimum 32-character high-entropy secret for HMAC-SHA256 signing of professor session tokens. Fallback rejected in production. |
| `NLP_SERVICE_URL`| URL | Yes | `http://127.0.0.1:8000` | Internal loopback or private subnet URL for the Python NLP microservice. Must not be exposed publicly. |
| `NLP_TIMEOUT_MS` | Number | No | `2000` | Bounded timeout (ms) for Express-to-NLP inference HTTP requests. |
| `FRONTEND_URL` | URL | Yes | `http://localhost:5173` | Allowed production origin for CORS headers. Must match the public frontend domain (no localhost). |

### Frontend Build (`frontend/.env` or build environment)

| Variable | Type | Required | Default | Description |
| :--- | :---: | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | URL | No | `/api/v1` | Public API base URL. If hosted on the same origin via reverse proxy, relative `/api/v1` is recommended. |

### NLP Microservice (`nlp` process environment)

| Variable | Type | Required | Default | Description |
| :--- | :---: | :---: | :--- | :--- |
| `NLP_HOST` | String | No | `127.0.0.1` | Loopback IP address for binding. Must remain loopback or internal subnet. |
| `NLP_PORT` | Number | No | `8000` | Port for the Python FastAPI server. |
| `NLP_MAX_TEXT_LENGTH` | Number | No | `5000` | Maximum character length accepted per comment payload. |
| `NLP_ARTIFACT_DIR` | Path | No | `nlp/artifacts/v1.0.0` | Filesystem path containing trained model parameters and vocabulary JSON files. |

---

## 3. Database Setup & Migrations

### Prerequisites
* PostgreSQL 15 or higher.
* Dedicated application database (e.g. `feedback_analyzer`).
* Dedicated database user with schema ownership permissions.

### Migration Execution
Migrations are versioned sequentially in `backend/src/db/migrations/` and track execution state inside the `schema_migrations` table:

```bash
# Run migrations
npm --prefix backend run db:migrate
```

* Migrations run inside explicit SQL transactions (`BEGIN` ... `COMMIT`).
* Already applied migrations are detected and skipped safely.
* Migrations are strictly non-destructive.

### Seed / Demo Data Policy
* **Production Policy**: `db:seed` is the additive local demo catalog loader; it does not delete or rewrite feedback, professors, courses, or existing offerings. `db:demo-reset` is destructive and refuses to run without explicit development/test mode, a matching `DEMO_RESET_DATABASE`, and `ALLOW_DESTRUCTIVE_DEMO_RESET=YES`. Never configure a production database as the reset target.
* **Initial Production Provisioning**: In production, initialize real professor records using hashed credentials via an administrative CLI script or controlled institutional provisioning.
* **Provisioning Secret**: `db:provision` requires an explicitly configured unique `PROF_PASSWORD` of at least 20 characters before connecting to PostgreSQL. Deliver initial credentials through an approved secure channel and require the account owner to rotate them at first login; the application does not currently force password rotation in-product.

---

## 4. NLP Model Artifacts & Reproducibility

The NLP microservice relies on pre-trained, deterministic JSON parameter artifacts located at `nlp/artifacts/v1.0.0/`:
* `model_manifest.json`: Model version metadata (`v1.0.0`), training timestamp, and hyperparameters.
* `sentiment_nb_params.json`: Multinomial Naive Bayes class priors and smoothed feature likelihoods for sentiment.
* `topic_br_params.json`: Binary Relevance binary class models for the 7 approved pedagogical topic categories.
* `vectorizer_vocab.json`: Term dictionary (unigrams and bigrams).
* `evaluation_report.json`: Classification report metrics from test split verification.

### Reproducibility Workflow
To retrain or verify artifacts from raw data:
```bash
# 1. Validate dataset syntax
python -m nlp.src.validate_data

# 2. Split dataset with fixed seed (seed = 42)
python -m nlp.src.split_data

# 3. Train models and generate JSON artifacts
python -m nlp.src.train

# 4. Evaluate against holdout test set
python -m nlp.src.evaluate
```

---

## 5. Startup & Execution Instructions

### Step 1: Start Python NLP Microservice
```bash
# Inside repository root
python -m uvicorn nlp.src.service:app --host 127.0.0.1 --port 8000 --workers 1
```

### Step 2: Start Express Backend API Gateway
```bash
# Production startup
NODE_ENV=production npm --prefix backend start
```

### Step 3: Build & Serve Frontend
```bash
# Build static assets
npm --prefix frontend run build

# Output directory: frontend/dist
# Serve frontend/dist using Nginx, Caddy, or static hosting provider
```

---

## 6. Health Checks & Monitoring Probes

| Service | Endpoint | Probe Type | Expected Output | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Backend** | `GET /health/live` | Liveness | `200 OK` `{"status":"alive"}` | Quick process responsiveness check. No database queries. |
| **Backend** | `GET /health/ready` | Readiness | `200 OK` `{"status":"ready"}` | Verifies PostgreSQL pool connectivity (`SELECT 1`). Returns `503` if DB down. |
| **Backend** | `GET /api/v1/health`| Gateway | `200 OK` `{"status":"ok"}` | Gateway version check. |
| **NLP** | `GET /health` | Liveness | `200 OK` `{"status":"healthy"}` | Fast loopback probe. |
| **NLP** | `GET /ready` | Readiness | `200 OK` `{"status":"ready"}` | Verifies model artifacts are loaded in memory. Returns `503` if unready. |

---

## 7. Graceful Shutdown & Process Signals

Both services handle `SIGTERM` and `SIGINT` signals for zero-downtime rolling restarts:
* **Express Backend**:
  - Stops accepting new incoming HTTP connections (`server.close()`).
  - Drains active in-flight requests.
  - Closes the PostgreSQL client pool (`closePool()`).
  - Implements a 10-second force-exit timeout if connections hang.
* **FastAPI NLP**:
  - Lifespan context manager gracefully releases memory and closes the ASGI event loop.

---

## 8. Backup & Disaster Recovery Design

1. **Database Backups**:
   - Schedule daily automated logical dumps via `pg_dump`:
     ```bash
     pg_dump -Fc -d "$DATABASE_URL" -f "backup_feedback_$(date +%Y%m%d).dump"
     ```
   - Store backups offsite with encryption at rest and minimum 30-day retention.
2. **Restoration Procedure**:
   ```bash
   pg_restore -d "$DATABASE_URL" --clean --if-exists "backup_feedback_<date>.dump"
   ```
3. **Model Artifact Recovery**:
   - Model parameter JSON files are committed to version control under `nlp/artifacts/v1.0.0/` and require no external database recovery.

---

## 9. Known Operational Limitations

1. **In-Memory Rate Limiting**: The current rate limiter tracks IP request counters in process memory. In a clustered/multi-replica deployment, apply shared limits at the trusted API gateway/load balancer; the application limiter is per replica and is not a one-student-one-vote control.
2. **Trusted Proxy Configuration**: `TRUST_PROXY_HOPS` defaults to `0`. Set it to the exact number of trusted proxy hops in front of Express (from `1` to `5`) only when the infrastructure strips/replaces inbound forwarding headers. Incorrect trust settings allow IP spoofing or group many students under a proxy IP. Account for shared campus NAT addresses when configuring gateway limits.
3. **Asynchronous NLP Queue**: Express uses `setImmediate` for async inference dispatch. If the backend process crashes while a submission is in-flight, the record remains in PostgreSQL with `analysis_status = 'pending'` or `'failed'`. The recovery worker retries failed analyses with backoff and stops after eight failed attempts; dashboard metrics report pending, retrying, and exhausted failures separately.
4. **No Dynamic Model Retraining**: Models are static artifacts loaded at startup. Model updates require artifact deployment and process restart.

---

## 10. Turnkey PaaS Deployment (Render / Railway / Fly.io)

### Architecture on Render
The application includes an Infrastructure-as-Code Blueprint specification (`render.yaml`):

```text
               [Internet]
                   | HTTPS
                   v
   +------------------------------------+
   |    feedback-analyzer-frontend      | (Static Site on CDN)
   +------------------------------------+
                   | HTTPS API calls
                   v
   +------------------------------------+
   |      feedback-analyzer-api         | (Web Service: Node.js 20+)
   +-----------------+------------------+
                     |
         +-----------+-----------+
         | Internal              | Encrypted SSL
         v Private Network       v Connection
   +--------------------+  +--------------------+
   |feedback-analyzer-nlp| |feedback-analyzer-db|
   |(Private Service)   |  |(Managed PostgreSQL)|
   +--------------------+  +--------------------+
```

### Deployment Steps
1. **Push Code to Repository**: Push the project branch to GitHub/GitLab.
2. **Deploy Blueprint on Render**:
   - Navigate to [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Blueprint**.
   - Connect the repository containing `render.yaml`.
   - Render automatically provisions:
     - Managed PostgreSQL 16 database (`feedback-analyzer-db`).
     - Internal Python FastAPI microservice (`feedback-analyzer-nlp`) on private networking.
     - Express API gateway (`feedback-analyzer-api`) with automated HTTPS and database linkage.
     - React 19 static single-page application (`feedback-analyzer-frontend`) on global CDN.
3. **Apply Database Migrations & Initial Faculty Provisioning**:
   - From the Render web shell on `feedback-analyzer-api` (or locally via remote `DATABASE_URL`):
     ```bash
     npm --prefix backend run db:migrate
     npm --prefix backend run db:provision
     ```
4. **Live Verification**:
   - Run `node scripts/verify_production.js --api <API_URL> --frontend <FRONTEND_URL>` to perform automated end-to-end smoke and security verification.
