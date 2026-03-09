-- Territory Claims: players can claim quadrants and defend them
CREATE TABLE IF NOT EXISTS territory_claims (
  id           SERIAL PRIMARY KEY,
  player_id    VARCHAR(255) NOT NULL,
  player_name  VARCHAR(255) NOT NULL,
  quadrant_x   INTEGER NOT NULL,
  quadrant_y   INTEGER NOT NULL,
  claimed_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  defense_rating VARCHAR(16) NOT NULL DEFAULT 'LOW',
  victories    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (quadrant_x, quadrant_y)
);

CREATE INDEX IF NOT EXISTS idx_territory_claims_player ON territory_claims (player_id);
CREATE INDEX IF NOT EXISTS idx_territory_claims_quadrant ON territory_claims (quadrant_x, quadrant_y);
