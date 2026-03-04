-- Combat v2: Station defense structures
CREATE TABLE IF NOT EXISTS station_defenses (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  defense_type  TEXT NOT NULL,
  installed_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  UNIQUE(user_id, sector_x, sector_y, defense_type)
);
CREATE INDEX IF NOT EXISTS idx_station_defenses_location
  ON station_defenses(sector_x, sector_y);

-- Station HP tracking (extend structures)
ALTER TABLE structures ADD COLUMN IF NOT EXISTS current_hp INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS max_hp INTEGER DEFAULT 500;
ALTER TABLE structures ADD COLUMN IF NOT EXISTS damaged_at BIGINT;

-- Battle log extensions for v2
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS rounds_played INTEGER DEFAULT 1;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS round_details JSONB;
ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS player_hp_end INTEGER;

-- Station battle log
CREATE TABLE IF NOT EXISTS station_battle_log (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x      INTEGER NOT NULL,
  sector_y      INTEGER NOT NULL,
  attacker_level INTEGER NOT NULL,
  outcome       TEXT NOT NULL,
  hp_lost       INTEGER NOT NULL DEFAULT 0,
  fought_at     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
CREATE INDEX IF NOT EXISTS idx_station_battle_log_user ON station_battle_log(user_id);
