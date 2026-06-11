-- Tutorial-Kette für Neuspieler: serverseitig getrackter Fortschritt (nur Neuspieler erhalten eine Row)
CREATE TABLE IF NOT EXISTS tutorial_progress (
  player_id VARCHAR(255) PRIMARY KEY,
  step INTEGER NOT NULL DEFAULT 0,
  ore_mined INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
