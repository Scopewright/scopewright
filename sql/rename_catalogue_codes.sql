-- =====================================================================================
-- Migration : Renommer les codes articles du catalogue
-- Format : {PREFIXE}-{NUMERO} -> ST-0001, ST-0002, ...
-- Prefixe configurable via app_config cle 'shop_code_prefix'
--
-- INSTRUCTIONS :
-- 1. Faire un backup complet de la DB dans Supabase Dashboard (Settings > Database > Backups)
-- 2. Executer ce script EN ENTIER dans le SQL Editor (tout est dans une transaction)
-- 3. Si une erreur survient, la transaction ROLLBACK automatiquement - rien n'est modifie
-- 4. Apres succes, verifier les resultats avec les requetes de validation en bas
-- =====================================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1 : BACKUP (tables de sauvegarde permanentes)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS _backup_catalogue_items;
DROP TABLE IF EXISTS _backup_room_items_codes;
DROP TABLE IF EXISTS _backup_components_codes;
DROP TABLE IF EXISTS _backup_item_media_codes;
DROP TABLE IF EXISTS _backup_fiches_vente_codes;
DROP TABLE IF EXISTS _backup_submissions_dm;
DROP TABLE IF EXISTS _backup_catalogue_rules;

CREATE TABLE _backup_catalogue_items AS SELECT * FROM catalogue_items;
CREATE TABLE _backup_room_items_codes AS SELECT id, catalogue_item_id FROM room_items WHERE catalogue_item_id IS NOT NULL;
CREATE TABLE _backup_components_codes AS SELECT id, catalogue_item_id FROM catalogue_item_components;
CREATE TABLE _backup_submissions_dm AS SELECT id, default_materials FROM submissions WHERE default_materials IS NOT NULL AND default_materials::text != '{}' AND default_materials::text != '[]';
CREATE TABLE _backup_catalogue_rules AS SELECT id, calculation_rule_ai FROM catalogue_items WHERE calculation_rule_ai IS NOT NULL;

-- Backup item_media si la table existe
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_media' AND table_schema = 'public') THEN
        EXECUTE 'CREATE TABLE _backup_item_media_codes AS SELECT id, catalogue_item_id FROM item_media';
    END IF;
END $$;

-- Backup fiches_vente si la table existe
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiches_vente' AND table_schema = 'public') THEN
        EXECUTE 'CREATE TABLE _backup_fiches_vente_codes AS SELECT id, catalogue_item_id FROM fiches_vente WHERE catalogue_item_id IS NOT NULL';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 2 : TABLE DE MAPPING (permanente, pour tracabilite)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS catalogue_code_mapping;

CREATE TABLE catalogue_code_mapping (
    old_code TEXT PRIMARY KEY,
    new_code TEXT UNIQUE NOT NULL,
    category TEXT,
    description TEXT,
    mapped_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO catalogue_code_mapping (old_code, new_code, category, description)
SELECT
    id AS old_code,
    'ST-' || LPAD(ROW_NUMBER() OVER (ORDER BY category, id)::TEXT, 4, '0') AS new_code,
    category,
    description
FROM catalogue_items
ORDER BY category, id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 3 : SUPPRIMER LES CONTRAINTES FK
-- (on les recree a la fin avec ON UPDATE CASCADE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Supprimer dynamiquement toutes les FK qui referencent catalogue_items(id)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE ccu.table_name = 'catalogue_items'
            AND ccu.column_name = 'id'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped FK: %.%', r.table_name, r.constraint_name;
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4 : RENOMMER LES CODES (PK + toutes les FK)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4a. Table principale : catalogue_items.id (PK)
UPDATE catalogue_items ci
SET id = m.new_code
FROM catalogue_code_mapping m
WHERE ci.id = m.old_code;

-- 4b. room_items.catalogue_item_id
UPDATE room_items ri
SET catalogue_item_id = m.new_code
FROM catalogue_code_mapping m
WHERE ri.catalogue_item_id = m.old_code;

-- 4c. catalogue_item_components.catalogue_item_id
UPDATE catalogue_item_components cic
SET catalogue_item_id = m.new_code
FROM catalogue_code_mapping m
WHERE cic.catalogue_item_id = m.old_code;

-- 4d. item_media.catalogue_item_id (si la table existe)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_media' AND table_schema = 'public') THEN
        EXECUTE '
            UPDATE item_media im
            SET catalogue_item_id = m.new_code
            FROM catalogue_code_mapping m
            WHERE im.catalogue_item_id = m.old_code';
    END IF;
END $$;

-- 4e. fiches_vente.catalogue_item_id (si la table existe et a cette colonne)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fiches_vente' AND column_name = 'catalogue_item_id' AND table_schema = 'public'
    ) THEN
        EXECUTE '
            UPDATE fiches_vente fv
            SET catalogue_item_id = m.new_code
            FROM catalogue_code_mapping m
            WHERE fv.catalogue_item_id = m.old_code';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5 : METTRE A JOUR LES REFERENCES JSONB
-- (cascades, contraintes, default_materials)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    rec RECORD;
    updated_count INTEGER;
BEGIN
    FOR rec IN SELECT old_code, new_code FROM catalogue_code_mapping LOOP

        -- 5a. calculation_rule_ai : cascade[].target et constraints[].item_id
        UPDATE catalogue_items
        SET calculation_rule_ai = REPLACE(
            calculation_rule_ai::text,
            '"' || rec.old_code || '"',
            '"' || rec.new_code || '"'
        )::jsonb
        WHERE calculation_rule_ai IS NOT NULL
          AND calculation_rule_ai::text LIKE '%"' || rec.old_code || '"%';

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        IF updated_count > 0 THEN
            RAISE NOTICE 'Updated % calculation_rule_ai rows for % -> %', updated_count, rec.old_code, rec.new_code;
        END IF;

        -- 5b. submissions.default_materials[].catalogue_item_id
        UPDATE submissions
        SET default_materials = REPLACE(
            default_materials::text,
            '"' || rec.old_code || '"',
            '"' || rec.new_code || '"'
        )::jsonb
        WHERE default_materials IS NOT NULL
          AND default_materials::text LIKE '%"' || rec.old_code || '"%';

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        IF updated_count > 0 THEN
            RAISE NOTICE 'Updated % default_materials rows for % -> %', updated_count, rec.old_code, rec.new_code;
        END IF;

    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5b : NETTOYER LES REFERENCES ORPHELINES
-- (room_items qui referencent des articles supprimes du catalogue)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Backup des orphelins avant nettoyage
DROP TABLE IF EXISTS _backup_orphan_room_items;
CREATE TABLE _backup_orphan_room_items AS
SELECT ri.id, ri.catalogue_item_id, ri.description, ri.room_id
FROM room_items ri
LEFT JOIN catalogue_items ci ON ri.catalogue_item_id = ci.id
WHERE ri.catalogue_item_id IS NOT NULL AND ci.id IS NULL;

-- Mettre a NULL les FK orphelines dans room_items
UPDATE room_items ri
SET catalogue_item_id = NULL
WHERE catalogue_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM catalogue_items ci WHERE ci.id = ri.catalogue_item_id);

-- Supprimer les composants orphelins
DELETE FROM catalogue_item_components cic
WHERE NOT EXISTS (SELECT 1 FROM catalogue_items ci WHERE ci.id = cic.catalogue_item_id);

-- item_media orphelins (si la table existe)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_media' AND table_schema = 'public') THEN
        EXECUTE '
            DELETE FROM item_media im
            WHERE NOT EXISTS (SELECT 1 FROM catalogue_items ci WHERE ci.id = im.catalogue_item_id)';
    END IF;
END $$;

-- fiches_vente orphelins (si la table existe)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fiches_vente' AND column_name = 'catalogue_item_id' AND table_schema = 'public'
    ) THEN
        EXECUTE '
            UPDATE fiches_vente fv
            SET catalogue_item_id = NULL
            WHERE catalogue_item_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM catalogue_items ci WHERE ci.id = fv.catalogue_item_id)';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 6 : RECREER LES FK AVEC ON UPDATE CASCADE
-- ═══════════════════════════════════════════════════════════════════════════════

-- room_items -> catalogue_items (nullable FK)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'room_items' AND column_name = 'catalogue_item_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE room_items
            ADD CONSTRAINT room_items_catalogue_item_id_fkey
            FOREIGN KEY (catalogue_item_id) REFERENCES catalogue_items(id)
            ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- catalogue_item_components -> catalogue_items
ALTER TABLE catalogue_item_components
    ADD CONSTRAINT catalogue_item_components_catalogue_item_id_fkey
    FOREIGN KEY (catalogue_item_id) REFERENCES catalogue_items(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

-- item_media -> catalogue_items (si la table existe)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'item_media' AND column_name = 'catalogue_item_id' AND table_schema = 'public'
    ) THEN
        EXECUTE '
            ALTER TABLE item_media
                ADD CONSTRAINT item_media_catalogue_item_id_fkey
                FOREIGN KEY (catalogue_item_id) REFERENCES catalogue_items(id)
                ON UPDATE CASCADE ON DELETE CASCADE';
    END IF;
END $$;

-- fiches_vente -> catalogue_items (si la table existe et a la colonne)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fiches_vente' AND column_name = 'catalogue_item_id' AND table_schema = 'public'
    ) THEN
        EXECUTE '
            ALTER TABLE fiches_vente
                ADD CONSTRAINT fiches_vente_catalogue_item_id_fkey
                FOREIGN KEY (catalogue_item_id) REFERENCES catalogue_items(id)
                ON UPDATE CASCADE ON DELETE SET NULL';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 7 : SEQUENCE ET TRIGGER AUTO-GENERATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Sequence pour les nouveaux codes
CREATE SEQUENCE IF NOT EXISTS catalogue_code_seq;

-- Initialiser la sequence au max existant
SELECT setval('catalogue_code_seq', COALESCE(
    (SELECT MAX(NULLIF(SPLIT_PART(id, '-', 2), '')::INTEGER) FROM catalogue_items WHERE id LIKE 'ST-%'),
    0
));

-- Fonction trigger : genere automatiquement le code si non fourni
CREATE OR REPLACE FUNCTION generate_catalogue_code()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
BEGIN
    -- Lire le prefixe depuis app_config
    SELECT REPLACE(value::text, '"', '') INTO prefix
    FROM app_config WHERE key = 'shop_code_prefix';
    prefix := COALESCE(prefix, 'ST');

    -- Generer le code si absent ou vide
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := prefix || '-' || LPAD(nextval('catalogue_code_seq')::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur INSERT
DROP TRIGGER IF EXISTS trg_catalogue_auto_code ON catalogue_items;
CREATE TRIGGER trg_catalogue_auto_code
    BEFORE INSERT ON catalogue_items
    FOR EACH ROW
    WHEN (NEW.id IS NULL OR NEW.id = '')
    EXECUTE FUNCTION generate_catalogue_code();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 8 : CONFIGURATION app_config
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO app_config (key, value)
VALUES ('shop_code_prefix', '"ST"')
ON CONFLICT (key) DO UPDATE SET value = '"ST"', updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 9 : RAFRAICHIR LA VUE MATERIALISEE (si elle existe)
-- ═══════════════════════════════════════════════════════════════════════════════

-- v_catalogue_usage_stats est une VIEW (pas materialisee), elle se met a jour automatiquement
-- Rien a faire ici.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- REQUETES DE VALIDATION (a executer APRES le commit)
-- ═══════════════════════════════════════════════════════════════════════════════

-- V1. Verifier le mapping
-- SELECT * FROM catalogue_code_mapping ORDER BY new_code;

-- V2. Verifier que tous les articles ont des codes ST-XXXX
-- SELECT id, category, description FROM catalogue_items ORDER BY id;

-- V3. Verifier les FK room_items
-- SELECT ri.catalogue_item_id, ci.id
-- FROM room_items ri
-- LEFT JOIN catalogue_items ci ON ri.catalogue_item_id = ci.id
-- WHERE ri.catalogue_item_id IS NOT NULL AND ci.id IS NULL;
-- (doit retourner 0 lignes = aucun orphelin)

-- V4. Verifier les JSONB cascade targets
-- SELECT id, calculation_rule_ai->'cascade' FROM catalogue_items
-- WHERE calculation_rule_ai ? 'cascade';

-- V5. Verifier les default_materials
-- SELECT id, default_materials FROM submissions
-- WHERE default_materials IS NOT NULL AND default_materials::text != '{}' AND default_materials::text != '[]';

-- V6. Verifier la sequence
-- SELECT last_value FROM catalogue_code_seq;

-- V7. Tester le trigger (creer un article sans ID)
-- INSERT INTO catalogue_items (id, category, description, type) VALUES (NULL, 'Test', 'Test auto-code', 'unitaire');
-- SELECT id FROM catalogue_items WHERE description = 'Test auto-code';
-- DELETE FROM catalogue_items WHERE description = 'Test auto-code';
