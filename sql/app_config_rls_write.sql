-- Migration: Restreindre l'écriture sur app_config aux Admin seulement
-- À exécuter dans Supabase SQL Editor
--
-- AVANT: "auth_write" FOR ALL TO authenticated → tout utilisateur authentifié peut écrire
-- APRÈS: seuls les utilisateurs avec le rôle 'Admin' dans user_roles peuvent INSERT/UPDATE/DELETE

-- 1. Supprimer la politique permissive existante
DROP POLICY IF EXISTS "auth_write" ON app_config;

-- 2. Fonction helper SECURITY DEFINER (bypasse RLS pour lire user_roles sans circularité)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_email TEXT;
    v_role TEXT;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IS NULL THEN RETURN FALSE; END IF;
    SELECT value ->> v_email INTO v_role FROM app_config WHERE key = 'user_roles';
    RETURN v_role = 'Admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Politiques d'écriture restrictives
CREATE POLICY "admin_insert" ON app_config FOR INSERT TO authenticated
    WITH CHECK (is_admin());

CREATE POLICY "admin_update" ON app_config FOR UPDATE TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "admin_delete" ON app_config FOR DELETE TO authenticated
    USING (is_admin());

-- Les politiques de lecture existantes restent inchangées :
-- "auth_read" FOR SELECT TO authenticated USING (true)
-- "anon_read_branding" FOR SELECT TO anon USING (key IN ('cover_image'))
