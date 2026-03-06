-- Add dims_config and ask to ST-0050 (Chêne blanc brut au PMP)
-- Enables dimensional inputs L×H×P for barèmes evaluation

UPDATE catalogue_items
SET dims_config = '{"l": true, "h": true, "p": true}'::jsonb,
    calculation_rule_ai = COALESCE(calculation_rule_ai, '{}'::jsonb) || '{"ask": ["L", "H", "P"]}'::jsonb
WHERE id = 'ST-0050';
