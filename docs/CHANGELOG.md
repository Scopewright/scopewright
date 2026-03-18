# Changelog — Scopewright

> Historique chronologique des modifications significatives.
>
> **Dernière mise à jour** : 2026-03-18

---

## 2026-03-17 / 2026-03-18

### Features
- **#219 — Facteur coupe par essence** : `_detectEssence(clientText)` détecte 9 essences (chêne blanc/rouge, noyer, érable, merisier, frêne, cerisier, pin noueux, acajou) par mots-clés FR/EN avec normalisation NFD. `getCoupeFacteur(coupeLabel, articleClientText)` : chaîne `facteurs[essence]` → `facteur_defaut` → `facteur` → 1.0. `_isPlacageCategory` élargi à "panneau", exclut "bande"/"brut"/"finition". Drawer catalogue 560px avec tableau facteurs par essence. Migration `sql/coupe_types_essences.sql`
- **#219b — Per-rule composante_id** : dans la boucle des règles cascade, chaque `$default:X` dont le type cible diffère du parent overrride `materialCtx.composante_id` avec la composante du DM ciblé. Lookup direct par `normalizeDmType(X)` — indépendant de `_getCategoryDmType`
- **#221 — Archivage projets** : `projects.is_archived` BOOLEAN DEFAULT false. Bouton 🗃 sur cartes projet. Filtre "Projets archivés (N)" dans la barre pipeline. Suppression uniquement depuis la vue archivés avec double confirmation. Message FK clair. Migration `sql/project_archive.sql`
- **#218 — Bouton Recalculer DM** : `_dmDirtyTypes[groupId]` trace les types DM modifiés. Barre d'avertissement + bouton "Recalculer" dans le panneau DM. Point orange 8px `#F59E0B` sur le header collapsé (`.dm-dirty`). Auto-clear après reprocess réussi
- **Style Façades → combobox catalogue** : champ Style passe de texte libre à combobox filtré par `item_type=fabrication` + catégories façade. Dual storage `{catalogue_item_id, client_text}`. Backward compat string via `_dmFieldText()`
- **Composante résolution client_text-only** : `resolveByComposante` avec `client_text` sans `catalogue_item_id` → lookup `CATALOGUE_DATA` par texte exact. 1 match → direct. 2+ → modale technique
- **Composante dans accordion DM** : dropdown composante déplacé de la ligne principale vers le premier champ de l'accordion enrichi. Badge code compact (COMP-XXX) quand appliquée + bouton × détacher
- **Panneau DM enrichi — Materiau sans dédup** : champ materiau affiche chaque article individuellement (ST-XXXX — Description), pas dédupliqué par client_text

### Corrections
- **#219 — Type-aware composante filter** : `filterDmByComposante` vérifie que le `dm_type` de la composante matche le type cible avant de filtrer. Empêche Caisson de filtrer les DM Façades
- **Titre DM — client_text = materiau only** : `_rebuildDmClientText` ne met que le matériau dans `client_text`. Style, coupe, finition affichés uniquement par `buildComposanteName` → zéro duplication
- **Stale data cleanup** : `openSubmission` reset `client_text` si >80 chars ou incohérent, puis rebuild + save DB
- **Badge composante type check** : vérifie `normalizeDmType(_appliedComp.dm_type) === entry type` avant affichage. Clear `composante_id` si mismatch
- **getMissingRequiredDm** : comparaison via `normalizeDmType` + vérifie enriched sub-fields
- **AI DM context** : `slimDM` fallback `materiau.client_text` quand `client_text` vide → élimine "Panneaux: ?"
- **Composante combobox click** : `JSON.stringify` double quotes cassait le HTML `onmousedown`. Fix : `escapeAttr` + single quotes
- **Groupe button toujours rendu** : plus de condition `_hasGroupes` (timing `loadComposantes`)
- **Bookmark toujours visible** : plus de condition `entry.client_text` (visible même sur DM vide)
- **Container 1600px** : `max-width: 1600px` sur `.calc-container`
- **Dims 290px** : colonne dims élargie 260→290px, empêche troncature label "Tir."

---

## 2026-03-16

### Features
- **#209 Phase 1D — Résolution cascade par composante_id** : `filterDmByComposante` filtre les DM candidats par `composante_id` dans `resolveCascadeTarget` et `resolveMatchTarget`. `materialCtx.composante_id` propagé à toute la chaîne cascade. Élimine les modales ambiguës quand une composante est définie
- **#209 — Enrichissement DM : champ Matériau** : ajout de `materiau` comme premier sous-champ combobox catalogue pour Façades et Panneaux (`DM_ENRICHED_GROUPS`, `DM_ENRICHED_CATALOGUE_FIELDS`, `DM_ENRICHED_LABELS`, `ENRICHED_DM_FIELD_MAP`). `rdmSearchEnriched` fieldCatMap couvre PLACAGE, PANNEAU, PANNEAU MÉLAMINE, PANNEAU BOIS, PANNEAUX, MATÉRIAU, MATERIAU
- **#209 — `loadComposantes()` au démarrage** : `COMPOSANTES_DATA` chargé depuis Supabase au lancement de calculateur.html (non-bloquant). Corrige le dropdown composantes vide
- **#209 — DM_REQUIRED_GROUPS réduit** : de `['Caisson','Panneaux','Tiroirs','Façades','Poignées']` à `['Caisson','Façades','Panneaux']`
- **#214 — Nom composante dans modale DM** : `showDmChoiceModal` affiche `composante.nom` au lieu de `client_text` quand une composante est liée
- **#215 — Résolution composante-first type-aware** (DEC-048) : `resolveByComposante` résout directement depuis les champs composante avant toute logique fuzzy/DM. Cross-type lookup : composante Caisson mais rule `$default:Panneaux` → trouve la composante Panneaux dans les DM de la pièce. `_getCategoryDmType` remplace `catItem.category` par mapping via `categoryGroupMapping`. `getRelevantComposanteId` peuple `materialCtx.composante_id` au depth 0. `showComposanteChoiceModal` pour 2+ composantes du même type. 347 tests (15 dans GROUP 36)

### Corrections
- **#209 — Dropdown composantes strict filter** : `is_active === true` (au lieu de `!== false` qui acceptait null/undefined). Guard `_entryType !== ''` empêche les matchs sur type vide. Comparaison `dm_type` case-insensitive
- **#209 — Bookmark détachement** : `_detachComposanteOnEdit` — modification manuelle d'un sous-champ enrichi repasse le bookmark en stroke, supprime `composante_id`, restaure le label `client_text`
- **#215 — parentDmType fragile** : `executeCascade` utilisait `catItem.category` (catégorie catalogue, ex: "Caissons mélamine") pour filtrer les DM entries par type "Caisson". Remplacé par `_getCategoryDmType()` + `normalizeDmType()` pour matching robuste

### Améliorations
- **Warning UI champs vides** : sous-champs enrichis vides liés à une composante → placeholder orange (`.rdm-empty-warn`) — indicateur visuel que la cascade pourrait ne pas résoudre certains articles

---

## 2026-03-15

### Features
- **Feature #208 — Enrichissement DM Phase 1A** : champs additionnels par groupe DM (Caisson, Façades, Panneaux). Sous-champs `bande_chant`, `finition`, `bois_brut` (combobox catalogue) + `style`, `coupe` (texte libre). Tier 0 dans `resolveMatchTarget` résout `$match:` depuis les champs enrichis sans modale. UI accordion collapsible dans le panneau DM. Validation cohérence mélamine/placage. 5 nouveaux groupes de tests (31-35), 330 assertions totales. Aucune migration SQL.
- **#209 Phase 1A — Table Composantes** : nouvelle table `composantes` (COMP-XXX auto-code, dual-storage, soft delete), CRUD drawer dans catalogue, migration `sql/composantes.sql`, FK `room_items.composante_id`
- **#209 Phase 1B — Enregistrement composantes depuis DM** : bouton par ligne DM + bouton "Enregistrer tout" dans le calculateur, `buildComposanteName` auto-nommage, `COMPOSANTES_DATA` global
- **#209 Phase 1C — Dropdown composantes + Redesign DM** : panneau DM fond navy `#0B1220`, dropdown composantes par ligne, `applyComposanteToDm`, bookmark SVG, retrait Finition de `DM_REQUIRED_GROUPS`

### Corrections
- **#188e** : `reprocessDefaultCascades` invalide `matchDefaults` sélectivement — seules les entrées liées au groupe DM modifié (via word-similarity sur `categoryGroupMapping`) sont supprimées, les choix `$match:` des catégories non modifiées sont préservés (DEC-041)
- **#205** : `deduplicateDmByClientText` déduplique aussi par `catalogue_item_id` (seconde passe) — empêche les modales quand plusieurs DM pointent vers le même article
- **#205b** : `resolveCascadeTarget` filtre les DM entries par catégories autorisées (`getAllowedCategoriesForGroup`) avant d'afficher la Modale 1
- **#206** : `filterDmByExpenseRelevance` filtre les DM entries par pertinence `material_costs` avant `showDmChoiceModal` dans les 4 tiers de `getDefaultMaterialKeywords` — empêche l'affichage de Laque/Legrabox quand seuls les panneaux sont pertinents
- **#207** : `_defaultResolvedFresh` — vérification cohérence materialCtx par word-similarity au lieu de skip total `findExistingChild`, élimine modales parasites lors changement DM non relié (DEC-043)
- **#207** : `filterDmByExpenseRelevance` appliqué à la modale materialCtx pre-population dans `executeCascade`
- **#207-2** : `aiGenerateDescription` injecte les DM de la pièce (`roomDM[groupId]`) dans le prompt description via `callEdgeFunction` → edge function `translate` ajoute section "MATÉRIAUX PAR DÉFAUT" au system prompt — descriptions cohérentes avec les matériaux effectifs (DEC-044)
- **#207-3** : nettoyage backticks dans `aiGenerateDescription` — strip ` ```html ` / ` ``` ` / ` '''html ` / ` ''' ` avant écriture dans le DOM
- **CAT-01** : auto-refresh modal catalogue après modification AI via `update_catalogue_item` — `master-agent.js` dispatche `CustomEvent('catalogue-item-updated')`, catalogue modal écoute et auto-refresh (dirty check, fetch DB, update CATALOGUE_DATA, re-populate, toast indigo) (DEC-045)

### Améliorations
- **AI lecture plans** : méthodologie dimensionnelle (PLANS_SECTION) toujours injectée dans le system prompt, plus conditionnelle sur `hasImages` — l'AI applique la rigueur de comptage/validation même sans images collées (DEC-040)
- **Routing AI** : mots-clés dimensionnels (caisson, dimension, largeur, hauteur, profondeur, élévation, estime, mesure, comptage, division, alignement) ajoutés à `_COMPLEX_KEYWORDS` → forçage Sonnet 4.5 + max_tokens ≥ 1536 pour toute requête d'estimation dimensionnelle
- **USER_GUIDE.md** : section "Rentabilité et marges" détaillée (#200b) — KPI cards, barre répartition, interprétation chiffres, ajustement prix cible
- **USER_GUIDE.md** : documentation flux texte humain → JSON (#200c) — cascade, barèmes, ajouts personnalisés, diagramme du flux

---

## 2026-03-13

### Features
- **#179f** Modal ajout personnalisé — prix total en haut à droite du header, mis à jour en temps réel
- **#179e** Modal ajout personnalisé identique au catalogue (MO/matériaux grids complètes)
- **#179d** Modal ajout complet + headers dims L H P séparés (#186)

### Fixes
- **#188c** `$match:` modal après changement DM — word-similarity DM lookup + `disambiguateMatchByDm()`
- **#188b** DM modal réapparaît encore — `client_text` fallback dans cache + inférence depuis enfants existants
- **#188** DM modal réapparaît à chaque changement dimension — always-cache strategy
- **#187** Accordion flash — create groups already collapsed + disable transition at load
- Hover jump sur lignes — `visibility:hidden/visible` au lieu de `display:none/inline-flex`

---

## 2026-03-12

### Features
- **#179c** Simplifier modal ajout personnalisé — coût + marge au lieu de grilles MO/matériaux
- **#179b** Refonte ajout personnalisé : modal prix composé + ligne inline

### Fixes
- **#185** Page crash — `updateCimSellPrice` renamed but namespace ref not updated
- **#184** Façades manquante dans `category_group_mapping` + libellés admin clarifiés
- **#183** Quantité auto-calculée encore éditable — condition trop restrictive
- **#183** Quantité auto-calculée non-interactive (readonly + pointer-events:none)
- **#182** Soumissions ne s'affichent plus — `presentation-client.js` not committed
- **#180** Subtle hover on calc rows — `rgba(0,0,0,0.018)` + 120ms ease
- Combobox dropdown déborde en bas de l'écran — max-height dynamique
- Type entreprise éditable en mode modification (clients.html)

---

## 2026-03-11

### Features
- **#179** Custom item improvements + AI cost optimization (routing dynamique + max_tokens adaptatif)
- **#160** Add `update_catalogue_item` tool to Agent Maître (9 tools total)
- **#175** Accordion rooms — une seule pièce ouverte à la fois + AI focus synchronisé
- **#174** Fix double `JSON.stringify` corruption (JSONB writes)

### Fixes
- **#173** `update_prompt_section` fuzzy line-by-line fallback pour bullets/backticks
- **#172** `effective_qty` (qty × qty_multiplier) missing from AI description context
- **#171** `tool_use` without `tool_result` in estimator — merge-aware sanitization
- **#170** `update_prompt_section` tolerant matching — replace broken sliding window with regex
- `confirmRemoveRow` — await `steleConfirm` instead of passing callback as label

---

## 2026-03-10

### Features
- **#169** Inject `presentation_rule_human` in AI description + estimator context
- **#161** Internal note per line — parent items only, never shown to client
- **#167** Improve `update_prompt_section` reliability — tolerant matching + `insert_after` mode
- **#166** `qty_multiplier` fully integrated in AI estimator context
- **#165** Add image support (paste + drag-drop) to Agent Maître drawer
- **#163** Remove auto-question on Agent Maître drawer open
- **#159** Add `get_catalogue_item` read-only tool to Agent Maître

### Fixes
- **#168** Agent Maître tool approval buttons persist and block conversation
- **#164** `labor_minutes` expression not evaluated in barèmes
- **#153** `ai_prompt_master` missing from `loadAiPrompts` whitelist
- **#148** FAB button 30px/0.28 at rest + Agent Maître improvements
- **#150** Sync button — find status element in drawer OR admin panel
- Confirmation dialog before deleting a row (× button)

---

## 2026-03-09

### Features
- **#150** Enrich MASTER_CONTEXT.md (sections 17-21) + inject live config in ai-master
- **#148 + #149** Agent Maître global drawer + tools + sanity checks
- **#147** Agent Maître: admin conversation UI + doc sync + ai-master edge function
- **#146** Drag & drop image reordering with sort_order persistence
- **#144** Admin sidebar navigation + barèmes `labor_minutes` additive (formulas)

### Fixes
- **#133** `aiCatalogueExplication` JSON not populated — flattened envelope
- **#145** RLS policy missing keys — quote.html can't read `project_steps`/`why_*`
- Catalogue modal Approve/Reject buttons not reset on reopen
- Contacts assistant double confirmation — single Apply button
- Contacts assistant 400 error on image paste — empty content guard

---

## 2026-03-08

### Features
- **#133** `description_format_rules` éditable + admin Présentation sections + JSONB fix
- **#137** PDF export refactor — PDFShift server-side (replace html2pdf.js/jsPDF)
- **#98** Fix HTML description display + smart AI description (squelette déterministe + diff)
- Presentation rule `exclude` + `detail_bullets` + update AI prompts

### Fixes
- **#137** PDF images no longer cropped by fixed max-height
- **#137** PDF vertical centering, missing images, cover height
- Submission title — initial value + visible editable field
- Multi-file PDF upload for architectural plans
- Reprocess DM — preserve memorized DM choices (`dmChoiceCache`)
- Cascade progress overlay repositioned on `.calc-rows`
- Cascade child level 2+ aggregate total shown when expanded

---

## 2026-03-07

### Features
- Override par ligne (prix, MO, matériaux) — popover 3 sections + undo stack
- Barèmes et modificateurs (`labor_modifiers`) — conditions dimensionnelles + cumulative mode
- `parseFraction` — inputs dims acceptent fractions (3/4, 1 1/2, 23 5/8)

### Fixes
- Cascade qty enfants readonly (readOnly + pointer-events:none)
- Qty enfants cascade modifiables (triple protection)
- Indicateur DM vide (`dm-needs-config`) CSS pur + animation pulse

---

## 2026-03-05

### Features
- Export PDF server-side via PDFShift API (Edge Function `pdf-export`)
- `shared/pdf-export.js` — HTML → PDFShift → blob PDF download
- Total+signature page reconstruite en layout 2 colonnes flex
- Sanitisation HTML descriptions (double-escaping regex)

---

## 2026-03-03

### Features
- `$match:` cascade resolution + `presentation_rule` engine + `assembleRoomDescription`
- `n_tablettes`/`n_partitions` inputs for Caisson fabrication items
- Cascade lock — manual override of auto-managed cascade children
- Auto tag propagation from parent to cascade children
- Batch selection mode for catalogue (select, delete, categorize, approve/reject)
- Price outlier detection (Check 8) using IQR method in audit

### Fixes
- `$match:` DM fallback — direct category↔type match + debug logging
- `$match:` resolution — `.some()` on plain object + case-insensitive
- Catalogue delete — `fiches_vente` FK constraint + pre-deletion dependency check
- Duplicate articles in default material dropdowns

---

## 2026-03-02

### Features
- **Shared files extraction** : `shared/auth.js`, `shared/utils.js`, `shared/pricing.js` (~830 lignes de duplication éliminées)
- DM identifié par `client_text` au lieu de `catalogue_item_id` (DEC-001)
- Catégorie de dépense dynamique — hint + similarité par mots (DEC-002)

---

## 2026-02-25

### Features
- `$match:` template migration, batch rule regeneration, audit checks
- Quote acceptance redesign + catalogue AI single-confirmation
- Présentation button refactor — iframe quote.html instead of inline render
- Combined Total + Signature into single landscape page with FR/EN support

### Fixes
- Installation toggle price + cascade infinite loop + diagnostic logs
- Quote.html regressions: restore intro page, skip old snapshots, adjust CSS
- Cascade popup reappearing when children already exist

---

## 2026-02-20

### Features
- Comprehensive catalogue user guide (`docs/guide-catalogue.md`)
- Admin category change on existing catalogue items
- Catalogue edit button: event delegation on table

### Fixes
- Quote layout fixes synced to calculateur.html
- Remove footer text from total page
