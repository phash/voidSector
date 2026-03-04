-- Guest mode: temporary accounts for instant play
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS guest_created_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_players_guest ON players(is_guest) WHERE is_guest = TRUE;
