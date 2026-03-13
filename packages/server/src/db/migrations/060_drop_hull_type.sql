-- Migration 060: remove hull_type column (hull system removed in #291)
ALTER TABLE ships DROP COLUMN IF EXISTS hull_type;
