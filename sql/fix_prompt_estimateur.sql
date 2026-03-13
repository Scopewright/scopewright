-- #174 — Restore ai_prompt_estimateur corrupted by double JSON.stringify
-- Delete the corrupted value so the hardcoded DEFAULT_STATIC_PROMPT in ai-assistant/index.ts takes over
DELETE FROM app_config WHERE key = 'ai_prompt_estimateur';
