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
| `calculateur.html` | App principale — projets, pipeline, soumissions, meubles, cascade engine, DM system, AI chatbox, annotations, preview | ~18 600 lignes |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — CRUD items, images, prix composé, AI import | ~9 200 lignes |
| `admin.html` | Administration — permissions, rôles, catégories, taux, tags, prompts AI, présentation | ~2 900 lignes |
| `approbation.html` | Approbation soumissions + items proposés, AI review chat | ~2 300 lignes |
| `clients.html` | CRM — contacts, entreprises, communications, AI import | ~2 340 lignes |
| `quote.html` | Vue client publique — soumission multi-page + acceptation + signature | ~2 060 lignes |
| `fiche.html` | Fiches de vente produits — présentation client d'un article catalogue | ~1 200 lignes |
| `app.html` | Tableau de bord — grille 2 colonnes responsive, navigation modules | ~300 lignes |
| `login.html` | Authentification Supabase — email/password, refresh token | ~200 lignes |
| `scopewright-tokens.css` | Design tokens — couleurs, rayons, ombres, espacements | Variables CSS |
| `google_apps_script.gs` | Envoi email estimation (GAS) | ~240 lignes |

## Fichiers partagés (`shared/`)

| Fichier | Contenu | Utilisé par |
|---------|---------|-------------|
| `shared/auth.js` | `SUPABASE_URL`, `SUPABASE_KEY`, `authenticatedFetch()`, `refreshAccessToken()`, `isTokenExpiringSoon()`, `_tokenDebug()` | Toutes les pages authentifiées (7 fichiers) |
| `shared/utils.js` | `escapeHtml()`, `escapeAttr()` | Toutes les pages qui affichent des données utilisateur (8 fichiers) |
| `shared/pricing.js` | `computeComposedPrice(item, includeInstallation)` (flat costs), `computeCatItemPrice(item)` ({cost,qty} objects) | calculateur, catalogue, approbation |

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
- 3 types de cibles : code direct (`"ST-0042"`), matériau par défaut (`"$default:Facades"`), correspondance fuzzy (`"$match:BANDE DE CHANT"`)
- `override_children` : empêche la duplication de matériaux cascade entre niveaux. L'item qui **déclare** l'override traite toujours ses propres règles — seuls ses **descendants** sont bloqués (check contre `parentOverrides`, pas `mergedOverrides`)
- `$match:` candidates : **catégorie de dépense dynamique** — la catégorie dans la règle (ex: `"PANNEAU BOIS"`) est un **hint**, pas un filtre littéral. `resolveMatchTarget` dérive la catégorie réelle depuis le DM : 1) `materialCtx.chosenClientText` → lookup catalogue → clés `material_costs`, 2) fallback DM direct par type. Les clés DM partageant un **mot commun** avec la règle sont incluses (ex: `"PANNEAU MÉLAMINE"` matche `"PANNEAU BOIS"` via `"PANNEAU"`). `effectiveExpCats` = union de toutes les catégories pertinentes. `findExistingChildForDynamicRule` utilise la même similarité par mots pour reconnaître les enfants existants. Fallback catalogue par nom de catégorie (fuzzy, plural-normalisé) si aucun candidat `material_costs`
- `getDefaultMaterialKeywords` : **5 tiers** — **tier 0 : materialCtx shortcut** (si `materialCtx.chosenClientText` existe, ses keywords sont utilisés directement, court-circuitant tous les autres tiers), puis : direct (DM type === expense), fuzzy (substring), catégorie catalogue de l'item DM, cross-DM. Chaque tier déduplique par `client_text` (`deduplicateDmByClientText`). Priorité de résolution multi-match : 1) DM unique → direct, 2) `materialCtx` → disambiguë, 3) `dmChoiceCache` → cache, 4) `showDmChoiceModal` → modale
- **`materialCtx`** : contexte cascade **hérité à travers toute la chaîne** parent → enfant → petit-enfant (4e paramètre de `executeCascade`). Pré-peuplé depuis le DM de la **catégorie du parent FAB racine** (ex: "Caisson" → `chosenClientText = "Placage chêne blanc"`). Sert de **disambiguateur** quand plusieurs DM existent, mais **ne surcharge jamais** un DM unique explicite (ex: DM "Finition" = "Laque polyuréthane" est utilisé tel quel)
- Quantités calculées par unité puis multipliées par `rootQty` (quantité du FAB racine)
- Dimensions propagées depuis le FAB racine à toute profondeur
- Tags : `saveRowTag` propage récursivement le tag à tous les descendants (`propagateTagToDescendants`)
- Tri : `sortRowsPreservingCascade` trie uniquement les parents, enfants restent groupés sous leur parent
- Guards : `_cascadeRunning` (re-entrance), `_isLoadingSubmission` (chargement), debounce 400ms
- **Guard `ask` completeness** : si l'article déclare `calculation_rule_ai.ask` (ex: `["L","H"]`), la cascade ne se déclenche qu'une fois les variables listées remplies. Appliqué uniquement à `depth === 0` (FAB racine). **Seuils** : `L`/`H`/`P`/`QTY` doivent être **> 0** (dimensions physiques). `N_TABLETTES`/`N_PARTITIONS` doivent seulement être **définis** (`!= null`) — 0 est valide (caisson sans tablettes/partitions). **Fallback** : si `ask` absent ET `dims_config` **explicitement défini** sur l'article, inféré depuis `dims_config` (ex: `{l:true, h:true}` → `["L","H"]`). Sans `dims_config` explicite, pas d'inférence. Mapping : `L`/`LARGEUR`, `H`/`HAUTEUR`, `P`/`PROFONDEUR`, `QTY`/`QUANTITÉ`, `N_TABLETTES`/`TABLETTES`, `N_PARTITIONS`/`PARTITIONS`
- **Validation target** : après résolution (`resolveCascadeTarget`), le target est vérifié dans `CATALOGUE_DATA`. Si l'ID n'existe pas dans le catalogue, traité comme résolution échouée (empêche la création de lignes vides)
- **`cascadeRuleTarget`** : chaque enfant cascade stocke `dataset.cascadeRuleTarget = rule.target` (ex: `"$default:Façades"`). Sert à identifier quel rule a créé l'enfant, utilisé par le matching locked children et la préservation au rechargement

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

**Résolution échouée** : quand `$default:` ou `$match:` ne trouve aucun article valide :
- **Pas de ligne enfant créée** — la règle est simplement sautée (`continue`)
- **Toast actionnable** affiché 6s : identifie le parent, la cible échouée, et dit exactement quel DM configurer
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

### Matériaux par défaut (DM)

**Room-level uniquement** (`roomDM[groupId]`). Le niveau soumission a été retiré.
- `getDefaultMaterialsForGroup(groupId)` retourne `roomDM[groupId]` ou `[]`
- `reprocessDefaultCascades(changedGroup, scopeGroupId)` — re-cascade quand un DM change (scopeGroupId obligatoire). Invalide `matchDefaults` (cache `$match:` persisté) et re-trigger les parents avec `$default:` ET `$match:` targets
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
4. **`getDefaultMaterialKeywords`** : tier 0 `materialCtx` shortcut (prioritaire), puis lookup catalogue via `client_text` d'abord, fallback `catalogue_item_id`
5. **`getMissingRequiredDm`** : vérifie `client_text || catalogue_item_id`
6. **`findDmEntryByType`** : accepte entries avec `client_text` sans `catalogue_item_id`
7. **Migration données** : au `openSubmission`, dérive `client_text` depuis `catalogue_item_id` pour les DM legacy
8. **`getAllowedCategoriesForGroup(groupName)`** : inverse `categoryGroupMapping` (chargé depuis `app_config.category_group_mapping`) pour trouver les catégories catalogue autorisées par groupe DM

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

### Pipeline commercial

3 vues : Table, Cartes, Soumissions. `project_code` auto-généré par trigger DB.
`amount_override` NUMERIC : priorité d'affichage sur le montant calculé (affiché en rouge).

### Prix composé

```
Prix = Σ(labor_minutes[dept] / 60 × taux_horaire[dept])
     + Σ(material_costs[cat] × (1 + markup%/100 + waste%/100))
```

- `loss_override_pct` sur l'article remplace le `waste` par catégorie
- Deux formats de `material_costs` : flat numbers (calculateur via `computeComposedPrice`) et objets `{cost, qty}` (catalogue/approbation via `computeCatItemPrice`)
- Si aucun prix composé défini, le prix manuel (`price`) est utilisé

### Suggestions texte client (catalogue)

L'input `editClientText` dans la modale d'édition catalogue propose des suggestions en temps réel (debounce 250ms, Levenshtein ≤ 5, top 3, toutes catégories). Cliquer une suggestion remplace le texte. Pas de warning doublon au save — seul le check "pas de texte client" (info) reste dans `runSaveValidation()`.

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

1. **Client** (`calculateur.html`) : drawer latéral droit, `collectAiContext()` assemble le contexte
2. **Edge Function** (`ai-assistant/index.ts`) : system prompt dynamique + Anthropic API + 7 outils
3. **Mode simulation** : l'AI propose des modifications, l'utilisateur confirme avant exécution
4. **Exécution côté client** : `executeAiTool()` applique les modifications DOM + sauvegarde Supabase
5. **Persistance** : messages sauvés dans table `chat_messages` par soumission

### 4 Edge Functions

| Edge Function | Modèle | Streaming | Tools | Appelé par |
|---------------|--------|-----------|-------|------------|
| `ai-assistant` | Sonnet 4.5 | Non | 7 | calculateur, approbation, catalogue |
| `translate` | Haiku 4.5 / Sonnet 4 | Non | — (11 actions) | catalogue, calculateur, approbation |
| `catalogue-import` | Sonnet 4.5 | SSE | 8 | catalogue |
| `contacts-import` | Sonnet 4.5 | SSE | 10 | clients |

### Déploiement Edge Functions

```bash
# CLI pas installé globalement, utiliser npx
npx supabase functions deploy ai-assistant --no-verify-jwt
npx supabase functions deploy translate --no-verify-jwt
npx supabase functions deploy catalogue-import --no-verify-jwt
npx supabase functions deploy contacts-import --no-verify-jwt

# Secrets (déjà configurés)
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set JWT_SECRET="..."
```

### Authentification Edge Functions

Les 4 Edge Functions sont déployées avec `--no-verify-jwt`. La vérification JWT est effectuée manuellement via `_shared/auth.ts` (bibliothèque `jose`) :
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
```

### Colonnes et contraintes importantes

- `room_items.line_total` est une **colonne générée PostgreSQL** (`qty × unit_price × (1 + markup/100)`) — ne pas écrire dessus
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

## Directives d'exécution

- Proposer un plan d'exécution complet avant de commencer
- Demander confirmation UNE SEULE FOIS sur le plan
- Exécuter le plan au complet sans demander d'approbation intermédiaire
- Après chaque modification, mettre à jour CLAUDE.md pour refléter les changements

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
- Les images sont compressées client-side (canvas resize + JPEG 0.7) avant upload

## Documentation

- `docs/TECHNICAL_MANUAL.md` — Manuel technique exhaustif : architecture, systèmes (cascade, DM, permissions, workflow), Edge Functions, tables, triggers
- `docs/AUDIT_REPORT.md` — Rapport d'audit : 15 problèmes de sécurité, 18 bugs, 13 risques architecturaux, 27 recommandations priorisées
- `docs/DECISIONS.md` — Journal des décisions architecturales (DEC-001 à DEC-010) : contexte, alternatives, conséquences
- `docs/guide-catalogue.md` — Guide complet du catalogue : structure, cascades, DM, audit, variables, bugs connus
- `ARCHITECTURE.md` — Vue d'ensemble architecturale (legacy, remplacé par TECHNICAL_MANUAL)
- `CHANGELOG.md` — Historique des modifications datées
- `sql/` — Fichiers de migration SQL à exécuter manuellement dans Supabase SQL Editor

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

### Guard dimensions
- [ ] FAB sans L/H/P → cascade bloquée, ask affiché
- [ ] `n_tablettes = 0` → accepté (valide pour caissons)
- [ ] `n_tablettes = null` → ask affiché (non défini)

### Catégorie de dépense dynamique
- [ ] `$match:PANNEAU BOIS` + DM "Placage chêne blanc" (material_costs: {"PANNEAU MÉLAMINE": 5.2}) → détecte via mot commun "PANNEAU"
- [ ] `effectiveExpCats` = union catégorie règle + catégories dérivées DM
- [ ] Changement de DM → re-cascade avec nouvelles catégories effectives
