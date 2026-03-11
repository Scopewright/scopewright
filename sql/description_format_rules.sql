-- Migration: Add description_format_rules to app_config
-- Source unique des règles de format pour la génération AI de descriptions client
-- Note: app_config.value is JSONB — use to_jsonb(text) for string values

INSERT INTO app_config (key, value)
VALUES (
  'description_format_rules',
  to_jsonb('FORMAT OBLIGATOIRE — DESCRIPTION CLIENT STELE

**Caisson :** [matériau]
**Façades :** [matériau 1], [matériau 2 si même type]
[finition sans label — ligne séparée, suite naturelle sous Façades]
**Panneaux apparents :** [matériau]
**Tiroirs :** [type]
**Poignées :** [type]
**Détails :**
- [détail technique ou inclusion notable]
- [ex: Installation incluse]
**Exclusions :** Voir note générale d''exclusions, [articles non inclus dans cette pièce]

RÈGLES :
- Fusionner les DM du même type sous un seul label bold
- Omettre une section si aucune donnée disponible pour cette pièce
- "Exclusions" toujours en dernier, toujours présent (au minimum "Voir note générale d''exclusions")
- Jamais de label dupliqué
- Ordre : Caisson → Façades → Finition → Panneaux → Tiroirs → Poignées → Détails → Exclusions
- Les composantes cascade ne sont PAS listées individuellement'::text)
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
