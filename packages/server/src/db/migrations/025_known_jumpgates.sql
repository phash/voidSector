CREATE TABLE IF NOT EXISTS player_known_jumpgates (
  player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  gate_id    TEXT NOT NULL,
  from_x     INTEGER NOT NULL,
  from_y     INTEGER NOT NULL,
  to_x       INTEGER NOT NULL,
  to_y       INTEGER NOT NULL,
  gate_type  VARCHAR(16) NOT NULL,
  PRIMARY KEY (player_id, gate_id)
);
CREATE INDEX IF NOT EXISTS idx_known_gates_player ON player_known_jumpgates(player_id);
