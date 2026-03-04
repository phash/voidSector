-- Admin Console: Quest management, COMM broadcasts, event tracking

-- Admin-created quests (source templates)
CREATE TABLE IF NOT EXISTS admin_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('universal', 'individual', 'sector')),
  quest_type VARCHAR(20) NOT NULL CHECK (quest_type IN ('fetch', 'delivery', 'scan', 'bounty', 'custom')),
  objectives JSONB NOT NULL DEFAULT '[]',
  rewards JSONB NOT NULL DEFAULT '{"credits":0,"xp":0,"reputation":0}',
  npc_name VARCHAR(100) NOT NULL DEFAULT 'ADMIN',
  npc_faction_id VARCHAR(32) NOT NULL DEFAULT 'independent',
  -- Sector scope: sector where quest can be discovered
  target_sector_x INTEGER DEFAULT NULL,
  target_sector_y INTEGER DEFAULT NULL,
  -- Individual scope: specific player IDs
  target_player_ids UUID[] DEFAULT NULL,
  -- Optional cap on total acceptances
  max_acceptances INTEGER DEFAULT NULL,
  acceptance_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'expired', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  -- Original YAML source for reference/re-import
  yaml_source TEXT DEFAULT NULL,
  intro_text TEXT DEFAULT NULL,
  completion_text TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_quests_scope ON admin_quests(scope, status);
CREATE INDEX IF NOT EXISTS idx_admin_quests_sector ON admin_quests(target_sector_x, target_sector_y) WHERE scope = 'sector';

-- Player instances of admin quests (one row per player per quest)
CREATE TABLE IF NOT EXISTS admin_quest_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_quest_id UUID NOT NULL REFERENCES admin_quests(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- pending = offered but not yet accepted, accepted = in progress, etc.
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'completed', 'declined', 'expired')),
  -- Per-player objective progress (copy of objectives with progress fields)
  objectives JSONB NOT NULL DEFAULT '[]',
  offered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE (admin_quest_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_quest_assignments_player ON admin_quest_assignments(player_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_quest_assignments_quest ON admin_quest_assignments(admin_quest_id, status);

-- Admin COMM messages (broadcasts + individual messages)
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_name VARCHAR(64) NOT NULL DEFAULT 'ADMIN',
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('universal', 'quadrant', 'individual')),
  content TEXT NOT NULL,
  -- For quadrant scope: sector coordinates
  target_sector_x INTEGER DEFAULT NULL,
  target_sector_y INTEGER DEFAULT NULL,
  -- For individual scope: specific player IDs
  target_player_ids UUID[] DEFAULT NULL,
  -- Whether players can reply to this message
  allow_reply BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_scope ON admin_messages(scope, sent_at);

-- Player replies to admin messages
CREATE TABLE IF NOT EXISTS admin_message_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_message_id UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_message_replies_msg ON admin_message_replies(admin_message_id);

-- Admin event log
CREATE TABLE IF NOT EXISTS admin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  label VARCHAR(200) DEFAULT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  target_sector_x INTEGER DEFAULT NULL,
  target_sector_y INTEGER DEFAULT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_time ON admin_events(triggered_at DESC);
