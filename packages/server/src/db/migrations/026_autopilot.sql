CREATE TABLE IF NOT EXISTS autopilot_routes (
  user_id      UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  target_x     INTEGER NOT NULL,
  target_y     INTEGER NOT NULL,
  use_hyperjump BOOLEAN DEFAULT TRUE,
  path         JSONB NOT NULL,
  current_step INTEGER DEFAULT 0,
  total_steps  INTEGER NOT NULL,
  started_at   BIGINT NOT NULL,
  last_step_at BIGINT NOT NULL,
  status       VARCHAR(16) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_autopilot_routes_status ON autopilot_routes(status);
