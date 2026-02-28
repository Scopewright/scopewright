-- Cascade locked: allow manual override of cascade children
-- When true, executeCascade() skips this row (no update, no delete, no duplicate).
ALTER TABLE room_items
  ADD COLUMN IF NOT EXISTS cascade_locked BOOLEAN DEFAULT false;

COMMENT ON COLUMN room_items.cascade_locked IS
  'true = enfant cascade modifié manuellement, ignoré par executeCascade(). Réversible via bouton ↩.';
