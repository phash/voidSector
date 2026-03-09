-- Quadrant control: tracks which faction controls each quadrant
CREATE TABLE IF NOT EXISTS quadrant_control (
  qx                  INTEGER NOT NULL,
  qy                  INTEGER NOT NULL,
  controlling_faction TEXT NOT NULL DEFAULT 'human',
  faction_shares      JSONB NOT NULL DEFAULT '{"human": 100}',
  attack_value        INTEGER NOT NULL DEFAULT 0,
  defense_value       INTEGER NOT NULL DEFAULT 0,
  friction_score      INTEGER NOT NULL DEFAULT 0,
  station_tier        INTEGER NOT NULL DEFAULT 0,
  last_strategic_tick TIMESTAMPTZ,
  PRIMARY KEY (qx, qy)
);

-- NPC fleet movements between quadrants
CREATE TABLE IF NOT EXISTS npc_fleet (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction    TEXT NOT NULL,
  fleet_type TEXT NOT NULL,
  from_qx    INTEGER NOT NULL,
  from_qy    INTEGER NOT NULL,
  to_qx      INTEGER NOT NULL,
  to_qy      INTEGER NOT NULL,
  strength   INTEGER NOT NULL DEFAULT 100,
  eta        TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_npc_fleet_eta ON npc_fleet (eta);
CREATE INDEX IF NOT EXISTS idx_npc_fleet_faction ON npc_fleet (faction);

-- Faction configuration: home coords, expansion behaviour
CREATE TABLE IF NOT EXISTS faction_config (
  faction_id      TEXT PRIMARY KEY,
  home_qx         INTEGER NOT NULL DEFAULT 0,
  home_qy         INTEGER NOT NULL DEFAULT 0,
  expansion_rate  INTEGER NOT NULL DEFAULT 10,
  aggression      FLOAT NOT NULL DEFAULT 1.0,
  expansion_style TEXT NOT NULL DEFAULT 'sphere',
  active          BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO faction_config (faction_id, home_qx, home_qy, expansion_rate, aggression, expansion_style)
VALUES
  ('human',           0,    0,   8,   1.0,  'wave'),
  ('kthari',         20,  -15,   5,   2.0,  'sphere'),
  ('silent_swarm',  -30,   20,   4,   2.5,  'sphere'),
  ('archivists',     15,   10,  15,   0.3,  'sphere'),
  ('consortium',    -10,  -20,  10,   0.4,  'sphere'),
  ('mycelians',      25,    5,  12,   0.5,  'sphere'),
  ('mirror_minds',  -20,   15,  10,   1.0,  'sphere'),
  ('tourist_guild',  -5,  -25,  20,   0.1,  'sphere')
ON CONFLICT (faction_id) DO NOTHING;
