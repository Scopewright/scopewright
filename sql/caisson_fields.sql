-- Caisson-specific fields: shelves and partitions
-- Used in cascade formulas as n_tablettes and n_partitions variables
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS n_tablettes INTEGER DEFAULT 0;
ALTER TABLE room_items ADD COLUMN IF NOT EXISTS n_partitions INTEGER DEFAULT 0;

COMMENT ON COLUMN room_items.n_tablettes IS 'Nombre de tablettes (caissons). Utilisé comme variable n_tablettes dans les formules cascade.';
COMMENT ON COLUMN room_items.n_partitions IS 'Nombre de partitions (caissons). Utilisé comme variable n_partitions dans les formules cascade.';
