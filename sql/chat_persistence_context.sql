-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Ajouter context_type + user_id à chat_messages
-- Permet la persistance des chats catalogue et contacts (sans submission)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Rendre submission_id nullable
ALTER TABLE chat_messages ALTER COLUMN submission_id DROP NOT NULL;

-- 2. Ajouter context_type (catalogue, contacts) et user_id
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 3. Contrainte: au moins un scope (submission OU context)
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_scope_check
    CHECK (submission_id IS NOT NULL OR context_type IS NOT NULL);

-- 4. Index pour les requêtes par context_type
CREATE INDEX IF NOT EXISTS idx_chat_messages_context
    ON chat_messages(context_type, user_id, created_at DESC)
    WHERE context_type IS NOT NULL;

-- 5. Backfill user_id pour les lignes existantes (via submission → project)
UPDATE chat_messages cm
SET user_id = p.user_id
FROM submissions s
JOIN projects p ON s.project_id = p.id
WHERE s.id = cm.submission_id
  AND cm.user_id IS NULL;

-- 6. RLS policies pour les messages context-based (catalogue/contacts)
CREATE POLICY "Context chat: select own" ON chat_messages
    FOR SELECT USING (
        context_type IS NOT NULL AND user_id = auth.uid()
    );

CREATE POLICY "Context chat: insert own" ON chat_messages
    FOR INSERT WITH CHECK (
        context_type IS NOT NULL AND user_id = auth.uid()
    );

CREATE POLICY "Context chat: delete own" ON chat_messages
    FOR DELETE USING (
        context_type IS NOT NULL AND user_id = auth.uid()
    );
