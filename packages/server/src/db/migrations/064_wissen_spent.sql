-- Migration 064: Track spent Wissen for display purposes
ALTER TABLE player_research ADD COLUMN IF NOT EXISTS wissen_spent INTEGER NOT NULL DEFAULT 0;
