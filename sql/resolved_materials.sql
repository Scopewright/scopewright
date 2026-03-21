-- Migration: Add resolved_materials to room_items
-- Run in Supabase SQL Editor
-- Stores the resolved catalogue_item_id for each expense category on FAB items.
-- Populated by shared/resolve-materials.js, read by executeCascade.

ALTER TABLE room_items ADD COLUMN IF NOT EXISTS resolved_materials JSONB DEFAULT '{}';
