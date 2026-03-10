-- Migration 050: Construction Sites
-- Structures now require 100 ticks to build with progressive resource delivery.

CREATE TABLE IF NOT EXISTS construction_sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID REFERENCES players(id) ON DELETE CASCADE,
  type         VARCHAR(50)  NOT NULL,
  sector_x     INTEGER      NOT NULL,
  sector_y     INTEGER      NOT NULL,
  progress     INTEGER      NOT NULL DEFAULT 0,
  needed_ore     INTEGER NOT NULL DEFAULT 0,
  needed_gas     INTEGER NOT NULL DEFAULT 0,
  needed_crystal INTEGER NOT NULL DEFAULT 0,
  deposited_ore     INTEGER NOT NULL DEFAULT 0,
  deposited_gas     INTEGER NOT NULL DEFAULT 0,
  deposited_crystal INTEGER NOT NULL DEFAULT 0,
  paused       BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sector_x, sector_y)
);

CREATE INDEX IF NOT EXISTS idx_construction_sites_sector
  ON construction_sites (sector_x, sector_y);

CREATE INDEX IF NOT EXISTS idx_construction_sites_owner
  ON construction_sites (owner_id);
