-- Migration: Élargir la politique anon_read_branding pour inclure les clés de présentation
-- À exécuter dans Supabase SQL Editor
--
-- AVANT: anon ne peut lire que 'cover_image'
-- APRÈS: anon peut lire cover_image + toutes les clés intro/présentation (pour quote.html public)

-- 1. Supprimer l'ancienne politique restrictive
DROP POLICY IF EXISTS "anon_read_branding" ON app_config;

-- 2. Recréer avec toutes les clés nécessaires à quote.html
CREATE POLICY "anon_read_branding" ON app_config
FOR SELECT TO anon
USING (key IN (
    'cover_image',
    'intro_image',
    'presentation_intro_text_1',
    'presentation_intro_text_2',
    'presentation_intro_text_3',
    'presentation_intro_atelier',
    'presentation_intro_bureau',
    'presentation_intro_phone',
    'presentation_intro_url'
));
