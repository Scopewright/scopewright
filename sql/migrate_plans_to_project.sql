-- Feature #197 — Migrate submission_plans from submission-level to project-level
-- Plans belong to projects, not individual submissions.

-- 1. Add project_id column (nullable first for migration)
ALTER TABLE submission_plans ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- 2. Populate project_id from submissions.project_id (no data loss)
UPDATE submission_plans sp
SET project_id = s.project_id
FROM submissions s
WHERE s.id = sp.submission_id;

-- 3. Make project_id NOT NULL now that all rows are populated
ALTER TABLE submission_plans ALTER COLUMN project_id SET NOT NULL;

-- 4. Drop the old submission_id column
ALTER TABLE submission_plans DROP COLUMN IF EXISTS submission_id;

-- 5. Recreate RPC get_next_plan_version to use project_id
CREATE OR REPLACE FUNCTION get_next_plan_version(p_project_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(MAX(version_number), 0) + 1
  FROM submission_plans
  WHERE project_id = p_project_id;
$$;
