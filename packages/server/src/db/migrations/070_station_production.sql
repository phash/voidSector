-- Station production queue
CREATE TABLE IF NOT EXISTS station_production_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES player_stations(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 9),
  completed INTEGER NOT NULL DEFAULT 0,
  started_at BIGINT NOT NULL,
  time_per_item_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_station_prod_queue_station ON station_production_queue(station_id);
