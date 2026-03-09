-- Admin Stories: QA playtest reports and admin notes

CREATE TABLE IF NOT EXISTS admin_stories (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  steps JSONB NOT NULL DEFAULT '[]',
  findings JSONB NOT NULL DEFAULT '[]',
  screenshot_paths TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | published
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_stories_status ON admin_stories(status);
CREATE INDEX IF NOT EXISTS idx_admin_stories_created_at ON admin_stories(created_at DESC);
