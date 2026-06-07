-- 091_civ_ship_indexes.sql — indexes for SP10 lazy NPC ticking (Phase-E review).
-- getShipsInRange filters civ_ships by (x,y) bounding box; countDronesAtStation
-- filters by (home_x, home_y, ship_type). civ_ships previously had neither index.
CREATE INDEX IF NOT EXISTS idx_civ_ships_xy ON civ_ships(x, y);
CREATE INDEX IF NOT EXISTS idx_civ_ships_home_type ON civ_ships(home_x, home_y, ship_type);
