-- Fix #184: Ajouter "Façades" → ["Façades"] dans category_group_mapping
-- La catégorie catalogue "Façades" n'était pas mappée au groupe DM "Façades",
-- ce qui causait la résolution cascade à proposer des panneaux au lieu de façades.

UPDATE app_config
SET value = value || '{"Façades": ["Façades"]}'::jsonb
WHERE key = 'category_group_mapping'
  AND NOT (value ? 'Façades');
