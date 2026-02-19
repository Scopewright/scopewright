-- Ajout des champs fournisseur principal sur catalogue_items
-- Le fournisseur parent est l'article lui-même (ex: "Charnière 110° complète")
-- Les composantes fournisseur (table catalogue_item_components) restent pour les sous-composantes

ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS supplier_sku TEXT;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC;
ALTER TABLE catalogue_items ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES companies(id);
