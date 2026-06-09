-- 095: Origin Hub bounty board — player-posted, credit-escrowed bounties.
CREATE TABLE IF NOT EXISTS origin_bounties (
  id             SERIAL PRIMARY KEY,
  poster_id      VARCHAR(255) NOT NULL,
  poster_name    VARCHAR(255) NOT NULL,
  reward_credits INTEGER NOT NULL CHECK (reward_credits > 0),
  objective_type VARCHAR(30) NOT NULL,
  objective_data JSONB NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'open',
  claimer_id     VARCHAR(255),
  claimer_name   VARCHAR(255),
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMP WITH TIME ZONE,
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS idx_origin_bounties_open ON origin_bounties (status, objective_type);
CREATE INDEX IF NOT EXISTS idx_origin_bounties_created ON origin_bounties (created_at DESC);
