# CHANGELOG — Scopewright (Stele)

---

## 2026-03-11

### Bug Fixes
- **Fix: #137 PDF — layout multi-images incorrect** — (1) `object-fit:contain` remplacé par `object-fit:cover` dans les CSS overrides PDF — `contain` créait des bandes vides autour des images et des hauteurs variables dans la grille, `cover` reproduit fidèlement le rendu browser. (2) Contrainte hauteur images : `max-height:3.2in` sur `.pv-img-wrap` + `height:100%` sur `img` — empêche les images portrait de déborder et forcer un page-break au milieu de la grille. (3) Contrainte hauteur room-body : `max-height:calc(8.5in - 160px)` sur `.pv-page-room-body` — le contenu texte+images reste sur une seule page PDF. (4) Variant `imgs-4` manquant ajouté (`grid-template-columns:1fr 1fr`) dans le CSS preview et dans SNAPSHOT_CSS — les pièces à 4 images ont maintenant une grille 2×2 explicite

---

## 2026-03-10

### UX
- **Indicateur de sauvegarde — masquer au repos (pattern Linear)** — (1) `showSaveIndicator()` : affiche "Sauvegardé ✓" en `#6B7280` 12px pendant 2s puis fade-out 300ms → invisible au repos. Supporte `showSaveIndicator(true)` pour erreur (rouge `#DC2626`, reste visible). (2) `updateStatus()` (pill catalogue `#dataStatus`) : "Chargement..." et offline/erreur restent visibles. "Données à jour" (online) s'affiche 2s puis fade-out. Au repos : complètement masqué. CSS : `opacity:0` par défaut, classe `.ds-visible`/`.si-visible` pour afficher, `transition: opacity 300ms ease`
- **#141 — Barre de progression lors du recalcul cascade global** — Overlay `rgba(255,255,255,0.6)` sur la zone articles (`.calc-rows` du groupe, pas le header) + barre indeterminate navy 3px + texte "⟳ Recalcul…" `#9CA3AF` 11px. Bloque l'interaction pendant `reprocessDefaultCascades`. Ref-counting (`_cascadeProgressRef`) pour les callers multi-reprocess. Fade-out 150ms. Aucun alert/confirm

### Bug Fixes
- **Fix: #137 PDF — centrage vertical + images manquantes + couverture coupée** — (1) Centrage vertical : `min-height:8.5in!important` sur `.pv-page` (landscape Letter). Le `height:auto` précédent supprimait l'espace vertical → `flex:1` + `justify-content:center` ne fonctionnaient plus. S'applique à toutes les pages (pièces, étapes, why, intro). (2) Page "Pourquoi stele" image manquante : les URLs relatives (`images/why-stele.jpg`) ne sont pas résolvables par PDFShift. Ajout résolution automatique : `baseUrl + src` pour toutes les `<img>` avec src relatif. (3) Couverture coupée : `.pv-page-title{height:8.5in!important}` + `.pv-cover-right{height:calc(8.5in - 64px)!important}` — force le conteneur image à remplir toute la page. (4) Diagnostic : `console.log` taille HTML, présence style block, et sources images
- **Fix: reprocessDefaultCascades — choix matériau mémorisé non respecté** — `dmChoiceCache = {}` vidait **tout** le cache lors d'un changement DM, forçant la re-sélection de tous les types (Panneaux, Façades, etc.) même ceux non modifiés. Fix : invalidation sélective — seules les entrées du type modifié (`groupId:changedGroup`) et les entrées cross-DM (`groupId:cross:*`) sont supprimées. Les choix "Mémoriser pour cette pièce" des autres types sont préservés
- **Fix: Total ligne enfant cascade avec sous-enfants affiché incorrectement** — Les enfants cascade niveau 2+ (ex: Facade Slab) qui ont leurs propres sous-enfants affichaient le total agrégé (parent + descendants) même quand expandés. Cause : `_cascadeExpanded` est `undefined` par défaut (traité comme collapsé) → `updateCollapsedParentTotal` écrivait l'agrégat. Quand le parent niveau 1 était expandé, les totaux des enfants n'étaient pas recalculés. Fix : `applyCascadeVisibility` appelle maintenant `updateCollapsedParentTotal` sur les enfants `cascade-parent-row` quand le parent est expandé
- **Fix: Total enfant cascade agrégé au chargement** — Au `openSubmission()`, les enfants cascade niveau 2+ (`cascade-parent-row`) avaient `_cascadeExpanded[rowId] = undefined` (traité comme collapsé) → affichaient le total agrégé même quand visibles (parent expandé). Fix : après le loop `applyCascadeVisibility`, second pass sur les `_loadedCascadeItems` — pour chaque `cascade-parent-row` dont le parent est expandé, appelle `updateCollapsedParentTotal()` pour afficher le total individuel
- **Diagnostic: findExistingChildForDynamicRule — logs MISS** — Ajout de logs `cascadeLog('warn')` quand `findExistingChildForDynamicRule` ne retrouve pas un enfant existant pour `$default:` ou `$match:`. Détail : `validIds`, `dmClientTexts`, `allowedCats`, IDs enfants non-matchés. Permet de diagnostiquer le bug "changement de dimension déclenche modale choix matériau"
- **Fix: #137 PDF — 4 bugs visuels** — (1) Page couverture : border-radius absent — `.pv-page-title{overflow:hidden!important}` + `-webkit-border-radius:8px!important` sur `.pv-cover-right`. (2) Proportions pages différentes du browser — ajout `<meta name="viewport" content="width=1056">` dans le HTML + `wait_for: "network"` dans l'appel PDFShift (attend chargement fonts/images). (3) Page clauses fond grisâtre — `.pv-page-clause{background:#fff!important}` override le `#fafafa` de SNAPSHOT_CSS. (4) Label "Façades et panneaux apparents" dans les descriptions — UPDATE `project_rooms.client_description` + `client_description_en` ajouté au script SQL phase 2
- **Fix: #98 — Résidu "Façades et panneaux apparents" phase 2** — `'PANNEAUX APPARENTS'` → `'PANNEAUX'` dans les keywords de `formatDescriptionForDisplay()` (presentation-client.js + quote.html). Migration SQL `sql/fix_facades_label_phase2.sql` : purge le vieux label dans `catalogue_items.presentation_rule`, `presentation_rule_human`, `app_config.expense_categories`, `app_config.ai_prompt_*`, et `project_rooms.client_description`
- **Fix: #140 — 4 bugs qty_multiplier** — (1) Enfants cascade n'héritent pas le QM du parent : ajout `propagateQtyMultToCascadeChildren(parentRowId, val)` — récursif, appelé depuis `updateQtyMult()` (même pattern que `propagateInstallationToCascadeChildren`). Fix also dans `executeCascade` : nouveau child QM toujours hérité (pas seulement quand > 1). (2) Quantité auto-calculée non modifiable : `qtyInput.readOnly = true` quand auto-qty (formule) est actif, style gris `#94A3B8`. (3) `openRentab` qty sans qtyMult : ajout `_qmRentab` dans la boucle rows de `openRentab` — `qty *= qtyMult` pour cohérence avec `computeRentabilityData` et `getRowTotal`. (4) Enfants cascade qty non readonly : `readOnly = true` dans `addRow()` (opts.cascade), `executeCascade()` (enfants existants), `openSubmission()` (rechargement). CSS `pointer-events:none` + `cursor:default` sur `.cascade-child .qty-input`
- **Fix: #137 PDF — debug erreur PDFShift** — Affichage de `errData.detail` dans le message d'erreur + download automatique du HTML source (`debug-pdf-source.html`) en cas d'échec pour diagnostic local
- **Fix: #137 PDF — 3 bugs persistants** — (1) Pages blanches : tous les CSS overrides renforcés avec `!important` (`aspect-ratio:unset!important`, `height:auto!important`, `overflow:visible!important`, `min-height:auto!important`, `max-height:none!important`), gap `.pv-content` forcé à 0. (2) `<br>` en texte brut : ajout sanitisation post-clone — regex `&lt;br&gt;` → `<br>` et `&lt;p|strong|em|ul|ol|li&gt;` → vrais tags HTML (double-escaping en DB). (3) Images coupées côté gauche : `object-fit:contain!important` (au lieu de `cover`) + `min-width:0!important` sur `.pv-page-room-media` et `.pv-img-wrap` pour contraindre les images dans leur grille. Debug blob download retiré
- **Fix: #137 PDF — 3 bugs HTML source (session précédente)** — Overrides CSS initiaux (sans `!important`), `textToHtml()` détecte `<br`, overflow hidden sur conteneurs 2-colonnes
- **Fix: Modifier % pièce — lignes cascade non rafraîchies** — `updateCollapsedParentTotal()` utilisait `getRowTotal()` (prix de base sans modificateur) pour afficher l'agrégat collapsé et le total individuel (mode expanded). Après changement du modifier %, le parent FAB affichait un total sans le %. Fix : applique `getModifierMultiplier(groupId)` au total affiché dans `updateCollapsedParentTotal` (both collapsed aggregate and expanded individual paths)

### Features
- **#140 — QTY multiplicateur universel par ligne article** — Nouveau champ `qty_multiplier` (default 1) entre la colonne Type et L×H×P. Multiplie le total de la ligne indépendamment du type de calcul (pi², pi³, unitaire). QTY=1 : chiffre gris très pâle `#D1D5DB`. QTY>1 : navy bold. Intégré dans `getRowTotal`, `updateRow` (3 chemins : normal, auto-qty, barèmes), `computeRentabilityData`, `collectRoomDetail` (AI context). Persisté en DB (`room_items.qty_multiplier`). Hérité par les enfants cascade lors de l'exécution. Pas de re-cascade au changement (ne touche pas les dims). Migration : `sql/qty_multiplier.sql`

### UI/UX
- **Colonne INST. — checkboxes discrètes** — Remplacement des checkboxes natives (noires, `accent-color`) par des custom checkboxes CSS. Cochée : fond `#EFF6FF`, checkmark `#93C5FD`, bordure `#BFDBFE`. Décochée : bordure `#E5E7EB`, fond blanc, quasi invisible. Transition 150ms. Logique `toggleRowInstallation` / `propagateInstallationToCascadeChildren` inchangée

---

## 2026-03-09

### Migration
- **#137 — Migration PDF : html2pdf → PDFShift** — Remplacement complet du système d'export PDF client-side (html2pdf.js/html2canvas/jsPDF) par un rendu server-side via PDFShift API (Chromium). Nouvelle Edge Function `pdf-export` (`supabase/functions/pdf-export/index.ts`). `shared/pdf-export.js` réécrit : collecte HTML autoportant (SNAPSHOT_CSS inline + Google Fonts) → `authenticatedFetch()` vers Edge Function → PDFShift API → blob PDF → download. Suppression CDN html2pdf.js de calculateur.html. Tous les hacks html2canvas retirés (conversion table-layout, base64 images, injection CSS dans document.head). Flex/grid fonctionnent nativement avec Chromium. Secret requis : `PDFSHIFT_API_KEY`

### Features
- **#139 — Style Guide UI** — Création de `docs/STYLE_GUIDE.md` : guide visuel complet (palette, typographie, espacement, boutons, cartes, tables, inputs, pattern AI dot, animations). Section "Références obligatoires" ajoutée dans CLAUDE.md. Directive : lire le style guide avant tout travail UI. Attio ajouté comme référence principale d'inspiration UI
- **#132 fix palette finale — Vert unifié modal rentabilité** — Remplacé teal (#0D9488) par vert standard #22C55E dans tout le modal rentabilité : KPI profit (fond #F0FDF4, bordure #BBF7D0), barre répartition profit, badges marges OK (#16A34A). Un seul vert dans toute l'app (#22C55E) pour statuts ET métriques financières positives

### Documentation
- **Maintenance complète** — Mise à jour de tous les docs (CLAUDE.md, TECHNICAL_MANUAL, AUDIT_REPORT, USER_GUIDE, CHANGELOG, STYLE_GUIDE) pour refléter l'état réel du code. Correction line counts (`admin.html` 3300→3580). Création `docs/sessions/SESSION_2026-03-09.md`
- **#137 — Export PDF** — Bouton PDF dans la toolbar preview du calculateur. Export client-side via html2pdf.js (html2canvas + jsPDF). Format landscape letter, JPEG 0.95, scale 2. Remplace la signature interactive par des lignes imprimables. Fichier : `shared/pdf-export.js` (~268 lignes)
- **#138 suite — AI catégories de dépense** — Chaque catégorie de dépense dans admin.html a maintenant deux boutons AI : **Template calcul** → génère le JSON `calc_rule` (action `catalogue_calc_rule`), **Template présentation** → génère le JSON `presentation_rule` (action `catalogue_pres_rule`). Nouveau champ `calc_rule` persisté dans `expense_categories[n].calc_rule`. Fonctions : `aiExpenseCalcRule`, `aiExpensePresRule`, `_getExpenseContext`, `_showExpenseFeedback`

### Features (continued)
- **#138 — Règle de présentation sur catégories de dépense** — Les `expense_categories` supportent un champ `presentation_rule` JSON (même structure que `catalogue_items.presentation_rule` : `{sections, exclude, notes}`). Textarea JSON dans admin.html par catégorie de dépense. Nouvelle action AI `expense_pres_rule` (Sonnet 4, JSON prefill) dans la edge function `translate`. Nouveau prompt `ai_prompt_expense_pres_rule` dans le dropdown admin. Fallback dans le calculateur : `_findGroupPresRule(catItem)` utilise la règle du groupe quand l'article n'a pas de `presentation_rule_human` (résolution via clés `material_costs` puis catégorie catalogue). Contexte AI catalogue : `getPresRuleJsons()` injecte les règles JSON des groupes dans `aiCatalogueExplication()`
- **Fix: `loadAiPrompts()` whitelist** — `ai_prompt_labor_modifiers` manquait dans la whitelist de `loadAiPrompts()` dans admin.html

### Bug Fixes
- **Fix: #137 PDF — 3 bugs critiques** — (1) Pages blanches intercalées : supprimé `page-break-after:always` redondant dans SNAPSHOT_CSS `@media print` (doublon avec `page-break-before` dans pdf-export.js). (2) HTML brut dans descriptions : ajouté `<br` à la détection HTML de `textToHtml()` (presentation-client.js) + corrigé conversion textarea→div dans pdf-export.js (`textContent` → `innerHTML` avec `escapeHtml` + newlines→`<br>`). (3) Texte coupé 2 colonnes : converti tous les layouts flex/grid en `display:table`/`table-cell` avec largeurs % fixes (room body, intro, why stele, signature page) pour compatibilité html2canvas
- **Fix: #138 — Align admin expense AI buttons with catalogue modal pattern** — Replaced custom CSS (`.expense-ai-btn`, `.expense-ai-wrap`, `.expense-ai-feedback`) with catalogue modal pattern (`.ai-field-wrap`, `.btn-ai-dot` absolute positioned, `.ai-feedback-container`/`.ai-feedback-banner`). Same animations: `aiBreathe`, `aiBreatheFast`, `ai-done`, `aiSuccessFlash`. Functions renamed to `_flashAiSuccess`/`_flashAiDotDone` (local versions of catalogue pattern)
- **Fix: Strip "prefix" from AI pres_rule responses** — `delete s.prefix` applied on all `pres_rule` AI response paths (catalogue `aiCatalogueExplication`, admin `regenOneItem` and `aiExpensePresRule`). Fixed `fixEnvelopeJsonSplit` keys from `['sections','order','prefix']` to `['sections','exclude','notes']` to match actual `presentation_rule` schema
- **Fix: #137 PDF layout v2** — Page breaks via CSS `.pv-page:not(:first-child){page-break-before:always}` (élimine les pages blanches). Page total+signature reconstruite en layout 2 colonnes identique à quote.html "Votre projet est prêt" : texte de clôture émotionnel à gauche, total + lignes signature à droite. `.pv-total-box` masqué via `display:none`. Bilingue FR/EN
- **Fix: PDF page blanche** — Trois correctifs : (1) SNAPSHOT_CSS injecté dans `document.head` (html2canvas lit `document.styleSheets`), (2) positionnement à `left:0` au lieu de `-9999px`, (3) suppression de l'insertion DOM manuelle — `html2pdf.toContainer()` gère son propre overlay, l'insertion manuelle causait des conflits de lifecycle
- **Fix: Images blanches PDF** — Les images Supabase Storage (cross-origin) sont converties en base64 data URLs avant le rendu html2canvas
- **Fix: Flèches scroll textareas admin** — Suppression des flèches haut/bas natives Windows sur les textareas `.input-template` dans admin.html (section catégories de dépense). Scrollbar fine 6px sans boutons via `::-webkit-scrollbar-button{display:none}` + `scrollbar-width:thin`
- **Fix: Label "Façades et panneaux apparents"** — Résidu legacy remplacé dans 5 fichiers. Keywords description : `'PANNEAUX APPARENTS'` séparé de `'FAÇADES'` (presentation-client.js, quote.html). Prompt AI pres_rule : label `"Façades"` (translate edge function). Seed SQL : `material_groups` et `category_group_mapping` scindés en `"Façades"` + `"Panneaux"`. Migration prod : `sql/fix_facades_label.sql`

### Database
- `sql/org_name.sql` — INSERT `org_name` dans `app_config` (nom organisation pour le filename PDF)
- `sql/fix_facades_label.sql` — Migration phase 1 : scinde `"Façades et panneaux apparents"` en `"Façades"` + `"Panneaux"` dans `app_config` (material_groups + category_group_mapping)
- `sql/fix_facades_label_phase2.sql` — Migration phase 2 : purge le vieux label dans `catalogue_items.presentation_rule`, `presentation_rule_human`, `app_config.expense_categories`, `app_config.ai_prompt_*`

---

## 2026-03-08

### Features
- **#135 — Panneau proposition AI description** — Le dot (•) sur le calculateur n'écrit plus directement dans le champ description. Affiche un panneau inline avec la proposition, 3 boutons : Remplacer tout / Insérer la sélection (contextuel) / Ignorer
- **#126 phase 1 — Extraction shared/presentation-client.js** — 30 fonctions (~728 lignes) extraites de calculateur.html : helpers texte, descriptions, clauses, images, snapshot, status UI

### UI — Rentabilité (#132)
- **Tri-state color thresholds** — Profit net : vert ≥15%, orange 8-14.9%, rouge <8%. Marge brute : vert ≥35%, orange 25-34.9%, rouge <25%. Bannière AI seuil fixe 35%
- **KPI cost card** — Coût direct = matériaux + perte + salaires (sans frais fixes)
- **Desaturation palette** — Cartes KPI fond blanc, barre répartition muted, boutons navy, badges doux
- **Alignement Scopewright** — Palette complète tokens (#111827 texte, #94A3B8 labels, #E5E7EB bordures, #F8FAFC surfaces)

### Bug Fixes
- **Fix: Modificateur % prix vente** — `openRentab` ignorait le room modifier % sur le prix de vente

---

## 2026-03-07

### Features — Rentabilité (#132)
- **Redesign modale rentabilité** — Layout mockup : 4 sections (KPI cards, barre répartition, marges + ventilation MO, tableau matériaux + tags)
- **Bouton "Ajuster le prix"** — Calcule le prix cible pour atteindre la marge visée (38%), applique via room modifier %
- **`computeRentabilityPure`** — Fonction pure testable dans cascade-helpers.js, 17 tests (GROUP 28)

### Bug Fixes
- **Fix: Formule markup** — Markup s'applique sur `(coût + perte)`, pas `(coût + perte + markup)` séparément. Formule : `coût × (1 + waste%) × (1 + markup%)`

---

## 2026-03-06

### Features — Barèmes et modificateurs
- **Labor modifiers** — Système de barèmes dimensionnels automatiques. Section séparée dans la modale catalogue (admin), JSON `labor_modifiers` sur `catalogue_items`
- **Popover 3 colonnes** — Cat | Auto | Manuel. Valeurs auto-factorisées visibles, banner bleu si barème actif
- **AI barèmes** — Bouton AI + action `catalogue_labor_modifiers` dans translate edge function, prompt `ai_prompt_labor_modifiers`
- **AI merge protection** — `aiCalcRuleGenerate()` préserve `ask`, `override_children`, `child_dims`, `labor_modifiers` lors de la regénération AI
- **Validation barèmes** — Vérification des clés `labor_factor`/`material_factor` contre les départements MO et catégories matériaux à la sauvegarde
- **Mode cumulatif** — `"cumulative": true` : tous les modificateurs vrais appliqués, facteurs multipliés (pas first-match)
- **Dims sur MAT** — Champs dims (L/H/P) affichés pour tout article avec `dims_config` explicite, pas seulement FAB. Guard auto-qty étendu
- **Dupliquer un article** — Bouton dans la modale catalogue, copie toutes les données sauf `is_default` et `status`
- **Suggestions texte client** — Autocomplete Levenshtein en temps réel dans le champ `editClientText`
- **Modale reste ouverte** — Save garde la modale ouverte, toast "Sauvegardé ✓" 2.5s, fermeture manuelle

### Features — Cascade
- **Collapse enfants cascade** — Masqués par défaut, triangle ▶ sur le parent, badge (+N), total agrégé récursif
- **Cascade suppressed** — Suppression manuelle d'enfants cascade mémorisée, bouton ⊘ pour restaurer
- **Cascade manual edit** — Indicateur modification manuelle (bordure indigo), bouton ↺ revert
- **Enfants cascade manuels** — `addRow(groupId, { parentRowId })` pour ajout manuel sous un parent FAB

### Features — AI
- **Tool `remove_item`** — Supprime un article via UUID, récursif sur enfants cascade, jamais auto-exécuté
- **Undo stack** — Max 10 entrées, bouton flottant ↩ 8s auto-hide, restaure après suppression/modification overrides

### Features — Dims
- **`n_portes` / `n_tiroirs`** — Variables caisson UI + substitution `evalFormula`. 0 valide, null bloque
- **`child_dims` + multi-instance** — Formules dimensionnelles sur règles cascade + N lignes distinctes quand qty > 1
- **Parser fractions** — Inputs dims acceptent `3/4`, `1 1/2`, `23 5/8`. Conversion auto au blur

### Database
- `sql/labor_modifiers.sql` — `labor_modifiers` JSONB + `labor_modifiers_human` TEXT sur `catalogue_items`, `labor_auto_modifier` JSONB sur `room_items`
- `sql/cascade_suppressed.sql` — `cascade_suppressed` JSONB sur `room_items`
- `sql/caisson_portes_tiroirs.sql` — `n_portes` + `n_tiroirs` INT sur `room_items`
- `sql/catalogue_change_log.sql` — Table `catalogue_change_log` (audit AI)
- `sql/line_overrides.sql` — `labor_override`, `material_override`, `price_override` sur `room_items`

### Tests
- **19 fonctions testées**, 282 assertions en 28 groupes (0 dépendances)
- Groupes 17-19 : evaluateLaborModifiers (basic, formulas, integration)
- Groupes 20-21 : checkDefaultItemMatchCategory, child_dims
- Groupes 22-23 : undo stack, token optimization
- Groupe 24 : cumulative baremes
- Groupe 25 : MAT with dims_config
- Groupe 26 : parseFraction
- Groupe 27 : calculation_rule_ai fallback
- Groupe 28 : computeRentabilityPure (17 tests)

---

## 2026-03-05

### Features — Moteur cascade
- **Override par ligne** — Ajustements MO, matériaux, prix de vente par ligne sans modifier le catalogue. Popover ⚙, indicateur violet, persistance DB
- **Tool `update_submission_line`** — AI tool pour overrides MO/matériaux/prix, jamais auto-exécuté
- **Tool `update_catalogue_item`** — Modification catalogue depuis l'AI avec audit trail, auto-exécuté après confirmation
- **skipCascade** — Règle systématique : toute fonction non-dimensionnelle passe `{ skipCascade: true }` à `updateRow`
- **Anti-lignes vides** — 3 gardes : skip save sans article, blur remove après 2s, filtre openSubmission
- **Installation propagation** — `propagateInstallationToCascadeChildren` récursif avec `skipCascade: true`
- **Quantités cascade** — Distinction constante × rootQty vs formule = total (regex variables)

### Features — AI
- **tool_use/tool_result sanitization** — `sanitizeConversationToolUse` injecte des `tool_result` synthétiques pour orphelins
- **Rate limit auto-retry** — 429/529 → message temporaire, 15s, 1 retry
- **Cascade debug logs** — Buffer circulaire 200 entrées, inclusion conditionnelle dans le contexte AI
- **Images annotées rasterisées** — `rasterizeAnnotatedImage()` pour AI (JPEG 0.92)

### Bug Fixes
- **Fix: rootQty constant vs formula** — Détection par regex des variables dimensionnelles
- **Fix: $match context propagation** — `_defaultResolvedFresh` flag pour résolution fraîche après changement DM
- **Fix: override_children** — Bloquait les propres règles du déclarant, corrigé : seuls les descendants bloqués
- **Fix: instruction in catalogueSummary** — Inclus correctement dans le résumé AI
- **Fix: PDF upload sanitisation** — NFD strip accents, caractères spéciaux nettoyés

---

## 2026-03-03

### Features — Moteur cascade & audit catalogue
- **Catégorie de dépense dynamique** — `$match:` dérive les catégories effectives depuis les clés `material_costs` du DM choisi via word-similarity (ex: `$match:PANNEAU BOIS` → détecte aussi `PANNEAU MÉLAMINE` via le mot commun "PANNEAU")
- **materialCtx propagation** — Contexte matériau hérité parent → enfant → petit-enfant dans les cascades. Pré-peuplé depuis le DM de la catégorie du parent FAB racine, utilisé pour disambiguer les choix DM multi-entrées
- **Persistence immédiate cascade** — `executeCascade` appelle `updateItem()` directement après chaque création/modification d'enfant, contournant le debounce global qui causait une perte de données
- **Audit catalogue : textes clients similaires** — Check 11 : groupement par `normalizeForGrouping()` (accents, articles FR). Bouton "Uniformiser" pour batch-PATCH les variantes minoritaires
- **Audit catalogue : clés dépense similaires** — Check 12 : `normalizeExpenseKey()` détecte "PANNEAU BOIS" vs "PANNEAUX BOIS" (pluriel S/X)
- **Labels modales** — `showMatchChoiceModal` et `showTechnicalItemModal` affichent `description` au lieu de `client_text` pour une meilleure disambiguation

### Bug Fixes
- **Fix: Perte données cascade (debounce)** — `debouncedSaveItem` utilisait un timer global unique : les créations rapides de 3+ enfants annulaient les saves intermédiaires. Corrigé par persist immédiat
- **Fix: Guard ask 0 tablettes** — `n_tablettes`/`n_partitions` vérifiaient `> 0` mais 0 est valide pour les caissons. Corrigé : vérifie `!= null` (défini)
- **Fix: Régression $match** — `findExistingChildForDynamicRule` avait un fallback catégorie qui permettait aux `$default:` de voler les enfants `$match:`. Fallback supprimé

### Code shared/
- **shared/auth.js** — `authenticatedFetch()` extrait (7 fichiers → 1)
- **shared/utils.js** — `escapeHtml()` / `escapeAttr()` extrait (8 fichiers → 1)
- **shared/pricing.js** — `computeComposedPrice()` / `computeCatItemPrice()` extrait (3 fichiers → 1)

---

## 2026-02-20

### Features — Rebranding & AI assistants
- **Rebranding visuel** — Passage du vert Stele au bleu marine Scopewright (#0B1220) sur toutes les pages internes
- **Header uniforme** — 56px, logo Scopewright + lien "← Menu", identique sur toutes les pages
- **Dashboard split screen** — Panneau gauche (cartes), panneau droit (branding Scopewright)
- **Login split screen** — Même pattern que le dashboard
- **Assistant AI catalogue** — Drawer latéral avec streaming SSE, CRUD items, reverse pricing
- **Assistant AI contacts** — Drawer latéral sur la page contacts
- **AI prompt editor** — Section dans admin.html pour personnaliser les prompts AI (app_config `ai_prompt_overrides`)
- **Catalogue single table** — Refonte : table unique avec dropdown catégorie (plus d'onglets), barre de recherche, tri colonnes
- **Bouton AI uniforme** — Cercle subtil avec breathing animation sur toutes les pages
- **Clients → Contacts** — Renommage global
- **Approbation directe** — Badge pending cliquable pour approuver les items catalogue

### Edge Functions
- **Deployed `catalogue-import`** — Streaming SSE, CRUD catalogue items
- **Deployed `contacts-import`** — Streaming SSE, actions contacts

### Bug Fixes
- **Fix: AI approval status** — L'assistant catalogue voit maintenant le statut d'approbation des articles
- **Fix: Preview band color** — La bande de l'aperçu soumission reste verte (client-facing)
- **Fix: Dashboard layout** — Marges 48px égales, centrage vertical du contenu
- **Fix: Rentability modal total** — Correction du calcul total
- **Fix: AI filter action** — Le filtrage AI agit directement sur la table au lieu d'afficher dans le chat

---

## 2026-02-17

### Features — Pipeline commercial
- **Pipeline views** — 3 vues pour la page projets : Table (14 colonnes triables), Cartes (enrichies avec statut/montant/deadline), Soumissions (toutes les soumissions avec mini-timeline)
- **Pipeline statuses** — Statuts configurables via admin.html (A contacter → Vendu/Perdu), badges colorés
- **Filter bar** — Recherche texte + filtres par statut pipeline, responsable, type de projet
- **Project pipeline fields** — Montant estimé, probabilité, pondéré, responsable, priorité, source, type, deadlines (internes + client), dates prévues
- **Submission assignment** — Estimateur, Vendeur/CP, Approbateur (dropdowns employés), deadlines par soumission, auto-save
- **Enhanced edit info modal** — Tous les champs pipeline (statut, source, type, montant, probabilité slider, responsable, priorité, dates)
- **Admin config** — 3 nouvelles sections : Statuts du pipeline (label + couleur + slug), Sources de projet, Types de projet

### Database Changes
- `sql/pipeline_projects.sql` — 11 nouvelles colonnes sur `projects` (pipeline_status, source, project_type, estimated_amount, probability, assigned_to, priority, expected_start_date, expected_end_date, internal_deadline, client_deadline) + index
- `sql/pipeline_submissions.sql` — 5 nouvelles colonnes sur `submissions` (estimateur, vendeur_cp, approbateur, internal_deadline, client_deadline)
- `app_config` keys: `pipeline_statuses`, `project_sources`, `project_types`

---

## 2026-02-15

### Features
- **Sortable columns** — Clic sur les en-têtes Tag, Article, Prix unit., Quantité, Total pour trier les lignes asc/desc dans chaque meuble (`sortGroupRows`, `getRowSortValue`)
- **Granular tag filter** — La barre de filtre par tag supporte maintenant les tags exacts (C1, C2) en plus des préfixes (C). Chips granulaires affichés quand un préfixe est actif
- **Tag annotation tool** — Modal plein écran pour placer des labels de tags (C1, F1, P1) sur les images des meubles avec SVG overlay, drag & drop, mode flèche, auto-numérotation
- **Rentability by tag** — Ventilation par préfixe de tag dans le modal Rentabilité (prix vente, heures, matériaux, profit, marge)
- **Tag filter bar** — Barre de filtrage rapide par préfixe de tag au-dessus des meubles du calculateur
- **AI assistant chatbox** — Drawer latéral avec Claude Sonnet 4.5, 6 outils (rentabilité, descriptions, ajout articles, quantités, suggestions, comparaison versions), mode simulation avec confirmation
- **AI per-room focus** — Bouton "AI" sur chaque meuble pour restreindre le scope de l'assistant à une pièce
- **Chat persistence** — Messages AI sauvés dans table `chat_messages` par soumission
- **Tag system** — Colonne `tag` sur `room_items`, nomenclature configurable dans admin.html (`tag_prefixes`)
- **Default materials rewrite** — Section matériaux par défaut refaite : dropdown 6 types fixes + autocomplete catalogue avec navigation scrollable
- **PDF capture fix** — Captures d'écran depuis le viewer PDF inline maintenant fonctionnelles (redirigées vers le crop modal existant)
- **Browseable catalogue autocomplete** — L'autocomplete des matériaux par défaut affiche tous les items groupés par catégorie au focus

### Bug Fixes
- **Fix: Duplicate ID admin.html** — `sectionTags` dupliqué empêchait l'ouverture de "Nomenclature des tags" → renommé `sectionTagPrefixes`
- **Fix: AI cache stale data** — `aiClientFileCache`, `aiFocusGroupId`, `aiCurrentScope` réinitialisés dans `resetAiChat()`
- **Fix: Inline PDF capture** — 5 bugs corrigés (mauvais bucket, mauvais schéma, pas de crop, pas de mediaId retourné, mauvais tags)
- **Fix: Annotation button visibility** — Bouton crayon maintenant toujours visible (opacity 0.7) au lieu de seulement au hover

### Database Changes
- `ALTER TABLE room_items ADD COLUMN tag TEXT DEFAULT NULL` (sql/tags.sql)
- `INSERT INTO app_config tag_prefixes` — nomenclature C/F/P/T/M/A (sql/tags.sql)
- `ALTER TABLE submissions ADD COLUMN default_materials JSONB DEFAULT '{}'` (sql/default_materials.sql)
- `ALTER TABLE room_media ADD COLUMN annotations JSONB DEFAULT '[]'` (sql/annotations.sql)
- `CREATE TABLE chat_messages` + RLS + index (sql/chat_messages.sql)

### Edge Functions
- **Deployed `ai-assistant`** — Claude Sonnet 4.5, 6 tools, JWT verified
- Existing `translate` unchanged

---

## 2026-02-14

### Features
- **Translate Edge Function** — 3 modes: FR→EN, EN→FR, optimize descriptions
- **PDF viewer standalone** — Nouvelle fenêtre avec pdf.js, navigation, zoom, capture d'écran
- **Loading animation** — Animation de chargement dans le viewer PDF standalone
- **Crop modal for PDF captures** — Capture → crop modal → sauvegarde dans room_media

### Bug Fixes
- **Fix: PDF captures instant display** — Les captures PDF apparaissent immédiatement dans les rooms
- **Fix: Favicon background** — Changé en noir

---

## 2026-02-12

### Features
- **Enriched snapshots** — Versions incluent projectName, clientName, designer, clauses, mediaUrls
- **Emergency unlock** — Remettre en brouillon avec audit immuable (nom, raison, IP)
- **Submission duplication** — Copie profonde via RPC `duplicate_submission`
- **Proof of acceptance** — Page verte dans la présentation avec signature, méthode, date, IP
- **Offline acceptance** — Confirmer vente par autre moyen (courriel, téléphone, papier)

---

## 2026-02-10

### Features
- **Audit complet** — Premier audit de sécurité et qualité du code (score: 6.5/10)
- **Clause library** — Drag-and-drop de clauses contractuelles dans les soumissions
- **FR/EN translation** — Toggle langue dans l'aperçu, dictionnaire i18n pour labels
- **Fullscreen presentation** — Navigation page par page (Fullscreen API)
- **Client view** — Mode lecture seule dans l'aperçu
- **Preview mode** — Vue prévisualisation landscape 8½×11

---

## 2026-02-08

### Features
- **Submission workflow** — 7 statuts (draft → invoiced), approbation interne, bypass, auto-approbation
- **Content freeze** — Verrouillage complet après envoi client
- **Bypass approval** — Envoyer directement sans approbation (permission dédiée, log immuable)

---

## 2026-02-05

### Features
- **Public quote (quote.html)** — Page publique avec signature canvas + acceptation en ligne
- **Composed pricing** — Prix = labor_minutes × taux_horaire + material_costs × (1 + markup + waste)
- **Installation toggle** — Par meuble et par ligne, exclut département Installation du calcul

---

## 2026-01-29

### Features
- **Calculator MVP** — Projets, soumissions, meubles, lignes avec catalogue
- **Image management** — Upload, compression, lightbox, Supabase Storage
- **Permissions system** — 6 rôles, 12 permissions, matrice dans admin.html
- **Catalogue CRUD** — Ajouter, éditer, supprimer items avec images et PDF
- **Email estimation** — Via Google Apps Script (HTML + PDF)
