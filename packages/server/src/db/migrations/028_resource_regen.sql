-- Resource regeneration: track last mined time and max resource values
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS last_mined BIGINT DEFAULT NULL;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_ore INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_gas INTEGER DEFAULT 0;
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS max_crystal INTEGER DEFAULT 0;
