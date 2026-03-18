-- Backfill item_type for FAB articles missing it
-- Articles with calculation_rule_ai but no item_type are fabrication items
-- Idempotent — only updates NULL values

UPDATE catalogue_items
SET item_type = 'fabrication'
WHERE item_type IS NULL
  AND calculation_rule_ai IS NOT NULL;

-- Also set remaining NULL item_type to 'materiau' (default)
UPDATE catalogue_items
SET item_type = 'materiau'
WHERE item_type IS NULL;
