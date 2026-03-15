# Changelog — Scopewright

> Historique chronologique des modifications significatives.
>
> **Dernière mise à jour** : 2026-03-15

---

## 2026-03-15

### Corrections
- **#188e** : `reprocessDefaultCascades` invalide `matchDefaults` sélectivement — seules les entrées liées au groupe DM modifié (via word-similarity sur `categoryGroupMapping`) sont supprimées, les choix `$match:` des catégories non modifiées sont préservés (DEC-041)
- **#205** : `deduplicateDmByClientText` déduplique aussi par `catalogue_item_id` (seconde passe) — empêche les modales quand plusieurs DM pointent vers le même article
- **#205b** : `resolveCascadeTarget` filtre les DM entries par catégories autorisées (`getAllowedCategoriesForGroup`) avant d'afficher la Modale 1
- **#206** : `filterDmByExpenseRelevance` filtre les DM entries par pertinence `material_costs` avant `showDmChoiceModal` dans les 4 tiers de `getDefaultMaterialKeywords` — empêche l'affichage de Laque/Legrabox quand seuls les panneaux sont pertinents

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
