-- Migration: Ajouter client_description_en au SELECT des rooms dans get_public_quote
-- À exécuter dans Supabase SQL Editor
--
-- Contexte : quote.html supporte ?lang=en mais get_public_quote ne retourne
-- que client_description (FR). Cette migration ajoute client_description_en
-- pour permettre l'affichage bilingue des descriptions de pièces.
--
-- Ce script est idempotent : si client_description_en est déjà présent, il ne fait rien.

DO $$
DECLARE
    func_def TEXT;
    func_body TEXT;
    new_body TEXT;
BEGIN
    SELECT prosrc INTO func_body
    FROM pg_proc
    WHERE proname = 'get_public_quote';

    IF func_body IS NULL THEN
        RAISE NOTICE 'Fonction get_public_quote introuvable.';
        RETURN;
    END IF;

    IF func_body ILIKE '%client_description_en%' THEN
        RAISE NOTICE 'OK — client_description_en est déjà présent dans get_public_quote.';
        RETURN;
    END IF;

    new_body := func_body;

    -- Ajouter client_description_en juste après client_description
    IF new_body ILIKE '%client_description%' THEN
        -- Match pr.client_description or just client_description, add _en after it
        new_body := regexp_replace(
            new_body,
            '(pr\.client_description|client_description)(\s*,|\s)',
            '\1, pr.client_description_en\2',
            'i'
        );
    ELSE
        RAISE NOTICE 'Pattern client_description non trouvé — ajout manuel requis.';
        RAISE NOTICE '%', func_body;
        RETURN;
    END IF;

    -- Vérifier que le remplacement a bien eu lieu
    IF new_body = func_body THEN
        RAISE NOTICE 'Remplacement échoué — ajout manuel requis.';
        RAISE NOTICE '%', func_body;
        RETURN;
    END IF;

    SELECT pg_get_functiondef(oid) INTO func_def
    FROM pg_proc
    WHERE proname = 'get_public_quote';

    func_def := replace(func_def, func_body, new_body);
    EXECUTE func_def;

    RAISE NOTICE 'get_public_quote mis à jour — client_description_en ajouté au SELECT des rooms.';
END $$;
