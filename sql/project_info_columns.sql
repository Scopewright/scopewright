-- Migration: Ajouter les colonnes info projet (adresse détaillée + lien client)
-- À exécuter dans Supabase SQL Editor

-- Colonnes adresse détaillée
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_address TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_city TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_postal_code TEXT;

-- Lien vers contact/entreprise client
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Migrer l'ancien champ client_address vers project_address si données existantes
UPDATE projects
SET project_address = client_address
WHERE client_address IS NOT NULL
  AND client_address != ''
  AND project_address IS NULL;
