# STATUS.md — Snapshot opérationnel Scopewright

> Dernière mise à jour : 2026-03-20

## Inventaire complet des fichiers

### Pages HTML (16 fichiers, 49 719 lignes)

| Fichier | Lignes | Rôle | Actif |
|---------|--------|------|-------|
| `calculateur.html` | 20 758 | App principale — projets, pipeline, soumissions, meubles, cascade, DM, AI chatbox | ✅ |
| `catalogue_prix_stele_complet.html` | 10 371 | Catalogue de prix — CRUD items, images, composantes, coupes, types | ✅ |
| `admin.html` | 4 171 | Administration — permissions, prompts AI, Agent Maître | ✅ |
| `clients.html` | 2 324 | CRM — contacts, entreprises, AI import | ✅ |
| `approbation.html` | 2 233 | Approbation soumissions + AI review | ✅ |
| `quote.html` | 2 106 | Vue client publique — soumission + signature | ✅ |
| `fiche.html` | 1 120 | Fiches de vente produits | ✅ |
| `app.html` | 685 | Tableau de bord — navigation modules | ✅ |
| `login.html` | 247 | Authentification Supabase | ✅ |
| `dashboard.html` | 3 224 | Prototype legacy | ❌ inactif |
| `soumission.html` | 479 | Prototype legacy | ❌ inactif |
| `index.html` | 316 | Landing redirect | ✅ |
| `catalogue_prix_stele.html` | 190 | Ancien catalogue (remplacé) | ❌ inactif |
| `mockup-rentabilite.html` | 661 | Mockup UI | ❌ inactif |
| `preview-tableau.html` | 608 | Mockup preview | ❌ inactif |
| `SOU-20260129-205814.html` | 226 | Snapshot soumission figé | ❌ inactif |

### Fichiers partagés (9 fichiers, 7 205 lignes)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `shared/calculateur.css` | 4 476 | CSS calculateur (extrait #126) |
| `shared/master-agent.js` | 1 271 | Agent Maître global drawer |
| `shared/presentation-client.js` | 773 | Texte, descriptions, clauses, snapshot |
| `shared/pdf-export.js` | 248 | Export PDF via PDFShift |
| `shared/sanity-checks.js` | 163 | Checks déterministes |
| `shared/auth.js` | 103 | Auth Supabase, authenticatedFetch |
| `shared/coupe.js` | 88 | Coupes de placage, facteurs par essence (extrait #126) |
| `shared/pricing.js` | 67 | Prix composé (computeComposedPrice) |
| `shared/utils.js` | 16 | escapeHtml, escapeAttr |

### Autres fichiers source

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `CLAUDE.md` | 1 210 | Instructions projet pour Claude Code |
| `ARCHITECTURE.md` | 868 | Vue d'ensemble architecturale (legacy 2026-02-25) |
| `scopewright-tokens.css` | 262 | Design tokens CSS |
| `google_apps_script.gs` | 236 | Envoi email estimation |

### Tests automatisés (4 398 lignes)

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `tests/cascade-engine.test.js` | 3 104 | 393 assertions, 42 groupes |
| `tests/cascade-helpers.js` | 834 | 24 fonctions pures extraites |
| `tests/fixtures/catalogue.js` | 330 | 21 articles catalogue réalistes |
| `tests/fixtures/enriched-dm.js` | 81 | DM enrichis pour tests |
| `tests/fixtures/room-dm.js` | 49 | Configs DM pièce |

### Migrations SQL : 91 fichiers dans `sql/`

### Edge Functions : 6 + 1 shared

| Fonction | Modèle | Rôle |
|----------|--------|------|
| `ai-assistant` | Sonnet 4.5 / Haiku 4.5 | Assistant estimateur |
| `ai-master` | Sonnet 4.5 | Agent Maître |
| `translate` | Haiku 4.5 / Sonnet 4 | 12 actions traduction/génération |
| `catalogue-import` | Sonnet 4.5 | Import catalogue SSE |
| `contacts-import` | Sonnet 4.5 | Import contacts SSE |
| `pdf-export` | — | PDFShift proxy |
| `_shared` | — | Auth JWT (jose) |

---

## État du moteur cascade

### Ce qui fonctionne ✅

- Résolution `$default:` via FAB-priority (DEC-058) — scanne style → materiau
- Résolution `$default:` via Step 4a (DEC-060) — ID direct sans filtre catégorie
- Résolution `$match:` via Tier 0 enriched (`getEnrichedDmField`)
- Résolution `$match:` via `resolveByComposante` + `COMPOSANTE_FIELD_MAP`
- Récursion 3 niveaux de profondeur
- Multi-instance (`child_dims` + qty > 1 → N lignes distinctes)
- DEC-061 — chaque FAB trouve sa propre composante
- `normalizedDmType` pour matching accent/plural-insensitive
- Guard `ask` completeness (L/H/P/n_portes/n_tiroirs)
- `cascade_suppressed` — mémorisation suppressions manuelles
- `cascade-locked` — protection enfants modifiés manuellement
- Bouton Recalculer (#218) — re-résolution enfants non-locked

### Ce qui est partiel ⚠️

- **Propagation tag** : le tag du parent devrait se propager aux enfants cascade. Le code `propagateTagToDescendants` existe mais ne semble pas se déclencher dans tous les cas (observé : enfants sans tag malgré parent taggé)
- **Sauvegarde debounce** : `debouncedSaveItem` a un timer global unique — les saves rapides successifs s'annulent. `executeCascade` fait des `updateItem` immédiats pour compenser, mais `depth_in` peut ne pas être sauvé si modifié puis page fermée trop vite
- **`reprocessDefaultCascades` scope** : le filtre `$default:changedType` ne re-cascade que les parents avec un `$default:` du type changé. Les `$match:` sont re-résolus indirectement quand leur parent est cascadé, mais les parents avec SEULEMENT des `$match:` (sans `$default:` du type changé) ne sont pas touchés

### Bugs connus actifs 🔴

1. **Panneau mélamine non généré** : `$default:Caisson` peut ne pas créer l'enfant panneau si `getAllowedCategoriesForGroup("Caisson")` ne contient pas la catégorie catalogue de ST-0012. Dépend du `categoryGroupMapping` en DB (config admin)
2. **Composante dropdown mauvais type** : les composantes créées avant #224 n'ont pas de `composante_type_id`. Le fallback string `normalizeDmType(c.dm_type)` fonctionne si `dm_type` est non-vide, mais échoue si `dm_type` est null → toutes les composantes matchent
3. **depth_in = NULL en DB** : certains articles ont `depth_in = NULL` malgré une profondeur saisie. Cause : `debouncedSaveItem` annulé avant fire (debounce global 500ms)
4. **`n_portes = 0` traité comme absent** : fix poussé (commit `0e86bee`) — utilise `!= null` au lieu de truthy check. À valider en prod
5. **Triple bande de chant** : `reprocessDefaultCascades` appelé 3 fois (1 par type dirty) → le caisson est re-cascadé 3 fois → `findExistingChildForDynamicRule` ne retrouve pas les enfants aux 2e/3e runs si `cascadeRuleTarget` a été cleared

---

## État des composantes

### Tables

- `composante_types` : 5 types seed (Caisson, Façades, Panneaux, Tiroirs, Poignées). Migration appliquée en prod : **à confirmer**
- `composantes` : COMP-XXX + GRP-XXX. Champ `composante_type_id` ajouté (FK → composante_types). Backfill depuis `dm_type` via SQL
- `composante_groupe_items` : table liaison groupe → membres. Migration appliquée en prod : **à confirmer**
- `catalogue_items.composante_type_id` : FK → composante_types. Migration appliquée en prod : **à confirmer**

### État des données

- **FAB avec `composante_type_id`** : dépend du backfill manuel via dropdown catalogue. Nombre inconnu — nécessite requête SQL
- **Composantes avec `composante_type_id`** : backfillées par `composante_types.sql` depuis `dm_type`. Les composantes créées après #224 ont le type via `saveDmAsComposante`/`saveComposante`
- **Composantes avec `materiau_catalogue_id` null** : possible si créées via le bookmark quand le fix `onmousedown` n'était pas encore en place

---

## Tests automatisés

**393 assertions, 42 groupes, 0 échecs** (2026-03-20)

| Groupe | Sujet | Assertions |
|--------|-------|------------|
| 1-16 | Core cascade (evalFormula, normalizeDmType, isFormulaQty, etc.) | ~120 |
| 17-19 | evaluateLaborModifiers (basic, formulas, integration) | ~25 |
| 20-23 | DM matching, scoring, dedup, categories | ~30 |
| 24-25 | Cumulative modifiers, MAT with dims_config | ~12 |
| 26 | parseFraction | ~8 |
| 27 | calculation_rule_ai fallback | ~5 |
| 28 | computeRentabilityPure | ~17 |
| 29 | labor_minutes_add | ~8 |
| 30 | checkDefaultItemMatchCategory | ~10 |
| 31-35 | Enriched DM fields, getEnrichedDmField | ~30 |
| 36 | resolveByComposante | ~15 |
| 37 | filterDmByComposante | ~8 |
| 38 | getEnrichedDmField | ~9 |
| 39 | shouldOverrideComposanteId (guard #219b) | ~8 |
| 40 | composante_types lookup | ~6 |
| 41 | composante_type_id sur catalogue_items | ~5 |
| 42 | resolveDmTypeFromFab | ~8 |

---

## Backlog actif

| # | Description | Statut |
|---|-------------|--------|
| #126 | Extraction calculateur.html — CSS extrait, coupe extrait, workflow bloqué (dépendances) | Partiel |
| #190 | Multi-tenant (organizations) | Non commencé |
| #218 | Bouton Recalculer DM | Livré — bugs scope reprocess |
| #219 | Facteurs coupe par essence | Livré |
| #221 | Archivage projets | Livré |
| #224 | Types de composante dynamiques (Phase A+B+C) | Livré — backfill FAB à compléter |
| #226 | UUID everywhere (Phase 1+2+4) | Livré — cleanup partiel fait |
| DEC-058 | FAB-priority dans $default: | Livré |
| DEC-059 | _rebuildDmClientText lecture catalogue frais | Livré |
| DEC-060 | Step 4a — ID > client_text (style + materiau only) | Livré |
| DEC-061 | Chaque FAB trouve sa propre composante | Livré |
| DEC-067 | reprocessDefaultCascades normalizeDmType | Livré |
| DEC-068 | Retrait resolveByComposante pour $default: | Livré |
| BUG | Tag non propagé aux enfants cascade | Actif |
| BUG | depth_in NULL en DB (debounce) | Actif |
| BUG | Triple bande de chant (triple reprocess) | Actif |
| BUG | Composantes sans composante_type_id (créées avant #224) | Actif — backfill requis |

---

## Migrations SQL non confirmées en prod

Les migrations suivantes ont été créées mais leur application en prod n'est pas confirmée :

1. `sql/composante_types.sql` — table + seed + backfill
2. `sql/composante_type_fk.sql` — FK sur catalogue_items
3. `sql/project_archive.sql` — is_archived sur projects
4. `sql/composante_groupes.sql` — table liaison groupes
5. `sql/coupe_types_essences.sql` — enrichissement facteurs par essence (version non-destructive)
6. `sql/backfill_item_type.sql` — corrigé pour exiger cascade réelles

---

## Décisions architecturales récentes (DEC-058 à DEC-068)

Voir `docs/DECISIONS.md` pour le détail. Résumé :

- **DEC-058** : FAB-priority — scan enriched sub-fields avant MAT
- **DEC-059** : _rebuildDmClientText lecture fraîche depuis CATALOGUE_DATA
- **DEC-060** : Step 4a — ID > client_text, scan style + materiau seulement
- **DEC-061** : Chaque FAB trouve sa propre composante (pas d'héritage parent)
- **DEC-063** : Pas de item_type 'style' — FAB suffit
- **DEC-064** : Pas de renommage nomenclature
- **DEC-065** : Modale conditionnelle (0→skip, 1→auto, 2+→modale)
- **DEC-066** : Retrait #219b différé post-backfill complet
- **DEC-067** : reprocessDefaultCascades normalizeDmType matching
- **DEC-068** : Retrait resolveByComposante pour $default:
