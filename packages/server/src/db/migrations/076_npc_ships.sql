ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'drone';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS name VARCHAR(60) DEFAULT '';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS patrol_state JSONB DEFAULT '{}';
ALTER TABLE civ_ships ADD COLUMN IF NOT EXISTS dead_until TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_item_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_item_type_check
  CHECK (item_type IN ('resource', 'module', 'blueprint', 'prisoner', 'data_slate', 'quest_item'));
