-- 044_wissen_typed_artefacts.sql
-- Wissen knowledge resource + typed artefact slots

-- Wissen balance on player_research
ALTER TABLE player_research
  ADD COLUMN IF NOT EXISTS wissen INTEGER NOT NULL DEFAULT 0;

-- Slot support for active_research (slot 1 = default, slot 2 = lab III unlocked)
-- active_research.user_id is currently the PRIMARY KEY; we need to allow two rows
-- per user (one per slot), so we drop the old single-column PK and replace it
-- with a composite unique constraint on (user_id, slot).
ALTER TABLE active_research
  ADD COLUMN IF NOT EXISTS slot INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  -- Add composite unique constraint only if it doesn't exist yet
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'active_research_user_id_slot_key'
      AND conrelid = 'active_research'::regclass
  ) THEN
    -- Drop the old single-column PK so we can enforce the new composite uniqueness
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'active_research_pkey'
        AND conrelid = 'active_research'::regclass
        AND contype = 'p'
    ) THEN
      ALTER TABLE active_research DROP CONSTRAINT active_research_pkey;
    END IF;

    ALTER TABLE active_research
      ADD CONSTRAINT active_research_user_id_slot_key UNIQUE (user_id, slot);
  END IF;
END$$;

-- Typed artefacts in storage_inventory (9 categories matching ModuleCategory)
ALTER TABLE storage_inventory
  ADD COLUMN IF NOT EXISTS artefact_drive    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_cargo    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_scanner  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_armor    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_weapon   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_shield   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_defense  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_special  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artefact_mining   INTEGER NOT NULL DEFAULT 0;

-- cargo uses a key-value design (player_id, resource, quantity).
-- Typed artefacts in cargo are stored as rows with resource names such as
-- 'artefact_drive', 'artefact_scanner', etc. — no DDL change needed here.

-- structures.tier already exists (added in migration 006_trading.sql). No change needed.
