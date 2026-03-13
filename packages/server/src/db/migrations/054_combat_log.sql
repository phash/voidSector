-- 054_combat_log.sql
-- Entfernt legacy battle_log Tabellen und erstellt neue combat_log Tabelle

DROP TABLE IF EXISTS battle_log_v2;
DROP TABLE IF EXISTS battle_log;

CREATE TABLE IF NOT EXISTS combat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  quadrant_x INTEGER,
  quadrant_y INTEGER,
  sector_x INTEGER,
  sector_y INTEGER,
  enemy_type VARCHAR(50),
  enemy_level INTEGER,
  outcome VARCHAR(20),
  rounds INTEGER,
  player_hp_end INTEGER,
  modules_damaged JSONB DEFAULT '[]',
  loot JSONB DEFAULT '{}',
  fought_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_log_player ON combat_log(player_id);
CREATE INDEX IF NOT EXISTS idx_combat_log_fought_at ON combat_log(fought_at);
