-- Add credits + artefact resource tracking to construction sites
ALTER TABLE construction_sites ADD COLUMN IF NOT EXISTS needed_credits     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construction_sites ADD COLUMN IF NOT EXISTS deposited_credits  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construction_sites ADD COLUMN IF NOT EXISTS needed_artefact    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE construction_sites ADD COLUMN IF NOT EXISTS deposited_artefact INTEGER NOT NULL DEFAULT 0;
-- metadata for upgrade sites (e.g. gate_id for jumpgate upgrades)
ALTER TABLE construction_sites ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
