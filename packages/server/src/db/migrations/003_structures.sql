CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sector_x, sector_y, type)
);

CREATE INDEX IF NOT EXISTS idx_structures_owner ON structures(owner_id);
CREATE INDEX IF NOT EXISTS idx_structures_sector ON structures(sector_x, sector_y);
