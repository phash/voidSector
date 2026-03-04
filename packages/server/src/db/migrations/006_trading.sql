-- Add credits to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- Add tier to structures
ALTER TABLE structures ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;

-- Storage inventory (per player, like cargo but for base storage)
CREATE TABLE IF NOT EXISTS storage_inventory (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  ore INTEGER DEFAULT 0,
  gas INTEGER DEFAULT 0,
  crystal INTEGER DEFAULT 0
);

-- Trade orders
CREATE TABLE IF NOT EXISTS trade_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  resource VARCHAR(16) NOT NULL,
  amount INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  type VARCHAR(8) NOT NULL CHECK (type IN ('buy', 'sell')),
  fulfilled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_orders_player ON trade_orders(player_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_active ON trade_orders(fulfilled, resource);
