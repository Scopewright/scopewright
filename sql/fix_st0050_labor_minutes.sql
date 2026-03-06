-- Fix ST-0050 (Chêne blanc brut au PMP):
-- 1. Add "Machinage": 0 to labor_minutes so barème factors have a base value
-- 2. Clean calculation_rule_ai — remove labor_modifiers that ended up there by mistake

-- Add Machinage: 0 to labor_minutes (preserve existing keys)
UPDATE catalogue_items
SET labor_minutes = COALESCE(labor_minutes, '{}'::jsonb) || '{"Machinage": 0}'::jsonb
WHERE id = 'ST-0050';

-- Remove labor_modifiers from calculation_rule_ai (keep ask, formula, notes, cascade)
UPDATE catalogue_items
SET calculation_rule_ai = calculation_rule_ai - 'labor_modifiers'
WHERE id = 'ST-0050'
  AND calculation_rule_ai ? 'labor_modifiers';
