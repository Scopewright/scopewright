-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Statut "Perdu" (lost) + Archivage des soumissions
-- Exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Colonnes lost sur submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lost_competitor_company_id UUID REFERENCES companies(id);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lost_competitor_price NUMERIC;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

-- 2. Archivage
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- 3. is_competitor sur companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_competitor BOOLEAN DEFAULT false;

-- 4. CHECK constraint mis à jour (ajouter 'lost')
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('draft', 'pending_internal', 'returned', 'approved_internal', 'sent_client', 'accepted', 'lost'));

-- 5. CHECK constraint mis à jour sur submission_reviews (ajouter 'lost', 'reopened')
ALTER TABLE submission_reviews DROP CONSTRAINT IF EXISTS submission_reviews_action_check;
ALTER TABLE submission_reviews ADD CONSTRAINT submission_reviews_action_check
    CHECK (action IN ('submitted', 'approved', 'returned', 'sent', 'bypass', 'offline_accepted', 'invoiced', 'duplicated', 'unlocked', 'lost', 'reopened'));

-- 6. Trigger remplacé : ajouter transitions lost ↔ sent_client
CREATE OR REPLACE FUNCTION check_submission_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le statut ne change pas, laisser passer
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Transitions autorisées
    IF (OLD.status = 'draft' AND NEW.status = 'pending_internal') THEN RETURN NEW; END IF;
    IF (OLD.status = 'draft' AND NEW.status = 'sent_client') THEN RETURN NEW; END IF;         -- bypass
    IF (OLD.status = 'pending_internal' AND NEW.status = 'approved_internal') THEN RETURN NEW; END IF;
    IF (OLD.status = 'pending_internal' AND NEW.status = 'returned') THEN RETURN NEW; END IF;
    IF (OLD.status = 'returned' AND NEW.status = 'pending_internal') THEN RETURN NEW; END IF;
    IF (OLD.status = 'approved_internal' AND NEW.status = 'sent_client') THEN RETURN NEW; END IF;
    IF (OLD.status = 'sent_client' AND NEW.status = 'accepted') THEN RETURN NEW; END IF;

    -- Transitions lost
    IF (OLD.status = 'sent_client' AND NEW.status = 'lost') THEN RETURN NEW; END IF;
    IF (OLD.status = 'lost' AND NEW.status = 'sent_client') THEN RETURN NEW; END IF;          -- rouvrir

    -- Transition vers 'draft' (unlock) — seulement si un log d'unlock existe
    IF (NEW.status = 'draft') THEN
        IF EXISTS (
            SELECT 1 FROM submission_unlock_logs
            WHERE submission_id = NEW.id
              AND created_at > NOW() - INTERVAL '30 seconds'
        ) THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Transition vers draft requiert un log de déverrouillage (submission_unlock_logs).';
    END IF;

    -- Toute autre transition est interdite
    RAISE EXCEPTION 'Transition de statut invalide: % → %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;
