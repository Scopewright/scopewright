-- Séquence pour les codes projet
CREATE SEQUENCE IF NOT EXISTS project_code_seq START WITH 1;

-- Trigger : auto-générer project_code et recalculer name sur INSERT
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    seq_num INTEGER;
BEGIN
    -- Lire le préfixe depuis app_config (défaut: 'EP')
    SELECT (value #>> '{}')::TEXT INTO prefix FROM app_config WHERE key = 'project_code_prefix';
    IF prefix IS NULL THEN prefix := 'EP'; END IF;

    -- Générer le code séquentiel
    seq_num := nextval('project_code_seq');
    NEW.project_code := prefix || LPAD(seq_num::TEXT, 3, '0');

    -- Construire le nom = CODE + VILLE (si présente)
    IF NEW.project_city IS NOT NULL AND NEW.project_city != '' THEN
        NEW.name := NEW.project_code || ' ' || NEW.project_city;
    ELSE
        NEW.name := NEW.project_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_auto_code ON projects;
CREATE TRIGGER trg_project_auto_code
    BEFORE INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION generate_project_code();

-- Trigger : recalculer name quand project_city change
CREATE OR REPLACE FUNCTION update_project_name_on_city()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.project_city IS DISTINCT FROM OLD.project_city THEN
        -- Ne recalculer que si project_code existe (projets auto-générés)
        IF NEW.project_code IS NOT NULL AND NEW.project_code != '' THEN
            IF NEW.project_city IS NOT NULL AND NEW.project_city != '' THEN
                NEW.name := NEW.project_code || ' ' || NEW.project_city;
            ELSE
                NEW.name := NEW.project_code;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_name_on_city ON projects;
CREATE TRIGGER trg_project_name_on_city
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_project_name_on_city();

-- Initialiser le préfixe dans app_config
INSERT INTO app_config (key, value) VALUES ('project_code_prefix', '"EP"')
ON CONFLICT (key) DO NOTHING;

-- Avancer la séquence pour ne pas conflicuter avec les codes existants
SELECT setval('project_code_seq', GREATEST(
    (SELECT COUNT(*) FROM projects),
    1
));

-- Backfill : assigner un code aux projets existants qui n'en ont pas
DO $$
DECLARE
    prefix TEXT;
    proj RECORD;
    seq_num INTEGER;
BEGIN
    SELECT (value #>> '{}')::TEXT INTO prefix FROM app_config WHERE key = 'project_code_prefix';
    IF prefix IS NULL THEN prefix := 'EP'; END IF;

    FOR proj IN SELECT id, project_city FROM projects WHERE project_code IS NULL OR project_code = '' ORDER BY created_at LOOP
        seq_num := nextval('project_code_seq');
        UPDATE projects SET
            project_code = prefix || LPAD(seq_num::TEXT, 3, '0'),
            name = prefix || LPAD(seq_num::TEXT, 3, '0') || COALESCE(' ' || NULLIF(project_city, ''), '')
        WHERE id = proj.id;
    END LOOP;
END $$;
