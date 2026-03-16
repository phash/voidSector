-- Migration 081: Craft sites for ACEP ship production
CREATE TABLE IF NOT EXISTS craft_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ship_id UUID NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  module_id VARCHAR(64) NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  duration INT NOT NULL,
  needed_ore INT NOT NULL DEFAULT 0,
  needed_gas INT NOT NULL DEFAULT 0,
  needed_crystal INT NOT NULL DEFAULT 0,
  needed_credits INT NOT NULL DEFAULT 0,
  deposited_ore INT NOT NULL DEFAULT 0,
  deposited_gas INT NOT NULL DEFAULT 0,
  deposited_crystal INT NOT NULL DEFAULT 0,
  deposited_credits INT NOT NULL DEFAULT 0,
  paused BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ship_id)
);
CREATE INDEX IF NOT EXISTS idx_craft_sites_player ON craft_sites(player_id);
CREATE INDEX IF NOT EXISTS idx_craft_sites_ship ON craft_sites(ship_id);
