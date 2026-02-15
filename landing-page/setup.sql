-- ═══════════════════════════════════════════════════════════════
-- SCOPEWRIGHT LANDING PAGE — Database Setup
-- Table pour la liste d'attente (waitlist)
-- ═══════════════════════════════════════════════════════════════

-- Créer la table waitlist
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT,
    lang TEXT DEFAULT 'fr',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par email
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Index pour tri par date
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- Activer Row Level Security (RLS)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Permettre à tout le monde d'insérer (formulaire public)
CREATE POLICY "Allow public insert on waitlist"
ON waitlist
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Seuls les admins peuvent lire la liste
CREATE POLICY "Admin can read waitlist"
ON waitlist
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND user_roles.role_id IN (
            SELECT id FROM roles WHERE name IN ('Administrateur', 'Admin')
        )
    )
);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON waitlist
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Instructions d'installation
-- ═══════════════════════════════════════════════════════════════
--
-- 1. Ouvrir Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Sélectionner le projet: rplzbtjfnwahqodrhpny
-- 3. Aller dans "SQL Editor"
-- 4. Coller ce script complet
-- 5. Cliquer "Run"
--
-- La table sera créée avec les permissions appropriées.
-- Le formulaire de la landing page pourra maintenant sauvegarder les soumissions.
--
