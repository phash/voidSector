-- 096: Origin Hub exchange — offline marketplace; sellers list escrowed items at 0:0.
CREATE TABLE IF NOT EXISTS exchange_listings (
  id          SERIAL PRIMARY KEY,
  seller_id   VARCHAR(255) NOT NULL,
  seller_name VARCHAR(255) NOT NULL,
  item_type   VARCHAR(30) NOT NULL,
  item_id     VARCHAR(64) NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  price       INTEGER NOT NULL CHECK (price > 0),
  status      VARCHAR(20) NOT NULL DEFAULT 'open',
  buyer_id    VARCHAR(255),
  buyer_name  VARCHAR(255),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sold_at     TIMESTAMP WITH TIME ZONE,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS idx_exchange_open ON exchange_listings (status, created_at DESC);
