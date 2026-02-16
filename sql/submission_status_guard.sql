-- ═══════════════════════════════════════════════════════════════════════
-- Trigger : Validation des transitions de statut sur submissions
-- ═══════════════════════════════════════════════════════════════════════
-- Exécuter dans Supabase SQL Editor

-- 1. Contrainte CHECK sur les statuts valides (sans 'invoiced')
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('draft', 'pending_internal', 'returned', 'approved_internal', 'sent_client', 'accepted'));

-- Migrer les soumissions 'invoiced' existantes vers 'accepted'
UPDATE submissions SET status = 'accepted' WHERE status = 'invoiced';

-- 2. Fonction trigger : valide les transitions de statut
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

-- 3. Attacher le trigger
DROP TRIGGER IF EXISTS trg_check_submission_status ON submissions;
CREATE TRIGGER trg_check_submission_status
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION check_submission_status_transition();
