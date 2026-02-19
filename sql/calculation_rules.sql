-- Ajout des colonnes de règles de calcul sur catalogue_items
-- Champ 1 : texte humain (documentation lisible)
-- Champ 2 : JSON structuré pour l'assistant AI

ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS calculation_rule_human TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS calculation_rule_ai JSONB;
