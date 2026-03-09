-- Drone system: idle resource automation

-- Player drone inventory
CREATE TABLE IF NOT EXISTS player_drones (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  drone_type VARCHAR(20) NOT NULL DEFAULT 'scout', -- scout | harvester | industrial
  status VARCHAR(20) NOT NULL DEFAULT 'idle', -- idle | mining | returning | damaged
  current_sector_x INTEGER,
  current_sector_y INTEGER,
  assigned_to VARCHAR(100), -- 'ship' | base_id | route_id
  current_load INTEGER NOT NULL DEFAULT 0,
  max_capacity INTEGER NOT NULL DEFAULT 50,
  fuel_remaining INTEGER NOT NULL DEFAULT 100,
  active_since BIGINT DEFAULT NULL,
  last_return BIGINT DEFAULT NULL,
  damage_until BIGINT DEFAULT NULL,
  total_mined INTEGER NOT NULL DEFAULT 0,
  total_trips INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_player_drones_player ON player_drones(player_id);
CREATE INDEX IF NOT EXISTS idx_player_drones_status ON player_drones(status);

-- Drone routes (base-assigned multi-sector routes)
CREATE TABLE IF NOT EXISTS drone_routes (
  id SERIAL PRIMARY KEY,
  base_id INTEGER NOT NULL,
  player_id VARCHAR(255) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  route_name VARCHAR(100),
  waypoints JSONB NOT NULL DEFAULT '[]', -- [{sector_x, sector_y, mine_duration_minutes}]
  total_duration_minutes INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | paused
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'daily', -- daily | every_2_days | weekly
  next_start BIGINT DEFAULT NULL,
  stats JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

CREATE INDEX IF NOT EXISTS idx_drone_routes_player ON drone_routes(player_id);
CREATE INDEX IF NOT EXISTS idx_drone_routes_base ON drone_routes(base_id);

-- Active drone missions
CREATE TABLE IF NOT EXISTS drone_missions (
  id SERIAL PRIMARY KEY,
  drone_id INTEGER NOT NULL REFERENCES player_drones(id) ON DELETE CASCADE,
  mission_type VARCHAR(30) NOT NULL, -- ship_mining | base_patrol | route_mission
  target_sector_x INTEGER,
  target_sector_y INTEGER,
  return_to_x INTEGER,
  return_to_y INTEGER,
  resource_type VARCHAR(20),
  target_amount INTEGER NOT NULL DEFAULT 0,
  current_collected INTEGER NOT NULL DEFAULT 0,
  started_at BIGINT,
  estimated_completion BIGINT,
  completed_at BIGINT,
  actual_yield INTEGER DEFAULT 0,
  result VARCHAR(20) -- success | partial | failed | damage
);

CREATE INDEX IF NOT EXISTS idx_drone_missions_drone ON drone_missions(drone_id);
