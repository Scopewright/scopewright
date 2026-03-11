-- Migration: Add master agent keys to app_config
-- Keys for Agent Maître document sync + prompt override
-- Note: app_config.value is JSONB — use to_jsonb(text) for strings

-- Master context document (synced from docs/MASTER_CONTEXT.md)
INSERT INTO app_config (key, value)
VALUES ('master_context', to_jsonb(''::text))
ON CONFLICT (key) DO NOTHING;

-- CLAUDE.md document (synced from CLAUDE.md)
INSERT INTO app_config (key, value)
VALUES ('master_claude_md', to_jsonb(''::text))
ON CONFLICT (key) DO NOTHING;

-- Master agent system prompt override
INSERT INTO app_config (key, value)
VALUES ('ai_prompt_master', to_jsonb(''::text))
ON CONFLICT (key) DO NOTHING;

-- Update anon_read_branding policy if needed (master keys are NOT public — admin only)
-- No changes needed to anon policy since these are internal-only keys
