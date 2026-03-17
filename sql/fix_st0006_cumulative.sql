-- Fix ST-0006 labor_modifiers: add "cumulative": true
-- Volume modifiers (0-4) and partition modifier (5) are independent axes
-- Without cumulative, first-match mode means the partition modifier is never reached
UPDATE catalogue_items
SET labor_modifiers = jsonb_set(
    labor_modifiers,
    '{cumulative}',
    'true'::jsonb
)
WHERE id = 'ST-0006';
