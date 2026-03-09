CREATE TABLE IF NOT EXISTS expansion_log (
  id      SERIAL PRIMARY KEY,
  ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  faction TEXT NOT NULL,
  qx      INT NOT NULL,
  qy      INT NOT NULL,
  event   TEXT NOT NULL
  -- event values: 'colonized' | 'conquered' | 'lost' | 'discovered'
);

CREATE INDEX IF NOT EXISTS idx_expansion_log_ts ON expansion_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_expansion_log_faction ON expansion_log (faction);
