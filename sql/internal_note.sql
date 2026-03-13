-- #161 — Internal note per line (parent items only, never shown to client)
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS internal_note TEXT;
