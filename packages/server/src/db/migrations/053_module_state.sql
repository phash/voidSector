-- 053_module_state.sql
-- Backfills powerLevel='high' und currentHp=<maxHp> in ships.modules JSONB
-- für alle Einträge ohne diese Felder.
-- maxHp wird aus tier abgeleitet: tier1=20, tier2=35, tier3=55, tier4=80, tier5=110

UPDATE ships
SET modules = (
  SELECT jsonb_agg(
    CASE
      WHEN module ? 'powerLevel' AND module ? 'currentHp' THEN module
      ELSE module
        || jsonb_build_object('powerLevel', 'high')
        || jsonb_build_object('currentHp',
            CASE
              WHEN (module->>'moduleId') LIKE '%_mk5' THEN 110
              WHEN (module->>'moduleId') LIKE '%_mk4' THEN 80
              WHEN (module->>'moduleId') LIKE '%_mk3' THEN 55
              WHEN (module->>'moduleId') LIKE '%_mk2' THEN 35
              ELSE 20
            END
          )
    END
  )
  FROM jsonb_array_elements(modules) AS module
)
WHERE jsonb_array_length(modules) > 0;
