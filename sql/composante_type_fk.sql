-- Migration: Add composante_type_id to catalogue_items (#224 Phase B)
-- Run in Supabase SQL Editor AFTER composante_types.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalogue_items' AND column_name = 'composante_type_id'
  ) THEN
    ALTER TABLE catalogue_items
      ADD COLUMN composante_type_id UUID REFERENCES composante_types(id) ON DELETE SET NULL;
  END IF;
END $$;
