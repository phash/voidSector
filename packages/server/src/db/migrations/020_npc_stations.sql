CREATE TABLE IF NOT EXISTS npc_station_data (
  station_x       INTEGER NOT NULL,
  station_y       INTEGER NOT NULL,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  visit_count     INTEGER NOT NULL DEFAULT 0,
  trade_volume    INTEGER NOT NULL DEFAULT 0,
  last_xp_decay   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_x, station_y)
);

CREATE TABLE IF NOT EXISTS npc_station_inventory (
  station_x         INTEGER NOT NULL,
  station_y         INTEGER NOT NULL,
  item_type         VARCHAR(32) NOT NULL,
  stock             INTEGER NOT NULL DEFAULT 0,
  max_stock         INTEGER NOT NULL DEFAULT 0,
  consumption_rate  REAL NOT NULL DEFAULT 0,
  restock_rate      REAL NOT NULL DEFAULT 0,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_x, station_y, item_type)
);

CREATE INDEX IF NOT EXISTS idx_npc_station_inv_coords
  ON npc_station_inventory (station_x, station_y);
