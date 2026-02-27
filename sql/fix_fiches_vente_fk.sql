-- fix_fiches_vente_fk: Change ON DELETE SET NULL → ON DELETE CASCADE
-- The original FK used SET NULL, but catalogue_item_id is NOT NULL,
-- causing error 23502 on delete. A fiche de vente is tied to its
-- catalogue item and should be deleted with it.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fiches_vente_catalogue_item_id_fkey'
          AND table_name = 'fiches_vente'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE fiches_vente
            DROP CONSTRAINT fiches_vente_catalogue_item_id_fkey;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fiches_vente'
          AND column_name = 'catalogue_item_id'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE fiches_vente
            ADD CONSTRAINT fiches_vente_catalogue_item_id_fkey
            FOREIGN KEY (catalogue_item_id) REFERENCES catalogue_items(id)
            ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;
