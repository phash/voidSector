-- Starthilfe-Bounties: systemgestellte Lieferaufträge am Origin Hub, einmal pro Spieler einlösbar
CREATE TABLE IF NOT EXISTS starter_bounty_claims (
  player_id VARCHAR(255) NOT NULL,
  bounty_key VARCHAR(40) NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, bounty_key)
);
