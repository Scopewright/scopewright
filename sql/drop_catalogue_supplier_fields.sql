-- Retrait des champs fournisseur principal sur catalogue_items
-- Ces champs sont redondants avec les composantes fournisseur (catalogue_item_components)
-- qui ont déjà expense_category, markup%, waste%

ALTER TABLE catalogue_items DROP COLUMN IF EXISTS supplier_name;
ALTER TABLE catalogue_items DROP COLUMN IF EXISTS supplier_sku;
ALTER TABLE catalogue_items DROP COLUMN IF EXISTS supplier_cost;
ALTER TABLE catalogue_items DROP COLUMN IF EXISTS supplier_id;
