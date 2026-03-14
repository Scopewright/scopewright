-- Feature #192 — Debug AI Images bucket
-- Bucket Storage pour sauvegarder les images envoyées à l'AI en mode debug

-- 1. Create the storage bucket (public read for admin gallery thumbnails)
INSERT INTO storage.buckets (id, name, public)
VALUES ('debug-ai-images', 'debug-ai-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: authenticated users can read (for admin gallery)
CREATE POLICY "auth_read_debug_images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'debug-ai-images');

-- 3. Policy: service role can insert (edge function uses service_role key)
-- Service role bypasses RLS, so no explicit policy needed for inserts.

-- 4. Policy: admin can delete (cleanup)
CREATE POLICY "auth_delete_debug_images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'debug-ai-images');

-- 5. Default app_config flag (disabled)
INSERT INTO app_config (key, value)
VALUES ('debug_ai_images', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
