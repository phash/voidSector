-- Drop the old case-sensitive unique constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_username_key;

-- Add a case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower_key ON players (lower(username));
