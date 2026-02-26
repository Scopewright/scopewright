-- loss_override_pct: per-item waste override (%), replaces category-level waste when set
-- If NULL → uses expense_category.waste (default behavior)
-- If set → overrides ALL material cost categories for this item
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS loss_override_pct NUMERIC;
