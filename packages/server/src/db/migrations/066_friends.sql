-- Migration 066: Friends system
CREATE TABLE IF NOT EXISTS player_friends (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_player_friends_player ON player_friends(player_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player UUID REFERENCES players(id) ON DELETE CASCADE,
  to_player UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_player, to_player)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_player);

CREATE TABLE IF NOT EXISTS player_blocks (
  blocker_id UUID REFERENCES players(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
