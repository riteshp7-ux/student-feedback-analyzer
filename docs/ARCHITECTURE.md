# System Architecture Specification

## 1. Architectural Overview & Boundaries

The Student Feedback Analyzer is built as a cleanly decoupled two-tier backend architecture:

```text
                     +---------------------------------------+
                     |         React Client (SPA)            |
                     +---------------------------------------+
                                         |
                                         | HTTPS / REST
                                         v
                     +---------------------------------------+
                     |         Express.js Backend            |
                     |  - Transaction Management             |
                     |  - Course & Feedback Aggregations     |
                     |  - Anonymity Enforcement              |
                     +---------------------------------------+
                        /                                 \
      PostgreSQL Pool  /                                   \ Internal HTTP (Loopback)
                      v                                     v
+-----------------------------+          +------------------------------------+
|     PostgreSQL Database     |          |       Python NLP Microservice      |
| - feedback                  |          | - FastAPI Runtime                  |
| - feedback_ratings          |          | - Pure-Python Baseline Inference   |
| - feedback_sentiment        |          | - In-Memory Artifacts (v1.0.0)     |
| - feedback_topics           |          | - Zero DB / Zero External LLMs     |
+-----------------------------+          +------------------------------------+
```

### Key Architectural Boundaries
1. **Express Backend**: Central application coordinator and public API gateway. Connects directly to PostgreSQL. Manages feedback submissions and professor dashboard queries.
2. **Python NLP Microservice**: Dedicated, isolated analytical engine. Does **not** access PostgreSQL. Does not perform user authentication. Reusable and swappable without touching core database schemas.
3. **No Direct Client Access**: The React frontend interacts solely with the Express API gateway; the NLP service is internal-only.

---

## 2. NLP Service Architecture (Stage 15)

The internal structure of `nlp/` maintains strict separation between HTTP endpoints, in-memory inference, and trained model artifacts:

```text
nlp/
├── src/
│   ├── config.py             # Service configuration & artifact path settings
│   ├── schemas.py            # Strict Pydantic input/output validation contracts
│   ├── inference.py          # In-memory inference engine with startup lifecycle
│   ├── pipeline.py           # Unified model wrapper (FeedbackNLPBaseline)
│   ├── vectorizer.py         # Pure-Python n-gram & domain lexicon extractor
│   ├── classifier.py         # Multinomial & Binary Naive Bayes linear models
│   ├── preprocessing.py      # Unicode normalization & contraction handling
│   └── service.py            # FastAPI service exposing /health, /ready, /analyze
│
├── artifacts/
│   └── v1.0.0/               # Serialized JSON model artifacts & evaluation metrics
│       ├── feature_extractor.json
│       ├── sentiment_model.json
│       ├── topics_model.json
│       └── metrics.json
│
├── scripts/
│   └── verify_api.py         # Manual verification script
│
└── tests/
    ├── test_health.py        # Probes & status endpoint unit tests
    ├── test_service.py       # Comprehensive API contract & validation tests
    └── test_model.py         # Preprocessing, feature, and model logic tests
```

---

## 3. Communication Protocols

| Source | Target | Protocol | Contract |
| :--- | :--- | :--- | :--- |
| Client | Express | HTTPS / REST | `/api/v1/feedback`, `/api/v1/dashboard/:id` |
| Express | PostgreSQL | TCP (pg pool) | SQL Migrations & Parameterized Queries |
| Express | Python NLP | HTTP / REST | `POST /analyze` or `POST /api/v1/analyze` |
| Python NLP | File System | Read-only JSON | Artifacts loading on startup |

---

## 4. Backend ↔ NLP Integration Architecture (Stage 16)

```text
[Student]
   │
   │ 1. POST /api/v1/feedback
   ▼
[Express Controller & Validation]
   │
   │ 2. BEGIN Transaction
   │    - Verify active offering
   │    - INSERT feedback_submissions (status = 'pending' if comment, else 'not_applicable')
   │    COMMIT
   ▼
[HTTP 201 Response to Student] (Immediate: ~15ms)
   │
   │ 3. setImmediate() Asynchronous Background Job
   ▼
[NLP Client] ─── HTTP POST /analyze ───► [Python FastAPI Service]
   │                                                 │
   │ 4. Validates NLP Response (Zod schema)          │ In-memory inference (<1ms)
   ▼                                                 ▼
[Analysis Repository] ◄──────────────────────────────┘
   │
   │ 5. BEGIN Transaction
   │    - UPSERT feedback_sentiment
   │    - UPSERT feedback_topic_mention
   │    - UPDATE feedback_submissions SET analysis_status = 'completed'
   │    COMMIT
   ▼
[Analytics Ready for Dashboard Query]
```

### Failure Semantics
- **NLP Downtime / Timeout**:
  - `feedback_submissions` remains safely committed.
  - `analysis_status` transitions to `'failed'`.
  - Student experiences zero submission errors or data loss.
  - Background recovery sweep (`processPendingBatch`) can retry unanalyzed comments when the NLP microservice recovers.

