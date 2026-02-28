-- Migration: Fix accept_quote — deux correctifs
-- À exécuter dans Supabase SQL Editor
--
-- Bug 1: submission_reviews_action_check ne contient pas 'accepted'
-- Bug 2: get_public_quote ne retourne pas la colonne 'clauses'

-- ═══════════════════════════════════════════════════════════════════════
-- FIX 1 : Ajouter 'accepted' au check constraint de submission_reviews
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE submission_reviews DROP CONSTRAINT IF EXISTS submission_reviews_action_check;
ALTER TABLE submission_reviews ADD CONSTRAINT submission_reviews_action_check
    CHECK (action IN (
        'submitted', 'approved', 'returned', 'sent', 'bypass',
        'offline_accepted', 'accepted', 'invoiced', 'duplicated',
        'unlocked', 'lost', 'reopened'
    ));

-- ═══════════════════════════════════════════════════════════════════════
-- FIX 2 : Ajouter 'clauses' au SELECT de get_public_quote
-- ═══════════════════════════════════════════════════════════════════════

-- Diagnostic : voir la définition actuelle
-- SELECT prosrc FROM pg_proc WHERE proname = 'get_public_quote';

-- Le bloc ci-dessous lit la définition actuelle de la fonction,
-- ajoute s.clauses si absent, et recrée la fonction automatiquement.

DO $$
DECLARE
    func_def TEXT;
    func_body TEXT;
    new_body TEXT;
BEGIN
    -- Lire le corps de la fonction
    SELECT prosrc INTO func_body
    FROM pg_proc
    WHERE proname = 'get_public_quote';

    IF func_body IS NULL THEN
        RAISE NOTICE 'Fonction get_public_quote introuvable — rien à modifier.';
        RETURN;
    END IF;

    -- Vérifier si clauses est déjà dans le SELECT
    IF func_body ILIKE '%clauses%' THEN
        RAISE NOTICE 'clauses est déjà présent dans get_public_quote — aucune modification.';
        RETURN;
    END IF;

    -- Ajouter s.clauses après s.current_version (pattern courant dans le SELECT)
    -- Essayer plusieurs patterns de colonnes connues
    new_body := func_body;

    -- Pattern 1: s.current_version suivi d'une virgule
    IF new_body ILIKE '%s.current_version,%' THEN
        new_body := regexp_replace(new_body, '(s\.current_version)\s*,', '\1, s.clauses,', 'i');
    -- Pattern 2: s.global_price_modifier_pct (souvent en fin de SELECT)
    ELSIF new_body ILIKE '%s.global_price_modifier_pct%' THEN
        new_body := regexp_replace(new_body, '(s\.global_price_modifier_pct)', 's.clauses, \1', 'i');
    -- Pattern 3: fallback — ajouter avant le premier FROM après le SELECT des submissions
    ELSE
        RAISE NOTICE 'Pattern non trouvé — ajout manuel requis. Corps actuel:';
        RAISE NOTICE '%', func_body;
        RETURN;
    END IF;

    -- Reconstruire la définition complète via pg_get_functiondef
    SELECT pg_get_functiondef(oid) INTO func_def
    FROM pg_proc
    WHERE proname = 'get_public_quote';

    -- Remplacer l'ancien corps par le nouveau dans la définition complète
    func_def := replace(func_def, func_body, new_body);

    -- Exécuter le CREATE OR REPLACE
    EXECUTE func_def;

    RAISE NOTICE 'get_public_quote mis à jour avec s.clauses ajouté.';
END $$;

-- Vérification : la colonne clauses devrait maintenant apparaître
-- SELECT prosrc FROM pg_proc WHERE proname = 'get_public_quote';
