-- Migration 080: Add factory_mk1 module to all ships that don't have one
-- Every ship gets a factory module in slot 8

UPDATE ships
SET modules = modules::jsonb || '[{"moduleId":"factory_mk1","slotIndex":8,"source":"standard","powerLevel":"high","currentHp":20}]'::jsonb
WHERE NOT modules::text LIKE '%factory_mk%';
