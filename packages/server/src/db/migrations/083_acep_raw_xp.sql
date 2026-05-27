-- Migration 083: separate raw ACEP XP from derived level.
-- The acep_<path>_xp columns store the LEVEL (0-10). Auto-XP from gameplay must
-- accumulate separately so a single action no longer clamps a path to max.
-- These *_xp_raw columns hold accumulated raw XP; the level is derived from them
-- via the exponential thresholds (getAcepLevelForXp). Backfill keeps existing
-- levels consistent: raw = threshold(currentLevel) = 10 * (2^level - 1).

ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_ausbau_xp_raw   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_intel_xp_raw    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_kampf_xp_raw    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_explorer_xp_raw INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_defense_xp_raw  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_trader_xp_raw   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acep_miner_xp_raw    INTEGER NOT NULL DEFAULT 0;

UPDATE ships SET
  acep_ausbau_xp_raw   = (10 * (POWER(2, acep_ausbau_xp)::numeric   - 1))::integer,
  acep_intel_xp_raw    = (10 * (POWER(2, acep_intel_xp)::numeric    - 1))::integer,
  acep_kampf_xp_raw    = (10 * (POWER(2, acep_kampf_xp)::numeric    - 1))::integer,
  acep_explorer_xp_raw = (10 * (POWER(2, acep_explorer_xp)::numeric - 1))::integer,
  acep_defense_xp_raw  = (10 * (POWER(2, acep_defense_xp)::numeric  - 1))::integer,
  acep_trader_xp_raw   = (10 * (POWER(2, acep_trader_xp)::numeric   - 1))::integer,
  acep_miner_xp_raw    = (10 * (POWER(2, acep_miner_xp)::numeric    - 1))::integer
WHERE acep_ausbau_xp_raw = 0 AND acep_intel_xp_raw = 0 AND acep_kampf_xp_raw = 0
  AND acep_explorer_xp_raw = 0 AND acep_defense_xp_raw = 0 AND acep_trader_xp_raw = 0
  AND acep_miner_xp_raw = 0;
