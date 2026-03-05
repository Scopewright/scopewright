-- Migration: Add n_portes and n_tiroirs columns to room_items
-- Same pattern as n_tablettes / n_partitions — caisson variables for cascade formulas.

ALTER TABLE room_items ADD COLUMN IF NOT EXISTS n_portes INTEGER DEFAULT 0;
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS n_tiroirs INTEGER DEFAULT 0;
