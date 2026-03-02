-- Migration: Ajouter s.clauses au SELECT de get_public_quote
-- À exécuter dans Supabase SQL Editor
--
-- Contexte : les clauses sont stockées dans submissions.clauses (JSONB)
-- mais get_public_quote ne les inclut pas dans son SELECT,
-- ce qui fait que quote.html et le mode présentation n'affichent pas les clauses.
--
-- Ce script est idempotent : si clauses est déjà présent, il ne fait rien.

-- ═══════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC (optionnel) — décommenter pour vérifier l'état actuel
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT prosrc FROM pg_proc WHERE proname = 'get_public_quote';

-- ═══════════════════════════════════════════════════════════════════════
-- FIX : Ajouter s.clauses au SELECT de get_public_quote
-- ═══════════════════════════════════════════════════════════════════════

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
        RAISE NOTICE 'OK — clauses est déjà présent dans get_public_quote.';
        RETURN;
    END IF;

    -- Ajouter s.clauses au SELECT
    new_body := func_body;

    -- Pattern 1: s.current_version suivi d'une virgule
    IF new_body ILIKE '%s.current_version,%' THEN
        new_body := regexp_replace(new_body, '(s\.current_version)\s*,', '\1, s.clauses,', 'i');
    -- Pattern 2: s.global_price_modifier_pct (souvent en fin de SELECT des submissions)
    ELSIF new_body ILIKE '%s.global_price_modifier_pct%' THEN
        new_body := regexp_replace(new_body, '(s\.global_price_modifier_pct)', 's.clauses, \1', 'i');
    -- Pattern 3: s.discount_type (autre colonne commune en fin de SELECT)
    ELSIF new_body ILIKE '%s.discount_type%' THEN
        new_body := regexp_replace(new_body, '(s\.discount_type)', 's.clauses, \1', 'i');
    ELSE
        RAISE NOTICE 'Pattern non trouvé — ajout manuel requis.';
        RAISE NOTICE 'Corps actuel de la fonction :';
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

    RAISE NOTICE 'get_public_quote mis à jour — s.clauses ajouté au SELECT.';
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — décommenter après exécution pour confirmer
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT prosrc FROM pg_proc WHERE proname = 'get_public_quote';
-- La colonne "clauses" devrait maintenant apparaître dans le résultat.
