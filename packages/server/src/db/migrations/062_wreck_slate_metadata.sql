-- Migration 062: Wreck slate metadata
-- (data_slates table already exists with different schema — this is separate)
CREATE TABLE IF NOT EXISTS wreck_slate_metadata (
  id UUID PRIMARY KEY,
  player_id VARCHAR(100) NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  sector_type TEXT,
  has_jumpgate BOOLEAN NOT NULL DEFAULT false,
  wreck_tier INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wreck_slate_player ON wreck_slate_metadata(player_id);
