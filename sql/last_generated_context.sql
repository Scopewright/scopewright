-- Migration: Add last_generated_context to project_rooms
-- Stores snapshot of DM + items at the time of AI description generation
-- Used by #133 to compute diff for subsequent regenerations

ALTER TABLE project_rooms
ADD COLUMN IF NOT EXISTS last_generated_context JSONB;

-- Structure: { dms: [{type, client_text}], items: [{code, client_text, qty, tag}], timestamp }
COMMENT ON COLUMN project_rooms.last_generated_context IS 'Snapshot of DM + items at last AI description generation';
