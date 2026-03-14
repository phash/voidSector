-- Player Stations: universal station replacing mining_station/trading_post/research_lab
CREATE TABLE IF NOT EXISTS player_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  factory_level INTEGER NOT NULL DEFAULT 0 CHECK (factory_level BETWEEN 0 AND 5),
  cargo_level INTEGER NOT NULL DEFAULT 0 CHECK (cargo_level BETWEEN 0 AND 5),
  cargo_contents JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sector_x, sector_y),
  UNIQUE(owner_id, quadrant_x, quadrant_y)
);
CREATE INDEX IF NOT EXISTS idx_player_stations_owner ON player_stations(owner_id);
CREATE INDEX IF NOT EXISTS idx_player_stations_sector ON player_stations(sector_x, sector_y);

-- Migrate existing structures to player_stations
INSERT INTO player_stations (owner_id, sector_x, sector_y, quadrant_x, quadrant_y, level)
SELECT DISTINCT ON (s.owner_id, (s.sector_x / 500), (s.sector_y / 500))
  s.owner_id,
  s.sector_x,
  s.sector_y,
  s.sector_x / 500,
  s.sector_y / 500,
  1
FROM structures s
WHERE s.type IN ('mining_station', 'trading_post', 'research_lab')
ON CONFLICT DO NOTHING;
