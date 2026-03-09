-- Lebendiges Universum: Cosmic Factions + Territory

-- Cosmic faction definition table
CREATE TABLE IF NOT EXISTS cosmic_factions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#888888',
  description TEXT,
  expansion_rate FLOAT NOT NULL DEFAULT 0.5,
  min_distance_from_origin INTEGER NOT NULL DEFAULT 0,
  total_stations INTEGER NOT NULL DEFAULT 0,
  total_quadrants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Territory control per quadrant
CREATE TABLE IF NOT EXISTS quadrant_territory (
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  dominant_faction VARCHAR(50) REFERENCES cosmic_factions(id) ON DELETE SET NULL,
  faction_shares JSONB NOT NULL DEFAULT '{}'::jsonb, -- {factionId: 0-100}
  total_stations INTEGER NOT NULL DEFAULT 0,
  last_updated BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (quadrant_x, quadrant_y)
);

CREATE INDEX IF NOT EXISTS idx_quadrant_territory_faction ON quadrant_territory(dominant_faction);
CREATE INDEX IF NOT EXISTS idx_quadrant_territory_updated ON quadrant_territory(last_updated);

-- NPC fleet tracking (cosmic faction ships)
CREATE TABLE IF NOT EXISTS cosmic_npc_fleets (
  id VARCHAR(50) PRIMARY KEY,
  faction_id VARCHAR(50) NOT NULL REFERENCES cosmic_factions(id) ON DELETE CASCADE,
  fleet_type VARCHAR(20) NOT NULL DEFAULT 'freighter', -- freighter, mining, military, scout
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  target_quadrant_x INTEGER DEFAULT NULL,
  target_quadrant_y INTEGER DEFAULT NULL,
  target_sector_x INTEGER DEFAULT NULL,
  target_sector_y INTEGER DEFAULT NULL,
  cargo_ore INTEGER NOT NULL DEFAULT 0,
  cargo_gas INTEGER NOT NULL DEFAULT 0,
  cargo_crystal INTEGER NOT NULL DEFAULT 0,
  ticks_to_target INTEGER NOT NULL DEFAULT 0,
  state VARCHAR(20) NOT NULL DEFAULT 'idle', -- idle, mining, traveling, building, patrolling
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_npc_fleets_faction ON cosmic_npc_fleets(faction_id);
CREATE INDEX IF NOT EXISTS idx_npc_fleets_quadrant ON cosmic_npc_fleets(quadrant_x, quadrant_y);

-- Human civilization meter (aggregate player contributions)
CREATE TABLE IF NOT EXISTS civilization_meter (
  id INTEGER PRIMARY KEY DEFAULT 1, -- single row
  total_contributions BIGINT NOT NULL DEFAULT 0,
  human_stations INTEGER NOT NULL DEFAULT 0,
  last_tick BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Player civilization contributions
CREATE TABLE IF NOT EXISTS player_civ_contributions (
  player_id VARCHAR(100) NOT NULL,
  contribution_points INTEGER NOT NULL DEFAULT 0,
  last_contribution BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (player_id)
);

-- Insert default civilization meter row
INSERT INTO civilization_meter (id, total_contributions) VALUES (1, 0) ON CONFLICT DO NOTHING;
