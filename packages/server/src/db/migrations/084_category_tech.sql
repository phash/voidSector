-- Migration 084: per-category unlocked-tier map for module gating (#527).
-- { "weapon_energy": 3, "shield": 2, ... }; missing category => tier 1.
ALTER TABLE players ADD COLUMN IF NOT EXISTS category_tech JSONB NOT NULL DEFAULT '{}';
