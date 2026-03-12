-- master_prompt_changelog.sql
-- Adds prompt_change_log key to app_config for tracking AI prompt modifications

INSERT INTO app_config (key, value)
VALUES ('prompt_change_log', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
