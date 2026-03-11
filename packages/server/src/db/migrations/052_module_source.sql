-- 052_module_source.sql
-- Ergänzt "source": "standard" in allen existierenden ship.modules Einträgen,
-- die noch kein source-Feld haben.

UPDATE ships
SET modules = (
  SELECT jsonb_agg(
    CASE
      WHEN module ? 'source' THEN module
      ELSE module || '{"source": "standard"}'::jsonb
    END
  )
  FROM jsonb_array_elements(modules) AS module
)
WHERE jsonb_array_length(modules) > 0;
