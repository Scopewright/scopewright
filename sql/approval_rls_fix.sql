-- ═══════════════════════════════════════════════════════════════════════
-- Fix RLS: Allow approvers to update submissions + insert versions/reviews
-- ═══════════════════════════════════════════════════════════════════════
-- Problème : les approbateurs ne sont pas le user_id du projet,
-- donc les policies RLS basées sur projects.user_id bloquent leurs actions.
--
-- Solution : policies supplémentaires pour les utilisateurs authentifiés
-- sur les tables nécessaires au workflow d'approbation.
-- La sécurité "qui peut approuver" reste côté client (canApproveQuotes)
-- + le trigger check_submission_status_transition valide les transitions.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Submissions : tout utilisateur authentifié peut UPDATE (status, approved_*, etc.)
CREATE POLICY "Authenticated users can update submissions"
    ON submissions FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 2. Project versions : tout utilisateur authentifié peut INSERT (snapshots d'approbation)
CREATE POLICY "Authenticated users can insert versions"
    ON project_versions FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 3. Submission reviews : tout utilisateur authentifié peut INSERT (historique approbation/retour)
CREATE POLICY "Authenticated users can insert reviews"
    ON submission_reviews FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 4. Submission reviews : tout utilisateur authentifié peut SELECT (lire l'historique)
CREATE POLICY "Authenticated users can read reviews"
    ON submission_reviews FOR SELECT
    USING (auth.role() = 'authenticated');
