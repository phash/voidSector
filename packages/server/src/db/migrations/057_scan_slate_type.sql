-- Extend data_slates.slate_type CHECK constraint to include 'scan'
DO $$
BEGIN
  ALTER TABLE data_slates DROP CONSTRAINT IF EXISTS data_slates_slate_type_check;
  ALTER TABLE data_slates ADD CONSTRAINT data_slates_slate_type_check
    CHECK (slate_type IN ('sector', 'area', 'custom', 'jumpgate', 'scan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
