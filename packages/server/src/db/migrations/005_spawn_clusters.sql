CREATE TABLE IF NOT EXISTS spawn_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_x INTEGER NOT NULL,
  center_y INTEGER NOT NULL,
  player_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spawn_clusters_count ON spawn_clusters(player_count);
