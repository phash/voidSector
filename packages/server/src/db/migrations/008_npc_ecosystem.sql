-- Player reputation per NPC faction
CREATE TABLE IF NOT EXISTS player_reputation (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  faction_id VARCHAR(16) NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, faction_id)
);

-- Active/completed quests
CREATE TABLE IF NOT EXISTS player_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  template_id VARCHAR(64) NOT NULL,
  station_x INTEGER NOT NULL,
  station_y INTEGER NOT NULL,
  objectives JSONB NOT NULL,
  rewards JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_quests_player ON player_quests(player_id, status);

-- Player upgrades (from rep milestones)
CREATE TABLE IF NOT EXISTS player_upgrades (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id VARCHAR(32) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, upgrade_id)
);

-- Discovered scan events
CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered', 'completed')),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_player ON scan_events(player_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_events_unique ON scan_events(player_id, sector_x, sector_y, event_type);

-- Battle log
CREATE TABLE IF NOT EXISTS battle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  pirate_level INTEGER NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  action VARCHAR(16) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  loot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_log_player ON battle_log(player_id);
