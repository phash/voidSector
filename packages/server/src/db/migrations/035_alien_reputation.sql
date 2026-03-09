-- Alien Quest System: alien reputation and encounter tracking

-- Player reputation with alien factions (separate from human NPC factions)
CREATE TABLE IF NOT EXISTS alien_reputation (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alien_faction_id VARCHAR(50) NOT NULL, -- archivists | consortium | kthari | mycelians | etc.
  reputation INTEGER NOT NULL DEFAULT 0, -- -100 to +100
  encounter_count INTEGER NOT NULL DEFAULT 0,
  first_contact_at BIGINT DEFAULT NULL,
  last_interaction BIGINT DEFAULT NULL,
  PRIMARY KEY (player_id, alien_faction_id)
);

CREATE INDEX IF NOT EXISTS idx_alien_rep_player ON alien_reputation(player_id);
CREATE INDEX IF NOT EXISTS idx_alien_rep_faction ON alien_reputation(alien_faction_id);

-- Alien encounter event log (story moments, first contacts, etc.)
CREATE TABLE IF NOT EXISTS alien_encounters (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alien_faction_id VARCHAR(50) NOT NULL,
  encounter_type VARCHAR(30) NOT NULL, -- first_contact | quest_offer | combat | trade | scan_event
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  quadrant_x INTEGER NOT NULL,
  quadrant_y INTEGER NOT NULL,
  encounter_data JSONB NOT NULL DEFAULT '{}', -- {questId, outcome, repChange, dialogKey}
  reputation_before INTEGER NOT NULL DEFAULT 0,
  reputation_after INTEGER NOT NULL DEFAULT 0,
  occurred_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_alien_enc_player ON alien_encounters(player_id);
CREATE INDEX IF NOT EXISTS idx_alien_enc_faction ON alien_encounters(alien_faction_id);
CREATE INDEX IF NOT EXISTS idx_alien_enc_type ON alien_encounters(encounter_type);

-- Community alien quest progress (server-wide collective goals)
CREATE TABLE IF NOT EXISTS community_alien_quests (
  id SERIAL PRIMARY KEY,
  alien_faction_id VARCHAR(50) NOT NULL,
  quest_type VARCHAR(30) NOT NULL, -- community_scan | community_delivery | community_bounty
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_count INTEGER NOT NULL DEFAULT 100,
  current_count INTEGER NOT NULL DEFAULT 0,
  reward_type VARCHAR(30) DEFAULT NULL, -- what all contributors get
  started_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  expires_at BIGINT DEFAULT NULL,
  completed_at BIGINT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' -- active | completed | expired
);

CREATE INDEX IF NOT EXISTS idx_community_quests_status ON community_alien_quests(status);
CREATE INDEX IF NOT EXISTS idx_community_quests_faction ON community_alien_quests(alien_faction_id);

-- Player contributions to community quests
CREATE TABLE IF NOT EXISTS community_quest_contributions (
  quest_id INTEGER NOT NULL REFERENCES community_alien_quests(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  contribution INTEGER NOT NULL DEFAULT 0,
  contributed_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (quest_id, player_id)
);
