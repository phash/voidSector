-- Phase 7: Modular Ship Designer

-- Add new columns to ships
ALTER TABLE ships ADD COLUMN IF NOT EXISTS hull_type VARCHAR(32) NOT NULL DEFAULT 'scout';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS name VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate existing ship_class to hull_type
UPDATE ships SET hull_type = 'scout' WHERE ship_class = 'aegis_scout_mk1';
UPDATE ships SET hull_type = 'explorer' WHERE ship_class = 'void_seeker_mk2';

-- Drop deprecated stat columns (stats now calculated from hull + modules)
ALTER TABLE ships DROP COLUMN IF EXISTS ship_class;
ALTER TABLE ships DROP COLUMN IF EXISTS fuel_max;
ALTER TABLE ships DROP COLUMN IF EXISTS jump_range;
ALTER TABLE ships DROP COLUMN IF EXISTS ap_cost_jump;
ALTER TABLE ships DROP COLUMN IF EXISTS cargo_cap;
ALTER TABLE ships DROP COLUMN IF EXISTS scanner_level;
ALTER TABLE ships DROP COLUMN IF EXISTS safe_slots;

-- Add base_name to players for renaming
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_name VARCHAR(20) NOT NULL DEFAULT '';

-- Add module_inventory to players (modules owned but not installed)
ALTER TABLE players ADD COLUMN IF NOT EXISTS module_inventory JSONB NOT NULL DEFAULT '[]';

-- Ensure only one active ship per player
-- Note: Can't use IF NOT EXISTS with partial indexes in all PG versions, so use DO block
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ships_active_unique') THEN
    CREATE UNIQUE INDEX idx_ships_active_unique ON ships (owner_id) WHERE active = true;
  END IF;
END
$$;
