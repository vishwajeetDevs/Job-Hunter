-- Migration: add_api_request_log
--
-- Creates tbl_api_request_response to store a complete audit trail of
-- every API call: who called it, what they sent, what we responded,
-- the HTTP status, and how long it took.
--
-- Rows are append-only; the table is never updated after insertion.

CREATE TABLE tbl_api_request_response (
  id             TEXT         NOT NULL PRIMARY KEY,
  user_id        TEXT,
  name           TEXT,
  method         TEXT         NOT NULL,
  api            TEXT         NOT NULL,
  request        JSONB,
  response       JSONB,
  status_code    INTEGER,
  execution_time INTEGER      NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes that support the most common access patterns:
--   • filter by user          → monitor a specific user's activity
--   • filter by endpoint      → debug a specific API
--   • filter by status code   → find all 4xx / 5xx errors
--   • sort / range by time    → time-bounded audit queries
CREATE INDEX idx_api_log_user_id    ON tbl_api_request_response (user_id);
CREATE INDEX idx_api_log_api        ON tbl_api_request_response (api);
CREATE INDEX idx_api_log_status     ON tbl_api_request_response (status_code);
CREATE INDEX idx_api_log_created_at ON tbl_api_request_response (created_at DESC);
