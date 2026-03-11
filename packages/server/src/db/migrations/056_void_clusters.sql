-- packages/server/src/db/migrations/056_void_clusters.sql

-- Cluster metadata
CREATE TABLE IF NOT EXISTS void_clusters (
  id               TEXT PRIMARY KEY,
  state            TEXT NOT NULL CHECK (state IN ('growing', 'splitting', 'dying')),
  size             INT NOT NULL DEFAULT 0,
  split_threshold  INT NOT NULL,
  spawned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin_qx        INT NOT NULL,
  origin_qy        INT NOT NULL
);

-- Per-quadrant progress (0–100)
CREATE TABLE IF NOT EXISTS void_cluster_quadrants (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  qx          INT NOT NULL,
  qy          INT NOT NULL,
  progress    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (cluster_id, qx, qy)
);

-- Frontier ring: 100 real sector coords per active quadrant
CREATE TABLE IF NOT EXISTS void_frontier_sectors (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  x           INT NOT NULL,
  y           INT NOT NULL,
  PRIMARY KEY (cluster_id, x, y)
);

CREATE INDEX IF NOT EXISTS idx_void_frontier_xy ON void_frontier_sectors(x, y);

-- Wire voids into quadrant_control
ALTER TABLE quadrant_control
  ADD COLUMN IF NOT EXISTS void_cluster_id TEXT REFERENCES void_clusters(id);

-- Void hives: one per fully conquered quadrant.
-- The spec references a 'stations' table but none exists in the codebase.
-- We use a dedicated void_hives table (functionally equivalent, simpler).
CREATE TABLE IF NOT EXISTS void_hives (
  id          TEXT PRIMARY KEY,            -- 'void_hive_{qx}_{qy}'
  qx          INT NOT NULL,
  qy          INT NOT NULL,
  sector_x    INT NOT NULL,               -- qx*10000+5000
  sector_y    INT NOT NULL,               -- qy*10000+5000
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  UNIQUE(qx, qy)
);
