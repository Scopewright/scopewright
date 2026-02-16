-- Ajouter la colonne expense_category aux composantes fournisseur
-- Exécuter dans Supabase SQL Editor

ALTER TABLE catalogue_item_components ADD COLUMN IF NOT EXISTS expense_category TEXT;
