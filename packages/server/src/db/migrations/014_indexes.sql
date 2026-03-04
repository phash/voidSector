CREATE INDEX IF NOT EXISTS idx_cargo_player ON cargo(player_id);
CREATE INDEX IF NOT EXISTS idx_structures_owner_sector ON structures(owner_id, sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_trade_orders_player_status ON trade_orders(player_id, fulfilled);
CREATE INDEX IF NOT EXISTS idx_reputation_composite ON player_reputation(player_id, faction_id);
