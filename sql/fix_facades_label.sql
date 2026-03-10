-- Migration: Split "Façades et panneaux apparents" into "Façades" and "Panneaux"
-- Run in Supabase SQL Editor.
-- Updates app_config.material_groups and app_config.category_group_mapping.

-- 1. material_groups: replace the combined label with two separate entries
UPDATE app_config
SET value = (
    SELECT jsonb_agg(
        CASE
            WHEN elem #>> '{}' = 'Façades et panneaux apparents' THEN '"Façades"'::jsonb
            ELSE elem
        END
    ) || '["Panneaux"]'::jsonb
    FROM jsonb_array_elements(value) AS elem
)
WHERE key = 'material_groups'
  AND value @> '"Façades et panneaux apparents"'::jsonb;

-- 2. category_group_mapping: replace in all arrays that reference the old label
UPDATE app_config
SET value = (
    SELECT jsonb_object_agg(
        k,
        CASE
            WHEN v @> '"Façades et panneaux apparents"'::jsonb THEN
                (SELECT jsonb_agg(
                    CASE
                        WHEN e #>> '{}' = 'Façades et panneaux apparents' THEN '"Façades"'::jsonb
                        ELSE e
                    END
                ) FROM jsonb_array_elements(v) AS e)
            ELSE v
        END
    )
    FROM jsonb_each(value) AS x(k, v)
)
WHERE key = 'category_group_mapping';

-- 3. Add "Panneaux" to relevant mapping arrays (Budgétaire, Panneaux catalogue category)
-- This adds "Panneaux" where "Façades et panneaux apparents" was previously listed
UPDATE app_config
SET value = jsonb_set(
    value,
    '{Budgétaire}',
    (value->'Budgétaire') || '["Panneaux"]'::jsonb
)
WHERE key = 'category_group_mapping'
  AND NOT (value->'Budgétaire') @> '"Panneaux"'::jsonb;

UPDATE app_config
SET value = jsonb_set(
    value,
    '{Panneaux}',
    COALESCE(value->'Panneaux', '[]'::jsonb) || '["Panneaux"]'::jsonb
)
WHERE key = 'category_group_mapping'
  AND (value->'Panneaux' IS NULL OR NOT (value->'Panneaux') @> '"Panneaux"'::jsonb);

-- 4. Scan ai_prompt_* values for the old label and replace
UPDATE app_config
SET value = to_jsonb(
    replace(value #>> '{}', 'Façades et panneaux apparents', 'Façades')
)
WHERE key LIKE 'ai_prompt_%'
  AND value #>> '{}' LIKE '%Façades et panneaux apparents%';
