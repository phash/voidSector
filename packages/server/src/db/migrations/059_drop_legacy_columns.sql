-- Drop legacy columns no longer referenced by application code
ALTER TABLE players DROP COLUMN IF EXISTS home_base;
ALTER TABLE players DROP COLUMN IF EXISTS module_inventory;
