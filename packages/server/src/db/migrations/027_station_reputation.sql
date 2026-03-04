CREATE TABLE IF NOT EXISTS player_station_reputation (
  player_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  station_x  INTEGER NOT NULL,
  station_y  INTEGER NOT NULL,
  reputation INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, station_x, station_y)
);
CREATE INDEX IF NOT EXISTS idx_player_station_rep ON player_station_reputation(player_id);
