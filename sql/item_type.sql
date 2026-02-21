-- Ajout de la classification fabrication/matériau sur catalogue_items
-- NULL par défaut pour compatibilité ascendante
ALTER TABLE catalogue_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT NULL
  CHECK (item_type IN ('fabrication', 'materiau'));

COMMENT ON COLUMN catalogue_items.item_type IS 'Classification: fabrication (ce qu''on fabrique) ou materiau (ce qu''on utilise)';
