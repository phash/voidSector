ALTER TABLE player_stations
  ADD COLUMN IF NOT EXISTS trade_volume   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markt_level    INTEGER NOT NULL DEFAULT 0 CHECK (markt_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS werft_level    INTEGER NOT NULL DEFAULT 0 CHECK (werft_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS refinery_level INTEGER NOT NULL DEFAULT 0 CHECK (refinery_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS sensor_level   INTEGER NOT NULL DEFAULT 0 CHECK (sensor_level   BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS building_expansion TEXT CHECK (building_expansion IN ('factory','cargo','markt','werft','refinery','sensor')),
  ADD COLUMN IF NOT EXISTS build_complete_at  TIMESTAMPTZ;
