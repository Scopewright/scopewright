-- Adresses multiples (JSONB array) sur contacts et companies
-- + Lien client du projet (FK optionnelles)
-- À exécuter dans Supabase SQL Editor

-- 1. Adresses multiples JSONB sur contacts et companies
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb;

-- 2. Lien client du projet (FK optionnelles vers contacts ou companies)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 3. Migration optionnelle : ancien champ address texte → nouveau JSONB addresses[0]
UPDATE contacts SET addresses = jsonb_build_array(
    jsonb_build_object('label', 'Principale', 'line1', address, 'line2', '', 'city', '', 'postal_code', '', 'is_primary', true)
) WHERE address IS NOT NULL AND address != '' AND (addresses IS NULL OR addresses = '[]'::jsonb);

UPDATE companies SET addresses = jsonb_build_array(
    jsonb_build_object('label', 'Principale', 'line1', address, 'line2', '', 'city', '', 'postal_code', '', 'is_primary', true)
) WHERE address IS NOT NULL AND address != '' AND (addresses IS NULL OR addresses = '[]'::jsonb);
