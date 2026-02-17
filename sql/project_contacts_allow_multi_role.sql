-- Migration: Permettre le même contact avec plusieurs rôles
-- À exécuter dans Supabase SQL Editor

-- Trouver et supprimer l'ancienne contrainte unique sur (project_id, contact_id)
-- Le nom exact peut varier, on les supprime toutes sauf la PK
DO $$
DECLARE
    cname TEXT;
BEGIN
    FOR cname IN
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'project_contacts'
        AND constraint_type = 'UNIQUE'
    LOOP
        EXECUTE 'ALTER TABLE project_contacts DROP CONSTRAINT ' || cname;
        RAISE NOTICE 'Dropped constraint: %', cname;
    END LOOP;
END $$;

-- Ajouter la nouvelle contrainte unique sur (project_id, contact_id, role)
ALTER TABLE project_contacts
ADD CONSTRAINT project_contacts_project_contact_role_unique
UNIQUE (project_id, contact_id, role);
