-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Ajout de org_name dans app_config (pour PDF export filename)
-- Exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO app_config (key, value)
VALUES ('org_name', '"Stele"'::jsonb)
ON CONFLICT (key) DO NOTHING;
