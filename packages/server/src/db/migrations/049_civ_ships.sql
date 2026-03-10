-- Migration 049: Civilization ships and stations
-- NPC faction stations seeded from quadrant_control; ships move 1 sector per tick

CREATE TABLE IF NOT EXISTS civ_stations (
  id         SERIAL PRIMARY KEY,
  sector_x   INTEGER NOT NULL,
  sector_y   INTEGER NOT NULL,
  faction    VARCHAR(50) NOT NULL,
  has_shipyard  BOOLEAN NOT NULL DEFAULT TRUE,
  has_warehouse BOOLEAN NOT NULL DEFAULT TRUE,
  has_kontor    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sector_x, sector_y)
);

CREATE TABLE IF NOT EXISTS civ_ships (
  id               SERIAL PRIMARY KEY,
  faction          VARCHAR(50) NOT NULL,
  ship_type        VARCHAR(20) NOT NULL,   -- 'mining_drone'|'station_builder'|'combat'
  state            VARCHAR(20) NOT NULL,   -- 'idle'|'exploring'|'traveling'|'mining'|'returning'
  x                INTEGER NOT NULL,
  y                INTEGER NOT NULL,
  home_x           INTEGER NOT NULL,
  home_y           INTEGER NOT NULL,
  target_x         INTEGER,               -- NULL when idle/exploring
  target_y         INTEGER,
  spiral_step      INTEGER NOT NULL DEFAULT 0,
  resources_carried INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_civ_ships_xy ON civ_ships(x, y);
CREATE INDEX IF NOT EXISTS idx_civ_ships_faction ON civ_ships(faction);
