-- Texte présentation client sur les articles du catalogue
-- Fragment de phrase standardisé pour assembler les descriptions client

ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS client_text TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS client_text_en TEXT;

-- Règles de présentation (séparées des règles de calcul)
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS presentation_rule_human TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS presentation_rule JSONB;
