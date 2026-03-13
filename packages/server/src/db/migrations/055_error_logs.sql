-- 055_error_logs.sql
CREATE TABLE IF NOT EXISTS error_logs (
  id            SERIAL PRIMARY KEY,
  fingerprint   VARCHAR(64) UNIQUE NOT NULL,
  message       TEXT NOT NULL,
  location      TEXT,
  stack         TEXT,
  count         INTEGER NOT NULL DEFAULT 1,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(16) NOT NULL DEFAULT 'new',
  github_issue_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_status ON error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs(last_seen DESC);
