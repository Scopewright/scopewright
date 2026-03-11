# CLAUDE.md — Instructions pour Claude Code

> Ce fichier est lu automatiquement par Claude Code à l'ouverture du projet.
> Documentation détaillée : `docs/TECHNICAL_MANUAL.md` (architecture complète) et `docs/AUDIT_REPORT.md` (sécurité, bugs, risques).

## Architecture du projet

Scopewright est une application web pour l'estimation de cuisines et meubles sur mesure.

- **Pas de build system** — Chaque page est un fichier HTML autonome avec CSS + JS inline
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI** : Anthropic API — Claude Sonnet 4.5 (assistant), Haiku 4.5 (traduction), Sonnet 4 (JSON)
- **Déploiement** : Netlify auto-deploy depuis GitHub (branche `main`)
- **Email** : Google Apps Script (envoi soumissions par courriel)
- **Pas de framework JS** — Vanilla JS uniquement, pas de React/Vue/Angular

## Fichiers clés

| Fichier | Rôle | Taille |
|---------|------|--------|
| `calculateur.html` | App principale — projets, pipeline, soumissions, meubles, cascade engine, DM system, AI chatbox, annotations, preview | ~21 700 lignes |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — CRUD items, images, prix composé, AI import | ~8 500 lignes |
| `admin.html` | Administration — permissions, rôles, catégories, taux, tags, prompts AI, présentation | ~3 580 lignes |
| `approbation.html` | Approbation soumissions + items proposés, AI review chat | ~2 200 lignes |
| `clients.html` | CRM — contacts, entreprises, communications, AI import | ~2 280 lignes |
| `quote.html` | Vue client publique — soumission multi-page + acceptation + signature | ~2 080 lignes |
| `fiche.html` | Fiches de vente produits — présentation client d'un article catalogue | ~1 120 lignes |
| `app.html` | Tableau de bord — grille 2 colonnes responsive, navigation modules | ~685 lignes |
| `login.html` | Authentification Supabase — email/password, refresh token | ~247 lignes |
| `scopewright-tokens.css` | Design tokens — couleurs, rayons, ombres, espacements | Variables CSS |
| `google_apps_script.gs` | Envoi email estimation (GAS) | ~240 lignes |

## Fichiers partagés (`shared/`)

| Fichier | Contenu | Utilisé par |
|---------|---------|-------------|
| `shared/auth.js` | `SUPABASE_URL`, `SUPABASE_KEY`, `authenticatedFetch()`, `refreshAccessToken()`, `isTokenExpiringSoon()`, `_tokenDebug()` | Toutes les pages authentifiées (7 fichiers) |
| `shared/utils.js` | `escapeHtml()`, `escapeAttr()` | Toutes les pages qui affichent des données utilisateur (8 fichiers) |
| `shared/pricing.js` | `computeComposedPrice(item, includeInstallation)` (flat costs), `computeCatItemPrice(item)` ({cost,qty} objects) | calculateur, catalogue, approbation |
| `shared/presentation-client.js` | Texte (`textToHtml`, `htmlToText`, `formatDescriptionForDisplay`, `toSentenceCase`), descriptions (`assembleRoomDescription`, `editClientDescription`, `saveClientDescription`…), clauses (CRUD + drag-drop, 17 fonctions), images (`toggleImageShowInQuote`, `toggleImageAiRef`), snapshot (`generateSnapshotHtml`, `uploadSnapshot`, `getSnapshotUrl`), status UI (`updateStatusBadge`, `updateStatusTimeline`) | calculateur |
| `shared/pdf-export.js` | `exportSubmissionPdf()`, `_sanitizePdfFilename()` — Export PDF server-side via PDFShift API (Edge Function `pdf-export`) | calculateur |

**Note** : `shared/auth.js` utilise `var` (pas `const`) pour éviter les erreurs de redéclaration entre `<script>` tags.

## Conventions de code

- **Langage** : HTML + CSS + JavaScript vanilla (ES6+ ok, mais pas de modules)
- **Variables** : `var` pour scope fonction (code legacy + shared/), `let`/`const` pour nouveau code
- **Nommage** : camelCase pour fonctions/variables, UPPER_SNAKE pour constantes
- **Supabase** : Toujours utiliser `authenticatedFetch()` (importé depuis `shared/auth.js`) pour les requêtes
- **Sécurité** : Toujours appliquer `escapeHtml()` / `escapeAttr()` (importés depuis `shared/utils.js`) pour les données utilisateur dans innerHTML
- **IDs DOM** : Pattern `${groupId}-rows`, `${groupId}-total`, `${rowId}-unit-price` etc.
- **Maps DOM↔DB** : `roomMap[groupDomId] = supabaseRoomUUID`, `itemMap[rowDomId] = supabaseItemUUID`

## Namespaces (`calculateur.html`)

9 objets `window.*` regroupent les ~470 fonctions et variables d'état par domaine :

| Namespace | Domaine |
|-----------|---------|
| `App` | État core (`currentProject`, `roomMap`…), navigation, auth |
| `UI` | Dialogues, formatage, lightbox, animation, timeline |
| `Db` | CRUD Supabase (projets, soumissions, rooms, items, config) |
| `Cascade` | Moteur cascade, contraintes, matériaux par défaut |
| `Ai` | Assistant AI (drawer, messages, contexte, exécution outils) |
| `Calc` | Calculateur UI (lignes, groupes, modificateurs, totaux) |
| `Pipeline` | Liste projets, vues pipeline, contacts, infos projet |
| `Workflow` | Machine d'état soumission, envoi, approbation, versions |
| `Media` | Images, annotations, PDF, plans, preview, clauses, snapshot |

**Références, pas copies** — les globals originaux restent intacts. Tout `onclick="fn()"` continue de fonctionner. Nouveau code peut utiliser l'un ou l'autre : `executeCascade()` ou `Cascade.executeCascade()`.

**Variables d'état** via `get`/`set` (alias live bidirectionnels) : `App.currentProject = x` modifie la variable globale `currentProject`.

## Design system et branding

### Tokens CSS (`scopewright-tokens.css`)

Toutes les pages internes utilisent le système de tokens Scopewright :

| Token | Valeur | Usage |
|-------|--------|-------|
| `--sw-navy` | `#0B1220` | Couleur principale (boutons, accents) |
| `--sw-navy-hover` | `#080E18` | Hover sur boutons primaires |
| `--sw-text` | `#0F172A` | Texte principal |
| `--sw-text-2` | `#64748B` | Texte secondaire |
| `--sw-muted` | `#94A3B8` | Placeholders, texte désactivé |
| `--sw-bg` | `#F8FAFC` | Fond de page |
| `--sw-surface` | `#FFFFFF` | Fond des cartes/inputs |
| `--sw-border` | `#E2E8F0` | Bordures principales |
| `--sw-border-2` | `#F1F5F9` | Bordures subtiles |

**Rayons** : input 10px, btn 10px, card 14px, modal 16px, dropdown 12px, pill 999px
**Ombres** : card `rgba(15,23,42,0.06)`, modal `rgba(15,23,42,0.12)`, primary `rgba(11,18,32,0.18)`
**Espacement** : multiples de 8 (8, 12, 16, 24, 32, 40, 48, 64)
**Police** : Inter + system fallbacks

### Pages client-facing (exception)

`quote.html` et les pages client conservent le branding Stele original :
- `--stele-black: #0A0203`, `--stele-green: #4b6050`, `--stele-gray: #C8C8C8`
- Police secondaire : Cormorant Garamond (titres soumission)
- **Images** : chargées via `get_public_room_media(p_token)` RPC (SECURITY DEFINER, bypass RLS). Migration : `sql/get_public_room_media.sql`
- **Clauses** : `sub.clauses` via `get_public_quote` RPC (nécessite `s.clauses` dans le SELECT — migration `sql/fix_get_public_quote_clauses.sql`)

### Classes utilitaires

- `.sw-btn-primary` / `.sw-btn-secondary` — Boutons standardisés (hauteur 44px)
- `.sw-input` — Inputs standardisés (hauteur 44px, border-radius 10px)
- `.sw-card` — Carte avec border + hover shadow
- `.sw-badge` — Badge pill (hauteur 28px)
- `.ai-assistant-btn` — Bouton AI (dot animé breathing)

## Conventions UI

### Custom dropdown (OBLIGATOIRE — jamais de `<select>` natif)

Pattern Linear/Notion. Référence : `openStatusDropdown()` dans calculateur.html.

- `position: fixed`, `border-radius: 10px`, animation scale+fade
- Items : dot couleur + label + checkmark (✓) pour sélection courante
- Clavier : ↑↓ navigation, Enter sélection, Escape fermeture
- Click outside ferme le dropdown
- Flip automatique vers le haut si trop proche du bas de l'écran

### Custom date picker (OBLIGATOIRE — jamais de `<input type="date">` natif)

Pattern Apple/Linear. Référence : `openDatePicker()` dans calculateur.html.

- `position: fixed`, `border-radius: 12px`, 264px wide, animation sdFadeIn
- Header : mois/année + chevrons ‹ › navigation
- Grille : 7 colonnes Lu-Di, jours cliquables
- Jour sélectionné : fond navy `#0F1C2D` texte blanc
- Aujourd'hui : outline `box-shadow: inset 0 0 0 1.5px #cbd5e1`
- Footer : bouton "Aujourd'hui" + "Effacer" (si date existante)
- Valeur stockée : ISO `YYYY-MM-DD`

### Custom dialog (`steleConfirm` / `steleAlert`)

Chaque fichier HTML a sa propre implémentation (pas encore extrait dans shared/).
Les IDs DOM et signatures varient entre fichiers — harmonisation future planifiée.

## Systèmes principaux

### Moteur de cascade (`executeCascade`)

Crée automatiquement des lignes enfants basées sur les règles `cascade` d'un article FAB parent.
- Récursion jusqu'à **3 niveaux** de profondeur
- 3 types de cibles : code direct (`"ST-0042"`), matériau par défaut (`"$default:Facade"`), correspondance fuzzy (`"$match:BANDE DE CHANT"`)
- **`normalizeDmType(str)`** : normalise un nom de type DM pour comparaison — lowercase, strip accents (NFD), strip pluriel français trailing `s`/`x`. Utilisé dans `resolveCascadeTarget`, `findExistingChildForDynamicRule`, et `getDefaultMaterialKeywords` tier 1. Permet `$default:Facade` de matcher DM type `"Façades"`
- `override_children` : empêche la duplication de matériaux cascade entre niveaux. L'item qui **déclare** l'override traite toujours ses propres règles — seuls ses **descendants** sont bloqués (check contre `parentOverrides`, pas `mergedOverrides`). **Autonomie FAB** : à la récursion, si l'enfant est un FAB (`item_type === 'fabrication'`), `mergedOverrides` est remplacé par `[]` — les FAB enfants sont autonomes et gèrent leurs propres catégories de dépense. Leur propre `override_children` (s'il existe) s'applique normalement à leurs descendants
- `$match:` candidates : **catégorie de dépense dynamique** — la catégorie dans la règle (ex: `"PANNEAU BOIS"`) est un **hint**, pas un filtre littéral. `resolveMatchTarget` dérive la catégorie réelle depuis le DM : 1) **room DM direct par type** (prioritaire — spécifique à la catégorie cible), 2) fallback `materialCtx.chosenClientText` → lookup catalogue → clés `material_costs` (hérité du parent, potentiellement d'un domaine différent). Les clés DM partageant un **mot commun** avec la règle sont incluses (ex: `"PANNEAU MÉLAMINE"` matche `"PANNEAU BOIS"` via `"PANNEAU"`). `effectiveExpCats` = union de toutes les catégories pertinentes. `findExistingChildForDynamicRule` utilise la même similarité par mots pour reconnaître les enfants existants. Fallback catalogue par nom de catégorie (fuzzy, plural-normalisé) si aucun candidat `material_costs`
- `getDefaultMaterialKeywords` : **4 tiers** — direct (DM type === expense), fuzzy (substring), catégorie catalogue de l'item DM, cross-DM. Chaque tier déduplique par `client_text` (`deduplicateDmByClientText`). Priorité de résolution multi-match : 1) DM unique → direct, 2) `materialCtx` → disambiguë, 3) `dmChoiceCache` → cache, 4) `showDmChoiceModal` → modale. **Note** : l'ancien tier 0 (materialCtx shortcut) a été supprimé — il court-circuitait tous les tiers et retournait des keywords du mauvais domaine DM (ex: keywords Panneaux pour résoudre FINITION BOIS)
- **`materialCtx`** : contexte cascade **hérité à travers toute la chaîne** parent → enfant → petit-enfant (4e paramètre de `executeCascade`). Pré-peuplé depuis le DM de la **catégorie du parent FAB racine** (ex: "Caisson" → `chosenClientText = "Placage chêne blanc"`). **Mis à jour par `$default:` après résolution** : `resolveCascadeTarget` propage le `client_text` de l'article résolu dans `materialCtx.chosenClientText` à chaque sortie (`cache hit`, `single candidate`, `modale technique`). Les `$match:` frères du même FAB scorent ainsi dans le contexte du matériau effectivement résolu par le `$default:` précédent. Sert de **disambiguateur** quand plusieurs DM existent, mais **ne surcharge jamais** un DM unique explicite (ex: DM "Finition" = "Laque polyuréthane" est utilisé tel quel)
- **Quantités enfants** : détection automatique constante vs formule. Si `rule.qty` contient des variables dimensionnelles (`L`, `H`, `P`, `QTY`, `n_tablettes`, `n_partitions`, `n_portes`, `n_tiroirs`) → résultat = quantité totale, **pas de multiplication** par `rootQty`. Si constante pure (ex: `"2"`) → quantité par unité FAB, multipliée par `rootQty`. Regex : `/\b(L|H|P|QTY|n_tablettes|n_partitions|n_portes|n_tiroirs)\b/`
- **`child_dims`** : formules dimensionnelles sur les règles cascade. Quand `rule.child_dims` est présent (ex: `{ L: '(L / n_portes) - 0.125', H: 'H - 0.25' }`), les dimensions L/H/P de l'enfant sont **calculées** à partir des variables du parent via `evalFormula`. `applyChildDims(childRowId, rule, vars)` écrit dans les inputs dim de l'enfant et appelle `updateRow(childRowId, { skipCascade: true })`. Appelé **toujours** quand `rule.child_dims` existe (même si item/qty inchangés) car les dims du parent ont pu changer. Résultat persisté en DB via `updateItem` (`length_in`, `height_in`, `depth_in`)
- **Multi-instance** : quand `child_dims` est présent ET `qty > 1` (entier), le moteur crée **N lignes distinctes** (qty=1 chacune) au lieu d'1 ligne avec qty=N. Chaque façade/tiroir est une pièce physique avec ses propres dimensions. Matching stable via `dataset.cascadeChildIndex` (0, 1, 2...). Non persisté en DB — reconstruit au `openSubmission` depuis l'ordre `sort_order` des enfants partageant le même `cascadeRuleTarget`. Si qty est fractionnaire ou `child_dims` absent → comportement classique (1 ligne, qty=N)
- **`n_portes` / `n_tiroirs`** : variables caisson (même pattern que `n_tablettes`/`n_partitions`). UI inputs `Port.`/`Tir.` dans la zone dims caisson. Substitution dans `evalFormula`. Ask completeness : 0 valide, null bloque. Aliases : `PORTES`/`N_PORTES`, `TIROIRS`/`N_TIROIRS`. Migration : `sql/caisson_portes_tiroirs.sql`
- Dimensions propagées depuis le FAB racine à toute profondeur
- Tags : `saveRowTag` propage récursivement le tag à tous les descendants (`propagateTagToDescendants`)
- Tri : `sortRowsPreservingCascade` trie uniquement les parents, enfants restent groupés sous leur parent. `openSubmission` applique un **tri topologique** défensif (`_addWithChildren`) pour garantir que les parents précèdent toujours leurs enfants, même si `sort_order` en DB est corrompu
- Guards : `_cascadeRunning` (re-entrance), `_isLoadingSubmission` (chargement), debounce 400ms, `opts.skipCascade` (voir règle ci-dessous), `scheduleCascade` guard cascade-child (les enfants cascade ne déclenchent jamais leur propre cascade — `if (row.classList.contains('cascade-child')) return`)
- **Propagation installation** : `toggleRowInstallation` → `propagateInstallationToCascadeChildren(parentRowId, checked)` — récursif, propage le cocher/décocher à tous les enfants cascade (via `findCascadeChildren`), sauvegarde DB, `skipCascade: true`
- **Propagation qty_multiplier** : `updateQtyMult` → `propagateQtyMultToCascadeChildren(parentRowId, val)` — récursif, même pattern que installation. Propage le QM à tous les enfants cascade + sauvegarde DB
- **Règle `skipCascade`** : toute fonction qui appelle `updateRow()` et qui N'EST PAS un changement de dimensions (L/H/P), de n_tablettes/n_partitions/n_portes/n_tiroirs, ou d'article catalogue DOIT passer `{ skipCascade: true }`. Fonctions corrigées : `saveOverrides`, `clearOverrides`, `refreshGroupRows` (modificateurs %), AI tools `update_submission_line` et `modify_item` (sans changement dims). `applyChildDims` utilise aussi `skipCascade: true` (l'enfant ne doit pas re-déclencher la cascade du parent). **Note** : `revertCascadeManualEdit` appelle `scheduleCascade` sur le **parent** (pas l'enfant) pour une re-cascade cohérente
- **Anti-lignes vides** : 3 gardes — (a) `debouncedSaveItem` skip les lignes sans article (`return` si select vide), (b) `addRow` attache un `blur` listener one-shot sur le combobox → `removeRow` après 2s si toujours vide, (c) `openSubmission` filtre les items sans `catalogue_item_id` ni `item_type=custom` avant rendu
- **Guard `ask` completeness** : si l'article déclare `calculation_rule_ai.ask` (ex: `["L","H"]`), la cascade ne se déclenche qu'une fois les variables listées remplies. Appliqué uniquement à `depth === 0` (FAB racine). **Seuils** : `L`/`H`/`P`/`QTY` doivent être **> 0** (dimensions physiques). `N_TABLETTES`/`N_PARTITIONS`/`N_PORTES`/`N_TIROIRS` doivent seulement être **définis** (`!= null`) — 0 est valide (caisson sans tablettes/partitions/portes/tiroirs). **Fallback** : si `ask` absent ET `dims_config` **explicitement défini** sur l'article, inféré depuis `dims_config` (ex: `{l:true, h:true}` → `["L","H"]`). Sans `dims_config` explicite, pas d'inférence. Mapping : `L`/`LARGEUR`, `H`/`HAUTEUR`, `P`/`PROFONDEUR`, `QTY`/`QUANTITÉ`, `N_TABLETTES`/`TABLETTES`, `N_PARTITIONS`/`PARTITIONS`, `N_PORTES`/`PORTES`, `N_TIROIRS`/`TIROIRS`
- **Validation target** : après résolution (`resolveCascadeTarget`), le target est vérifié dans `CATALOGUE_DATA`. Si l'ID n'existe pas dans le catalogue, traité comme résolution échouée (empêche la création de lignes vides)
- **`cascadeRuleTarget`** : chaque enfant cascade stocke `dataset.cascadeRuleTarget = rule.target` (ex: `"$default:Façades"`). Sert à identifier quel rule a créé l'enfant, utilisé par le matching locked children et la préservation au rechargement
- **Collapse enfants cascade** : les enfants cascade sont masqués par défaut (`display: none`, classe `.cascade-visible` pour afficher). Triangle ▶ sur le parent FAB (`btn-cascade-toggle`, classe `.cascade-parent-row`). Badge `(+N)` dans `.cell-total` quand collapsé. Checkbox globale par pièce dans le header (`.cb-show-cascade`) → classe `.show-all-cascade` sur le groupe. État en mémoire (`_cascadeExpanded[parentRowId]`), pas persisté en DB. Les calculs (`getRowTotal`, `computeRentabilityData`), saves, et propagation installation fonctionnent normalement sur les enfants masqués
- **Total agrégé collapsé** : quand un parent FAB est collapsé, sa cellule `.cell-total` affiche la somme parent + **tous les descendants** récursivement (classe `.aggregate-total`, texte bold navy). `getAllCascadeDescendants(parentRowId)` collecte enfants + petits-enfants via `cascadeParentMap`. `updateCollapsedParentTotal(parentRowId)` : collapsé → somme via `getRowTotal` × `getModifierMultiplier(groupId)`, expanded → `getRowTotal(parentRow)` × multiplicateur (jamais de cache DOM — évite la circularité agrégat↔individuel). Le multiplicateur room+global est appliqué au total affiché pour cohérence avec les totaux individuels. Dans `updateRow`, la mise à jour remonte toute la chaîne d'ancêtres (`while (_ancestor)`) pour que les changements sur un petit-enfant propagent au grand-parent collapsé

**Préservation au rechargement** : `findExistingChildForDynamicRule` utilise 2 niveaux de matching pour retrouver les enfants existants au lieu de les recréer :
1. **Exact** : `catalogueId` dans `validIds` (DM entry + catégorie autorisée) — comportement normal
2. **Fallback client_text** : `client_text` de l'enfant matche un DM entry (sans filtre catégorie) — couvre les cas où `getAllowedCategoriesForGroup` exclut la catégorie
- ~~Fallback catégorie~~ **Retiré** : le matching par catégorie seule (`allowedCats`) volait les enfants `$match:` quand une règle `$default:` s'exécutait en premier — causait la perte de résolution panneau/bande de chant
- En plus, dans la boucle des règles, un enfant actif est retrouvé par `cascadeRuleTarget` si l'exact `catalogueId` ne matche plus (cas où la résolution fraîche donne un item différent)
- **Résultat** : les enfants cascade avec `catalogue_item_id` valide en DB sont préservés, seuls les enfants MANQUANTS sont recréés

**Persistance immédiate des enfants cascade** : `debouncedSaveItem` utilise un **timer unique global** (pas per-row). Quand `executeCascade` crée/met à jour 3 enfants en <500ms, seul le dernier `catalogue_item_id` est sauvé — les précédents sont annulés par le debounce. Fix : `executeCascade` appelle `updateItem()` **immédiatement** après chaque enfant (nouveau ou existant modifié) pour persister `catalogue_item_id`, `description`, `unit_price`, `quantity`, `tag`. Le debounce fire ensuite sans conflit (écrit les mêmes données).

**Changement manuel d'enfant cascade** : quand l'utilisateur modifie manuellement un enfant (change son article catalogue), le moteur :
1. **Lock** l'enfant (`cascade-locked`) — protégé contre update/suppression par le moteur
2. **Invalide** `dmChoiceCache` pour toutes les entrées du groupe parent
3. **Extrait** le `client_text` du nouvel article → `_pendingMaterialCtx[parentRowId]`
4. **Re-cascade** le parent (`scheduleCascade(parentRowId, true)`) avec le nouveau `materialCtx`
5. **Locked children matching** : dans la boucle des règles, les enfants locked sont matchés par `cascadeRuleTarget` ou `catalogueId` — empêche la création de doublons
6. **Frères** : les autres enfants actifs sont re-résolus avec le nouveau materialCtx. Si la résolution échoue (ex: mélamine → pas de finition), l'enfant frère est orpheliné et supprimé

**Résolution fraîche `$match:` sur changement DM** : flag `_defaultResolvedFresh` dans la boucle cascade. Si `$default:` résout via `resolveCascadeTarget` (pas via enfant existant = DM a changé), le flag est activé. Les `$match:` suivants **sautent** `findExistingChildForDynamicRule` et forcent une résolution fraîche. L'ancien enfant est retrouvé par `cascadeRuleTarget` (fallback) et mis à jour (`itemChanged = true`). Sans ce flag, l'ancien enfant PVC resterait car `findExistingChildForDynamicRule` le matche par catégorie sans vérifier le variant.

**Filtre catégorie sur `$match:`** : après résolution d'un `$match:`, si `materialCtx._updatedBySiblingDefault` est vrai et `materialCtx._defaultResolvedId` existe, vérifie que l'article résolu par le `$default:` frère a une **relation** avec la catégorie du `$match`. Deux checks : (1) clés `material_costs` contenant un mot de la catégorie, (2) règles cascade ciblant la même catégorie. Ex: mélamine (material_costs: `{"PANNEAU MÉLAMINE": 5}`, pas de FINITION dans costs/cascades) → `$match:FINITION BOIS` rejeté silencieusement. Placage (cascade vers `$match:FINITION BOIS`) → accepté. Fonction testable : `checkDefaultItemMatchCategory(defaultItem, matchCategory)` dans `cascade-helpers.js`. **Propagation via enfants existants** : quand `findExistingChildForDynamicRule` retrouve un enfant pour `$default:`, l'ID + `client_text` de l'enfant sont propagés dans `materialCtx` (`_defaultResolvedId`, `chosenClientText`, `_updatedBySiblingDefault = true`)

**Résolution échouée** : quand `$default:` ou `$match:` ne trouve aucun article valide :
- **Pas de ligne enfant créée** — la règle est simplement sautée (`continue`)
- **Toast actionnable** affiché 6s : identifie le parent, la cible échouée, et dit exactement quel DM configurer. **Exception** : si le `$match:` a été rejeté par le filtre catégorie, **pas de toast** — c'est un comportement voulu (ex: mélamine n'a pas besoin de FINITION BOIS)
- **Console warn** avec détail technique (target, groupId, DM disponibles)
- `getDefaultMaterialKeywords` n'a **pas de fallback "first-available"** — si aucun DM ne correspond à la catégorie, retourne null (évite de sélectionner un article non pertinent)

Détails complets : `docs/TECHNICAL_MANUAL.md` §3

### Cascade supprimée (`cascade_suppressed`)

Quand un utilisateur supprime manuellement un enfant cascade, l'ID catalogue est mémorisé pour empêcher la regénération.
- **Stockage** : `cascadeSuppressed[parentRowId] = ['ST-0035', ...]` (mémoire) + `room_items.cascade_suppressed` JSONB (DB)
- **Détection** : `removeRow()` vérifie `!_cascadeRunning && cascadeParentMap[rowId]` — seules les suppressions manuelles comptent
- **Filtrage** : `executeCascade()` skip les targets dont l'ID résolu est dans la liste supprimée du parent
- **Reset** : quand l'utilisateur change l'article parent (`updateRow`), les suppressions sont vidées et la cascade reprend normalement
- **UI** : bouton `⊘` (`.btn-suppressed-cascade`) visible seulement si suppressions actives, dropdown de restauration (`openSuppressedMenu`)
- **Restauration** : `restoreSuppressedCascade(parentRowId, catId)` retire l'ID de la liste et re-exécute la cascade
- **Migration** : `sql/cascade_suppressed.sql` — `ALTER TABLE room_items ADD COLUMN cascade_suppressed JSONB`

### Indicateur modification manuelle cascade (`cascade-manual-edit`)

Quand l'utilisateur modifie manuellement la quantité ou le prix d'un enfant cascade, un indicateur visuel signale l'écart avec les valeurs calculées par le moteur.
- **Stockage source** : `dataset.cascadeQty` et `dataset.cascadeUnitPrice` — écrits par `executeCascade` sur chaque enfant (nouveau ou existant) avec les valeurs calculées par le moteur
- **Détection** : `checkCascadeManualEdit(rowId)` — compare qty/prix courants avec `cascadeQty`/`cascadeUnitPrice`, toggle `.cascade-manual-edit` sur la ligne. Appelé à la fin de chaque `updateRow` pour les enfants cascade
- **Revert** : `revertCascadeManualEdit(rowId)` — restaure `cascadeQty`, supprime `price_override`, retire `.cascade-manual-edit`, puis appelle `scheduleCascade` sur le **parent** (`cascadeParentMap[rowId]`) pour re-cascade complète
- **CSS** : `.cascade-manual-edit` — bordure gauche 2px solid `#6366f1` (indigo), fond subtil indigo. `.btn-revert-manual` — bouton ↺ dans `.cell-remove`, visible uniquement quand `.cascade-manual-edit` actif
- **UI** : bouton ↺ ajouté dans le template de ligne `.cell-remove`, avant `btn-remove`

### Matériaux par défaut (DM)

**Room-level uniquement** (`roomDM[groupId]`). Le niveau soumission a été retiré.
- `getDefaultMaterialsForGroup(groupId)` retourne `roomDM[groupId]` ou `[]`
- `reprocessDefaultCascades(changedGroup, scopeGroupId)` — re-cascade quand un DM change (scopeGroupId obligatoire). Invalide `matchDefaults` (cache `$match:` persisté) ET `dmChoiceCache` (choix DM stale). Exécute sous guard `_cascadeRunning = true` pour empêcher `updateRow → scheduleCascade` de déclencher des cascades parallèles (cause de doublons). Re-trigger les parents avec `$default:` ET `$match:` targets
- Cache choix : `dmChoiceCache[groupId + ':' + typeName]`
- "Copier de…" : copie depuis une autre pièce uniquement (pas de template soumission)
- **Indicateur DM vide** : classe `.dm-needs-config` sur `.room-dm-label` quand DM count = 0 et ≥1 article dans la pièce. Flèche `←` avec animation `dm-pulse` (opacity 0.35→1, 2.2s). Disparaît dès qu'un DM est ajouté. CSS pur, pas de JS timer.
- **Validation DM obligatoires** : `DM_REQUIRED_GROUPS = ['Caisson','Panneaux','Tiroirs','Façades','Finition','Poignées']`. `getMissingRequiredDm(groupId)` retourne les groupes non remplis. `addRow()` bloque l'ajout d'articles (toast + ouvre le panneau DM) si des groupes requis manquent — sauf pour le chargement d'articles existants (legacy), les cascades, et le bulk load. Le bouton "+" est grisé (`.dm-blocked`) pour les nouvelles pièces sans DM complets.
- **Groupes cachés** : `DM_HIDDEN_GROUPS = ['Autre','Éclairage']` — filtrés dans `getDmTypes()`, n'apparaissent plus dans le dropdown DM.
- **Regroupement client_text** (Phase 1) : le dropdown DM (`rdmSearchCatalogue`) déduplique les articles par `client_text` — un seul "Placage de chêne blanc" affiché même si 2+ articles techniques existent. `rdmSelectItem` stocke le `client_text` sur l'entrée DM en plus du `catalogue_item_id` représentant. Structure DM : `{ type, catalogue_item_id, client_text, description }`.

#### Refactor DM client_text — Phase 2 (IMPLÉMENTÉ)

Le DM représente un matériau client, pas un article technique. `client_text` est désormais l'identifiant primaire pour la résolution cascade :

1. **`resolveCascadeTarget`** : `$default:` → DM entries par type → choix `client_text` (Modale 1 si multiple) → filtrer `CATALOGUE_DATA` par `client_text` + catégorie (`getAllowedCategoriesForGroup`) → choix article technique (Modale 2 si multiple) → `catalogue_item_id` final
2. **Trois modales** : `showDmChoiceModal(groupName, dmEntries)` — Modale 1 (choix matériau client, label = `client_text`). `showTechnicalItemModal(groupName, catalogueItems)` — Modale 2 (choix article technique, label = code + `description` + catégorie + prix). `showMatchChoiceModal(expenseCategory, scored, keywords)` — Modale 3 (choix `$match:` multi-résultats, label = code + `description` + catégorie)
3. **`findExistingChildForDynamicRule`** : `validIds` expandés via `client_text` + filtre catégorie (`getAllowedCategoriesForGroup`)
4. **`getDefaultMaterialKeywords`** : lookup catalogue via `client_text` d'abord, fallback `catalogue_item_id`. `materialCtx` sert uniquement à disambiguïer dans chaque tier (pas de shortcut)
5. **`getMissingRequiredDm`** : vérifie `client_text || catalogue_item_id`
6. **`findDmEntryByType`** : accepte entries avec `client_text` sans `catalogue_item_id`
7. **Migration données** : au `openSubmission`, dérive `client_text` depuis `catalogue_item_id` pour les DM legacy
8. **`getAllowedCategoriesForGroup(groupName)`** : inverse `categoryGroupMapping` (chargé depuis `app_config.category_group_mapping`) pour trouver les catégories catalogue autorisées par groupe DM

### QTY multiplicateur universel (`qty_multiplier`)

Champ multiplicateur global par ligne article, indépendant du type de calcul (pi², pi³, unitaire).
- **Position** : entre la colonne Type et L×H×P dans la grille (colonne 6, 44px desktop / 36px tablet)
- **Formule** : `total_ligne = unit_price × quantity × qty_multiplier × modifier%`
- **Default** : 1. Valeur > 1 → style `.qty-mult-active` (navy bold). Valeur = 1 → gris pâle `#D1D5DB`
- **Fonction** : `updateQtyMult(rowId)` — met à jour l'affichage + sauvegarde DB + `updateRow({ skipCascade: true })` + `propagateQtyMultToCascadeChildren`
- **Pas de re-cascade** : `qty_multiplier` ne touche pas les dimensions, pas besoin de recascader
- **Cascade** : les enfants cascade héritent le `qty_multiplier` du parent lors de `executeCascade` (existants + nouveaux) ET lors du changement par l'utilisateur (`propagateQtyMultToCascadeChildren`). L'estimateur peut modifier manuellement le `qty_multiplier` d'un enfant
- **Auto-qty readonly** : quand `updateRow` détecte une formule auto-qty, `qtyInput.readOnly = true` + style gris `#94A3B8`
- **Intégration** : `getRowTotal`, `updateRow` (3 chemins), `computeRentabilityData`, `openRentab`, `collectRoomDetail` (AI context), `debouncedSaveItem`, `openSubmission` (restauration)
- **DB** : `room_items.qty_multiplier` NUMERIC DEFAULT 1. Migration : `sql/qty_multiplier.sql`

### Ajout d'articles

Un seul bouton (+) "Ajouter un article" en bas de chaque pièce (`.add-row-container`). Pas de (+) inline sur les lignes.
- `addRow(groupId)` — crée une nouvelle ligne avec combobox complet
- `.dm-blocked` si DM requis manquants (bloque l'ajout)
- AI handler `add_catalogue_item` : valide `catalogue_item_id` dans `CATALOGUE_DATA` **avant** `addRow` — empêche les lignes vides

### Enfants cascade manuels

Ajout manuel d'articles enfants sous un parent FAB, en dehors du moteur cascade automatique.
- **`addRow(groupId, { parentRowId })`** : crée un enfant `cascade-child` + `cascade-locked` dès la création. Inséré après les enfants cascade existants du parent. Hérite le tag du parent
- **Persistance** : `createItem` envoie `parent_item_id` (UUID Supabase via `itemMap`) + `cascade_locked: true` en DB
- **Protection cascade** : les enfants manuels (`cascade-locked`) ne sont jamais touchés, supprimés ou re-résolus par `executeCascade`
- **AI tool `add_catalogue_item`** : accepte `parent_item_id` (UUID Supabase). Reverse lookup via `itemMap[rowId] = UUID` pour trouver le `rowId` DOM du parent
- **Contexte AI** : `collectRoomDetail` expose `itemId` (UUID Supabase) sur **tous** les articles (pas seulement FAB) et `isFabParent: true` sur les articles `item_type === 'fabrication'`. Ces champs sont **inclus dans le slim mapping** de `collectAiContext` ET **rendus dans le prompt texte** de l'edge function (`[itemId=UUID]` sur chaque article, `[FAB parent]` sur les fabrications) pour que l'AI ait accès aux UUID (add_catalogue_item parent_item_id + remove_item)
- **Fallback interdit** : le prompt système interdit à l'AI d'ajouter en racine silencieusement quand le parent ciblé n'est pas trouvé — elle doit signaler et demander clarification

### Override par ligne (prix, MO, matériaux)

Ajustements par ligne, par soumission, sans modifier le catalogue. Stocké dans `room_items` (JSONB/NUMERIC).
- **`_rowOverrides[rowId]`** : map mémoire `{ labor: {dept: mins}, material: {cat: cost}, price: number|null }`
- **Bouton `⚙`** (`.btn-ov`) dans `.cell-unit-price`, visible au hover, violet si override actif
- **Popover** (`.ov-pop`) : 3 sections — prix de vente, MO par département, matériaux par catégorie. Montre la valeur catalogue en référence
- **Calcul** : `price_override` remplace entièrement `computeComposedPrice`. `labor_override`/`material_override` fusionnent avec les valeurs catalogue (`Object.assign`) puis recalculent via `computeComposedPrice(merged, includeInstall)`
- **Rentabilité** : `computeRentabilityData` utilise les overrides. `price_override` → montant flat (comme `__AJOUT__`), labor/material → décomposition MO + matériaux avec valeurs fusionnées
- **Persistance** : `debouncedSaveItem` sauvegarde les 3 colonnes override + `unit_price` effectif (pour compatibilité `quote.html`)
- **Indicateur** : classe `.has-override` (bordure gauche violette `#7c3aed`, prix violet bold)
- **Reset** : changement d'article → overrides supprimés. Bouton "Réinitialiser" dans le popover
- **Cascade children** : pas de bouton override (masqué dans `addRow` si `opts.cascade`)
- **AI tool** : `update_submission_line` — jamais auto-exécuté, simulation obligatoire. Migration : `sql/line_overrides.sql`
- **Undo stack** : `_undoStack[]` (max 10 entrées) — snapshot avant suppression ou modification d'overrides. Bouton flottant `↩ Annuler` (bas gauche, 8s auto-hide) après toute action destructive. `executeUndo()` restaure le dernier état (recrée la ligne pour delete, restaure les overrides pour override). Stack vidé à chaque changement de soumission

### Dropdown combobox articles

`renderComboboxItems()` affiche les articles groupés par type puis catégorie :

1. **FABRICATION** (section header `.cb-section-label`) — articles `item_type === 'fabrication'`
   - Articles par défaut (`is_default`) en premier avec ★
   - Puis articles par catégorie catalogue
2. **MATÉRIAUX** (section header) — tous les autres articles
   - Articles par défaut en premier avec ★
   - Puis articles par catégorie catalogue
3. **Autre** — Proposer un nouvel article / Ajout personnalisé

CSS : `.cb-section-label` (navy, bold, border-bottom) vs `.cb-group-label` (gris, smaller)

### Langue soumission (FR/EN)

- **`submissions.language`** : colonne TEXT (`'fr'` ou `'en'`, default `'fr'`). Migration : `sql/submission_language.sql`
- **Toggle FR/EN** : `toggleLang()` dans l'aperçu — traduit via Edge Function `translate`, bascule `currentLang`, persiste en DB
- **Restauration** : `openSubmission()` lit `currentSubmission.language` et restaure `currentLang` + état du bouton
- **Présentation** : `openPresentation()` passe `&lang=currentLang` dans l'URL de l'iframe `quote.html`
- **Liens client** : tous les `quote.html?token=` incluent `&lang=currentLang` (envoi, copie, bypass)
- **quote.html** : lit `?lang=` et utilise `QUOTE_TEXTS[QUOTE_LANG]`, `STEPS_I18N[QUOTE_LANG]`, `client_description_en`, `clause.content_en` avec fallback FR

### Workflow de soumission

Machine à états : `draft → pending_internal ↔ returned → approved_internal → sent_client → accepted`
- Auto-approbation : utilisateurs avec `can_approve_quotes` → draft directement à `approved_internal`
- Bypass : utilisateurs avec `can_bypass_approval` → draft à `sent_client`
- Verrouillage via `setEditable(false)`, déverrouillage audité dans `submission_unlock_logs`
- Snapshots HTML uploadés dans Storage à chaque transition
- **Suppression projet** : `handleDeleteProject()` bloque la suppression si le projet contient une soumission `accepted` ou `invoiced` (message explicite). Toute autre erreur DB (FK, RLS) affiche aussi un message au lieu d'échouer silencieusement.
- Détails complets : `docs/TECHNICAL_MANUAL.md` §5

### Système de permissions (13 permissions, 6 rôles)

`app_config.permissions` (matrice rôle × permission) + `app_config.user_roles` (email → rôle).
Ou via tables DB `roles` + `user_roles`.
**IMPORTANT** : Toutes les vérifications sont **côté client uniquement** (`checkPageAccess()`). La sécurité réelle repose sur les RLS policies Supabase.

### Sync catégories catalogue (admin.html)

Au chargement, l'admin fetch les catégories distinctes depuis `catalogue_items` et les compare à `app_config.catalogue_categories`. Les catégories présentes dans les articles mais absentes de la config sont **auto-ajoutées** et persistées. Elles apparaissent avec "⚠ Non liée" dans la table catégories, incitant l'admin à les mapper à un groupe matériau.

### Architecture de rendu soumission

Le contenu d'une soumission est rendu dans **4 chemins distincts** avec des sources de données différentes :

| Chemin | Fichier | Fonction | Source données | Live/Figé |
|--------|---------|----------|----------------|-----------|
| **Aperçu** | calculateur.html | `renderPreview()` | État local (DOM + mémoire JS) | Live |
| **Présentation** | quote.html (iframe) | `renderQuote()` | RPC `get_public_quote` + `get_public_room_media` | Live ou snapshot |
| **Lien client** | quote.html (direct) | `renderQuote()` | Même RPC que Présentation | Live ou snapshot |
| **Snapshot** | calculateur.html | `uploadSnapshot()` | Capture HTML de `renderPreview()` | Figé à l'approbation |
| **Email** | google_apps_script.gs | `genererHtmlCourriel()` | Paramètres du client (pas de RPC) | Figé à l'envoi |

#### Matrice données × chemin de rendu

| Donnée | Aperçu (renderPreview) | quote.html (live) | Snapshot | Email |
|--------|----------------------|-------------------|----------|-------|
| **Descriptions FR** | `roomDescHTML[gid]` ✅ | `room.client_description` ✅ | Capturé ✅ | ❌ |
| **Descriptions EN** | `roomDescEN[gid]` ✅ | ❌ `client_description_en` absent du RPC | Capturé (si lang=en actif) | ❌ |
| **Images** | `groupImages` filtrées `showInQuote`, max 4 | `get_public_room_media` RPC + legacy, max 6 | URLs capturées ✅ | Base64 en pièce jointe |
| **Clauses** | `currentSubmission.clauses` ✅ | `sub.clauses` via RPC ✅ | Capturé (textarea→div) ✅ | ❌ |
| **Clauses EN** | `clause.content_en` ✅ | ❌ seul `clause.content` rendu | Capturé (si lang=en actif) | ❌ |
| **Prix/totaux** | Calculé live (DOM `getRowTotal`) | `room.subtotal` × modifiers | Capturé ✅ | Tableau par meuble ✅ |
| **`approved_total`** | Non utilisé explicitement | Priorité sur total calculé ✅ | Capturé (total affiché) | ❌ |
| **Rabais** | `currentSubmission.discount_*` ✅ | `sub.discount_*` ✅ | Capturé ✅ | ❌ |
| **Étapes** | Hardcoded i18n (FR+EN) ✅ | Hardcoded `STEPS` (FR seulement) ⚠️ | Capturé ✅ | ❌ |
| **Intro page** | `introConfig` + EN via `introConfigEN` ✅ | `introConfig` (FR seulement) ⚠️ | Capturé ✅ | ❌ |
| **Installation** | DOM checkboxes ✅ | `room.installation_included` ✅ | Capturé ✅ | ❌ |
| **DM (matériaux)** | ❌ non rendu | ❌ non rendu | ❌ | ❌ |
| **Couverture** | `introConfig.cover_image` ✅ | `introConfig.cover_image` ✅ | Capturé ✅ | ❌ |
| **Acceptation** | Badge titre page ✅ | Formulaire + badge ✅ | Badge capturé ✅ | ❌ |

#### Incohérences identifiées (corrigées)

1. ~~**Traduction EN des descriptions**~~ ✅ Migration SQL `fix_get_public_quote_desc_en.sql` + quote.html utilise `client_description_en` avec fallback FR.
2. ~~**Traduction EN des clauses**~~ ✅ quote.html utilise `clause.content_en`/`clause.title_en` quand `QUOTE_LANG==='en'`.
3. ~~**Traduction EN des étapes**~~ ✅ `STEPS_I18N` bilingue (FR/EN) dans quote.html, `t('stepsTitle')` pour le titre.
4. ~~**Traduction EN intro**~~ ✅ `applyTranslations()` persiste les EN dans `app_config` (`_en` suffix), quote.html les charge et utilise avec fallback FR.
5. ~~**Max images par pièce**~~ ✅ renderPreview aligné à 6 (`.slice(0, 6)`), CSS `imgs-5`/`imgs-6` ajoutés.
6. **Source des prix** : renderPreview calcule live depuis le DOM, quote.html utilise `room.subtotal` pré-calculé du RPC. (Acceptable — pas un bug)
7. **Snapshots figés** : si clauses/images/descriptions changent après la génération du snapshot, les modifications ne sont pas reflétées dans le lien client tant qu'un nouveau snapshot n'est pas uploadé.

#### Mécanisme de snapshot

`uploadSnapshot()` est appelé aux transitions de workflow (approbation, envoi client).
1. Appelle `renderPreview()` → génère le HTML live dans `#pvContent`
2. Extrait `container.innerHTML`
3. Nettoie : supprime boutons, `contenteditable`, convertit `textarea→div`
4. Wraps dans HTML complet via `generateSnapshotHtml()` (inclut `SNAPSHOT_CSS`)
5. Upload vers Storage bucket `submission-snapshots/{submissionId}.html`

quote.html charge le snapshot si `status ∉ {draft, returned, pending_internal}`. Filtre les anciens formats (check `pv-page-total`). Si snapshot absent/invalide → fallback rendu live.

**Migrations SQL nécessaires** :
- `fix_get_public_quote_clauses.sql` — ajouter `s.clauses` au SELECT ✅
- `get_public_room_media.sql` — RPC pour images publiques ✅
- `fix_get_public_quote_desc_en.sql` — ajouter `client_description_en` au retour rooms ✅

**Clauses** : `submissions.clauses` JSONB `[{title, content, title_en, content_en}]`. Bibliothèque dans `quote_clauses` table.
**Sauvegarde immédiate** : `saveSubmissionClauses()` → PATCH instantané en DB.

### Export PDF (`shared/pdf-export.js`)

Export server-side de la soumission en PDF via PDFShift API (rendu Chromium) à travers l'Edge Function `pdf-export`.
- **Bouton PDF** dans la toolbar preview de `calculateur.html` (entre Présentation et EN)
- **Format** : landscape Letter (8.5x11), marges 0
- **Processus** : `renderPreview()` → clone HTML → nettoyage interactifs → reconstruction page total+signature (layout 2 colonnes flex) → construction document HTML autoportant (SNAPSHOT_CSS inline) → `authenticatedFetch()` vers Edge Function `pdf-export` → PDFShift API (Chromium) → blob PDF → download
- **Page breaks** : CSS `.pv-page:not(:first-child){page-break-before:always}` + `use_print: true` dans PDFShift
- **Page total+signature** : `.pv-page-total` reconstruite en layout 2 colonnes flex : colonne gauche (55%) texte de clôture émotionnel (titre 38px + 3 paragraphes), séparateur vertical 1px, colonne droite total (montant 48px, breakdown, taxes) + lignes signature ("Accepté par" / "Date"). Bilingue FR/EN via `currentLang`
- **Pas de hacks html2canvas** : PDFShift utilise Chromium — flex/grid fonctionnent nativement, pas besoin de conversion table-layout. Pas de conversion base64 des images (PDFShift les fetch côté serveur). Pas d'injection CSS dans `document.head`
- **CSS overrides PDF** : tous les overrides utilisent `!important` pour garantir la priorité sur SNAPSHOT_CSS. `.pv-page{aspect-ratio:unset!important;height:auto!important;overflow:visible!important}` (élimine les pages blanches). `.pv-page-title{overflow:hidden!important}` (exception couverture — clip border-radius image). `.pv-cover-right{-webkit-border-radius:8px!important;border-radius:8px!important;overflow:hidden!important}` (border-radius couverture compatible Chromium PDFShift). `.pv-page-clause{background:#fff!important}` (clauses fond blanc, override #fafafa). `.pv-content{gap:0!important}` (pas d'espace entre pages). Images : `object-fit:contain!important`, `min-width:0!important`. Conteneurs 2 colonnes : `overflow:hidden!important;max-width:100%!important`. Texte : `word-wrap:break-word!important`
- **Sanitisation HTML descriptions** : après le clone, regex remplace `&lt;br&gt;` → `<br>` et `&lt;p|strong|em|ul|ol|li&gt;` → vrais tags HTML (corrige le double-escaping de descriptions en DB)
- **Conversion textarea→div** : les textareas (clauses) sont converties en divs avec `innerHTML = escapeHtml(value) + newlines→<br>`
- **Document HTML** : document complet autoportant envoyé à PDFShift (DOCTYPE + head avec `<meta name="viewport" content="width=1056">` + CSS inline + Google Fonts Inter + body avec contenu à `width:1056px`)
- **`textToHtml()` détection HTML** : `shared/presentation-client.js` détecte `<br` (en plus de `<p>`, `<strong>`, `<ul>`) comme indicateur HTML — empêche le double-escaping des descriptions legacy contenant des `<br>` tags
- **Nom de fichier** : `{OrgName}_{ProjectCode}_{SubNumber}_v{Version}.pdf`. `_sanitizePdfFilename()` normalise NFD, strip accents/caractères spéciaux
- **`org_name`** : chargé depuis `introConfig` (via `app_config`), fallback "Stele"
- **Edge Function** : `supabase/functions/pdf-export/index.ts` — reçoit `{ html }`, appelle `https://api.pdfshift.io/v3/convert/pdf` avec auth Basic (secret `PDFSHIFT_API_KEY`), options `{ format: "Letter", landscape: true, margin: "0", use_print: true, wait_for: "network" }`, retourne le PDF binaire
- **Dépendances retirées** : html2pdf.js (CDN), html2canvas, jsPDF — tout remplacé par PDFShift server-side

### Pipeline commercial

3 vues : Table, Cartes, Soumissions. `project_code` auto-généré par trigger DB.
`amount_override` NUMERIC : priorité d'affichage sur le montant calculé (affiché en rouge).

### Prix composé

```
Prix = Σ(labor_minutes[dept] / 60 × taux_horaire[dept])
     + Σ(material_costs[cat] × (1 + waste%/100) × (1 + markup%/100))
```

- **Markup sur coût + perte** : le markup s'applique sur `(coût + perte)`, pas sur le coût seul. Formule matériaux : `coût × (1 + waste%) × (1 + markup%)`
- `loss_override_pct` sur l'article remplace le `waste` par catégorie
- Deux formats de `material_costs` : flat numbers (calculateur via `computeComposedPrice`) et objets `{cost, qty}` (catalogue/approbation via `computeCatItemPrice`)
- Si aucun prix composé défini, le prix manuel (`price`) est utilisé

**Rentabilité** (`computeRentabilityData` / `openRentab`) :
- **Marge brute** = `(PV - coûtant mat - perte - salaires) / PV × 100`
- **Profit net** = `(PV - coûtant mat - perte - salaires - frais fixes) / PV × 100`
- **Marge visée** : 38% (hardcodé)
- **Modificateur % sous-total** : `computeRentabilityData` et `openRentab` appliquent `getModifierMultiplier(groupId)` au prix de vente (coûts inchangés). Pour le scope `project`, `computeRentabilityData` agrège les résultats per-group (chaque groupe avec son propre modificateur). `openRentab` en scope project utilise un ratio `effectiveSum/baseSum` pour scaler le total
- Fonction pure testable : `computeRentabilityPure(lines[], tauxHoraires[], expenseCategories[])` dans `tests/cascade-helpers.js`
- Tests : GROUP 28 (17 tests) dans `tests/cascade-engine.test.js`

**Modale rentabilité** (`openRentab`) — refonte visuelle mockup #132 :
- **4 sections** : KPI cards (Vente/Coût/Profit) → bannière AI → barre répartition → 2 colonnes (Marges + Ventilation MO) → tableau matériaux (Base/Perte/Markup/Total) → tags
- **KPI cards** : 3 cartes en ligne (Vente / Coût direct / Profit). Coût direct = matériaux + perte + salaires (sans frais fixes). Profit card couleur tri-state basée sur profit net % : vert (`#F0FDF4`, bordure `#BBF7D0`) si ≥15%, ambre (`#FFFBEB`, bordure `#FDE68A`) si 8-14.9%, ambre (`#FFFBEB`, bordure `#FDE68A`) si <8%. Couleurs montant : `#22C55E` (OK), `#B45309` (warning/danger). Couleurs % : `#22C55E` (OK), `#D97706` (warning/danger)
- **Bannière AI** : apparaît si marge brute effective < 35% (seuil fixe). Fond `#FFFBEB`, bordure gauche `#F59E0B`, texte `#92400E`
- **Bouton "Ajuster le prix"** (scope `group` uniquement) : révèle une carte avec prix recommandé, marges projetées, et boutons Appliquer/Ignorer. Calcul : `PV_cible = (mat + perte + salaires) / (1 - margeVisée/100)`. Animation slide-down `rentabAiReveal`
- **`rentabApplyTargetPrice(groupId, prixCible)`** : calcule le % room modifier nécessaire depuis le sous-total **base** (sans modifier existant). Formule : `((prixCible / (baseSousTotal × globalMult)) - 1) × 100`. Tient compte du modificateur global existant. L'inscrit dans `roomModifiers[groupId]`, appelle `refreshGroupRows` + `updateGrandTotal` + `updateRoom` DB, ferme la modale. Pas de confirm/alert natif
- **Barre répartition** : 4 segments — Matériaux `#0B1220` (navy), Salaires `#374151` (gris foncé), Frais fixes `#9CA3AF` (gris), Profit `#22C55E` (vert). Labels inline si segment ≥ 8%
- **Marges** : badges colorés — marge brute : vert `#16A34A` ≥35%, ambre `#D97706` 25-34.9%, rouge `#DC2626` <25%. Profit net : vert ≥15%, ambre 8-14.9%, rouge <8%. Tooltips avec formules sur ⓘ
- **Ventilation MO** : barres horizontales triées décroissant, couleur `#0B1220` (navy), fond vide `#F1F5F9`
- **Tableau matériaux** : accumulateurs per-catégorie `matWaste[cat]`, `matMarkup[cat]` (gère correctement `loss_override_pct`)

### Barèmes et modificateurs (`labor_modifiers`)

Ajustements automatiques de prix basés sur les dimensions de l'article. Section **séparée** de `calculation_rule_ai` dans la modale catalogue (visible admin uniquement).

**Structure JSON** (`catalogue_items.labor_modifiers`) :
```json
{
  "modifiers": [
    {
      "condition": "L > 48",
      "label": "Grand (> 48 po)",
      "labor_factor": { "Machinage": 1.5 },
      "material_factor": { "PANNEAU MÉLAMINE": 1.20 }
    }
  ]
}
```

- **`condition`** : expression évaluée par `evalFormula` (variables : L, H, P, QTY, n_tablettes, n_partitions, n_portes, n_tiroirs)
- **`labor_factor`** / **`material_factor`** : multiplicateurs par département MO / catégorie matériau. 3 formats acceptés : objet `{dept: multiplier}`, **nombre scalaire** (appliqué à tous), ou **objet clé vide** `{"": multiplier}` (AI génère parfois ce format, normalisé en per-key). 1.0 = base, 1.25 = +25%
- **First-match** (défaut) : premier modificateur dont la condition est vraie gagne
- **Cumulatif** (`"cumulative": true` au niveau racine du JSON) : TOUS les modificateurs dont la condition est vraie sont appliqués — les facteurs sont **multipliés** entre eux (pas additionnés). Utile quand les axes dimensionnels sont indépendants (ex: largeur × longueur × épaisseur)
- **Hierarchie d'override per-département** : `price` (override global, remplace tout) > sinon pour chaque département/catégorie : `manual` si défini, sinon `auto-factored` (catalogue × facteur), sinon `catalogue`. Les tiers manual et auto ne sont **pas mutuellement exclusifs** — un override manuel sur un département préserve les valeurs auto-factorisées des autres départements
- **Ordre d'exécution dans `updateRow`** : les barèmes sont évalués **inline** après la section dims et l'auto-quantité, par lookup direct `selectedId` → `CATALOGUE_DATA`. Réévalue à chaque appel de `updateRow` (changement dims, article, quantité)

**Colonnes DB** :
- `catalogue_items.labor_modifiers` JSONB — barèmes JSON
- `catalogue_items.labor_modifiers_human` TEXT — explication humaine
- `room_items.labor_auto_modifier` JSONB — résultat auto-calculé persisté (pour quote.html)

**Fonction** : `evaluateLaborModifiers(item, vars)` — évalue les barèmes, retourne `{labor_factor, material_factor, label}` ou null. **Fallback** : lit `item.labor_modifiers` (colonne DB séparée) en priorité, puis `item.calculation_rule_ai.labor_modifiers` si absent — permet aux articles MAT d'avoir leurs barèmes dans `calculation_rule_ai` sans colonne dédiée. Appelé **inline** dans `updateRow()` à chaque appel (pas de pattern deferred) — lookup direct via `selectedId` → `CATALOGUE_DATA`. Réévalue à chaque changement de dimensions. **Normalisation clé vide** : `labor_factor: {"": 1.25}` (généré par l'AI) est expandé à tous les départements MO de l'article

**Popover override** : 3 colonnes (Cat | Auto | Manuel). La colonne Auto affiche les valeurs après application du facteur. Banner bleu quand un barème est actif. **Important** : les valeurs `autoFactor`/`autoVal` sont des nombres — utiliser `!= null` (pas de truthy check) pour les conditionnels, sinon facteur `0` est traité comme absent. Classe `ov-auto-active` appliquée seulement quand `autoVal !== catVal`

**AI** : bouton AI dans la section barèmes catalogue, action `catalogue_labor_modifiers` dans `translate` edge function, prompt `ai_prompt_labor_modifiers`. **AI merge protection** dans `aiCalcRuleGenerate()` : quand l'AI régénère le JSON `calculation_rule_ai`, les clés `ask`, `override_children`, `child_dims`, `labor_modifiers` sont préservées depuis le JSON existant si l'AI ne les retourne pas

**Dims sur MAT** : les champs dims (L/H/P) sont affichés pour tout article avec `dims_config` explicite, pas seulement les FAB. Permet aux MAT avec barèmes dimensionnels d'avoir des champs dims éditables. Le guard `formula auto-qty` est aussi étendu : `calculation_rule_ai` est évalué pour tout article avec `dims_config` (pas seulement FAB). La modale catalogue sauvegarde `dims_config` pour tout type d'article si au moins une checkbox dim est cochée (ne force plus `null` pour les non-FAB).

**Tests** : groupes 17-19 (evaluateLaborModifiers basic + formulas + integration) + groupe 24 (cumulative mode) + groupe 25 (MAT with dims_config) + groupe 27 (calculation_rule_ai fallback) dans `tests/cascade-engine.test.js`

### Parser fractions dims (`parseFraction`)

Les inputs dims (L, H, P) acceptent les fractions en plus des décimaux. Au `blur`, la valeur est convertie automatiquement en décimal via `parseFraction(str)`.

**Formats supportés** : `3/4` → 0.75, `1 1/2` → 1.5, `23 5/8` → 23.625, `1-3/4` → 1.75. Les décimaux normaux passent inchangés. Les valeurs invalides retournent `null` (pas de modification).

**Implémentation** : inputs dims sont `type="text" inputmode="decimal"` (pas `type="number"` — ne supporte pas les `/`). Le blur handler appelle `parseFraction`, remplace la valeur si convertie, puis `updateRow` + `scheduleCascade`.

**Tests** : groupe 26 dans `tests/cascade-engine.test.js`

### Dupliquer un article (catalogue)

Bouton "Dupliquer" dans la modale d'édition (`openEditModal`), à côté de "Supprimer". `duplicateItem()` INSERT un nouvel article avec toutes les données copiées (description, category, item_type, price, labor/material, rules, client_text, dims_config, loss_override_pct, etc.) sauf : `is_default` forcé à false, `status` forcé à "pending". Le code ST-XXXX est auto-généré par le trigger DB. Composantes fournisseur et médias ne sont PAS copiés. Après INSERT, la modale se rouvre sur le nouvel article.

### Suggestions texte client (catalogue)

L'input `editClientText` dans la modale d'édition catalogue propose des suggestions en temps réel (debounce 250ms, Levenshtein ≤ 5, top 3, toutes catégories). Cliquer une suggestion remplace le texte. Pas de warning doublon au save. `runSaveValidation()` affiche des avis avant sauvegarde : seuls les niveaux `error`/`warn` bloquent (bypass au 2e clic), le niveau `info` (ex: "pas de texte client") s'affiche sans bloquer. **Validation barèmes** : si `labor_modifiers` est défini, chaque clé de `labor_factor`/`material_factor` est vérifiée contre les départements MO (`labor_minutes`) et catégories matériaux (`material_costs`) de l'article. Mismatch → warning `warn` avec suggestion fuzzy (Levenshtein ≤ 5) : `'Coupe' introuvable, vouliez-vous dire 'Coupe/edge' ?`

### Sauvegarde modale catalogue

La modale "Modifier l'article" **reste ouverte** après sauvegarde. Un toast navy "Sauvegardé ✓" apparaît au-dessus du footer et disparaît après 2.5s (`showSaveToast()`). L'utilisateur ferme manuellement via Annuler, le X, ou Escape. Le dirty tracking est reset après chaque save (`_modalSnapshot` recapturé). En mode embedded (iframe calculateur), la modale se ferme automatiquement après `postMessage`.

### Audit catalogue (drawer)

12 checks dans `runFullAudit()` → `renderAuditReport()` dans `catalogue_prix_stele_complet.html` :

| Check | Niveau | Détection |
|-------|--------|-----------|
| 1 | warning | Variantes texte client suspectes (Levenshtein ≤ 3, même catégorie) |
| 2 | info | Articles sans texte client |
| 3 | critical | Articles sans prix |
| 4 | warning | Catégorie non classée |
| 5 | warning | Orthographe similaire (Levenshtein < 3, même catégorie) |
| 6 | info | Jamais utilisés |
| 7 | info | Dormants (> 60 jours) |
| 8 | warning | Prix aberrants (IQR) |
| 9 | warning | Règles de calcul obsolètes ($default:) |
| 10 | warning | Règles de calcul manquantes |
| 11 | warning | **Textes clients similaires** — groupement par `normalizeForGrouping()` (lowercase, sans accents, sans articles FR de/du/des/au/aux/le/la/les/en/un/une). Détecte des `client_text` différents qui normalisent au même texte. Bouton **Uniformiser** par groupe → PATCH tous les articles minoritaires vers le texte le plus fréquent |
| 12 | warning | **Clés dépense similaires** — `normalizeExpenseKey()` (uppercase, sans accents, strip S/X pluriel). Détecte "PANNEAU BOIS" vs "PANNEAUX BOIS" dans la même catégorie catalogue |

- **`normalizeForGrouping(str)`** : normalisation pour groupement client_text
- **`normalizeExpenseKey(key)`** : normalisation pour clés material_costs
- **`uniformiseClientText(targetText, itemIds, btn)`** : PATCH batch + refresh audit

## AI — Chatbox et Edge Functions

### Architecture

1. **Client** (`calculateur.html`) : drawer latéral droit, `collectAiContext(userMessage)` assemble le contexte. **Budget tokens** : en mode normal, `catalogueSummary` ne contient que les articles de la soumission (max 50) + les ★ defaults (max 15), descriptions tronquées à 40 chars, sans `instruction` ni `client_text` pour les defaults. `calculationRules` vide par défaut. **Détections conditionnelles** : `detectCalculationContext(userMessage)` → inclut `calculationRules` + `expenseCategories` complet (avec templates). `detectCascadeDiagnostic(userMessage)` → inclut `cascadeDiagnostic` (50 derniers logs). `hasImages` → inclut section "Comment lire les plans" dans le system prompt. `needsDescriptionHelp` → inclut section "Descriptions client". **Troncature historique** : `truncateAiHistory()` garde les 16 derniers messages, résume les anciens (respecte les paires tool_use/tool_result). **Token measurement** : `console.log('[AI] Token estimate...')` dans `callAiAssistant`. Cible : ≤15K tokens normal, ≤20K diagnostic
2. **Edge Function** (`ai-assistant/index.ts`) : system prompt dynamique + Anthropic API + 10 outils (dont `update_catalogue_item`, `update_submission_line`, `remove_item`)
3. **Mode simulation** : l'AI propose des modifications en texte d'abord, l'utilisateur confirme, puis les tools sont appelés
4. **Auto-exécution** : `isUserConfirmation(text)` détecte les confirmations ("oui", "go", "confirme"…). Si l'AI retourne des `tool_use` après confirmation, `autoExecutePendingTools()` exécute directement sans afficher les boutons "Appliquer/Ignorer". **Exceptions** : `update_submission_line` et `remove_item` sont bloqués de l'auto-exécution — toujours boutons de confirmation (opérations destructives/sensibles). `update_catalogue_item` s'auto-exécute après confirmation conversationnelle (audit trail dans `catalogue_change_log` suffit)
5. **Exécution côté client** : `executeAiTool()` applique les modifications DOM + sauvegarde Supabase. Le handler `add_catalogue_item` fait un **save immédiat** (`await updateItem`) et une **cascade immédiate** (`await executeCascade` avec guard `_cascadeRunning`), sans passer par les debounce globaux (`debouncedSaveItem` 500ms, `scheduleCascade` 400ms) — car le debounce global est une fonction unique dont le timer est annulé quand plusieurs items sont ajoutés en séquence rapide. **Variables caisson** : `add_catalogue_item` et `modify_item` supportent `n_tablettes`, `n_partitions`, `n_portes`, `n_tiroirs` — écrits dans les datasets dims puis dans les inputs DOM, avec `updateRow` + `updateItem` immédiats. Essentiel pour que la cascade génère les façades/tiroirs automatiquement.
6. **Persistance** : messages sauvés dans table `chat_messages` par soumission
7. **Changement de pièce** : quand `aiFocusGroupId` change (scroll ou bouton), `onAiFocusChanged()` insère un séparateur visuel (`.ai-scope-separator`) + un message système dans `aiConversation` pour que Claude comprenne le nouveau contexte. `_lastAiFocusGroupId` évite les doublons. Réinitialisé dans `resetAiChat()`
8. **Sanitisation messages** : filtre défense en profondeur contre `content` vide/null/`[]` — appliqué côté client dans `callAiAssistant()` (calculateur), `callAiReviewAssistant()` (approbation), `callCatAiReviewAssistant()` (catalogue), ET côté serveur dans `ai-assistant/index.ts` (guard permanent). Prévient erreur Anthropic 400 "non-empty content"
7. **Images AI** : deux sources — chatbox paste/drop (base64, 3200px max, JPEG 0.90) et images de référence (URL directe Storage). Les images de référence utilisent `annotatedUrl` (image avec tags rasterisés) quand disponible, sinon l'image brute. `collectRoomDetail` inclut aussi les positions des tags en texte (`annotations: [{image, tags}]`)
8. **Rasterisation annotations** : `rasterizeAnnotatedImage()` — au save des annotations, dessine image + tags (rect navy + texte blanc) dans un canvas, upload JPEG 0.92 dans `annotated/{mediaId}.jpg`, stocke l'URL dans `room_media.annotated_url`. Migration : `sql/annotated_url.sql`
9. **Description AI — panneau proposition** : `aiGenerateDescription()` n'écrit plus directement dans le champ. Affiche un panneau inline `.ai-desc-proposal` sous le champ description avec le HTML proposé. 3 boutons : **Remplacer tout** (remplace la description entière), **Insérer la sélection** (apparaît uniquement quand du texte est sélectionné dans la proposition — insère le fragment à la position du curseur dans le champ principal), **Ignorer** (ferme le panneau). Fonctions : `showAiDescProposal`, `aiDescReplaceAll`, `aiDescInsertSelection`, `aiDescIgnore`. **Fallback règle de présentation groupe** : `_findGroupPresRule(catItem)` — si l'article n'a pas de `presentation_rule_human`, cherche une `presentation_rule` au niveau du groupe de dépense via les clés `material_costs` de l'article, puis par catégorie catalogue. La règle article a toujours priorité (pas de merge, pur fallback)
10. **Cascade debug log** : `cascadeDebugLog` — buffer mémoire circulaire (max 200 entrées) capturant tous les `console.log/warn/error` du moteur cascade via `cascadeLog(level, msg, data)`. `summarizeCascadeLog()` retourne les 50 dernières entrées en texte. `detectCascadeDiagnostic(text)` détecte les mots-clés cascade dans le message utilisateur pour inclure les logs dans le contexte AI
10. **Tool `update_catalogue_item`** : modifie un article du catalogue depuis l'AI (price, labor_minutes, material_costs, calculation_rule_ai, instruction, loss_override_pct). Permission `canEditCatalogue` requise (`edit_catalogue`). Whitelist stricte de champs, snapshot avant/après, audit trail dans `catalogue_change_log`. **Auto-exécuté** après confirmation conversationnelle (l'AI propose en simulation → l'utilisateur confirme → exécution directe). Migration : `sql/catalogue_change_log.sql`
11. **Tool `update_submission_line`** : ajuste les minutes MO, coûts matériaux ou prix de vente d'une ligne dans la soumission courante. Override local, ne modifie PAS le catalogue. Fusionne `labor_minutes`/`material_costs` avec les valeurs catalogue via `Object.assign`. `price` remplace entièrement le prix composé. **Jamais auto-exécuté** — simulation obligatoire. Pas d'audit trail DB (chat history seulement). Le contexte AI (`collectRoomDetail`) inclut `laborMinutes` et `materialCosts` catalogue par ligne + overrides existants. Le résultat du tool retourne `catalogue_base` (valeurs catalogue) et `effective_overrides` (overrides effectifs après fusion) pour vérification
12. **Tool `remove_item`** : supprime un article d'une pièce via `item_id` (UUID Supabase). Reverse lookup `itemMap` → `rowId` DOM → vérifie que l'article est dans la bonne pièce → appelle `removeRow()`. Si l'article est un parent FAB avec des enfants cascade, **tous les enfants sont supprimés aussi** (récursivement via `removeRow`). **Jamais auto-exécuté** — confirmation obligatoire (destructif). Le contexte AI expose `itemId` sur **tous** les articles (pas seulement FAB). Prompt rule : "supprimer avant de remplacer" — pour remplacer un article, l'AI supprime l'ancien d'abord puis ajoute le nouveau
13. **Sanitisation tool_use/tool_result** : `sanitizeConversationToolUse(messages)` — défense en profondeur avant chaque appel API. Détecte les blocs `tool_use` orphelins (sans `tool_result` correspondant) et injecte des `tool_result` synthétiques `{"skipped":true}`. Prévient l'erreur Anthropic 400 "tool_use ids found without tool_result blocks". Trois sources d'orphelins corrigées en amont : (a) `aiDismissPending` injecte `{"dismissed":true}` au clic "Ignorer", (b) `sendAiMessage` neutralise les pending tools si l'utilisateur tape un nouveau message, (c) `autoExecutePendingTools`/`aiApplyPending` gèrent les follow-up `tool_use` dans la réponse post-exécution (affichent des boutons de confirmation au lieu de laisser les blocs orphelins)
12. **Rate limit auto-retry** : `callAiAssistant` intercepte les réponses 429 (rate limit) et 529 (overloaded). Affiche "Un instant, le serveur est occupé…", attend 15s, retire le message temporaire (`removeLastAiMessage()`), et retry une seule fois. Si le retry échoue aussi, affiche un message d'erreur propre (jamais le texte brut de l'API)

### Architecture des prompts AI

**18 prompts** (15 dans le dropdown admin + 3 invisibles) répartis dans 4 Edge Functions. Les catégories de dépense dans admin.html réutilisent les actions `catalogue_calc_rule` et `catalogue_pres_rule` de l'edge function `translate` pour générer les JSON `calc_rule` et `presentation_rule` respectivement.
Chaque prompt a un **default hardcodé** dans le code TypeScript + un **override DB** dans `app_config`. Si la DB a une valeur non-vide → utilisée. Sinon → hardcodé.

| Clé `app_config` | Edge Function | Modèle | Admin visible |
|---|---|---|---|
| `ai_prompt_estimateur` | ai-assistant | Sonnet 4.5 | ✅ |
| `ai_prompt_approval_review` | ai-assistant | Sonnet 4.5 | ✅ |
| `ai_prompt_catalogue_import` | catalogue-import | Sonnet 4.5 | ✅ |
| `ai_prompt_contacts` | contacts-import | Sonnet 4.5 | ✅ |
| `ai_prompt_fiche_optimize` | translate | Haiku 4.5 | ✅ |
| `ai_prompt_fiche_translate_fr_en` | translate | Haiku 4.5 | ✅ |
| `ai_prompt_fiche_translate_en_fr` | translate | Haiku 4.5 | ✅ |
| `ai_prompt_client_text_catalogue` | translate | Haiku 4.5 | ✅ (bouton UI retiré, action conservée) |
| `ai_prompt_pres_rule` | translate | Sonnet 4 | ✅ |
| `ai_prompt_calc_rule` | translate | Sonnet 4 | ✅ |
| `ai_prompt_labor_modifiers` | translate | Sonnet 4 | ✅ |
| `ai_prompt_expense_pres_rule` | translate | Sonnet 4 | ✅ |
| `ai_prompt_description_calculateur` | translate | Haiku 4.5 | ✅ |
| `ai_prompt_import_components` | translate | Sonnet 4 | ✅ |
| `ai_prompt_instruction_catalogue` | translate | Haiku 4.5 | ✅ |
| `ai_prompt_explication_catalogue` | translate | Haiku 4.5 | ❌ Manquant |
| `ai_prompt_json_catalogue` | translate | Haiku 4.5 | ❌ Manquant |
| `ai_prompt_approval_suggest` | translate | Sonnet 4 | ❌ Manquant |

**Mécanisme override :** `loadPromptOverride(supabase, key)` → `app_config` → si string non-vide → utiliser. Sinon → constante hardcodée.

**Prompt final = statique (DB ou hardcodé) + dynamique (code) :**
- `ai_prompt_estimateur` : `DEFAULT_STATIC_PROMPT` (~135 lignes) + `buildSystemPrompt()` (12+ sections dynamiques : taux, dépenses, DM, règles calcul, diagnostic cascade, modification catalogue, contexte projet/pièces, logs cascade, learnings, catalogue résumé). Placeholders : `{{TAG_PREFIXES}}`, `{{DESCRIPTION_FORMAT_RULES}}`
- `ai_prompt_approval_review` : `DEFAULT_APPROVAL_REVIEW_PROMPT` (~50 lignes) + learnings. Pas de contexte dynamique riche
- `ai_prompt_catalogue_import` : `DEFAULT_STATIC_PROMPT` (~170 lignes) + `buildSystemPrompt()` (stats, catégories, taux, article ouvert, usage). **Bug** : n'injecte pas les learnings
- `ai_prompt_contacts` : `DEFAULT_STATIC_PROMPT` (~120 lignes) + `buildSystemPrompt()` (counts, types, rôles, learnings)
- Prompts translate (13 actions) : prompt statique remplacé 1:1 + learnings auto-ajoutés

**Sections hardcodées non-éditables depuis admin :**
- `DESCRIPTION_FORMAT_RULES` (9 lignes) — injecté via placeholder `{{DESCRIPTION_FORMAT_RULES}}`
- Instructions "Diagnostic cascade" et "Modification catalogue" — hardcodées dans `buildSystemPrompt()`
- Header "Règles de calcul" (~30 lignes d'instructions) — hardcodé avant la liste des règles
- User message templates (translate, 12 actions) — messages action-spécifiques côté code

**Bugs identifiés :**
- 3 prompts (`explication_catalogue`, `json_catalogue`, `approval_suggest`) manquent dans le dropdown admin
- `catalogue-import` n'injecte pas les learnings (contrairement aux 3 autres EF)

### 5 Edge Functions

| Edge Function | Modèle | Streaming | Tools | Appelé par |
|---------------|--------|-----------|-------|------------|
| `ai-assistant` | Sonnet 4.5 | Non | 9 | calculateur, approbation, catalogue |
| `translate` | Haiku 4.5 / Sonnet 4 | Non | — (12 actions) | catalogue, calculateur, approbation |
| `catalogue-import` | Sonnet 4.5 | SSE | 8 | catalogue |
| `contacts-import` | Sonnet 4.5 | SSE | 10 | clients |
| `pdf-export` | — | Non | — | calculateur (shared/pdf-export.js) |

### Déploiement Edge Functions

```bash
# CLI pas installé globalement, utiliser npx
npx supabase functions deploy ai-assistant --no-verify-jwt
npx supabase functions deploy translate --no-verify-jwt
npx supabase functions deploy catalogue-import --no-verify-jwt
npx supabase functions deploy contacts-import --no-verify-jwt
npx supabase functions deploy pdf-export --no-verify-jwt

# Secrets (déjà configurés)
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set JWT_SECRET="..."
npx supabase secrets set PDFSHIFT_API_KEY=sk_...
```

### Authentification Edge Functions

Les 5 Edge Functions sont déployées avec `--no-verify-jwt`. La vérification JWT est effectuée manuellement via `_shared/auth.ts` (bibliothèque `jose`) :
- **Primaire** : ES256 via JWKS (clé publique Supabase Auth v2, cachée 1h)
- **Fallback** : HS256 avec `JWT_SECRET` (tokens legacy)
- Tolérance horloge : 30s sur l'expiration
- CORS : origines `https://scopewright.ca` et `https://www.scopewright.ca`

## Tables Supabase principales

```
projects
  ├── submissions
  │     ├── project_rooms
  │     │     ├── room_items (avec parent_item_id pour cascade)
  │     │     └── room_media (avec annotations JSONB)
  │     ├── project_versions (snapshots)
  │     ├── submission_reviews (historique approbation)
  │     └── public_quote_tokens
  ├── project_follows (★ par utilisateur)
  └── project_contacts (liaison vers contacts)

catalogue_items
  ├── catalogue_item_components (composants fournisseur)
  └── item_media (images/PDF avec tags)

contacts ─── contact_companies ─── companies
  └── communications

app_config (key-value JSONB)
chat_messages (par soumission ou par contexte)
ai_learnings (règles organisationnelles)
employees, roles, user_roles, user_profiles
quote_clauses, submission_unlock_logs (immuable)
catalogue_change_log (audit AI modifications catalogue)
```

### Colonnes et contraintes importantes

- `room_items.line_total` est une **colonne générée PostgreSQL** (`qty × unit_price × (1 + markup/100)`) — ne pas écrire dessus
- `room_items.labor_override` JSONB — override MO par ligne (`{ dept: minutes }`). NULL = valeurs catalogue. Migration : `sql/line_overrides.sql`
- `room_items.material_override` JSONB — override matériaux par ligne (`{ cat: cost }`). NULL = valeurs catalogue
- `room_items.price_override` NUMERIC — prix de vente fixe par ligne. NULL = prix composé calculé. Remplace entièrement `computeComposedPrice`
- `catalogue_items.id` est un TEXT PK auto-généré (ST-XXXX) par trigger `trg_catalogue_auto_code`
- `project_code` auto-généré par trigger `trg_project_auto_code` (préfixe configurable)
- `submission_number` séquence globale démarrant à 100

## RLS (Row Level Security)

| Table | Policy | Note |
|-------|--------|------|
| `projects` | `auth.uid() = user_id` | Correct |
| `submissions`, `project_rooms`, `room_items`, `room_media` | JOIN chain → `projects.user_id` | Correct |
| `chat_messages` | JOIN chain OU `user_id = auth.uid()` | Correct |
| `project_follows` | `user_id = auth.uid()` | Correct |
| `app_config` | Lecture : auth + anon partiel. Écriture : admin via `is_admin()` | OK mais fragile |
| `catalogue_items` | Tous authentifiés : full CRUD | **Trop permissif** (voir audit SEC-01) |
| `ai_learnings` | Tous authentifiés : full CRUD | **Trop permissif** (voir audit RI-08) |
| `submission_reviews` | SELECT + INSERT only | Correct (immuable) |

## Règles d'architecture

### Règle 1 — Seuil de taille
Un fichier HTML ne doit pas dépasser ~2 000 lignes de JS. Au-delà, extraire la logique en fichiers `.js` séparés inclus via `<script src="...">`.

### Règle 2 — Nouveau domaine = nouveau fichier
Si une feature constitue un nouveau système (pas une modification d'un existant), elle va dans son propre fichier JS dans `shared/` ou un dossier dédié.

### Règle 3 — Fonctions partagées obligatoires
Toute fonction utilisée par 2+ pages HTML va dans `shared/`. Jamais de copier-coller entre fichiers.

### Règle 4 — Interface explicite entre modules
Chaque fichier partagé documente en commentaire d'en-tête : les fonctions exportées, les variables globales requises, et les fichiers qui l'utilisent.

### Règle 5 — Signalement proactif
Si une modification touche plus de 3 fonctions dans un domaine différent de la feature demandée, **proposer une extraction** avant de continuer. Ne pas accumuler la dette technique silencieusement.

### Règle 6 — Ne pas grossir le monolithe par défaut
Toute nouvelle feature substantielle doit d'abord évaluer si elle peut vivre dans un fichier séparé avant d'être ajoutée à `calculateur.html`. Si oui, créer le fichier dans `shared/`. Ne jamais grossir le monolithe par défaut. Le fichier `calculateur.html` était à 18 600 lignes au début du projet — chaque ajout doit être justifié.

## Directives d'exécution

- Proposer un plan d'exécution complet avant de commencer
- Demander confirmation UNE SEULE FOIS sur le plan
- Exécuter le plan au complet sans demander d'approbation intermédiaire
- Après chaque modification, mettre à jour CLAUDE.md pour refléter les changements

## Tests automatisés

**Avant toute modification au moteur cascade, rouler `node tests/cascade-engine.test.js` et vérifier que tous les tests passent.**

### Infrastructure

| Fichier | Rôle |
|---------|------|
| `tests/cascade-engine.test.js` | 282 assertions en 28 groupes, mini runner inline (0 dépendances) |
| `tests/cascade-helpers.js` | 19 fonctions pures extraites de `calculateur.html` (copies paramétrisées) |
| `tests/fixtures/catalogue.js` | 21 articles catalogue réalistes (8 FAB + 13 MAT) |
| `tests/fixtures/room-dm.js` | 5 configs DM pièce + `categoryGroupMapping` |

### Fonctions couvertes

`evalFormula`, `normalizeDmType`, `isFormulaQty`, `computeCascadeQty`, `mergeOverrideChildren`, `isRuleOverridden`, `checkAskCompleteness`, `inferAskFromDimsConfig`, `extractMatchKeywords`, `scoreMatchCandidates`, `deduplicateDmByClientText`, `getAllowedCategoriesForGroup`, `itemHasMaterialCost`, `findExistingChildForDynamicRule`, `computeChildDims`, `evaluateLaborModifiers`, `checkDefaultItemMatchCategory`, `parseFraction`, `computeRentabilityPure`

### Synchronisation

Les fonctions dans `cascade-helpers.js` sont des **copies manuelles** des fonctions pures de `calculateur.html`. Si la logique source change, mettre à jour les copies et re-rouler les tests. Les numéros de lignes source sont documentés dans les commentaires d'en-tête de chaque fonction.

## Ne pas toucher

- `landing-page/` — Projet indépendant, ne pas modifier
- `dashboard.html`, `soumission.html` — Prototypes legacy, pas de backend
- `*.ps1`, `*.xlsx`, `*.pdf` — Fichiers locaux, exclus de Git
- Fichiers dans `.gitignore` — Le projet utilise un whitelist pattern (default-deny)

## Points d'attention (sécurité)

- **Permissions côté client uniquement** — contournable via DevTools (voir audit RC-02)
- **`catalogue_items` RLS trop permissif** — tout user authentifié peut DELETE (voir audit RC-03)
- **Pas de validation d'input côté serveur** — Edge Functions ne valident pas les schémas (voir audit SEC-08)
- **Tokens publics sans expiration** — `public_quote_tokens` n'a pas de `expires_at` (voir audit RC-01)
- **PostMessage sans validation d'origine** — calculateur ↔ catalogue en iframe (voir audit SEC-11)
- Google Apps Script nécessite un **redéploiement manuel** après modification du `.gs`
- **Compression images** : les captures PDF passent par PNG lossless (temporaire) puis une seule compression JPEG 0.92 au crop. Les photos passent directement au crop JPEG 0.92. `confirmCrop()` est le seul point de compression JPEG (maxDim 3200px). AI chatbox : JPEG 0.90, 3200px (aligné sur le crop pour lisibilité des tags).
- **Sanitisation noms fichiers** : `uploadNewPlan` sanitise `file.name` avant upload Storage — NFD strip accents, strip apostrophes `''`, em/en dash → hyphen, espaces → underscores, strip caractères non-alphanumériques restants. Le `file_name` original est conservé en DB pour affichage.

## Documentation

- `docs/TECHNICAL_MANUAL.md` — Manuel technique exhaustif : architecture, systèmes (cascade, DM, permissions, workflow), Edge Functions, tables, triggers
- `docs/AUDIT_REPORT.md` — Rapport d'audit : 15 problèmes de sécurité, 18 bugs, 13 risques architecturaux, 27 recommandations priorisées
- `docs/DECISIONS.md` — Journal des décisions architecturales (DEC-001 à DEC-030) : contexte, alternatives, conséquences
- `docs/USER_GUIDE.md` — Guide utilisateur complet : 9 parties, fonctionnalités, exemples AI, workflow, trucs et astuces
- `docs/guide-catalogue.md` — Guide complet du catalogue : structure, cascades, DM, audit, variables, bugs connus
- `docs/STYLE_GUIDE.md` — Guide de style UI : palette, typographie, espacement, composants, pattern AI dot, règle fondamentale de réutilisation
- `ARCHITECTURE.md` — Vue d'ensemble architecturale (legacy, remplacé par TECHNICAL_MANUAL)
- `CHANGELOG.md` — Historique des modifications datées
- `docs/sessions/` — Résumés de session par date (features, bugs, décisions, backlogs)
- `sql/` — Fichiers de migration SQL à exécuter manuellement dans Supabase SQL Editor

## Références obligatoires

Avant tout travail UI (nouveaux composants, modifications de style, nouveaux écrans), lire `/docs/STYLE_GUIDE.md` et confirmer que chaque décision visuelle respecte ce guide. En cas de doute, demander avant d'implémenter.

## Test checklist cascade

**Valider ces scénarios avant chaque push qui touche au moteur cascade.**

### Résolution matériau
- [ ] `$default:Facades` avec 1 seul DM → résolution directe, pas de modale
- [ ] `$default:Facades` avec 2+ DM → `showDmChoiceModal` s'affiche
- [ ] `$match:PANNEAU BOIS` → détecte un candidat avec `material_costs` contenant "PANNEAU" (word-similarity)
- [ ] `$match:` sans candidat → toast actionnable 6s, pas de ligne créée
- [ ] DM avec `client_text` sans `catalogue_item_id` → résolution fonctionne

### Persistance
- [ ] Cascade 3 enfants rapides → les 3 sont sauvés en DB (pas de perte debounce)
- [ ] Supprimer un enfant cascade → `cascade_suppressed` mémorise l'ID, pas de regénération
- [ ] Restaurer via `⊘` → l'enfant revient, `cascade_suppressed` nettoyé

### Propagation contexte
- [ ] `materialCtx` pré-peuplé depuis le DM du parent FAB racine
- [ ] `materialCtx` propagé parent → enfant → petit-enfant (3 niveaux)
- [ ] `materialCtx` disambiguë un DM multi-entrées, mais ne surcharge pas un DM unique
- [ ] `$match:` filtre materialCtx : "mélamine" vs "laque" → 0 mots communs → rejeté
- [ ] `$match:` filtre materialCtx : "chêne blanc" vs "bandes chêne blanc" → mots communs → accepté
- [ ] Filtre ne s'applique pas quand materialCtx est initial (pas de `_updatedBySiblingDefault`)

### Guard dimensions
- [ ] FAB sans L/H/P → cascade bloquée, ask affiché
- [ ] `n_tablettes = 0` → accepté (valide pour caissons)
- [ ] `n_tablettes = null` → ask affiché (non défini)
- [ ] `n_portes = 0` → accepté (valide)
- [ ] `n_portes = null` → ask affiché (non défini)

### child_dims + multi-instance
- [ ] Règle avec `child_dims: { L: '(L/n_portes)-0.125', H: 'H-0.25' }` → enfant reçoit L/H calculés
- [ ] Parent dims changent (L: 24→36) → enfant child_dims recalculés automatiquement
- [ ] `child_dims` absent → aucun effet sur les dims enfant
- [ ] Formule unsafe dans child_dims → clé ignorée, pas de crash
- [ ] `child_dims` + `n_portes=2` → 2 lignes enfants distinctes (qty=1 chacune), pas 1 ligne qty=2
- [ ] `n_portes` passe de 3 à 2 → 3e enfant supprimé (orphan cleanup)
- [ ] Recharger soumission → `cascadeChildIndex` reconstruit, re-cascade stable

### Modification manuelle enfants cascade
- [ ] Changer la qty d'un enfant cascade → bordure indigo `.cascade-manual-edit` + bouton ↺ visible
- [ ] Changer le prix (override) d'un enfant cascade → même indicateur
- [ ] Cliquer ↺ → qty/prix restaurés aux valeurs cascade, `.cascade-manual-edit` retiré, re-cascade du parent
- [ ] Changer la qty d'un enfant cascade → PAS de modale DM (guard `scheduleCascade` sur `cascade-child`)

### Barèmes et modificateurs
- [ ] Article avec `labor_modifiers` + L > seuil → popover affiche colonne Auto avec valeurs factorisées
- [ ] Changer les dimensions → Auto recalculé dynamiquement
- [ ] Override manuel > Auto (manual gagne)
- [ ] Recharger soumission → auto/manuels restaurés
- [ ] Article sans `labor_modifiers` → pas de colonne Auto, pas de `.has-auto-modifier`
- [ ] `cumulative: true` → tous les modificateurs vrais sont appliqués, facteurs multipliés
- [ ] `cumulative: false`/absent → first-match (comportement inchangé)

### Catégorie de dépense dynamique
- [ ] `$match:PANNEAU BOIS` + DM "Placage chêne blanc" (material_costs: {"PANNEAU MÉLAMINE": 5.2}) → détecte via mot commun "PANNEAU"
- [ ] `effectiveExpCats` = union catégorie règle + catégories dérivées DM
- [ ] Changement de DM → re-cascade avec nouvelles catégories effectives

### Filtre catégorie $match
- [ ] DM mélamine → `$match:FINITION BOIS` rejeté silencieusement (mélamine n'a pas FINITION dans costs/cascades)
- [ ] DM placage → `$match:FINITION BOIS` accepté (placage a FINITION dans ses cascades)
- [ ] DM mélamine → `$match:BANDE DE CHANT` accepté (mélamine a BANDE DE CHANT dans ses cascades)
- [ ] Changement DM mélamine → placage → finition et bande de chant bois créées
- [ ] Changement DM placage → mélamine → finition supprimée, bande de chant PVC remplace bois
