-- Migration: Add labor_modifiers system
-- Barèmes automatiques par palier dimensionnel — section séparée de calculation_rule_ai.

-- Catalogue items: JSON barème + human explanation
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS labor_modifiers JSONB;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS labor_modifiers_human TEXT;

-- Room items: auto-computed modifier result (persisted for quote.html compatibility)
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS labor_auto_modifier JSONB;
