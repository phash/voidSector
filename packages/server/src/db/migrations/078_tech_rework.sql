CREATE TABLE IF NOT EXISTS module_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier INTEGER NOT NULL,
  slot TEXT NOT NULL,
  cost_credits INTEGER DEFAULT 0,
  cost_ore INTEGER DEFAULT 0,
  cost_gas INTEGER DEFAULT 0,
  cost_crystal INTEGER DEFAULT 0,
  cost_artefact TEXT DEFAULT '0',
  ap_cost REAL DEFAULT 0,
  energy_cost REAL DEFAULT 0,
  hitpoints INTEGER DEFAULT 20,
  stats JSONB NOT NULL DEFAULT '{}',
  description TEXT DEFAULT '',
  is_found_only BOOLEAN DEFAULT FALSE,
  is_unique BOOLEAN DEFAULT FALSE,
  prerequisite_module_id TEXT
);

CREATE TABLE IF NOT EXISTS research_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  description TEXT DEFAULT '',
  effect JSONB NOT NULL DEFAULT '{}',
  wissen_cost INTEGER DEFAULT 10,
  prerequisite_module_id TEXT,
  prerequisite_research_id TEXT
);

CREATE TABLE IF NOT EXISTS player_research_v2 (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  researched_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, node_id)
);

CREATE TABLE IF NOT EXISTS player_modules_v2 (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  current_hp INTEGER NOT NULL,
  installed BOOLEAN DEFAULT TRUE,
  UNIQUE(player_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_player_modules_v2_player ON player_modules_v2(player_id);
CREATE INDEX IF NOT EXISTS idx_player_research_v2_player ON player_research_v2(player_id);
