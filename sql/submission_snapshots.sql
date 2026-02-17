-- Migration: Snapshot HTML des soumissions approuvées/envoyées
-- À exécuter dans Supabase SQL Editor

-- Bucket Storage pour les snapshots (public pour que quote.html puisse y accéder)
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-snapshots', 'submission-snapshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: lecture publique, écriture authentifiée
CREATE POLICY "Public read snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'submission-snapshots');

CREATE POLICY "Auth upload snapshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submission-snapshots');

CREATE POLICY "Auth update snapshots"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'submission-snapshots');

CREATE POLICY "Auth delete snapshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'submission-snapshots');
