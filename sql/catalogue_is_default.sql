-- Flag "par défaut" sur les articles du catalogue
-- Les articles par défaut sont les go-to de l'atelier, suggérés en priorité par l'AI

ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
