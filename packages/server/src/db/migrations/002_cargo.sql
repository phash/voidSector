CREATE TABLE IF NOT EXISTS cargo (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource VARCHAR(16) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_cargo_player ON cargo(player_id);
