-- Extend inventory item_type check to include prisoner and data_slate
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_item_type_check;
ALTER TABLE inventory ADD CONSTRAINT inventory_item_type_check
  CHECK (item_type IN ('resource', 'module', 'blueprint', 'prisoner', 'data_slate'));
