-- ============================================================
-- MIGRATION 3 : Prompt Agent Maître (#209)
-- Fichier : sql/update_prompt_master_composantes.sql
-- Appends composante section to existing prompt text.
-- Uses (value#>>'{}') to extract text from JSONB string,
-- concatenates, then re-wraps as JSONB string.
-- ============================================================

UPDATE app_config
SET value = to_jsonb(
  (value #>> '{}') || '

COMPOSANTES (#209)
Architecture :
- Table composantes : UUID PK, code COMP-XXX auto-généré, RLS authentifié
- Dual storage : materiau_client_text + materiau_catalogue_id (même pattern pour bande_chant, finition, bois_brut)
- Types DM : Caisson, Façades, Panneaux, Groupe (multi-types)
- Lien : room_items.composante_id -> composantes.id (nullable, ON DELETE SET NULL)

Fonctionnalités :
- Drawer catalogue : bouton Composantes dans .catalogue-header-bar, filtrage par type DM, CRUD avec modale
- Enregistrement depuis DM : icône bookmark SVG par ligne DM + bouton Enregistrer tout (si 2 DM ou plus)
- Application : dropdown Composante par ligne DM (filtré par type) -> applyComposanteToDm -> cascade relancée
- Résolution cascade : filterDmByComposante(dmEntries, composante_id) réduit les candidats DM avant modales
- Soft delete : is_active = false (pas de DELETE physique)

Contexte AI estimateur :
Les DM de la pièce courante incluent composante_id et composante_name quand une composante est appliquée. L''AI estimateur doit utiliser composante_name dans ses explications au lieu de lister tous les champs individuels.

Phases livrées :
- sql/composantes.sql : table + trigger code + RLS
- Phase 1A : table + CRUD catalogue
- Phase 1B : enregistrement depuis panneau DM
- Phase 1C : dropdown + redesign visuel navy #0B1220
- Phase 1D : résolution cascade par composante_id

Diagnostics - modale DM s''ouvre malgré composante_id défini :
1. Vérifier que le DM a bien un composante_id non-null
2. Vérifier que filterDmByComposante retourne 1 candidat ou plus (sinon fallback liste complète)
3. Vérifier que l''article résolu correspond à la composante (cohérence client_text)

Aucun outil de manipulation directe : l''Agent Maître connaît les composantes mais ne les crée/modifie pas. Orientation vers l''UI si demandé.'
)
WHERE key = 'ai_prompt_master';
