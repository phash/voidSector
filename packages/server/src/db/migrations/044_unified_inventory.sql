-- 044_unified_inventory.sql
-- Unified inventory: replaces cargo, module_inventory JSONB, player_research.blueprints[]
-- Resources, modules, and blueprints all stored as inventory items.

CREATE TABLE IF NOT EXISTS inventory (
  id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  item_type TEXT         NOT NULL CHECK (item_type IN ('resource', 'module', 'blueprint')),
  item_id   TEXT         NOT NULL,
  quantity  INTEGER      NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (player_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory (player_id);
CREATE INDEX IF NOT EXISTS idx_inventory_player_type ON inventory (player_id, item_type);

-- Extend Kontor orders to support all item types (was resource-only)
ALTER TABLE kontor_orders
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'resource';
