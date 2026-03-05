-- 030: Player-built jumpgates

-- Extend jumpgates table for player ownership and leveling
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT NULL;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS level_connection INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS level_distance INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS toll_credits INT DEFAULT 0;
ALTER TABLE jumpgates ADD COLUMN IF NOT EXISTS built_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jumpgates_owner ON jumpgates(owner_id);

-- Link table for multi-gate connections
CREATE TABLE IF NOT EXISTS jumpgate_links (
  gate_id TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  linked_gate_id TEXT NOT NULL REFERENCES jumpgates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (gate_id, linked_gate_id)
);
CREATE INDEX IF NOT EXISTS idx_jumpgate_links_gate ON jumpgate_links(gate_id);
CREATE INDEX IF NOT EXISTS idx_jumpgate_links_linked ON jumpgate_links(linked_gate_id);
