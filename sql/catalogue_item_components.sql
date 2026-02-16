-- ═══════════════════════════════════════════════════════════════════════
-- Table : catalogue_item_components
-- Composantes fournisseur associées aux articles du catalogue
-- ═══════════════════════════════════════════════════════════════════════
-- Exécuter dans Supabase SQL Editor

CREATE TABLE catalogue_item_components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    catalogue_item_id UUID NOT NULL REFERENCES catalogue_items(id) ON DELETE CASCADE,
    supplier_name TEXT,
    supplier_sku TEXT,
    description TEXT,
    qty_per_unit NUMERIC DEFAULT 1,
    unit_cost NUMERIC DEFAULT 0,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

ALTER TABLE catalogue_item_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read"
    ON catalogue_item_components FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Allow authenticated write"
    ON catalogue_item_components FOR ALL
    TO authenticated USING (true) WITH CHECK (true);
