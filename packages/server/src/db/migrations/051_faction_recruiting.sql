-- Migration 051: Faction Recruiting
-- Allows faction leaders to mark their faction as actively recruiting,
-- add a slogan, and optionally a color for display in the recruitment panel.

ALTER TABLE factions
  ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS slogan        VARCHAR(160),
  ADD COLUMN IF NOT EXISTS color         VARCHAR(7);
