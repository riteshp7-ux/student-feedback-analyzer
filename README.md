# Student Feedback Analyzer

A university feedback analytics platform that transforms anonymous student feedback into structured, evidence-backed pedagogical insights for professors.

---

## Architecture Overview

* **Frontend**: React SPA (Vite) — Single-column accessible student submission and 4-tier professor analytical dashboard.
* **Backend**: Node.js + Express API Gateway — Request validation (Zod), aggregation engine, privacy guard ($N \ge 5$), and token-based authentication.
* **Database**: PostgreSQL — Relational storage for offerings, submissions, ratings, and NLP topic mentions. Zero student identifying data stored.
* **NLP Service**: Python microservice (FastAPI) — Negation-aware TF-IDF, Sentiment Logistic Regression, and Multi-label Topic classification.

---

## Repository Structure

```text
NLP-sys-minor/
├── backend/          # Node.js + Express REST API Gateway
├── frontend/         # React SPA (Vite)
├── nlp/              # Python FastAPI NLP Microservice & ML Models
├── docs/             # Approved Architectural Specifications
├── .env.example      # Environment variables template
├── .gitignore        # Version control exclusions
└── package.json      # Root orchestration scripts
```

---

## Prerequisites

* **Node.js**: v20+ or v24+
* **npm**: v10+
* **Python**: v3.11+
* **PostgreSQL**: v15+ (Local instance or container)

---

## Installation & Setup

### 1. Configure Environment
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

### 2. Install Dependencies
```bash
# Install root, backend, and frontend dependencies
npm run install:all

# Install Python NLP service dependencies
cd nlp
pip install -r requirements.txt
cd ..
```

---

## Starting the Services

### Start Backend Service (Port 5000)
```bash
cd backend
npm run dev
```
Health Check: `http://localhost:5000/health`

### Start NLP Microservice (Port 8000)
```bash
cd nlp
uvicorn src.service:app --port 8000 --reload
```
Health Check: `http://127.0.0.1:8000/health`

### Start Frontend Application (Port 5173)
```bash
cd frontend
npm run dev
```
Access in browser: `http://localhost:5173`

---

## Testing

```bash
# Run backend tests
npm run test:backend

# Run frontend tests
npm run test:frontend

# Run NLP tests
npm run test:nlp
```

---

## Current Status & Next Steps

* **Current State**: Stage 16 (Backend ↔ NLP Integration & Asynchronous Analysis) completed.
  - PostgreSQL schema and migrations verified (Stage 11)
  - Anonymous feedback submission write APIs verified (Stage 12)
  - Course offering and analytical dashboard read APIs verified (Stage 13)
  - Curated academic dataset, stratified splits, and baseline models evaluated (Stage 14)
  - Isolated FastAPI NLP inference microservice verified (Stage 15)
  - Express ↔ NLP integration with failure resilience, timeout guard, and recovery sweeps verified (Stage 16)
* **Next Stage**: Stage 17 (Frontend Student Submission Experience).


