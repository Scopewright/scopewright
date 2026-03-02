-- Migration: Ajouter cascade_suppressed sur room_items
-- À exécuter dans Supabase SQL Editor
--
-- Quand un utilisateur supprime manuellement un enfant cascade,
-- l'ID catalogue de l'enfant est ajouté ici pour empêcher la regénération.
-- Vidé automatiquement quand l'article parent change.

ALTER TABLE room_items
ADD COLUMN IF NOT EXISTS cascade_suppressed JSONB DEFAULT NULL;

COMMENT ON COLUMN room_items.cascade_suppressed IS
    'Array of catalogue item IDs suppressed by user deletion. Prevents cascade regeneration.';
