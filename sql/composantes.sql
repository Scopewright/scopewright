-- #209 Phase 1A — Table Composantes
-- Regroupement nommé de propriétés définissant un élément constructif.
-- Code COMP-XXX auto-généré par trigger (modèle: trg_catalogue_auto_code).

-- Séquence auto-code COMP-XXX
CREATE SEQUENCE IF NOT EXISTS composante_code_seq;

-- Fonction trigger (modèle : generate_catalogue_code)
CREATE OR REPLACE FUNCTION generate_composante_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'COMP-' || LPAD(nextval('composante_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table
CREATE TABLE IF NOT EXISTS composantes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT NOT NULL UNIQUE,
  nom                       TEXT NOT NULL,
  dm_type                   TEXT NOT NULL,

  -- Matériau principal (dual storage)
  materiau_client_text      TEXT,
  materiau_catalogue_id     TEXT REFERENCES catalogue_items(id) ON DELETE SET NULL,

  -- Champs enrichis
  style                     TEXT,
  coupe                     TEXT,

  -- Composantes cascade (dual storage)
  bande_chant_client_text   TEXT,
  bande_chant_catalogue_id  TEXT REFERENCES catalogue_items(id) ON DELETE SET NULL,

  finition_client_text      TEXT,
  finition_catalogue_id     TEXT REFERENCES catalogue_items(id) ON DELETE SET NULL,

  bois_brut_client_text     TEXT,
  bois_brut_catalogue_id    TEXT REFERENCES catalogue_items(id) ON DELETE SET NULL,

  notes                     TEXT,
  is_active                 BOOLEAN DEFAULT true,
  usage_count               INTEGER DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  created_by                UUID REFERENCES auth.users(id)
);

-- Trigger auto-code
CREATE TRIGGER trg_composante_auto_code
  BEFORE INSERT ON composantes
  FOR EACH ROW EXECUTE FUNCTION generate_composante_code();

-- Index
CREATE INDEX IF NOT EXISTS idx_composantes_dm_type ON composantes(dm_type);
CREATE INDEX IF NOT EXISTS idx_composantes_nom ON composantes(nom);

-- RLS (cohérent avec catalogue_items : tous authentifiés, full CRUD)
ALTER TABLE composantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY composantes_authenticated ON composantes
  FOR ALL USING (auth.role() = 'authenticated');

-- Champ sur room_items (optionnel, nullable, sans impact cascade)
ALTER TABLE room_items
  ADD COLUMN IF NOT EXISTS composante_id UUID REFERENCES composantes(id) ON DELETE SET NULL;
