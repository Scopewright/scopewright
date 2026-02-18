-- Table de suivi par utilisateur (étoile ★)
CREATE TABLE IF NOT EXISTS project_follows (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

-- RLS : chaque utilisateur voit/gère ses propres follows
ALTER TABLE project_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON project_follows
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
