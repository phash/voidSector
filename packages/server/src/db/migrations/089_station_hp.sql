-- 089_station_hp.sql — current hit points for player stations (SP7 station combat).
-- NULL means "undamaged" (treated as full = STATION_BASE_HP × level at read time).
ALTER TABLE player_stations ADD COLUMN IF NOT EXISTS current_hp INTEGER;
ALTER TABLE player_stations ADD COLUMN IF NOT EXISTS last_raid_at BIGINT;
