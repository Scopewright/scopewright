-- Migration: Élargir la politique anon_read_branding pour inclure les clés de présentation
-- À exécuter dans Supabase SQL Editor
--
-- AVANT: anon ne peut lire que 9 clés (cover_image + intro_*)
-- APRÈS: anon peut lire toutes les clés nécessaires à quote.html public
--        (intro, why, project_steps, traductions EN)

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
    'presentation_intro_text_1_en',
    'presentation_intro_text_2_en',
    'presentation_intro_text_3_en',
    'presentation_intro_atelier',
    'presentation_intro_bureau',
    'presentation_intro_phone',
    'presentation_intro_url',
    'why_title',
    'why_text',
    'why_image_url',
    'project_steps'
));
