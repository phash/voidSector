-- 094: Origin Hub notice board — a persistent galaxy-wide message wall posted at 0:0.
CREATE TABLE IF NOT EXISTS origin_notices (
  id          SERIAL PRIMARY KEY,
  player_id   VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_origin_notices_created ON origin_notices (created_at DESC);
