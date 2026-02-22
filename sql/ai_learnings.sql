-- Mémoire organisationnelle des assistants AI
-- Les règles apprises des corrections utilisateur sont injectées dans tous les assistants

CREATE TABLE ai_learnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule TEXT NOT NULL,
    source_context TEXT NOT NULL DEFAULT 'general',
    source_example TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

ALTER TABLE ai_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_learnings" ON ai_learnings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "insert_learnings" ON ai_learnings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_learnings" ON ai_learnings
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "delete_learnings" ON ai_learnings
    FOR DELETE USING (auth.uid() IS NOT NULL);
