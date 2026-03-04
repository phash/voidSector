-- Tech-Baum: Research state per player
CREATE TABLE IF NOT EXISTS player_research (
  user_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE PRIMARY KEY,
  unlocked_modules TEXT[]  NOT NULL DEFAULT '{}',
  blueprints       TEXT[]  NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_player_research_user ON player_research(user_id);

-- Active research project (one per player)
CREATE TABLE IF NOT EXISTS active_research (
  user_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE PRIMARY KEY,
  module_id     TEXT    NOT NULL,
  started_at    BIGINT  NOT NULL,
  completes_at  BIGINT  NOT NULL
);
