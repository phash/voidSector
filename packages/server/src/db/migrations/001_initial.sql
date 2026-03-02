CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  home_base JSONB DEFAULT '{"x":0,"y":0}',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES players(id) ON DELETE CASCADE,
  ship_class VARCHAR(32) NOT NULL DEFAULT 'aegis_scout_mk1',
  fuel INTEGER NOT NULL DEFAULT 100,
  fuel_max INTEGER NOT NULL DEFAULT 100,
  jump_range INTEGER NOT NULL DEFAULT 4,
  ap_cost_jump INTEGER NOT NULL DEFAULT 1,
  cargo_cap INTEGER NOT NULL DEFAULT 5,
  scanner_level INTEGER NOT NULL DEFAULT 1,
  safe_slots INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sectors (
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  type VARCHAR(32) NOT NULL,
  seed INTEGER NOT NULL,
  discovered_by UUID REFERENCES players(id),
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  PRIMARY KEY (x, y)
);

CREATE TABLE IF NOT EXISTS player_discoveries (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, sector_x, sector_y)
);

CREATE INDEX IF NOT EXISTS idx_ships_owner ON ships(owner_id);
CREATE INDEX IF NOT EXISTS idx_sectors_discovered_by ON sectors(discovered_by);
CREATE INDEX IF NOT EXISTS idx_discoveries_player ON player_discoveries(player_id);
