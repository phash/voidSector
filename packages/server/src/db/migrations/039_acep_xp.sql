-- Migration 039: ACEP XP Engine — ship progression paths + wrecks
-- ACEP paths: Ausbau (construction), Intel (intelligence), Kampf (combat), Explorer

ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS acep_ausbau_xp   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acep_intel_xp    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acep_kampf_xp    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acep_explorer_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acep_traits      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS acep_personality_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS acep_generation  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acep_legacy_from_ship_id UUID;

-- Permadeath POI: destroyed ships leave wrecks in the world
CREATE TABLE IF NOT EXISTS ship_wrecks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_ship_id     UUID NOT NULL,
  player_name          VARCHAR(64) NOT NULL,
  quadrant_x           INTEGER NOT NULL,
  quadrant_y           INTEGER NOT NULL,
  sector_x             INTEGER NOT NULL,
  sector_y             INTEGER NOT NULL,
  radar_icon_data      JSONB NOT NULL DEFAULT '{}',
  last_log_entry       TEXT,
  salvageable_modules  JSONB NOT NULL DEFAULT '[]',
  created_at           BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_ship_wrecks_location
  ON ship_wrecks (quadrant_x, quadrant_y, sector_x, sector_y);
