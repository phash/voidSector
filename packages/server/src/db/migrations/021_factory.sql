CREATE TABLE IF NOT EXISTS factory_state (
  structure_id      VARCHAR(64) PRIMARY KEY,
  owner_id          UUID NOT NULL,
  active_recipe_id  VARCHAR(64),
  cycle_started_at  BIGINT,
  fuel_cell         INTEGER NOT NULL DEFAULT 0,
  circuit_board     INTEGER NOT NULL DEFAULT 0,
  alloy_plate       INTEGER NOT NULL DEFAULT 0,
  void_shard        INTEGER NOT NULL DEFAULT 0,
  bio_extract       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_factory_state_owner ON factory_state(owner_id);
