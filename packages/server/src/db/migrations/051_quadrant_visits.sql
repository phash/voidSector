-- Migration 051: Player quadrant visits — Fog-of-War tracking for QUAD-MAP
-- Records which quadrants a player has physically entered (room join events)

CREATE TABLE IF NOT EXISTS player_quadrant_visits (
  player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  qx               INTEGER     NOT NULL,
  qy               INTEGER     NOT NULL,
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, qx, qy)
);

CREATE INDEX IF NOT EXISTS idx_pqv_player ON player_quadrant_visits(player_id);
