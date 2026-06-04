-- id is BIGSERIAL (not UUID): CivShip.id is a number; this matches the reused
-- nextShipState state machine + the civShipBus broadcast/radar render path.
CREATE TABLE IF NOT EXISTS station_mining_ships (
  id                BIGSERIAL PRIMARY KEY,
  station_id        UUID NOT NULL REFERENCES player_stations(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  state             TEXT NOT NULL DEFAULT 'idle',
  x                 INTEGER NOT NULL,
  y                 INTEGER NOT NULL,
  home_x            INTEGER NOT NULL,
  home_y            INTEGER NOT NULL,
  target_x          INTEGER,
  target_y          INTEGER,
  spiral_step       INTEGER NOT NULL DEFAULT 0,
  resources_carried INTEGER NOT NULL DEFAULT 0,
  mined_resource    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_station_mining_ships_station ON station_mining_ships(station_id);
