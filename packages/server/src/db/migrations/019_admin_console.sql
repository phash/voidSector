CREATE TABLE IF NOT EXISTS admin_quests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(128) NOT NULL,
  description     TEXT NOT NULL,
  scope           VARCHAR(16) NOT NULL DEFAULT 'universal',
  quest_type      VARCHAR(16) NOT NULL DEFAULT 'fetch',
  npc_name        VARCHAR(64),
  npc_faction     VARCHAR(32),
  objectives      JSONB NOT NULL DEFAULT '[]',
  rewards         JSONB NOT NULL DEFAULT '{}',
  flavor          JSONB DEFAULT '{}',
  sector_x        INTEGER,
  sector_y        INTEGER,
  target_players  TEXT[] DEFAULT '{}',
  max_acceptances INTEGER DEFAULT 0,
  expires_days    INTEGER DEFAULT 7,
  status          VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_quest_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id    UUID NOT NULL REFERENCES admin_quests(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status      VARCHAR(16) NOT NULL DEFAULT 'offered',
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(quest_id, player_id)
);

CREATE TABLE IF NOT EXISTS admin_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  content     TEXT NOT NULL,
  scope       VARCHAR(16) NOT NULL DEFAULT 'universal',
  target_players TEXT[] DEFAULT '{}',
  channel     VARCHAR(16) NOT NULL DEFAULT 'direct',
  allow_reply BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_message_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES admin_messages(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_events (
  id          SERIAL PRIMARY KEY,
  action      VARCHAR(64) NOT NULL,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_quest_assign_player ON admin_quest_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_admin_quest_assign_quest ON admin_quest_assignments(quest_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_created ON admin_events(created_at DESC);
