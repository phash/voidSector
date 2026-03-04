-- Add environment and contents columns to sectors table
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'empty';
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS contents TEXT[] DEFAULT '{}';

-- Backfill from legacy type
UPDATE sectors SET environment = 'nebula' WHERE type = 'nebula' AND environment = 'empty';
UPDATE sectors SET contents = ARRAY['asteroid_field'] WHERE type = 'asteroid_field' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['station'] WHERE type = 'station' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['anomaly'] WHERE type = 'anomaly' AND contents = '{}';
UPDATE sectors SET contents = ARRAY['pirate_zone', 'asteroid_field'] WHERE type = 'pirate' AND contents = '{}';

-- Index for environment filtering
CREATE INDEX IF NOT EXISTS idx_sectors_environment ON sectors(environment);
