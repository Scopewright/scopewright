-- Migration: Image de couverture soumission
-- À exécuter dans Supabase SQL Editor

-- Ajouter la clé cover_image dans app_config (URL publique de l'image)
INSERT INTO app_config (key, value)
VALUES ('cover_image', '"https://rplzbtjfnwahqodrhpny.supabase.co/storage/v1/object/public/assets/cover_image.jpg"')
ON CONFLICT (key) DO NOTHING;

-- Permettre la lecture anonyme de la clé cover_image (pour quote.html public)
CREATE POLICY "anon_read_branding" ON app_config
FOR SELECT TO anon
USING (key IN ('cover_image'));
