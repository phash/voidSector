CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES players(id),
  recipient_id UUID REFERENCES players(id),
  channel VARCHAR(16) NOT NULL DEFAULT 'direct',
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, delivered);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);

CREATE TABLE IF NOT EXISTS badges (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  badge_type VARCHAR(32) NOT NULL,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, badge_type)
);
