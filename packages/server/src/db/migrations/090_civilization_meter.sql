-- 090_civilization_meter.sql — SP8 reuses the civilization_meter table that
-- migration 033 already created (single row; column total_contributions).
-- No new schema is needed; this only guarantees the singleton row exists so
-- getCivTotal/addCivPoints have a row to read/upsert. Idempotent.
INSERT INTO civilization_meter (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
