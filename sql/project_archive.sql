-- Migration: Add is_archived to projects (#221)
-- Run in Supabase SQL Editor

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
