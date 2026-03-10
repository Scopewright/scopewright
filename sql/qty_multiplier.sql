-- #140 — QTY multiplicateur universel par ligne article
-- Ajoute un champ qty_multiplier sur room_items.
-- Le total de la ligne = unit_price × quantity × qty_multiplier.
-- Default 1 (pas de multiplication).

ALTER TABLE room_items ADD COLUMN IF NOT EXISTS qty_multiplier NUMERIC DEFAULT 1;
