# Stage 4 — API Contract Specification

---

## 1. API Architecture & Versioning

The API contract establishes a clear boundary between the React frontend, the Node.js/Express application gateway, and the private internal Python NLP microservice.

### Architectural Rules:
1. **Single Entry Point**: The React frontend interacts solely with the Node.js/Express API gateway over HTTPS.
2. **Direct Access Forbidden**: Direct communication from the browser to PostgreSQL or the Python NLP service is disallowed.
3. **Internal Microservice**: The Python NLP service is an internal HTTP daemon bound to `127.0.0.1:8000` (or an isolated Docker network), unreachable from the public internet.
4. **Versioning Prefix**: All public/external REST endpoints are prefixed with `/api/v1`.
   - *Rationale*: For an application that will progress from prototype to production deployment, `/api/v1` provides a clean evolution path for API consumers and prevents breaking mobile or web clients during future schema iterations.

---

## 2. HTTP Status Code Conventions

The application adheres to standard REST HTTP status codes:

| Code | Meaning | When Used |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Standard response for successful `GET`, `PUT`, or non-creation `POST` actions. |
| **`201 Created`** | Resource Created | Feedback submission successfully received and persisted (`POST /api/v1/feedback`). |
| **`400 Bad Request`** | Malformed Request | Malformed JSON body or syntactically invalid input parameters. |
| **`401 Unauthorized`** | Authentication Missing/Invalid | Missing, expired, or invalid JWT bearer token on protected professor routes. |
| **`403 Forbidden`** | Authorization Denied | Valid token, but the professor does not own the requested course offering. |
| **`404 Not Found`** | Resource Not Found | Course offering, professor, or feedback record does not exist. |
| **`422 Unprocessable Entity`** | Validation Error | Request is well-formed JSON, but fails business/schema validation (e.g., rating out of 1–5 range). |
| **`429 Too Many Requests`** | Rate Limit Exceeded | Client exceeded the allowed submission threshold (anti-spam / anti-abuse). |
| **`500 Internal Server Error`** | Server Failure | Unhandled exceptions or database connection failures (masks internal details). |
| **`503 Service Unavailable`** | Service Outage | Returned by `/health` if the database is unreachable. |

---

## 3. Standard Error Format

Every error response across the entire API adheres to a single, predictable structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted feedback contains invalid data.",
    "details": {
      "ratings.teachingClarity": "Teaching clarity must be an integer between 1 and 5.",
      "comment": "Comment cannot exceed 2000 characters."
    }
  }
}
```

### Standard Error Codes:
* `VALIDATION_ERROR`: Schema validation failure (`422`).
* `INVALID_CREDENTIALS`: Email or password mismatch (`401`).
* `AUTHENTICATION_REQUIRED`: Missing bearer token (`401`).
* `ACCESS_DENIED`: Unauthorized access to another instructor's course (`403`).
* `RESOURCE_NOT_FOUND`: Offering or entity not found (`404`).
* `RATE_LIMIT_EXCEEDED`: Too many requests (`429`).
* `INTERNAL_ERROR`: Unexpected server error (`500`).

*Security Rule: Stack traces, SQL syntax strings, filesystem paths, and environment secrets are never returned in `details` or `message`.*

---

## 4. Authentication & Authorization Matrix

### Authentication Mechanism:
* **Students**: No authentication required. Strict anonymity.
* **Professors**: Standard email/password authentication generating an industry-standard signed JWT bearer token (`Authorization: Bearer <token>`). The JWT payload contains `{ "professorId": "uuid", "email": "string" }` with a 24-hour expiration.

### Authorization Matrix:

| Endpoint | Role: Student | Role: Professor | Authorization Condition |
| :--- | :---: | :---: | :--- |
| `GET /api/v1/course-offerings` | Allowed | Allowed | Public active offerings list. |
| `POST /api/v1/feedback` | Allowed | Allowed | Public; anonymous submission to active offering. |
| `POST /api/v1/auth/login` | N/A | Allowed | Public authentication endpoint. |
| `GET /api/v1/professor/offerings` | Denied (`401`) | Allowed | Returns offerings where `professor_id == token.professorId`. |
| `GET /api/v1/dashboard/:courseOfferingId` | Denied (`401`) | Allowed | Allowed ONLY if offering belongs to authenticated professor (`403` otherwise). |
| `GET /api/v1/feedback/:courseOfferingId` | Denied (`401`) | Allowed | Allowed ONLY if offering belongs to authenticated professor (`403` otherwise). |
| `GET /health` | Allowed | Allowed | System monitoring health check. |

---

## 5. Public / Student Endpoints

### 5.1 `GET /api/v1/course-offerings`
* **Purpose**: Fetches active course offerings so a student can select their course context.
* **Auth**: None (Public).
* **Query Parameters**: None.
* **Response (200 OK)**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "courseCode": "CS301",
    "courseTitle": "Database Management Systems",
    "term": "Fall 2026",
    "instructorName": "Dr. Ramesh Sharma"
  },
  {
    "id": "a98c7654-b234-4567-c890-123456789abc",
    "courseCode": "CS201",
    "courseTitle": "Data Structures & Algorithms",
    "term": "Fall 2026",
    "instructorName": "Prof. Anita Desai"
  }
]
```

---

### 5.2 `POST /api/v1/feedback`
* **Purpose**: Submits anonymous feedback for an active course offering.
* **Auth**: None (Public).
* **Rate Limit**: 10 submissions per minute per IP address.

#### Request Schema & Validation:
```json
{
  "courseOfferingId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "ratings": {
    "teachingClarity": 4,
    "teachingPace": 3,
    "doubtHandling": 5,
    "engagement": 4,
    "practicalExamples": 2
  },
  "comment": "The concepts are explained clearly, but we need more practical code walkthroughs."
}
```

* **Validation Rules**:
  - `courseOfferingId`: Required UUID string; must correspond to an active offering (`is_active = true`).
  - `ratings`: Required object. Must contain exactly all 5 approved dimensions:
    - `teachingClarity`: Integer $\in [1, 5]$.
    - `teachingPace`: Integer $\in [1, 5]$.
    - `doubtHandling`: Integer $\in [1, 5]$.
    - `engagement`: Integer $\in [1, 5]$.
    - `practicalExamples`: Integer $\in [1, 5]$.
  - `comment`: Optional string. Can be null, omitted, or string with $\le 2000$ characters. Whitespace is trimmed.
  - Unknown properties in `ratings` or root body are rejected with `422 Unprocessable Entity`.

#### Responses:
* **Success (`201 Created`)**:
```json
{
  "success": true,
  "message": "Feedback submitted successfully."
}
```
*(No internal submission ID is returned to the student client, maintaining strict anonymity).*

* **Validation Failure (`422 Unprocessable Entity`)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid feedback submission.",
    "details": {
      "ratings.practicalExamples": "Rating must be an integer between 1 and 5."
    }
  }
}
```

* **Offering Closed or Not Found (`404 Not Found`)**:
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The selected course offering was not found or is no longer accepting feedback."
  }
}
```

---

## 6. Professor / Authenticated Endpoints

### 6.1 `POST /api/v1/auth/login`
* **Purpose**: Professor credentials authentication.
* **Auth**: None (Public).
* **Request Body**:
```json
{
  "email": "sharma@university.edu",
  "password": "SecurePassword123!"
}
```
* **Validation**:
  - `email`: Required valid email string.
  - `password`: Required non-empty string.
* **Response (`200 OK`)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "professor": {
    "id": "prof-1111-2222-3333-4444",
    "email": "sharma@university.edu",
    "fullName": "Dr. Ramesh Sharma"
  }
}
```
* **Failure (`401 Unauthorized`)**:
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

---

### 6.2 `GET /api/v1/professor/offerings`
* **Purpose**: Lists all course offerings assigned to the authenticated professor.
* **Auth**: Required (`Bearer <JWT>`).
* **Response (`200 OK`)**:
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "courseCode": "CS301",
    "courseTitle": "Database Management Systems",
    "term": "Fall 2026",
    "isActive": true,
    "submissionCount": 42
  }
]
```

---

### 6.3 `GET /api/v1/dashboard/:courseOfferingId`
* **Purpose**: Returns aggregate analytics for a course offering, structured directly according to the 4-level dashboard hierarchy.
* **Auth**: Required (`Bearer <JWT>`). Enforces ownership (`course_offering.professor_id == token.professorId`).

#### Behavior on Small Sample Size ($N < 5$):
If total submissions for the offering is $< 5$, the endpoint returns `privacyThresholdMet: false` and suppresses granular topic breakdowns and comments to prevent de-anonymization.

#### Response (`200 OK` — Privacy Threshold Met, $N \ge 5$):
```json
{
  "courseOffering": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "courseCode": "CS301",
    "courseTitle": "Database Management Systems",
    "term": "Fall 2026"
  },
  "privacyThresholdMet": true,
  "overall": {
    "responseCount": 42,
    "averageRating": 3.84,
    "sentimentDistribution": {
      "positive": 24,
      "neutral": 11,
      "negative": 7
    }
  },
  "performance": [
    {
      "dimensionKey": "teachingClarity",
      "label": "Teaching Clarity",
      "averageScore": 4.25,
      "status": "strong"
    },
    {
      "dimensionKey": "doubtHandling",
      "label": "Doubt Handling",
      "averageScore": 4.10,
      "status": "strong"
    },
    {
      "dimensionKey": "engagement",
      "label": "Engagement",
      "averageScore": 3.75,
      "status": "moderate"
    },
    {
      "dimensionKey": "teachingPace",
      "label": "Teaching Pace",
      "averageScore": 3.40,
      "status": "moderate"
    },
    {
      "dimensionKey": "practicalExamples",
      "label": "Practical Examples",
      "averageScore": 2.70,
      "status": "weak"
    }
  ],
  "topics": [
    {
      "topicKey": "practical_examples",
      "label": "Practical Examples",
      "mentionCount": 18,
      "dominantSentiment": "negative",
      "sentimentDistribution": {
        "positive": 2,
        "neutral": 4,
        "negative": 12
      }
    },
    {
      "topicKey": "teaching_clarity",
      "label": "Teaching Clarity",
      "mentionCount": 15,
      "dominantSentiment": "positive",
      "sentimentDistribution": {
        "positive": 12,
        "neutral": 2,
        "negative": 1
      }
    },
    {
      "topicKey": "teaching_pace",
      "label": "Teaching Pace",
      "mentionCount": 9,
      "dominantSentiment": "neutral",
      "sentimentDistribution": {
        "positive": 2,
        "neutral": 5,
        "negative": 2
      }
    }
  ]
}
```

#### Response (`200 OK` — Privacy Threshold NOT Met, $N < 5$):
```json
{
  "courseOffering": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "courseCode": "CS301",
    "courseTitle": "Database Management Systems",
    "term": "Fall 2026"
  },
  "privacyThresholdMet": false,
  "overall": {
    "responseCount": 3,
    "averageRating": null,
    "sentimentDistribution": null
  },
  "performance": [],
  "topics": [],
  "message": "Minimum response threshold not met (requires at least 5 submissions). Feedback details are hidden to protect student anonymity."
}
```

* **Errors**: `401 Unauthorized`, `403 Forbidden` (offering belongs to another professor), `404 Not Found`.

---

### 6.4 `GET /api/v1/feedback/:courseOfferingId`
* **Purpose**: Retrieves paginated anonymous student feedback comments with optional sentiment/topic filtering (Evidence Level 4).
* **Auth**: Required (`Bearer <JWT>`). Enforces ownership.

#### Query Parameters:
* `page`: Integer $\ge 1$ (Default: `1`).
* `pageSize`: Integer $\in [1, 50]$ (Default: `15`).
* `topic`: Optional string filter (`practical_examples`, `teaching_clarity`, etc.).
* `sentiment`: Optional string filter (`positive`, `neutral`, `negative`).

#### Privacy Guard:
If total responses for the offering $< 5$, returns an empty array with an informational notice.

#### Response (`200 OK`):
```json
{
  "pagination": {
    "currentPage": 1,
    "pageSize": 15,
    "totalComments": 28,
    "totalPages": 2
  },
  "comments": [
    {
      "id": "sub-1111-2222-3333-4444",
      "commentText": "The concepts are explained clearly, but we need more practical code walkthroughs.",
      "ratings": {
        "teachingClarity": 4,
        "teachingPace": 3,
        "doubtHandling": 5,
        "engagement": 4,
        "practicalExamples": 2
      },
      "sentiment": "neutral",
      "topics": ["teaching_clarity", "practical_examples"],
      "submittedDate": "2026-10-09"
    }
  ]
}
```
*(Notice: The date is truncated to `YYYY-MM-DD` rather than an exact millisecond timestamp to prevent temporal de-anonymization).*

---

## 7. System Health Endpoint

### `GET /health`
* **Purpose**: Liveness and dependency probe for reverse proxies and orchestrators.
* **Auth**: None (Public).
* **Response (`200 OK` / `503 Service Unavailable`)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-10-10T01:05:00.000Z",
  "dependencies": {
    "database": "connected",
    "nlpService": "connected"
  }
}
```

---

## 8. NLP Internal Service Contract

The Node.js Express backend communicates with the Python NLP microservice via private HTTP:

### `POST http://127.0.0.1:8000/analyze`

#### Request:
```json
{
  "text": "The concepts are explained clearly, but we need more practical code walkthroughs."
}
```
* **Validation**:
  - `text`: Non-empty string; maximum 2000 characters.

#### Response (`200 OK`):
```json
{
  "sentiment": {
    "label": "neutral",
    "score": 0.62
  },
  "topics": [
    {
      "topicKey": "teaching_clarity",
      "confidence": 0.88
    },
    {
      "topicKey": "practical_examples",
      "confidence": 0.91
    }
  ]
}
```

#### Strict Taxonomy:
* **Sentiment Labels**: Strictly `positive`, `neutral`, `negative`.
  - Polarity $> +0.15 \rightarrow$ `positive`
  - Polarity $< -0.15 \rightarrow$ `negative`
  - Otherwise $\rightarrow$ `neutral`
* **Candidate Topics**:
  - `teaching_clarity`
  - `teaching_pace`
  - `practical_examples`
  - `doubt_handling`
  - `engagement`
  - `assignments`
  - `course_content`

---

## 9. NLP Failure & Timeout Behavior

Because the Python microservice is internal, Node.js wraps calls to `/analyze` in a **resilience circuit**:

```text
Student Submit ---> Express validates & saves submission (analysis_status = 'pending')
                         |
                         +---> POST /analyze (2.0-second timeout)
                                     |
                +--------------------+--------------------+
                |                                         |
            [Success]                            [Timeout / 5xx / Error]
                |                                         |
     Save sentiment & topics.                 Log warning internally.
     Set status = 'completed'.                Set status = 'failed'.
                |                                         |
                +--------------------+--------------------+
                                     |
                           Return 201 Created to Student
```

### Invariant Rules:
1. **Submissions Never Fail Due to NLP**: If Python times out ($> 2000\text{ ms}$), crashes, or returns 5xx, the student receives `201 Created` with full confirmation.
2. **Analysis Status Lifecycle**:
   - `not_applicable`: `comment` was null or whitespace. Python is not called.
   - `pending`: Written to DB before calling Python.
   - `completed`: Analysis returned and persisted.
   - `failed`: Python call failed or timed out.
3. **Empty / Non-topical Comments**: If a comment like *"Good class"* matches no approved topics, Python returns an empty list `topics: []`. Node marks the submission `completed` with the detected sentiment.
4. **Low-Confidence Filtering**: The Python service drops any detected topic where `confidence < 0.50`.

---

## 10. API Contract Summary Table

| Method | Endpoint | Purpose | Auth | Request Body | Response (Success) |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/course-offerings` | List active courses for student selection | None | None | `200 OK` `CourseOffering[]` |
| `POST` | `/api/v1/feedback` | Submit anonymous student feedback | None | `{ courseOfferingId, ratings, comment }` | `201 Created` `{ success: true }` |
| `POST` | `/api/v1/auth/login` | Authenticate professor | None | `{ email, password }` | `200 OK` `{ token, professor }` |
| `GET` | `/api/v1/professor/offerings` | List assigned courses for professor | Bearer JWT | None | `200 OK` `ProfessorOffering[]` |
| `GET` | `/api/v1/dashboard/:courseOfferingId` | Get aggregated dashboard metrics (Levels 1–3) | Bearer JWT | None | `200 OK` `DashboardData` |
| `GET` | `/api/v1/feedback/:courseOfferingId` | Get paginated anonymous comments (Level 4 Evidence) | Bearer JWT | Query params (`page`, `topic`, etc.) | `200 OK` `{ pagination, comments }` |
| `GET` | `/health` | System and dependency liveness probe | None | None | `200 OK` `{ status, dependencies }` |
| `POST` | `http://127.0.0.1:8000/analyze` | *(Internal)* NLP sentiment & topic extraction | Internal | `{ text }` | `200 OK` `{ sentiment, topics }` |

---

## 11. Security Considerations

1. **Input Validation**: Strict schema validation via a parser (Zod or Joi) on all endpoints. Requests containing unknown fields or malformed types are rejected with `422`.
2. **CORS Restrictions**: Express restricts CORS origins to the approved frontend domain (`http://localhost:5173` in local development).
3. **Rate Limiting**: IP-based rate limiting on `POST /api/v1/feedback` (10 requests/min per IP) to prevent denial of service and ballot stuffing.
4. **Payload Size Caps**: JSON body parser capped at 100 KB; comments capped at 2,000 characters.
5. **No Data Leakage**: Error middleware intercepts all database or runtime errors and emits sanitized, predictable error JSON.

---

## 12. Contract Consistency Review

* **Anonymity Preserved**: Verified that `POST /api/v1/feedback` takes zero student metadata, and `GET /api/v1/feedback/:courseOfferingId` truncates timestamps to `YYYY-MM-DD` and exposes zero student identifiers.
* **Separation of Layers**: The React frontend receives structured, aggregated metrics (`averageScore`, `dominantSentiment`, `mentionCount`) rather than raw database sums or averages.
* **NLP Decoupling**: The student submission contract remains resilient; NLP degradation does not impede feedback ingestion.
* **Taxonomy Alignment**: The sentiment taxonomy is strictly `{ positive, neutral, negative }`, matching the domain specification without unapproved labels.

---

## 13. Decisions Requiring Architect Approval

1. **Token Transport**: Is an HTTP Authorization header (`Authorization: Bearer <token>`) preferred for the professor dashboard, or should we use an HTTP-only cookie? *(Recommendation: Bearer token in header is simpler, standard for SPAs, and eliminates CSRF complexity).*
2. **Default Page Size for Evidence**: Is 15 comments per page suitable for the dashboard evidence view?
3. **Threshold for Topic Confidence**: Is $0.50$ (50%) acceptable as the baseline confidence cutoff for returning detected topics from the NLP service?

---
*(Stopping here as instructed. Awaiting architectural review and approval of the API contract before proceeding to any code or route implementation.)*