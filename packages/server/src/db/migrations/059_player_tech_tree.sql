CREATE TABLE IF NOT EXISTS player_tech_tree (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  researched_nodes JSONB NOT NULL DEFAULT '{}',
  total_researched INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ
);
