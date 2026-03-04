-- Economy Overhaul: NPC station inventory, factory production, research, kontor

-- NPC Station data (level + XP tracking)
CREATE TABLE IF NOT EXISTS npc_station_data (
  station_x       INTEGER NOT NULL,
  station_y       INTEGER NOT NULL,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  visit_count     INTEGER NOT NULL DEFAULT 0,
  trade_volume    INTEGER NOT NULL DEFAULT 0,
  last_xp_decay   BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (station_x, station_y)
);

-- NPC Station inventory (per resource/item, lazy evaluation)
CREATE TABLE IF NOT EXISTS npc_station_inventory (
  station_x        INTEGER NOT NULL,
  station_y        INTEGER NOT NULL,
  item_type        VARCHAR(32) NOT NULL,
  stock            INTEGER NOT NULL DEFAULT 0,
  max_stock        INTEGER NOT NULL DEFAULT 0,
  consumption_rate REAL NOT NULL DEFAULT 0,
  restock_rate     REAL NOT NULL DEFAULT 0,
  last_updated     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (station_x, station_y, item_type)
);

CREATE INDEX IF NOT EXISTS idx_npc_station_inv_coords
  ON npc_station_inventory (station_x, station_y);

-- Factory state (per structure)
CREATE TABLE IF NOT EXISTS factory_state (
  structure_id      VARCHAR(64) PRIMARY KEY,
  owner_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  active_recipe_id  VARCHAR(64),
  cycle_started_at  BIGINT,
  fuel_cell         INTEGER NOT NULL DEFAULT 0,
  circuit_board     INTEGER NOT NULL DEFAULT 0,
  alloy_plate       INTEGER NOT NULL DEFAULT 0,
  void_shard        INTEGER NOT NULL DEFAULT 0,
  bio_extract       INTEGER NOT NULL DEFAULT 0
);

-- Player research (unlocked recipes)
CREATE TABLE IF NOT EXISTS player_research (
  player_id    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  recipe_id    VARCHAR(64) NOT NULL,
  unlocked_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (player_id, recipe_id)
);

-- Active research (in-progress)
CREATE TABLE IF NOT EXISTS active_research (
  player_id      UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  recipe_id      VARCHAR(64) NOT NULL,
  started_at     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  completes_at   BIGINT NOT NULL,
  credits_spent  INTEGER NOT NULL
);

-- Kontor orders (standing buy orders at player bases)
CREATE TABLE IF NOT EXISTS kontor_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x        INTEGER NOT NULL,
  sector_y        INTEGER NOT NULL,
  item_type       VARCHAR(32) NOT NULL,
  amount_wanted   INTEGER NOT NULL,
  amount_filled   INTEGER NOT NULL DEFAULT 0,
  price_per_unit  INTEGER NOT NULL,
  budget_reserved INTEGER NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_kontor_sector
  ON kontor_orders (sector_x, sector_y, active);

CREATE INDEX IF NOT EXISTS idx_kontor_owner
  ON kontor_orders (owner_id);

-- Extend storage_inventory for processed goods
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS fuel_cell INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS circuit_board INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS alloy_plate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS void_shard INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS bio_extract INTEGER NOT NULL DEFAULT 0;

-- Extend cargo for processed goods (stored in DB as JSON metadata, using jsonb column)
ALTER TABLE players ADD COLUMN IF NOT EXISTS cargo_processed JSONB NOT NULL DEFAULT '{}';
