-- Migration: composante_types reference table (#224 Phase A)
-- Run in Supabase SQL Editor

-- 1. Create reference table
CREATE TABLE IF NOT EXISTS composante_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Seed initial 5 types (idempotent)
INSERT INTO composante_types (code, label, sort_order) VALUES
  ('caisson',  'Caisson',  1),
  ('facades',  'Façades',  2),
  ('panneaux', 'Panneaux', 3),
  ('tiroirs',  'Tiroirs',  4),
  ('poignees', 'Poignées', 5)
ON CONFLICT (code) DO NOTHING;

-- 3. Add FK on composantes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'composantes' AND column_name = 'composante_type_id'
  ) THEN
    ALTER TABLE composantes
      ADD COLUMN composante_type_id UUID REFERENCES composante_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Backfill composante_type_id from dm_type
UPDATE composantes c
SET composante_type_id = ct.id
FROM composante_types ct
WHERE c.composante_type_id IS NULL
  AND LOWER(TRANSLATE(c.dm_type, 'àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ', 'aaaeeeeiioouucaaaeeeeiioouuc')) = ct.code;

-- Extra mappings for accent/plural variants
UPDATE composantes c
SET composante_type_id = ct.id
FROM composante_types ct
WHERE c.composante_type_id IS NULL
  AND ct.code = 'facades'
  AND LOWER(c.dm_type) IN ('façades', 'facades', 'facade', 'façade');

UPDATE composantes c
SET composante_type_id = ct.id
FROM composante_types ct
WHERE c.composante_type_id IS NULL
  AND ct.code = 'poignees'
  AND LOWER(c.dm_type) IN ('poignées', 'poignees', 'poignée', 'poignee');

-- 5. RLS policies
ALTER TABLE composante_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read composante_types" ON composante_types;
CREATE POLICY "Authenticated read composante_types" ON composante_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write composante_types" ON composante_types;
CREATE POLICY "Admin write composante_types" ON composante_types
  FOR ALL TO authenticated USING (is_admin());
