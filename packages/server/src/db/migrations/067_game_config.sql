-- Migration 067: Game config system — DB-backed balance constants
CREATE TABLE IF NOT EXISTS game_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_config_category ON game_config(category);
