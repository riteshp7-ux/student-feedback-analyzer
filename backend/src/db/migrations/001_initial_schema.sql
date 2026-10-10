-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core relational schema for Student Feedback Analyzer
-- Conforms to: docs/DATA_MODEL.md & Stage 3 / Stage 9 specifications
-- ==============================================================================

-- Enable UUID extension for cryptographic unique identifiers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Professors Table
-- Represents academic instructors who view analytics for their assigned courses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Courses Table
-- Persistent academic catalog subject (e.g., CS301 Database Systems)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Course Offerings Table
-- A specific delivery of a course in an academic term by an instructor
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES professors(id) ON DELETE RESTRICT,
    term VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_course_offering_term UNIQUE (course_id, professor_id, term)
);

-- ------------------------------------------------------------------------------
-- 4. Feedback Submissions Table
-- Anonymous feedback entry submitted by a student
-- Strictly contains NO student_id, student name, email, IP address, or fingerprints
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    rating_clarity INTEGER NOT NULL CHECK (rating_clarity BETWEEN 1 AND 5),
    rating_pace INTEGER NOT NULL CHECK (rating_pace BETWEEN 1 AND 5),
    rating_doubt_handling INTEGER NOT NULL CHECK (rating_doubt_handling BETWEEN 1 AND 5),
    rating_engagement INTEGER NOT NULL CHECK (rating_engagement BETWEEN 1 AND 5),
    rating_practical_examples INTEGER NOT NULL CHECK (rating_practical_examples BETWEEN 1 AND 5),
    comment_text TEXT CHECK (comment_text IS NULL OR LENGTH(TRIM(comment_text)) <= 2000),
    analysis_status VARCHAR(32) NOT NULL DEFAULT 'not_applicable'
        CHECK (analysis_status IN ('not_applicable', 'pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Feedback Sentiment Table (1:1 with feedback_submissions)
-- Stores derived sentiment analysis results
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_sentiment (
    submission_id UUID PRIMARY KEY REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    label VARCHAR(16) NOT NULL CHECK (label IN ('positive', 'neutral', 'negative')),
    score REAL NOT NULL CHECK (score BETWEEN 0.0 AND 1.0),
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. Feedback Topic Mentions Table (1:N with feedback_submissions)
-- Captures multiple detected topics discussed within a single comment
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_topic_mention (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    topic_key VARCHAR(64) NOT NULL,
    confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    CONSTRAINT uq_submission_topic UNIQUE (submission_id, topic_key)
);

-- ==============================================================================
-- INDEXING STRATEGY
-- Targeted indexes for dashboard queries, offering lookups, and background retry
-- ==============================================================================

-- Accelerates retrieving assigned offerings for an instructor
CREATE INDEX IF NOT EXISTS idx_course_offerings_prof 
    ON course_offerings(professor_id);

-- Primary filter for all dashboard queries and aggregate calculations
CREATE INDEX IF NOT EXISTS idx_feedback_offering 
    ON feedback_submissions(offering_id);

-- Partial index for background NLP retry of unanalyzed comments
CREATE INDEX IF NOT EXISTS idx_feedback_pending_analysis 
    ON feedback_submissions(analysis_status) 
    WHERE analysis_status IN ('pending', 'failed');

-- Accelerates topic frequency groupings and topic-filtered evidence queries
CREATE INDEX IF NOT EXISTS idx_topic_mentions_lookup 
    ON feedback_topic_mention(topic_key, submission_id);
