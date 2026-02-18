-- Remplacer expected_start_date/expected_end_date par delivery_month
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_month TEXT;
