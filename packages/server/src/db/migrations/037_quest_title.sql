-- Add title column to player_quests so display name is persisted independently of template_id
ALTER TABLE player_quests
  ADD COLUMN IF NOT EXISTS title VARCHAR(256) NOT NULL DEFAULT '';
