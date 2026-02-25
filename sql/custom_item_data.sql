-- Add JSONB column for custom item metadata (supplier, notes, attachments)
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS custom_data JSONB;
