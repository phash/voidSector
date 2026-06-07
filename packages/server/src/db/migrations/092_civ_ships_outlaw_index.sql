-- 092_civ_ships_outlaw_index.sql — index for resetDeadOutlaws (QW3 review).
-- resetDeadOutlaws runs every strategic tick (~60s):
--   UPDATE civ_ships ... WHERE role='outlaw' AND dead_until IS NOT NULL AND dead_until < NOW()
-- Without an index this sequentially scans the whole civ_ships table each tick.
-- Partial index keeps it tiny (only dead outlaws qualify).
CREATE INDEX IF NOT EXISTS idx_civ_ships_role_dead_until
  ON civ_ships(role, dead_until)
  WHERE dead_until IS NOT NULL;
