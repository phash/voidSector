-- Migration 045: Add last_mined_tick for tick-based resource regeneration
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS last_mined_tick BIGINT;
