-- Blueprints consumed into station factories
CREATE TABLE IF NOT EXISTS station_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES player_stations(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(station_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_station_blueprints_station ON station_blueprints(station_id);

-- ACEP (ship) consumed blueprints — stored per player
CREATE TABLE IF NOT EXISTS acep_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_acep_blueprints_player ON acep_blueprints(player_id);
