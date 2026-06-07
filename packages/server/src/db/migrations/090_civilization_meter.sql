-- 090_civilization_meter.sql — global humanity civilization progress (SP8).
-- Single-row counter; contributions (station built, quest done, pirate defeated,
-- territory explored) accumulate toward HUMAN_CIVILIZATION_METER_MAX.
CREATE TABLE IF NOT EXISTS civilization_meter (
  id           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_points BIGINT NOT NULL DEFAULT 0
);
INSERT INTO civilization_meter (id, total_points) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
