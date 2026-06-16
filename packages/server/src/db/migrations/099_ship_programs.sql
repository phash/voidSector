-- Migration 099: Programmable Ship — program definitions, runtime VM state, execution logs.

CREATE TABLE IF NOT EXISTS ship_programs (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id   VARCHAR(255) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  source      TEXT NOT NULL,
  mode        VARCHAR(8) NOT NULL DEFAULT 'loop',   -- 'once' | 'loop'
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, name)
);

CREATE TABLE IF NOT EXISTS ship_program_state (
  player_id     VARCHAR(255) PRIMARY KEY,
  program_id    TEXT NOT NULL,
  pc            INT NOT NULL DEFAULT 0,
  vm_state      JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(12) NOT NULL DEFAULT 'idle', -- idle|running|paused|drift|error
  paused_reason TEXT,
  last_tick     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ship_program_logs (
  id         BIGSERIAL PRIMARY KEY,
  player_id  VARCHAR(255) NOT NULL,
  program_id TEXT,
  ts         TIMESTAMP NOT NULL DEFAULT NOW(),
  level      VARCHAR(8) NOT NULL DEFAULT 'info',    -- info|warn|error
  message    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ship_programs_player ON ship_programs(player_id);
CREATE INDEX IF NOT EXISTS idx_ship_programs_active ON ship_programs(player_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ship_program_logs_player ON ship_program_logs(player_id, ts DESC);
