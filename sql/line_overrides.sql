-- Migration: Per-line overrides for labor, materials, and sale price
-- Overrides are per-submission-line, not per-catalogue-item.
-- Run in Supabase SQL Editor.

ALTER TABLE room_items
ADD COLUMN IF NOT EXISTS labor_override JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS material_override JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_override NUMERIC DEFAULT NULL;

COMMENT ON COLUMN room_items.labor_override IS 'Per-line override of labor_minutes (JSONB {department: minutes}). NULL = use catalogue values.';
COMMENT ON COLUMN room_items.material_override IS 'Per-line override of material_costs (JSONB {expense_cat: cost}). NULL = use catalogue values.';
COMMENT ON COLUMN room_items.price_override IS 'Per-line sale price override (NUMERIC). NULL = use computed price. Bypasses composed price entirely.';
