-- Phase 8: Alien Credits currency
ALTER TABLE players ADD COLUMN IF NOT EXISTS alien_credits INTEGER NOT NULL DEFAULT 0;
