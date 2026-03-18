-- Backfill item_type for FAB articles missing it
-- Only marks as fabrication if the article has REAL cascade rules
-- (non-empty cascade array in calculation_rule_ai)
-- Idempotent — only updates NULL values

UPDATE catalogue_items
SET item_type = 'fabrication'
WHERE item_type IS NULL
  AND calculation_rule_ai IS NOT NULL
  AND calculation_rule_ai ? 'cascade'
  AND jsonb_typeof(calculation_rule_ai->'cascade') = 'array'
  AND jsonb_array_length(calculation_rule_ai->'cascade') > 0;

-- Set remaining NULL item_type to 'materiau' (default)
UPDATE catalogue_items
SET item_type = 'materiau'
WHERE item_type IS NULL;
