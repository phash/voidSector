-- Story quest chain progress per player
CREATE TABLE IF NOT EXISTS story_quest_progress (
  player_id          VARCHAR(255) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_chapter    INT NOT NULL DEFAULT 0 CHECK (current_chapter >= 0),
  completed_chapters JSONB NOT NULL DEFAULT '[]', -- [0, 1, 2, ...]
  branch_choices     JSONB NOT NULL DEFAULT '{}', -- {"2": "A", "4": "B"}
  last_progress      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Server-wide humanity reputation aggregated across all player actions
CREATE TABLE IF NOT EXISTS humanity_reputation (
  alien_faction_id  VARCHAR(50) PRIMARY KEY,
  rep_value         INT NOT NULL DEFAULT 0,
  interaction_count INT NOT NULL DEFAULT 0,
  last_updated      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
