-- ═══════════════════════════════════════════════════════════════════════
-- Vue: v_catalogue_usage_stats
-- Statistiques d'utilisation des articles du catalogue
-- Compte uniquement les soumissions ENVOYÉES (sent_at IS NOT NULL)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_catalogue_usage_stats AS
SELECT
    ci.id,
    ci.category,
    ci.description,
    COALESCE(stats.usage_count, 0)      AS usage_count,
    COALESCE(stats.submission_count, 0)  AS submission_count,
    stats.last_used_at,
    CASE
        WHEN stats.last_used_at IS NOT NULL
        THEN EXTRACT(DAY FROM now() - stats.last_used_at)::int
        ELSE NULL
    END AS days_since_used
FROM catalogue_items ci
LEFT JOIN (
    SELECT
        ri.catalogue_item_id,
        COUNT(ri.id)          AS usage_count,
        COUNT(DISTINCT s.id)  AS submission_count,
        MAX(s.sent_at)        AS last_used_at
    FROM room_items ri
    JOIN project_rooms pr ON ri.room_id = pr.id
    JOIN submissions s ON pr.submission_id = s.id
    WHERE s.sent_at IS NOT NULL
      AND ri.catalogue_item_id IS NOT NULL
    GROUP BY ri.catalogue_item_id
) stats ON stats.catalogue_item_id = ci.id;

-- Accès lecture pour les utilisateurs authentifiés
GRANT SELECT ON v_catalogue_usage_stats TO authenticated;
