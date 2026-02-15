-- Table pour la persistance des conversations AI dans le calculateur
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'summary')),
    content TEXT NOT NULL,
    image_urls TEXT[] DEFAULT '{}',
    tool_calls JSONB DEFAULT NULL,
    pending_actions JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_submission ON chat_messages(submission_id, created_at);

-- RLS: même pattern que les autres tables liées aux soumissions
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat messages" ON chat_messages
    FOR SELECT USING (
        submission_id IN (
            SELECT s.id FROM submissions s
            JOIN projects p ON s.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (
        submission_id IN (
            SELECT s.id FROM submissions s
            JOIN projects p ON s.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE USING (
        submission_id IN (
            SELECT s.id FROM submissions s
            JOIN projects p ON s.project_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );
