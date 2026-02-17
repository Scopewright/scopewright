-- Ajouter champs adresse projet + table project_contacts
-- À exécuter dans Supabase SQL Editor

-- Champs adresse projet (distincts de client_address)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_city TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_postal_code TEXT;

-- Table de liaison projet ↔ contacts CRM
CREATE TABLE IF NOT EXISTS project_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Client',
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_contact ON project_contacts(contact_id);

-- RLS (même pattern que les autres tables enfants de projects)
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON project_contacts FOR SELECT
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "insert_own" ON project_contacts FOR INSERT
    WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "update_own" ON project_contacts FOR UPDATE
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "delete_own" ON project_contacts FOR DELETE
    USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
