CREATE TABLE IF NOT EXISTS station_production (
  sector_x               INTEGER      NOT NULL,
  sector_y               INTEGER      NOT NULL,
  resource_stockpile     JSONB        NOT NULL DEFAULT '{"ore":0,"gas":0,"crystal":0}',
  passive_gen_last_tick  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  queue_index            INTEGER      NOT NULL DEFAULT 0,
  current_item_started_at TIMESTAMPTZ,
  finished_goods         JSONB        NOT NULL DEFAULT '{}',
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sector_x, sector_y)
);
