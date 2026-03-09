-- Phase 2: Sector environment and content system
-- Stores pre-generated sector data (environment type, planet subtype, etc.)
-- Generated deterministically from world seed; populated lazily on first visit.

CREATE TABLE IF NOT EXISTS sector_environments (
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  environment_type VARCHAR(20) NOT NULL DEFAULT 'empty',
  planet_subtype VARCHAR(20) DEFAULT NULL, -- only set when environment_type = 'planet'
  is_impassable BOOLEAN NOT NULL DEFAULT FALSE,
  content_variance FLOAT NOT NULL DEFAULT 1.0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (sector_x, sector_y)
);

CREATE INDEX IF NOT EXISTS idx_sector_env_quadrant ON sector_environments(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_sector_env_type ON sector_environments(environment_type);

-- Sector contents (POIs, resources, etc.)
-- Multiple content entries per sector (max 3 per design)
CREATE TABLE IF NOT EXISTS sector_contents (
  id SERIAL PRIMARY KEY,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, depleted, defeated
  respawn_at BIGINT DEFAULT NULL, -- unix ms, null = permanent
  ore_yield INTEGER DEFAULT 0,
  gas_yield INTEGER DEFAULT 0,
  crystal_yield INTEGER DEFAULT 0,
  exotic_yield INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_sector_contents_sector ON sector_contents(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_sector_contents_quadrant ON sector_contents(quadrant_x, quadrant_y);
CREATE INDEX IF NOT EXISTS idx_sector_contents_type ON sector_contents(content_type);
CREATE INDEX IF NOT EXISTS idx_sector_contents_respawn ON sector_contents(respawn_at) WHERE respawn_at IS NOT NULL;
