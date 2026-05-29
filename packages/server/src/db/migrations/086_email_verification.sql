-- Email-verified registration. Existing accounts default verified=TRUE (not locked out / no banner);
-- new email registrations set email_verified=FALSE until the verification link is clicked.
ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE players ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
ALTER TABLE players ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_players_verification_token ON players (verification_token);
