-- Migration: Add per-essence factors to coupe_types (#219)
-- NON-DESTRUCTIVE — enriches existing entries without overwriting labels/facteurs
-- Run in Supabase SQL Editor

-- Add facteur_defaut (copy of facteur) and facteurs ({}) on existing entries
-- Preserves all existing code, label, facteur, notes values
UPDATE app_config
SET value = (
  SELECT jsonb_agg(
    elem
    || CASE WHEN elem->>'facteur_defaut' IS NULL
         THEN jsonb_build_object('facteur_defaut', (elem->>'facteur')::numeric)
         ELSE '{}'::jsonb END
    || CASE WHEN elem->'facteurs' IS NULL
         THEN jsonb_build_object('facteurs', '{}'::jsonb)
         ELSE '{}'::jsonb END
  )
  FROM jsonb_array_elements(value) elem
)
WHERE key = 'coupe_types'
  AND value IS NOT NULL
  AND jsonb_typeof(value) = 'array';
