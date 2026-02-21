-- Ajout des dimensions L/H/P sur room_items (Phase 2 Fabrication/Matériau)
-- NULL par défaut pour compatibilité ascendante
ALTER TABLE room_items
  ADD COLUMN IF NOT EXISTS length_in NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height_in NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS depth_in NUMERIC DEFAULT NULL;

COMMENT ON COLUMN room_items.length_in IS 'Largeur en pouces (L)';
COMMENT ON COLUMN room_items.height_in IS 'Hauteur en pouces (H)';
COMMENT ON COLUMN room_items.depth_in IS 'Profondeur en pouces (P)';
