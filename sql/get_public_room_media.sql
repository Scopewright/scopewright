-- Migration: Créer get_public_room_media — accès public aux images via token
-- À exécuter dans Supabase SQL Editor
--
-- Contexte : quote.html (page publique) ne peut pas lire room_media via REST
-- car le RLS exige auth.uid() (via JOIN projects.user_id).
-- Cette fonction SECURITY DEFINER contourne le RLS de façon sécurisée :
-- seules les images des pièces liées au token fourni sont retournées.

CREATE OR REPLACE FUNCTION get_public_room_media(p_token UUID)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    original_url TEXT,
    cropped_url TEXT,
    crop_ratio TEXT,
    crop_data JSONB,
    tags TEXT[],
    sort_order INT,
    annotations JSONB,
    source_metadata JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        rm.id,
        rm.room_id,
        rm.original_url,
        rm.cropped_url,
        rm.crop_ratio,
        rm.crop_data,
        rm.tags,
        rm.sort_order,
        rm.annotations,
        rm.source_metadata
    FROM room_media rm
    JOIN project_rooms pr ON rm.room_id = pr.id
    JOIN public_quote_tokens t ON t.submission_id = pr.submission_id
    WHERE t.token = p_token
    ORDER BY rm.sort_order ASC;
$$;

COMMENT ON FUNCTION get_public_room_media(UUID) IS
    'Returns room_media for all rooms linked to a public quote token. SECURITY DEFINER bypasses RLS.';
