-- Add artefact column to storage_inventory
ALTER TABLE storage_inventory ADD COLUMN IF NOT EXISTS artefact INTEGER DEFAULT 0;
