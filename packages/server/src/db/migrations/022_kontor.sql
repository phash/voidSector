CREATE TABLE IF NOT EXISTS kontor_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES players(id),
  sector_x        INTEGER NOT NULL,
  sector_y        INTEGER NOT NULL,
  item_type       VARCHAR(32) NOT NULL,
  amount_wanted   INTEGER NOT NULL,
  amount_filled   INTEGER NOT NULL DEFAULT 0,
  price_per_unit  INTEGER NOT NULL,
  budget_reserved INTEGER NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kontor_sector ON kontor_orders(sector_x, sector_y, active);
CREATE INDEX IF NOT EXISTS idx_kontor_owner ON kontor_orders(owner_id, active);
