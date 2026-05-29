-- Feedback: player-submitted feedback shown in the admin console
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  player_id UUID,
  username VARCHAR(64),
  category VARCHAR(16) NOT NULL DEFAULT 'other',  -- bug | idea | praise | other
  message  TEXT NOT NULL,
  status   VARCHAR(16) NOT NULL DEFAULT 'new',     -- new | done
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback (status, created_at DESC);
