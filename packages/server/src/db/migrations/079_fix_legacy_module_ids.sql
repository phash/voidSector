-- Migration 079: Fix legacy module IDs in ships.modules JSON
-- Renames generator_mk1 → fusion_cell_mk1, drive_mk1 → ion_drive_mk1

UPDATE ships
SET modules = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'moduleId' = 'generator_mk1'
        THEN jsonb_set(elem, '{moduleId}', '"fusion_cell_mk1"')
      WHEN elem->>'moduleId' = 'drive_mk1'
        THEN jsonb_set(elem, '{moduleId}', '"ion_drive_mk1"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(modules::jsonb) AS elem
)
WHERE modules::text LIKE '%generator_mk1%'
   OR modules::text LIKE '%drive_mk1%';
