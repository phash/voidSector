CREATE TABLE IF NOT EXISTS quadrants (
  qx            INTEGER NOT NULL,
  qy            INTEGER NOT NULL,
  seed          INTEGER NOT NULL,
  name          VARCHAR(64),
  discovered_by UUID REFERENCES players(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  config        JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (qx, qy)
);

CREATE TABLE IF NOT EXISTS player_known_quadrants (
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  qx          INTEGER NOT NULL,
  qy          INTEGER NOT NULL,
  learned_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, qx, qy)
);

CREATE INDEX IF NOT EXISTS idx_quadrants_discovered_by ON quadrants(discovered_by);
CREATE INDEX IF NOT EXISTS idx_player_known_quadrants_player ON player_known_quadrants(player_id);
