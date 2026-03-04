-- Add annotated_url column to room_media
-- Stores the URL of the rasterized image with annotation tags burned in
-- Used by AI reference images to show tags visually to Claude Vision
ALTER TABLE room_media ADD COLUMN IF NOT EXISTS annotated_url TEXT;
