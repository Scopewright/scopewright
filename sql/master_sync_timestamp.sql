-- master_sync_timestamp.sql
-- Adds master_context_synced_at key to app_config for tracking doc freshness

INSERT INTO app_config (key, value)
VALUES ('master_context_synced_at', to_jsonb(''::text))
ON CONFLICT (key) DO NOTHING;
