-- =====================================================================================
-- Migration : Ajouter default_materials par pièce (room-level)
-- Permet à chaque pièce d'avoir ses propres matériaux par défaut,
-- avec fallback vers les matériaux par défaut de la soumission.
-- =====================================================================================

ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS default_materials JSONB DEFAULT '[]';

-- Vérification :
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'project_rooms' AND column_name = 'default_materials';
