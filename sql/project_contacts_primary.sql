-- is_primary: contact principal par rôle dans un projet
ALTER TABLE project_contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
