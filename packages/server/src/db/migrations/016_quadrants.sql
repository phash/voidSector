-- Quadrant system: lazy-generated, seed-based quadrant configuration
-- Each quadrant covers QUAD_SECTOR_SIZE x QUAD_SECTOR_SIZE sectors.
-- Seed is generated deterministically but only persisted on first entry.

CREATE TABLE IF NOT EXISTS quadrants (
  qx            BIGINT NOT NULL,
  qy            BIGINT NOT NULL,
  seed          INTEGER NOT NULL,
  name          VARCHAR(64),
  discovered_by UUID REFERENCES players(id) ON DELETE SET NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  config        JSONB NOT NULL,
  PRIMARY KEY (qx, qy)
);

CREATE INDEX IF NOT EXISTS idx_quadrants_discovered_by
  ON quadrants(discovered_by);

-- Per-player fog-of-war: which quadrants does each player know about?
CREATE TABLE IF NOT EXISTS player_known_quadrants (
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  qx          BIGINT NOT NULL,
  qy          BIGINT NOT NULL,
  learned_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, qx, qy)
);

CREATE INDEX IF NOT EXISTS idx_player_known_quadrants_player
  ON player_known_quadrants(player_id);
