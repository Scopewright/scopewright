-- Migration: Pipeline commercial — colonnes projects
-- A executer dans Supabase SQL Editor

-- Statut pipeline (configurable via app_config pipeline_statuses)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'a_contacter';

-- Source et type
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT;

-- Financier
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_amount NUMERIC;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 0;

-- Assignation
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Priorite
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Dates
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS internal_deadline DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_deadline DATE;

-- Index pour les requetes pipeline
CREATE INDEX IF NOT EXISTS idx_projects_pipeline_status ON projects(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);

-- Initialiser les projets ayant des soumissions acceptees
UPDATE projects p SET pipeline_status = 'vendu'
WHERE EXISTS (SELECT 1 FROM submissions s WHERE s.project_id = p.id AND s.status = 'accepted')
  AND (p.pipeline_status IS NULL OR p.pipeline_status = 'a_contacter');
