-- Ajouter les colonnes crop à item_media pour supporter le crop d'images
-- À exécuter dans Supabase SQL Editor

ALTER TABLE item_media ADD COLUMN IF NOT EXISTS original_url TEXT;
ALTER TABLE item_media ADD COLUMN IF NOT EXISTS crop_ratio TEXT;
ALTER TABLE item_media ADD COLUMN IF NOT EXISTS crop_data JSONB;
