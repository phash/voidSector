-- Data Slates
CREATE TABLE IF NOT EXISTS data_slates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES players(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  slate_type VARCHAR(16) NOT NULL CHECK (slate_type IN ('sector', 'area')),
  sector_data JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'listed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_slates_owner ON data_slates(owner_id);
CREATE INDEX IF NOT EXISTS idx_data_slates_creator ON data_slates(creator_id);

-- Slate reference on trade orders (for marketplace slate trading)
ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS slate_id UUID REFERENCES data_slates(id);

-- Factions
CREATE TABLE IF NOT EXISTS factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL UNIQUE,
  tag VARCHAR(5) NOT NULL UNIQUE,
  leader_id UUID REFERENCES players(id) ON DELETE CASCADE,
  join_mode VARCHAR(8) NOT NULL DEFAULT 'invite' CHECK (join_mode IN ('open', 'code', 'invite')),
  invite_code VARCHAR(16),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faction_members (
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  rank VARCHAR(8) NOT NULL DEFAULT 'member' CHECK (rank IN ('leader', 'officer', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (faction_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_faction_members_player ON faction_members(player_id);

CREATE TABLE IF NOT EXISTS faction_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES players(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faction_invites_invitee ON faction_invites(invitee_id, status);
