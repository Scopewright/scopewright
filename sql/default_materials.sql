-- Ajouter la colonne default_materials à la table submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS default_materials JSONB DEFAULT '{}';

-- Structure: { "Bois": [{"material": "Merisier", "scope": "Cuisine"}], "Quincaillerie": [...] }
-- scope vide = toutes les pièces
