-- Migration: Phase 2 — Purge remaining "Façades et panneaux apparents" from DB data
-- Targets: catalogue_items.presentation_rule, presentation_rule_human,
--          app_config expense_categories presentation_rule, ai_prompt_* overrides
-- Run in Supabase SQL Editor after fix_facades_label.sql (Phase 1)

-- ══════════════════════════════════════════════════════════════════════
-- 1. catalogue_items.presentation_rule — replace label in JSONB sections
-- ══════════════════════════════════════════════════════════════════════

-- Diagnostic (run first to see affected rows):
-- SELECT id, description, presentation_rule
-- FROM catalogue_items
-- WHERE presentation_rule::text LIKE '%Façades et panneaux apparents%';

UPDATE catalogue_items
SET presentation_rule = replace(presentation_rule::text, 'Façades et panneaux apparents', 'Façades')::jsonb
WHERE presentation_rule::text LIKE '%Façades et panneaux apparents%';

-- Also catch case variations
UPDATE catalogue_items
SET presentation_rule = replace(presentation_rule::text, 'Facades et panneaux apparents', 'Façades')::jsonb
WHERE presentation_rule::text LIKE '%Facades et panneaux apparents%';

-- ══════════════════════════════════════════════════════════════════════
-- 2. catalogue_items.presentation_rule_human — replace in text field
-- ══════════════════════════════════════════════════════════════════════

UPDATE catalogue_items
SET presentation_rule_human = replace(presentation_rule_human, 'Façades et panneaux apparents', 'Façades')
WHERE presentation_rule_human LIKE '%Façades et panneaux apparents%';

UPDATE catalogue_items
SET presentation_rule_human = replace(presentation_rule_human, 'Facades et panneaux apparents', 'Façades')
WHERE presentation_rule_human LIKE '%Facades et panneaux apparents%';

-- ══════════════════════════════════════════════════════════════════════
-- 3. app_config expense_categories — presentation_rule in JSONB array
-- ══════════════════════════════════════════════════════════════════════

-- Diagnostic:
-- SELECT key, value::text
-- FROM app_config
-- WHERE key = 'expense_categories'
--   AND value::text LIKE '%Façades et panneaux apparents%';

UPDATE app_config
SET value = replace(value::text, 'Façades et panneaux apparents', 'Façades')::jsonb
WHERE key = 'expense_categories'
  AND value::text LIKE '%Façades et panneaux apparents%';

-- ══════════════════════════════════════════════════════════════════════
-- 4. app_config ai_prompt_* — replace in prompt text overrides
-- ══════════════════════════════════════════════════════════════════════

-- Diagnostic:
-- SELECT key, left(value #>> '{}', 200)
-- FROM app_config
-- WHERE key LIKE 'ai_prompt_%'
--   AND value::text LIKE '%Façades et panneaux apparents%';

UPDATE app_config
SET value = to_jsonb(replace(value #>> '{}', 'Façades et panneaux apparents', 'Façades'))
WHERE key LIKE 'ai_prompt_%'
  AND value::text LIKE '%Façades et panneaux apparents%';

-- Also catch "facades et panneaux" (no accents)
UPDATE app_config
SET value = to_jsonb(replace(value #>> '{}', 'Facades et panneaux apparents', 'Façades'))
WHERE key LIKE 'ai_prompt_%'
  AND value::text LIKE '%Facades et panneaux apparents%';

-- ══════════════════════════════════════════════════════════════════════
-- 5. project_rooms.client_description — existing room descriptions in submissions
-- ══════════════════════════════════════════════════════════════════════

-- Diagnostic:
-- SELECT id, name, left(client_description, 100)
-- FROM project_rooms
-- WHERE client_description LIKE '%Façades et panneaux apparents%'
--    OR client_description LIKE '%Facades et panneaux apparents%';

UPDATE project_rooms
SET client_description = replace(client_description, 'Façades et panneaux apparents', 'Façades')
WHERE client_description LIKE '%Façades et panneaux apparents%';

UPDATE project_rooms
SET client_description = replace(client_description, 'Facades et panneaux apparents', 'Façades')
WHERE client_description LIKE '%Facades et panneaux apparents%';

-- Also fix EN descriptions
UPDATE project_rooms
SET client_description_en = replace(client_description_en, 'Façades et panneaux apparents', 'Façades')
WHERE client_description_en LIKE '%Façades et panneaux apparents%';

UPDATE project_rooms
SET client_description_en = replace(client_description_en, 'Facades et panneaux apparents', 'Façades')
WHERE client_description_en LIKE '%Facades et panneaux apparents%';

-- ══════════════════════════════════════════════════════════════════════
-- 6. Verify — run after migration to confirm zero remaining
-- ══════════════════════════════════════════════════════════════════════

-- SELECT 'catalogue_items.presentation_rule' AS source, count(*)
-- FROM catalogue_items WHERE presentation_rule::text LIKE '%panneaux apparents%'
-- UNION ALL
-- SELECT 'catalogue_items.presentation_rule_human', count(*)
-- FROM catalogue_items WHERE presentation_rule_human LIKE '%panneaux apparents%'
-- UNION ALL
-- SELECT 'app_config.expense_categories', count(*)
-- FROM app_config WHERE key = 'expense_categories' AND value::text LIKE '%panneaux apparents%'
-- UNION ALL
-- SELECT 'app_config.ai_prompt_*', count(*)
-- FROM app_config WHERE key LIKE 'ai_prompt_%' AND value::text LIKE '%panneaux apparents%'
-- UNION ALL
-- SELECT 'project_rooms.client_description', count(*)
-- FROM project_rooms WHERE client_description LIKE '%panneaux apparents%'
-- UNION ALL
-- SELECT 'project_rooms.client_description_en', count(*)
-- FROM project_rooms WHERE client_description_en LIKE '%panneaux apparents%';
