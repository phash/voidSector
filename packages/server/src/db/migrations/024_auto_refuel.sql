-- Migration 024: Auto-refuel configuration (#94)
CREATE TABLE IF NOT EXISTS player_auto_refuel (
  user_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  max_price INTEGER DEFAULT 5
);
