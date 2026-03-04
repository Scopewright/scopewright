-- Audit log for AI-driven catalogue modifications
-- Tracks before/after values, reason, and source for every change
CREATE TABLE IF NOT EXISTS catalogue_change_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES catalogue_items(id),
    changed_by TEXT NOT NULL,
    before_values JSONB,
    after_values JSONB,
    reason TEXT,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: authenticated users can INSERT (logging) and SELECT (audit)
ALTER TABLE catalogue_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_change_log" ON catalogue_change_log
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_change_log" ON catalogue_change_log
    FOR SELECT TO authenticated USING (true);
