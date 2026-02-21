-- Phase 3: Moteur de règles cascade
-- Lien parent → enfant pour les articles auto-générés par cascade
ALTER TABLE room_items
  ADD COLUMN IF NOT EXISTS parent_item_id UUID DEFAULT NULL;

COMMENT ON COLUMN room_items.parent_item_id IS
  'UUID du room_item parent qui a déclenché cette ligne par cascade. NULL = ligne manuelle.';
