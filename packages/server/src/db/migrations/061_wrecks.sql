-- Migration 061: Wreck POI table
CREATE TABLE IF NOT EXISTS wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  size TEXT NOT NULL DEFAULT 'small' CHECK (size IN ('small', 'medium', 'large')),
  items JSONB NOT NULL DEFAULT '[]',
  difficulty_modifier FLOAT NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'intact' CHECK (status IN ('intact', 'investigated', 'exhausted')),
  spawned_at TIMESTAMPTZ DEFAULT NOW(),
  exhausted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wrecks_quadrant ON wrecks(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_sector ON wrecks(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_wrecks_status ON wrecks(status);
