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

-- LEAST(col, 10): the level column should be 0..10, but legacy/buggy data may hold
-- larger values (raw XP). Cap the exponent at 10 so POWER(2, x) never overflows int4
-- (10 * (2^10 - 1) = 10230). Anything above level 10 is treated as max.
UPDATE ships SET
  acep_ausbau_xp_raw   = (10 * (POWER(2, LEAST(acep_ausbau_xp, 10))::numeric   - 1))::integer,
  acep_intel_xp_raw    = (10 * (POWER(2, LEAST(acep_intel_xp, 10))::numeric    - 1))::integer,
  acep_kampf_xp_raw    = (10 * (POWER(2, LEAST(acep_kampf_xp, 10))::numeric    - 1))::integer,
  acep_explorer_xp_raw = (10 * (POWER(2, LEAST(acep_explorer_xp, 10))::numeric - 1))::integer,
  acep_defense_xp_raw  = (10 * (POWER(2, LEAST(acep_defense_xp, 10))::numeric  - 1))::integer,
  acep_trader_xp_raw   = (10 * (POWER(2, LEAST(acep_trader_xp, 10))::numeric   - 1))::integer,
  acep_miner_xp_raw    = (10 * (POWER(2, LEAST(acep_miner_xp, 10))::numeric    - 1))::integer
WHERE acep_ausbau_xp_raw = 0 AND acep_intel_xp_raw = 0 AND acep_kampf_xp_raw = 0
  AND acep_explorer_xp_raw = 0 AND acep_defense_xp_raw = 0 AND acep_trader_xp_raw = 0
  AND acep_miner_xp_raw = 0;
