-- Fix faction ID: rename 'human' -> 'humans' to match COSMIC_FACTION_IDS in shared constants

-- 1. Update faction_config primary key (rename the row)
INSERT INTO faction_config (faction_id, home_qx, home_qy, expansion_rate, aggression, expansion_style, active)
SELECT 'humans', home_qx, home_qy, expansion_rate, aggression, expansion_style, active
FROM faction_config
WHERE faction_id = 'human'
ON CONFLICT (faction_id) DO NOTHING;

DELETE FROM faction_config WHERE faction_id = 'human';

-- 2. Update quadrant_control rows controlled by 'human'
UPDATE quadrant_control
SET
  controlling_faction = 'humans',
  faction_shares = (
    CASE
      WHEN faction_shares ? 'human'
      THEN (faction_shares - 'human') || jsonb_build_object('humans', faction_shares->'human')
      ELSE faction_shares
    END
  )
WHERE controlling_faction = 'human';

-- 3. Fix any remaining faction_shares JSONB that contain 'human' key (partial shares)
UPDATE quadrant_control
SET faction_shares = (faction_shares - 'human') || jsonb_build_object('humans', faction_shares->'human')
WHERE faction_shares ? 'human';

-- 4. Update the column default
ALTER TABLE quadrant_control ALTER COLUMN controlling_faction SET DEFAULT 'humans';

-- 5. Update expansion_log (column is 'faction', not 'faction_id')
UPDATE expansion_log SET faction = 'humans' WHERE faction = 'human';
