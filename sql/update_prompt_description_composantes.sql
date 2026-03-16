-- ============================================================
-- MIGRATION 2 : Prompt description calculateur (#209)
-- Fichier : sql/update_prompt_description_composantes.sql
-- Appends composante section to existing prompt text.
-- Uses (value#>>'{}') to extract text from JSONB string,
-- concatenates, then re-wraps as JSONB string.
-- ============================================================

UPDATE app_config
SET value = to_jsonb(
  (value #>> '{}') || '

COMPOSANTES DANS LES DESCRIPTIONS
Si les matériaux par défaut de la pièce ont des composantes nommées (composante_name), utilise ces noms comme base de description au lieu de recomposer depuis les DM bruts.

Exemple :
- DM avec composante : { type: "Façades", composante_name: "Façades chêne blanc shaker" }
- Incorrect : "Façades en placage de chêne blanc avec finition polyuréthane, bande de chant chêne blanc"
- Correct : "Façades chêne blanc shaker"

Le nom de la composante capture déjà toutes les propriétés constructives. C''est plus concis et plus professionnel.
Si aucune composante n''est définie, recompose normalement depuis les DM bruts.'
)
WHERE key = 'ai_prompt_description_calculateur';
