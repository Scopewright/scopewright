-- Configuration des dimensions applicables par article fabrication
-- NULL par défaut = toutes les dimensions affichées (L, H, P)
ALTER TABLE catalogue_items
  ADD COLUMN IF NOT EXISTS dims_config JSONB DEFAULT NULL;

COMMENT ON COLUMN catalogue_items.dims_config IS 'Dimensions pertinentes pour fabrication: {"l":true,"h":true,"p":true}';
