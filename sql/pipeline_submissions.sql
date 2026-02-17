-- Migration: Pipeline commercial — colonnes submissions (assignation + deadlines)
-- A executer dans Supabase SQL Editor

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS estimateur TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS vendeur_cp TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS approbateur TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS internal_deadline DATE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS client_deadline DATE;
