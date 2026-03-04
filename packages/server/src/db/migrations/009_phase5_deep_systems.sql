-- 009: Phase 5 Deep Systems

-- Faction upgrade choices (binary per tier)
CREATE TABLE IF NOT EXISTS faction_upgrades (
  faction_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  chosen_by TEXT NOT NULL,
  chosen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (faction_id, tier)
);

-- JumpGates (deterministically generated, cached on first visit)
CREATE TABLE IF NOT EXISTS jumpgates (
  id TEXT PRIMARY KEY,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('bidirectional', 'wormhole')),
  requires_code BOOLEAN DEFAULT FALSE,
  requires_minigame BOOLEAN DEFAULT FALSE,
  access_code TEXT,
  UNIQUE(sector_x, sector_y)
);
CREATE INDEX IF NOT EXISTS idx_jumpgates_sector ON jumpgates(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_jumpgates_target ON jumpgates(target_x, target_y);

-- Player-discovered gate codes
CREATE TABLE IF NOT EXISTS gate_codes (
  player_id TEXT NOT NULL,
  gate_id TEXT NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, gate_id)
);

-- Rescued survivors (in transit on ship)
CREATE TABLE IF NOT EXISTS rescued_survivors (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  origin_x INTEGER NOT NULL,
  origin_y INTEGER NOT NULL,
  survivor_count INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL CHECK (source_type IN ('scan_event', 'npc_quest', 'comm_distress')),
  rescued_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rescued_survivors_player ON rescued_survivors(player_id);

-- Active distress calls
CREATE TABLE IF NOT EXISTS distress_calls (
  id TEXT PRIMARY KEY,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  survivor_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player received distress calls
CREATE TABLE IF NOT EXISTS player_distress_calls (
  player_id TEXT NOT NULL,
  distress_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  estimated_distance REAL NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (player_id, distress_id)
);

-- Trade routes (auto-trading from Trading Post Tier 3)
CREATE TABLE IF NOT EXISTS trade_routes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  trading_post_id TEXT NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  sell_resource TEXT,
  sell_amount INTEGER DEFAULT 0,
  buy_resource TEXT,
  buy_amount INTEGER DEFAULT 0,
  cycle_minutes INTEGER DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  last_cycle_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_routes_owner ON trade_routes(owner_id);

-- Extend data_slates table with custom_data
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_slates') THEN
    ALTER TABLE data_slates ADD COLUMN IF NOT EXISTS custom_data JSONB;
  END IF;
END $$;
