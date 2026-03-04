-- Bookmarks
CREATE TABLE IF NOT EXISTS player_bookmarks (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_player ON player_bookmarks(player_id);
