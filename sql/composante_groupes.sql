-- #217 — Groupes de composantes
-- Table de liaison groupe → composantes membres

CREATE TABLE IF NOT EXISTS composante_groupe_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groupe_id     UUID NOT NULL REFERENCES composantes(id) ON DELETE CASCADE,
  composante_id UUID NOT NULL REFERENCES composantes(id) ON DELETE CASCADE,
  ordre         INTEGER DEFAULT 0,
  UNIQUE(groupe_id, composante_id)
);

CREATE INDEX IF NOT EXISTS idx_cgi_groupe ON composante_groupe_items(groupe_id);

-- RLS (idempotent)
ALTER TABLE composante_groupe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cgi_authenticated ON composante_groupe_items;
CREATE POLICY cgi_authenticated ON composante_groupe_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Modifier le trigger pour générer GRP-XXX quand dm_type = 'Groupe'
CREATE OR REPLACE FUNCTION generate_composante_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    IF NEW.dm_type = 'Groupe' THEN
      NEW.code := 'GRP-' || LPAD(nextval('composante_code_seq')::TEXT, 3, '0');
    ELSE
      NEW.code := 'COMP-' || LPAD(nextval('composante_code_seq')::TEXT, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
