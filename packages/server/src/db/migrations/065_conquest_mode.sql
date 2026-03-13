-- Migration 065: Add conquest mode, resource pool, and level to civ_stations
ALTER TABLE civ_stations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'conquest',
  ADD COLUMN IF NOT EXISTS conquest_pool INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- Existing NPC stations are fully established → factory mode.
-- Idempotent: only updates rows still at default 'conquest'.
UPDATE civ_stations SET mode = 'factory'
WHERE mode = 'conquest';
