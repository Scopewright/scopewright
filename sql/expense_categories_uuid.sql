-- Migration: Add UUID to each expense_categories entry
-- Run in Supabase SQL Editor
-- Adds a stable "id" field (UUID) to each entry in the JSONB array
-- Backward compatible — existing code reads .name, .markup, .waste

UPDATE app_config
SET value = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'id' IS NOT NULL THEN elem  -- already has id, keep it
      ELSE jsonb_build_object('id', gen_random_uuid()::text) || elem  -- prepend id
    END
  )
  FROM jsonb_array_elements(value) elem
)
WHERE key = 'expense_categories';
