# Manuel Technique Scopewright/Stele

> Document exhaustif pour assistant AI. Couvre l'architecture, les systèmes, les flux de données et les mécanismes internes de la plateforme Scopewright.
>
> **Dernière mise à jour** : 2026-03-14

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Système de catalogue](#2-système-de-catalogue)
3. [Moteur de cascade](#3-moteur-de-cascade)
4. [Matériaux par défaut](#4-matériaux-par-défaut)
5. [Workflow de soumission](#5-workflow-de-soumission)
6. [Assistant AI](#6-assistant-ai)
7. [Système de permissions](#7-système-de-permissions)
8. [Présentation client (quote.html)](#8-présentation-client-quotehtml)
9. [CRM (clients.html)](#9-crm-clientshtml)
10. [Administration (admin.html)](#10-administration-adminhtml)
11. [Base de données Supabase](#11-base-de-données-supabase)
12. [Edge Functions](#12-edge-functions)
13. [Google Apps Script](#13-google-apps-script)
14. [Tests automatisés — Moteur cascade](#14-tests-automatisés--moteur-cascade)

---

## 1. Architecture générale

### 1.1 Stack technique

| Couche | Technologie | Détail |
|--------|------------|--------|
| Frontend | HTML/CSS/JS vanilla | Fichiers autonomes, pas de build system, pas de framework |
| Backend | Supabase | PostgreSQL + Auth + Storage + Edge Functions |
| AI | Anthropic API | Claude Sonnet 4.5 (assistant complexe) / Haiku 4.5 (assistant simple + traduction), Sonnet 4 (JSON). Routing dynamique par complexité |
| Déploiement | Netlify | Auto-deploy depuis GitHub (branche `main`) |
| Email | Google Apps Script | Envoi de soumissions par courriel |
| CDN | Google Fonts, PDF.js | Inter, Cormorant Garamond, PDF.js 3.11.174 |

### 1.2 Structure des fichiers

| Fichier | Rôle | Taille approx. |
|---------|------|----------------|
| `calculateur.html` | Application principale — projets, soumissions, rooms, items, cascade, AI chatbox, annotations, pipeline, preview | ~22 950 lignes |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — CRUD items, images, prix composé, sandbox, AI import | ~8 530 lignes |
| `admin.html` | Administration — 6 volets sidebar (Présentation, Catalogue, Workflow, Équipe, Prompts AI, Agent Maître), 22 sections | ~4 044 lignes |
| `approbation.html` | Approbation — soumissions pendantes + articles proposés, AI review chat | ~2 233 lignes |
| `quote.html` | Vue client publique — soumission multi-page + acceptation + signature | ~2 106 lignes |
| `clients.html` | CRM — contacts, entreprises, communications, AI import | ~2 324 lignes |
| `fiche.html` | Fiches de vente produits — présentation client d'un article catalogue | ~1 120 lignes |
| `app.html` | Tableau de bord — grille 2 colonnes responsive, navigation vers les modules | ~685 lignes |
| `login.html` | Authentification Supabase — email/password, refresh token | ~247 lignes |
| `shared/presentation-client.js` | Fonctions présentation client — texte, descriptions, clauses, images, snapshot, status UI | ~766 lignes |
| `shared/master-agent.js` | Agent Maître global drawer — FAB, chat UI, tool approval, doc sync, sanity badge, image paste/drop | ~1 606 lignes |
| `shared/pdf-export.js` | Export PDF server-side via PDFShift — `exportSubmissionPdf()`, `_sanitizePdfFilename()` | ~249 lignes |
| `shared/sanity-checks.js` | Sanity checks déterministes — `runSanityChecks(opts)`, 4 checks (presRuleKeys, descriptionsNotEmpty, totalNotZero, cascadeOrphans) | ~164 lignes |
| `scopewright-tokens.css` | Design tokens — couleurs, rayons, ombres, espacements | Variables CSS |
| `google_apps_script.gs` | Envoi email estimation (GAS) | ~240 lignes |

### 1.3 Flux de données

```
┌──────────────────────────────────────────────────────────┐
│                     NAVIGATEUR CLIENT                     │
│                                                          │
│  calculateur.html ──┐                                    │
│  catalogue.html ────┤  authenticatedFetch()               │
│  admin.html ────────┤  ────────────────────►  Supabase   │
│  approbation.html ──┤        REST API        (PostgREST) │
│  clients.html ──────┤                                    │
│  fiche.html ────────┘                                    │
│                                                          │
│  quote.html ─────── anon key ──────────►  Supabase RPC   │
│    (public, pas d'auth user)             get_public_quote │
│                                          accept_quote     │
│                                                          │
│  catalogue.html ──── SSE stream ──────►  catalogue-import │
│  clients.html ────── SSE stream ──────►  contacts-import  │
│  calculateur.html ── JSON req/res ────►  ai-assistant     │
│  catalogue.html ──── JSON req/res ────►  translate        │
│  approbation.html ── JSON req/res ────►  translate        │
│                                          ai-assistant     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    SUPABASE PLATFORM                      │
│                                                          │
│  PostgreSQL ─── Tables + RLS + Triggers + Sequences      │
│  Auth ───────── JWT (access 1h, refresh 30j)             │
│  Storage ────── room-images, submission-snapshots,        │
│                 submission-plans, fiche-images,           │
│                 admin-assets                              │
│  Edge Functions  ai-assistant, translate,                 │
│                  catalogue-import, contacts-import        │
│                  ──────► Anthropic API (Claude)           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  GOOGLE APPS SCRIPT                       │
│  calculateur.html ──── fetch (no-cors) ──► doPost()      │
│                                            envoyerEstim() │
│                                            ──► MailApp    │
└──────────────────────────────────────────────────────────┘
```

### 1.4 Authentification

**Pattern `authenticatedFetch()`** (extrait dans `shared/auth.js`, inclus par toutes les pages authentifiées) :
1. Vérifie si le token expire dans < 5 minutes (`isTokenExpiringSoon`)
2. Si oui, rafraîchit proactivement via `/auth/v1/token?grant_type=refresh_token`
3. Injecte les headers `Authorization: Bearer {token}` et `apikey: {SUPABASE_KEY}`
4. Sur réponse 401/403 : rafraîchit le token et réessaie (max 2 tentatives, 1s de délai)
5. Déduplique les appels de refresh concurrents via `_refreshPromise`
6. En cas d'échec total : efface les tokens et redirige vers `login.html`

**Token storage** : `localStorage.sb_access_token`, `localStorage.sb_refresh_token`, `localStorage.sb_user_id`, `localStorage.sb_user_email`

**`quote.html`** : Utilise uniquement la clé anon Supabase (pas d'auth utilisateur). La sécurité repose sur le token de soumission passé en paramètre URL.

---

## 2. Système de catalogue

### 2.1 Types d'articles

| Type | Valeur `item_type` | Caractéristiques |
|------|-------------------|------------------|
| Fabrication | `'fabrication'` | Dimensions L/H/P configurables via `dims_config`, formules de calcul, articles cascadés, sandbox complet |
| Matériau | `'materiau'` | Prix unitaire simple, peut être cible de `$default:` ou `$match:`, peut être marqué `is_default` |
| Legacy | `null` / vide | Articles non classifiés, traités comme matériau |

### 2.2 Catégories de dépense

24 catégories par défaut dans `app_config.expense_categories`, chacune avec :
- `name` : nom (ex: "PANNEAU BOIS", "BANDE DE CHANT", "QUINCAILLERIE")
- `markup` : marge % par défaut
- `waste` : facteur de perte % par défaut
- `calc_template` (optionnel) : template texte pour la génération AI de règles de calcul
- `pres_template` (optionnel) : template texte pour la génération AI de règles de présentation
- `calc_rule` (optionnel) : JSON de règle de calcul au niveau du groupe (même structure que `catalogue_items.calculation_rule_ai`). Éditable dans admin.html via un textarea JSON par catégorie, avec bouton AI de génération (réutilise l'action `catalogue_calc_rule`, Sonnet 4). Fonctions : `aiExpenseCalcRule(btn)`, `_getExpenseContext(btn)`, `_flashAiSuccess(el)`, `_flashAiDotDone(btn)`
- `presentation_rule` (optionnel) : JSON de règle de présentation au niveau du groupe (même structure que `catalogue_items.presentation_rule` : `{sections, exclude, notes}`). Sert de fallback quand un article n'a pas sa propre `presentation_rule_human`. Éditable dans admin.html via un textarea JSON par catégorie, avec bouton AI de génération (réutilise l'action `catalogue_pres_rule`, Sonnet 4). Fonctions : `aiExpensePresRule(btn)`. CSS : même pattern que la modale catalogue (`.ai-field-wrap`, `.btn-ai-dot` position absolute, `.ai-feedback-container`/`.ai-feedback-banner`). AI responses : le champ `prefix` est strippé (`delete s.prefix`) car non utilisé dans le schéma `presentation_rule`

Les catégories sont aussi groupées par `material_groups` (Caisson, Facades, Panneaux, Tiroirs, Poignées, Éclairage, Autre) via `app_config.category_group_mapping`.

### 2.3 Structure JSON `calculation_rule_ai`

```json
{
  "formula": "L * H / 144",
  "cascade": [
    {
      "target": "ST-0042",
      "qty": "ceil(L/24)",
      "condition": "L > 48"
    },
    {
      "target": "$default:Facades",
      "qty": "L * H / 144"
    },
    {
      "target": "$match:BANDE DE CHANT",
      "qty": "(L * 2 + H * 2) / 12"
    }
  ],
  "constraints": [
    { "type": "auto_add", "item_id": "ST-0005", "quantity": 2 },
    { "type": "auto_add_calculated", "item_id": "ST-0006", "quantity_formula": "ceil(L/24)" },
    { "type": "requires_swap", "target_group": "Poignees", "warning": "..." },
    { "type": "requires_choice", "conditions": [{"condition": "...", "message": "..."}] }
  ],
  "override_children": ["BANDE DE CHANT"],
  "ask": ["L", "H"],
  "notes": "Notes pour l'AI"
}
```

**Variables disponibles dans les formules** : `L` (longueur pouces), `H` (hauteur pouces), `P` (profondeur pouces), `QTY` (quantité racine FAB), `n_tablettes`, `n_partitions`, `n_portes`, `n_tiroirs`

**Fonctions mathématiques** : `ceil`, `floor`, `round`, `min`, `max`

**Évaluation sécurisée** (`evalFormula`) : Substitue les variables, remplace les fonctions par `Math.*`, vérifie qu'aucun caractère non-math ne subsiste, exécute via `new Function('return ' + safe)()`.

### 2.4 Compilation template → JSON

**Flux `autoGenerateBaseRules(item)`** (appelé au premier enregistrement d'un nouvel article) :

1. Trouve le `calc_template` de la catégorie de dépense de l'article
2. Trouve le `pres_template` de la catégorie de dépense
3. Envoie les deux en parallèle à l'Edge Function `translate` :
   - `action: 'catalogue_calc_rule'` → reçoit `{ explication, json: { formula, cascade, ask } }`
   - `action: 'catalogue_pres_rule'` → reçoit `{ explication, json: { sections, exclude } }`
4. Applique les résultats aux champs `calculation_rule_ai`, `calculation_rule_human`, `presentation_rule`, `presentation_rule_human`

**Exclusion** : Les articles `item_type='fabrication'` NE reçoivent PAS de templates automatiques (règles custom uniquement).

### 2.5 Bouton AI de génération manuelle

**`aiCalcRuleGenerate()`** :
1. Lit l'explication humaine du champ `editCalcRuleHuman`
2. Construit un contexte riche : tous les codes articles, catégories de dépense, matériaux par défaut, templates par catégorie, 3 exemples de la même catégorie (filtrés par `item_type`)
3. Appelle `translate` avec `action: 'catalogue_calc_rule'`
4. Parse la réponse via `parseAiEnvelope()` + `fixEnvelopeJsonSplit()`
5. Si `status: ok` → auto-applique. Si `needs_review` → montre un bouton "Appliquer"

### 2.6 Règles de présentation (`presentation_rule`)

```json
{
  "sections": [
    { "key": "CAISSON", "template": "{client_text}" },
    { "key": "DÉTAILS", "template": "Inclut {client_text}" }
  ],
  "exclude": ["FINITION"]
}
```

**Ordre des sections** (hardcodé) : CAISSON, FACADES, PANNEAUX, COMPTOIR, TIROIRS, POIGNEES, QUINCAILLERIE, ECLAIRAGE, FINITION, RANGEMENT, DETAILS, EXCLUSIONS, NOTES, PARTICULARITES

L'assemblage de la description client (`sbBuildDescription` dans le sandbox, `assembleRoomDescription` dans le calculateur) combine les matériaux par défaut sélectionnés + les règles de présentation de chaque article pour produire un texte structuré.

**Fallback groupe** : `_findGroupPresRule(catItem)` dans `calculateur.html` — quand un article n'a pas de `presentation_rule_human`, cherche une `presentation_rule` au niveau du groupe de dépense (`expenseCategories`). Résolution : 1) clés `material_costs` de l'article matchées contre `expenseCategories[].name`, 2) catégorie catalogue de l'article. La règle article a toujours priorité (pas de merge, pur fallback). Utilisé dans `aiGenerateDescription()` pour enrichir le contexte AI.

**Injection DM dans le prompt description (#207-2)** : `aiGenerateDescription(groupId)` passe `roomDM[groupId] || []` comme 4e paramètre (`defaultMaterials`) à `callEdgeFunction(texts, action, images, defaultMaterials)`. L'edge function `translate` (action `calculateur_description`) extrait `defaultMaterials` du body et injecte une section "MATÉRIAUX PAR DÉFAUT DE LA PIÈCE" dans le system prompt, listant chaque type DM et son `client_text`. L'AI génère ainsi des descriptions cohérentes avec les matériaux effectivement configurés dans la pièce. **Nettoyage backticks (#207-3)** : la réponse AI est nettoyée côté client — regex chain strip les wrappers ` ```html ` / ` ``` ` / ` '''html ` / ` ''' ` avant écriture dans le DOM.

**Contexte AI catalogue** : `aiCatalogueExplication()` dans `catalogue_prix_stele_complet.html` inclut les `presentation_rule` JSON des groupes de dépense via `getPresRuleJsons()` pour que l'AI s'inspire de la structure du groupe lors de la génération des règles de présentation d'un article.

### 2.7 Prix composé

```
Prix = Σ(labor_minutes[dept] / 60 × taux_horaire[dept])
     + Σ(material_costs[cat] × (1 + waste%/100) × (1 + markup%/100))
```

- **Markup sur coût + perte** : le markup s'applique sur `(coût + perte)`, pas sur le coût seul
- `loss_override_pct` sur l'article remplace le `waste` par catégorie
- Les composants fournisseur (`catalogue_item_components`) verrouillent automatiquement les inputs de `material_costs` pour les catégories concernées
- Si aucun prix composé n'est défini, le prix manuel (`price`) est utilisé

**Rentabilité** : `computeRentabilityData` (retour objet pour AI context) et `openRentab` (modale UI) partagent la même logique de calcul. Fonction pure testable : `computeRentabilityPure` dans `tests/cascade-helpers.js`.
- **Marge brute** = `(PV - coûtant mat - perte - salaires) / PV × 100`
- **Profit net** = `(PV - coûtant mat - perte - salaires - frais fixes) / PV × 100`
- **Marge visée** : 38% (hardcodé)
- `price_override` et `__AJOUT__` sont traités comme ajouts flat (pas de décomposition MO/matériaux)
- `openRentab` applique les overrides (laborAuto, materialAuto, manual) — même hiérarchie que `computeRentabilityData`

**Modale rentabilité** (refonte #132) :
- 4 sections : KPI cards → bannière AI → barre répartition → 2 colonnes (marges + MO) → tableau matériaux → tags
- KPI : Vente / Coût direct (mat + perte + salaires, sans frais fixes) / Profit tri-state — vert (`#F0FDF4`/`#22C55E`) ≥15%, ambre (`#FFFBEB`/`#B45309`) 8-14.9%, ambre (`#FFFBEB`/`#B45309`) <8%
- Bannière AI : si marge brute effective < 35% → fond `#FFFBEB`, bordure `#F59E0B`, texte `#92400E` + bouton "Ajuster le prix" (scope group uniquement)
- Prix recommandé : `PV_cible = (mat + perte + salaires) / (1 - margeVisée/100)`. Applique via `roomModifiers[groupId]` (% sous-total pièce)
- `rentabApplyTargetPrice(groupId, prixCible)` : calcule le % room modifier depuis le sous-total base (sans modifier existant), tient compte du global modifier. Persiste en DB, ferme la modale silencieusement
- Modificateur % sous-total : `computeRentabilityData` et `openRentab` appliquent `getModifierMultiplier(groupId)` au PV. Pour le scope projet, agrégation per-group avec modifiers individuels
- Barre répartition : Matériaux `#0B1220` (navy) + Salaires `#374151` (gris foncé) + Frais fixes `#9CA3AF` (gris) + Profit `#22C55E` (vert). Labels si segment ≥ 8%
- Badges marges colorés — marge brute : vert `#16A34A` ≥35%, ambre `#D97706` 25-34.9%, rouge `#DC2626` <25%. Profit net : vert ≥15%, ambre 8-14.9%, rouge <8%
- Ventilation MO : barres `#0B1220` (navy) sur fond `#F1F5F9`, triées décroissant
- Tableau matériaux : 4 colonnes (Base / Perte / Markup / Total) avec accumulateurs per-catégorie

### 2.8 Barèmes et modificateurs (`labor_modifiers`)

Ajustements automatiques de prix basés sur les dimensions. Section séparée de `calculation_rule_ai` dans la modale catalogue (admin only).

**Structure JSON** (`catalogue_items.labor_modifiers`) :
```json
{
  "cumulative": false,
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
`cumulative` : `false`/absent = first-match, `true` = tous les modificateurs vrais sont appliqués (facteurs multipliés).

**Colonnes DB** :
- `catalogue_items.labor_modifiers` JSONB, `catalogue_items.labor_modifiers_human` TEXT
- `room_items.labor_auto_modifier` JSONB — résultat persisté

**Évaluation** : `evaluateLaborModifiers(item, vars)` — deux modes :
- **First-match** (défaut) : premier modificateur dont la condition est vraie gagne
- **Cumulatif** (`"cumulative": true` au niveau racine) : tous les modificateurs dont la condition est vraie sont appliqués — les facteurs sont **multipliés** entre eux (pas additionnés). Utile pour les articles avec axes dimensionnels indépendants (ex: largeur × longueur × épaisseur)

**Fallback source** : lit `item.labor_modifiers` (colonne DB séparée) en priorité. Si absent, fallback vers `item.calculation_rule_ai.labor_modifiers`. Permet aux articles MAT d'avoir leurs barèmes dans `calculation_rule_ai` sans nécessiter la colonne dédiée.

Variables : L, H, P, QTY, n_tablettes, n_partitions, n_portes, n_tiroirs. Fonctions : ceil, floor, round, min, max.

**Facteurs** : multiplicateurs (1.0 = base, 1.25 = +25%). 3 formats : objet `{dept: multiplier}`, nombre scalaire (appliqué à tous via expansion), ou objet clé vide `{"": multiplier}` (normalisé en per-key — l'AI génère parfois ce format). Appliqués aux valeurs catalogue : `labor_minutes[dept] × factor`, `material_costs[cat] × factor`.

**Ordre d'exécution** : dans `updateRow()`, les barèmes sont évalués **inline** après la section dims et auto-quantité, par lookup direct de `selectedId` → `CATALOGUE_DATA`. Pas de pattern deferred — réévalue à chaque appel `updateRow` (y compris changement de dimensions).

**Hiérarchie d'override per-département** : `ov.price` remplace tout. Sinon, pour chaque département/catégorie : `manual` si défini, sinon `auto-factored` (catalogue × facteur barème), sinon `catalogue`. Les tiers manual et auto ne sont **pas mutuellement exclusifs** — un override manuel sur Gestion préserve les valeurs auto-factorisées d'Assemblage et Installation. Même logique dans `updateRow`, `getRowTotal`, et `computeRentabilityData`.

**Dims sur MAT** : le guard `showDims` dans `updateRow` accepte tout article avec `dims_config` explicite (pas seulement les FAB). Un MAT avec `dims_config: {l:true, h:true, p:true}` et `labor_modifiers` affiche les champs dims L×H×P pour que les conditions barèmes puissent être évaluées. Le guard `formula auto-qty` est aussi étendu : `calculation_rule_ai` (formule de quantité automatique) est évalué pour tout article avec `dims_config`, pas seulement les FAB. La modale catalogue (`catalogue_prix_stele_complet.html`) sauvegarde `dims_config` indépendamment du type d'article — si au moins une checkbox dim (L/H/P) est cochée, la valeur est sauvegardée; sinon `null`. Les checkboxes dims sont visibles pour les FAB ou tout article ayant déjà un `dims_config` en DB.

**Parser fractions** : les inputs dims (L, H, P) sont `type="text" inputmode="decimal"` et acceptent les fractions (`3/4`, `1 1/2`, `23 5/8`, `1-3/4`). Au blur, `parseFraction(str)` convertit en décimal. Les décimaux normaux passent inchangés, les valeurs invalides retournent `null` (pas de modification). Le moteur reçoit toujours un décimal via `parseFloat(inp.value)`.

**Popover** : 3 colonnes (Cat | Auto | Manuel). Banner bleu quand barème actif. La colonne Auto affiche `catVal × factor`. **Important** : les valeurs `autoFactor`/`autoVal` sont numériques — les conditionnels utilisent `!= null` (pas de truthy check) pour gérer correctement le cas facteur `0`. Classe `ov-auto-active` seulement quand `autoVal !== catVal`.

**Persistance** : `debouncedSaveItem()` écrit `labor_auto_modifier` JSONB. `openSubmission()` restaure dans `_rowOverrides`. `saveOverrides()` ne touche que les champs manuels. CSS `.has-auto-modifier` (gear icon).

**Validation au save** : `runSaveValidation()` vérifie que chaque clé de `labor_factor`/`material_factor` dans les barèmes existe dans `labor_minutes`/`material_costs` de l'article (DOM inputs, incluant valeurs 0). Mismatch → warning `warn` avec suggestion fuzzy (`_findClosestKey`, Levenshtein ≤ 5). Ex: `'Coupe' introuvable dans labor_minutes, vouliez-vous dire 'Coupe/edge' ?`. L'utilisateur peut corriger ou re-cliquer pour bypasser.

**AI** : action `catalogue_labor_modifiers` dans `translate` edge function, prompt `ai_prompt_labor_modifiers`.

**Migration** : `sql/labor_modifiers.sql`, `sql/fix_st0050_labor_minutes.sql`

---

## 3. Moteur de cascade

### 3.1 Vue d'ensemble

Le moteur de cascade (`executeCascade`) crée automatiquement des lignes enfants (matériaux, composants) basées sur les règles `cascade` d'un article parent. Il supporte la récursion jusqu'à 3 niveaux de profondeur.

### 3.2 Flow complet

```
scheduleCascade(rowId)
  └── debounce 400ms (sauf immediate=true)
       └── runCascadeNow(rowId)
            └── executeCascade(parentRowId, depth=0, parentOverrides=[], parentMaterialCtx={})
                 │
                 ├── Guards: depth < 3, itemMap[rowId] exists
                 │
                 ├── Ask guard (depth 0 uniquement) :
                 │   └── Si l'article déclare `calculation_rule_ai.ask` (ex: ["L","H"])
                 │       ├── L/H/P/QTY doivent être > 0
                 │       └── n_tablettes/n_partitions/n_portes/n_tiroirs doivent être != null (0 est valide)
                 │
                 ├── Pré-peupler materialCtx depuis le DM de la catégorie du parent FAB
                 │   ├── categoryGroupMapping → DM type → unique DM → chosenClientText
                 │   └── Si multiple DMs → filterDmByExpenseRelevance avant modale (fix #207), auto-select si réduit à 1
                 │
                 ├── Récupérer dims via getRootDimsForCascade(parentRowId)
                 │   └── Remonte cascadeParentMap → lit dim-l/dim-h/dim-p de la racine
                 │
                 ├── Récupérer rootQty via getRootQtyForCascade(parentRowId)
                 │   └── Remonte cascadeParentMap → lit qty-input de la racine FAB
                 │
                 ├── vars = { L, H, P, QTY: rootQty, n_tablettes, n_partitions, n_portes, n_tiroirs }
                 │
                 ├── Séparer enfants existants: locked (ignorés) vs active
                 │
                 ├── Pour chaque règle cascade:
                 │   ├── Vérifier cascade_suppressed (skip si ID résolu supprimé)
                 │   ├── Vérifier override_children (skip si catégorie overridée)
                 │   ├── Résoudre la cible (direct / $default: / $match:)
                 │   ├── Évaluer condition (si présente)
                 │   ├── Calculer qty = evalFormula(rule.qty, vars) × rootQty
                 │   ├── Réutiliser enfant existant OU créer nouvelle ligne
                 │   ├── Appliquer child_dims si rule.child_dims présent (applyChildDims)
                 │   ├── Persist immédiat via updateItem() (bypass debounce global)
                 │   │   └── Inclut length_in/height_in/depth_in si child_dims calculés
                 │   ├── Hériter le tag du parent
                 │   └── Ajouter à matchedChildRowIds
                 │
                 ├── Supprimer orphelins actifs (non matchés)
                 │
                 ├── syncSortOrderForGroup(groupId)
                 │
                 └── Récursion: pour chaque enfant matché
                      └── executeCascade(childRowId, depth+1, mergedOverrides, materialCtx)
```

### 3.3 Résolution des cibles

| Pattern | Mécanisme | Détail |
|---------|-----------|--------|
| `"ST-0042"` | Code direct | Utilise l'article catalogue directement |
| `"$default:Facades"` | Matériau par défaut | Lookup dans room DM uniquement (`roomDM[groupId]`). Si multiples entrées du même type → `materialCtx` disambiguë d'abord, puis `dmChoiceCache`, puis `showDmChoiceModal()`. Résolution 2 étapes : choix `client_text` (Modale 1) → filtre par `client_text` + `getAllowedCategoriesForGroup` → choix article technique (Modale 2 si multiples) |
| `"$match:CATÉGORIE"` | Correspondance dynamique | La catégorie dans la règle est un **hint**, pas un filtre littéral. Résolution via DM + word-similarity (voir ci-dessous) |

**Résolution `$match:`** (`resolveMatchTarget`) :

1. **Dériver les catégories effectives** (`effectiveExpCats`) :
   - Commence avec la catégorie de la règle (ex: `"PANNEAU BOIS"`) comme `[expCatUpper]`
   - Cherche le DM via `materialCtx.chosenClientText` → article catalogue → clés `material_costs`
   - Fallback : room DM direct par type de catégorie de dépense
   - Pour chaque clé `material_costs` du DM, vérifie la **similarité par mots** : au moins un mot en commun avec la catégorie de la règle (ex: `"PANNEAU MÉLAMINE"` matche `"PANNEAU BOIS"` via `"PANNEAU"`)
   - `effectiveExpCats` = union de la catégorie originale + catégories dérivées du DM

2. **Filtrer les candidats** : articles avec `material_costs[key] > 0` pour au moins une clé dans `effectiveExpCats` (exclut `item_type=fabrication`)

3. **Fallback catégorie** : si aucun candidat par `material_costs`, cherche par nom de catégorie catalogue (fuzzy, plural-normalisé)

4. **Chaîne de mots-clés** (chaque étape indépendante) :
   - Étape 1 : `client_text` du parent → `extractMatchKeywords()`
   - Étape 2 : `description` du parent → `extractMatchKeywords()`
   - Étape 3 : mots-clés DM via `getDefaultMaterialKeywords()`

4b. **Filtre DM par pertinence expense** (fix #206) : avant chaque `showDmChoiceModal` dans les 4 tiers de `getDefaultMaterialKeywords`, `filterDmByExpenseRelevance(dmEntries, expenseCategory)` filtre les DM entries. Trois critères d'acceptation : (1) `material_costs` keys matchent l'expense category par word-similarity sur mots bruts (pas `extractMatchKeywords` — les stop words comme `'panneau'` sont critiques), (2) MAT sans `material_costs` défini → accepté par défaut, (3) FAB avec cascade `$match:` ciblant la catégorie → accepté. Si filtre vide → fallback à la liste complète (sécurité). Si réduit à 1 → auto-select sans modale.

5. **Scoring** : `scoreMatchCandidates(keywords, candidates)` → Levenshtein + substring. **Relaxation** : si > 2 mots-clés donnent 0 résultats, réessaye avec les 2 meilleurs

6. **Résultat** : 1 match → utilise directement. Multiples → `showMatchChoiceModal()`. 0 → toast d'erreur

7. **Cache** : `matchDefaults[cacheKey]` persisté dans `submissions.match_defaults`

### 3.4 `override_children`

Mécanisme pour empêcher la duplication de matériaux cascade à différentes profondeurs.

```json
{
  "cascade": [...],
  "override_children": ["BANDE DE CHANT", "FINITION BOIS"]
}
```

- Le parent déclare quelles catégories de dépense il gère lui-même
- Les overrides sont propagés à tous les descendants via le paramètre `parentOverrides`
- Les règles `$match:` dont la catégorie est dans `mergedOverrides` sont sautées avec un log console
- **Autonomie FAB** : à la récursion (ligne ~4644), si l'enfant est un FAB (`item_type === 'fabrication'`), `mergedOverrides` est remplacé par `[]`. Les FAB enfants sont autonomes — leur propre `override_children` s'applique à leurs descendants via le mécanisme normal `mergedOverrides = [].concat(ownOverrides)`

### 3.5 `materialCtx` (contexte matériau cascade)

4e paramètre de `executeCascade(parentRowId, depth, parentOverrides, parentMaterialCtx)`.

**Structure** : `{ chosenClientText: "Placage chêne blanc" }` — le texte client du matériau DM choisi.

**Pré-peuplement** (depth 0) :
1. Si `_pendingMaterialCtx[parentRowId]` existe (changement manuel d'enfant) → l'utilise
2. Sinon, dérive depuis la catégorie du parent FAB via `categoryGroupMapping` :
   - Cherche le type DM correspondant à la catégorie du parent (ex: article catégorie "Carcasses" → DM type "Caisson")
   - Si un seul DM de ce type → `chosenClientText` = son `client_text`
   - Si plusieurs DMs du même type → lookup dans `dmChoiceCache`, puis `showDmChoiceModal()`

**Propagation** : à chaque appel récursif, le `materialCtx` est **copié** (pas référence) et passé au child :
```javascript
await executeCascade(childRowId, depth + 1, mergedOverrides, materialCtx);
```

**Mise à jour par `$default:`** : après résolution d'une règle `$default:`, `resolveCascadeTarget` propage le `client_text` de l'article catalogue résolu dans `materialCtx.chosenClientText`. Cela permet aux règles `$match:` frères (même FAB) de scorer les candidats dans le contexte du matériau effectivement résolu. Trois points de sortie patchés : cache hit (`dmChoiceCache`), candidat unique, et modale technique. Exemple : `$default:Caisson` → mélamine grise 805 → `materialCtx.chosenClientText = "Mélamine grise pale 805"` → `$match:BANDE DE CHANT` score dans le contexte mélamine (pas chêne blanc).

**Usage** :
- `resolveCascadeTarget($default:)` : disambiguë quand plusieurs DMs du même type existent, puis **propage** le `client_text` résolu dans `materialCtx`
- `resolveMatchTarget($match:)` : dérive les catégories de dépense dynamiques depuis le DM via `materialCtx.chosenClientText`
- `getDefaultMaterialKeywords()` : disambiguë dans chaque tier de résolution

**Règle** : materialCtx **disambiguë** uniquement — il ne surcharge JAMAIS un DM unique explicite. Si un seul DM existe pour un type donné, il est utilisé directement quel que soit le materialCtx.

**Filtre catégorie sur `$match:`** : après résolution d'un `$match:`, si `materialCtx._updatedBySiblingDefault` est vrai et `materialCtx._defaultResolvedId` existe, le moteur vérifie que l'article résolu par le `$default:` frère a une **relation** avec la catégorie du `$match`. Deux checks : (1) clés `material_costs` de l'article $default contenant un mot de la catégorie $match, (2) règles cascade de l'article $default ciblant la même catégorie (`$match:CATÉGORIE`). Si aucune relation → résolution rejetée silencieusement (**pas de toast** — comportement voulu). Ex: mélamine (`material_costs: {"PANNEAU MÉLAMINE": 5}`, cascade: `$match:BANDE DE CHANT` seulement) → `$match:FINITION BOIS` rejeté. Placage (`cascade: [$match:BANDE DE CHANT, $match:FINITION BOIS]`) → `$match:FINITION BOIS` accepté. Testable via `checkDefaultItemMatchCategory(defaultItem, matchCategory)` dans `tests/cascade-helpers.js`.

**Propagation via enfants existants** : quand `findExistingChildForDynamicRule` retrouve un enfant pour une règle `$default:`, l'ID (`_defaultResolvedId`) et le `client_text` de l'article existant sont propagés dans `materialCtx` avec `_updatedBySiblingDefault = true`. Sans cette propagation, les changements de dims ou de DM ne déclencheraient pas le filtre catégorie car le `$default:` résoudrait via enfant existant sans passer par `resolveCascadeTarget`.

**Résolution fraîche `$match:` sur changement DM** (fix #207) : flag `_defaultResolvedFresh` dans la boucle cascade. Si `$default:` résout via `resolveCascadeTarget` (pas via enfant existant — le DM a changé), le flag est activé. Les `$match:` suivants exécutent **toujours** `findExistingChildForDynamicRule` d'abord, mais quand `_defaultResolvedFresh` est vrai, l'enfant existant est **vérifié** : son `client_text` est comparé à `materialCtx.chosenClientText` par word-similarity (via `normalizeDmType`). Si aucun mot commun → enfant incohérent, discard et résolution fraîche via `resolveMatchTarget`. Si au moins un mot commun → enfant cohérent, réutilisé sans modale. L'ancien enfant incohérent est retrouvé par `cascadeRuleTarget` (fallback) et mis à jour (`itemChanged = true`). Cela évite les **modales parasites** quand un DM non lié change (ex: changer le DM Caisson ne déclenche plus de modale pour les `$match:` liés aux Panneaux). Ex: DM Caisson mélamine → placage : `$default:Caisson` résout ST-0035 (fresh) → `_defaultResolvedFresh = true` → `$match:BANDE DE CHANT` trouve enfant existant ST-0048 (PVC), compare "PVC" vs "Placage chêne blanc" → 0 mots communs → discard → résolution fraîche ST-0013 (chêne).

### 3.6 Quantités enfants (constante vs formule)

Le moteur détecte automatiquement si `rule.qty` est une constante ou une formule dimensionnelle :

```javascript
var qtyPerUnit = evalFormula(rule.qty, vars);
var formulaStr = String(rule.qty);
var usesDimVars = /\b(L|H|P|QTY|n_tablettes|n_partitions|n_portes|n_tiroirs)\b/.test(formulaStr);
var qty = usesDimVars
    ? Math.round(qtyPerUnit * 100) / 100        // formule = quantité totale
    : Math.round(qtyPerUnit * rootQty * 100) / 100; // constante = par unité × rootQty
```

| Type formule | Exemple `rule.qty` | Résultat | Multiplication rootQty |
|---|---|---|---|
| Constante | `"2"` | 2 charnières par unité | × rootQty → ex: 2 × 6 = 12 |
| Formule L/H | `"(L*H)/144"` | Surface en pi² | Non (déjà total) |
| Formule QTY | `"QTY"` | = rootQty | Non |
| Formule n_tab | `"n_tablettes + 1"` | Tablettes + 1 | Non |

- `rootQty` est toujours la QTY du FAB racine (pas du parent immédiat)
- À profondeur 0 : `rootQty = parentQty` (pas de traversal)
- À profondeur 1+ : `getRootQtyForCascade()` remonte `cascadeParentMap` jusqu'à la racine
- `vars.QTY = rootQty` à toute profondeur

### 3.7 Passage de dimensions

`getRootDimsForCascade(rowId)` :
- Remonte `cascadeParentMap` jusqu'à la racine (le FAB avec les inputs dim-l/dim-h/dim-p)
- Retourne `{ L, H, P, n_tablettes, n_partitions, n_portes, n_tiroirs }`
- Les dimensions racine sont utilisées à TOUTE profondeur de cascade
- Si le parent immédiat a ses propres dims (cas rare de FAB enfant), elles overrident les racine

### 3.7.1 `child_dims` — Dimensions calculées des enfants

Quand une règle cascade déclare `child_dims`, les dimensions L/H/P de l'enfant sont **calculées** à partir des variables du parent au lieu d'être héritées directement.

**Exemple JSON** :
```json
{
  "target": "$default:Facades",
  "qty": "n_portes",
  "condition": "n_portes > 0",
  "child_dims": { "L": "(L / n_portes) - 0.125", "H": "H - 0.25" }
}
```

**Fonction `applyChildDims(childRowId, rule, vars)`** :
1. Si `rule.child_dims` absent → return null (aucun effet)
2. Pour chaque clé (L, H, P), évalue la formule avec `evalFormula(formula, vars)`
3. Écrit les résultats dans les inputs dim de l'enfant (si existants)
4. Appelle `updateRow(childRowId, { skipCascade: true })` pour recalculer le prix
5. Retourne `{length_in, height_in, depth_in}` pour la persistance DB

**Point critique** : `applyChildDims` est appelé **toujours** quand `rule.child_dims` existe dans les deux branches (enfant existant ET nouveau). Même si item/qty n'ont pas changé, les dimensions du parent ont pu changer (ex: L de 24→36).

**Multi-instance** : quand `child_dims` est présent ET `qty > 1` (entier), le moteur crée **N lignes enfants distinctes** (qty=1 chacune) au lieu d'une seule ligne avec qty=N. Chaque façade/tiroir est une pièce physique avec ses propres dimensions calculées. Matching stable via `dataset.cascadeChildIndex` (0, 1, 2...) — non persisté en DB, reconstruit au chargement depuis `sort_order`. Quand `n_portes` passe de 3 à 2, le 3e enfant est supprimé par le orphan cleanup existant. Si qty est fractionnaire → comportement classique (1 ligne, qty=N).

**Variables `n_portes` / `n_tiroirs`** : même pattern que `n_tablettes`/`n_partitions`. UI inputs `Port.`/`Tir.` dans la zone dims caisson. Migration : `sql/caisson_portes_tiroirs.sql`.

### 3.8 Guards et protections

| Guard | Variable | Rôle |
|-------|----------|------|
| Profondeur max | `depth >= 3` | Empêche les boucles infinies |
| Re-entrance | `_cascadeRunning` | Un seul cascade actif à la fois. `_pendingCascadeRowId` queue 1 cascade |
| Chargement | `_isLoadingSubmission` | Toutes les cascades dropped pendant `openSubmission()` |
| Cascade-child guard | `scheduleCascade` | Les enfants cascade (`cascade-child`) ne déclenchent jamais leur propre cascade — `return` immédiat |
| Debounce | `scheduleCascade` | 400ms (sauf `immediate=true`) |
| Ask completeness | `calculation_rule_ai.ask` | Depth 0 uniquement. L/H/P/QTY doivent être > 0. n_tablettes/n_partitions/n_portes/n_tiroirs doivent être != null (0 valide). Fallback : inféré depuis `dims_config` si `ask` absent |
| Polling | `while (!itemMap[row] && attempts < 50)` | Attend que la création DB se termine (80ms × 50 = 4s max) |
| Contraintes | `dataset.constraintsProcessed` | Empêche le re-triggering des contraintes sur le même article |
| Article changé | `dataset.lastCatalogueId` | Détecte le changement pour reset les enfants |
| Locked children | `cascade-locked` CSS class | Enfants verrouillés invisibles au moteur (override manuel) |
| Qty readonly | `readOnly = true` + CSS `pointer-events:none` | Inputs qty des enfants cascade non-modifiables. Appliqué dans `addRow`, `executeCascade`, `openSubmission` |
| Cascade suppressed | `cascadeSuppressed[parentRowId]` | Enfants manuellement supprimés ne sont pas recréés. Reset quand le parent change d'article |
| Persist immédiat | `updateItem()` après chaque enfant | Bypass le debounce global pour persister `catalogue_item_id`, `description`, `unit_price`, `quantity`, `tag` immédiatement |
| Skip cascade | `opts.skipCascade` dans `updateRow` | **Règle** : tout `updateRow()` qui N'EST PAS un changement de dims (L/H/P/n_tablettes/n_partitions/n_portes/n_tiroirs) ou d'article catalogue DOIT passer `skipCascade: true`. Corrigé dans : `saveOverrides`, `clearOverrides`, `refreshGroupRows`, `toggleInstallation`, AI tools `update_submission_line`, `modify_item` (sans dims), `applyChildDims` |

### 3.9 Propagation installation

`toggleRowInstallation(rowId)` propage récursivement l'état coché/décoché à tous les enfants cascade via `propagateInstallationToCascadeChildren(parentRowId, checked)` :

- Utilise `findCascadeChildren()` pour trouver les enfants directs
- Récursif : propage aussi aux petits-enfants (3 niveaux couverts)
- Chaque enfant : checkbox mise à jour + `updateRow(skipCascade: true)` + `updateItem()` en DB
- `toggleInstallation(groupId)` (checkbox groupe) passe aussi `skipCascade: true`

### 3.10 Collapse enfants cascade

Les enfants cascade sont **masqués par défaut** pour réduire le bruit visuel (3 caissons = 20+ lignes sans collapse).

**CSS** : `.cascade-child { display: none }`, `.cascade-child.cascade-visible { display: grid }`. Classe `.show-all-cascade` sur le groupe force tous les enfants visibles.

**UI** :
- Triangle ▶ (`btn-cascade-toggle`) dans `.cell-add` sur les parents FAB. Clic → `toggleCascadeChildren(parentRowId)`
- Badge `(+N)` dans `.cell-total` quand collapsé. Disparaît quand expanded
- Checkbox par pièce dans le header (`cb-show-cascade`) → `toggleShowAllCascade(groupId, checked)` → `.show-all-cascade` sur le groupe

**État** : `_cascadeExpanded[parentRowId]` en mémoire. Pas de persistance DB — reset à collapsé au chargement.

**Total agrégé** : quand un parent est collapsé, sa cellule `.cell-total` affiche la somme du parent + **tous ses descendants** récursivement (classe `.aggregate-total`, texte bold navy). `getAllCascadeDescendants(parentRowId)` collecte l'arbre complet via `cascadeParentMap`. `updateCollapsedParentTotal(parentRowId)` : collapsé → somme `getRowTotal` de tout l'arbre × `getModifierMultiplier(groupId)`, expanded → `getRowTotal(parentRow)` × multiplicateur. Le multiplicateur room+global est appliqué au total affiché pour cohérence avec les prix individuels modifiés. Dans `updateRow`, un changement sur un petit-enfant remonte toute la chaîne d'ancêtres (`while (_ancestor)`). **Fix enfants niveau 2+** : `applyCascadeVisibility` appelle `updateCollapsedParentTotal` sur chaque enfant `cascade-parent-row` quand le parent est expandé — corrige l'agrégat stale hérité de `executeCascade` (où `_cascadeExpanded` est `undefined` = traité comme collapsé). **Fix au chargement** : `openSubmission()` fait un second pass après `applyCascadeVisibility` — pour chaque `cascade-parent-row` dont le parent est expandé, appelle `updateCollapsedParentTotal()` pour afficher le total individuel au lieu de l'agrégat.

**Invariants préservés** : `getRowTotal`, `computeRentabilityData`, `debouncedSaveItem`, `propagateInstallationToCascadeChildren` opèrent sur les éléments DOM par ID, pas par visibilité — fonctionnent normalement sur enfants masqués.

### 3.10.1 Indicateur modification manuelle cascade

Quand l'utilisateur modifie manuellement la quantité ou le prix d'un enfant cascade, un indicateur visuel signale l'écart avec les valeurs calculées par le moteur.

- **Source** : `dataset.cascadeQty` et `dataset.cascadeUnitPrice` stockés par `executeCascade` sur chaque enfant (nouveau ou existant)
- **Détection** : `checkCascadeManualEdit(rowId)` compare qty/prix courants avec les valeurs source, toggle `.cascade-manual-edit`. Appelé à la fin de chaque `updateRow` pour les `cascade-child`
- **Revert** : `revertCascadeManualEdit(rowId)` restaure qty, supprime `price_override`, retire `.cascade-manual-edit`, puis `scheduleCascade` sur le **parent** (`cascadeParentMap[rowId]`)
- **CSS** : `.cascade-manual-edit` — bordure gauche 2px indigo `#6366f1`, fond subtil. Bouton ↺ (`.btn-revert-manual`) visible uniquement quand actif
- **Guard** : `scheduleCascade` retourne immédiatement pour les lignes `cascade-child` — empêche les enfants de déclencher leur propre cascade (évite la modale DM intempestive)
- **Qty readonly** : les inputs qty des enfants cascade sont `readOnly = true` (appliqué dans `addRow`, `executeCascade`, et `openSubmission`). CSS `.calc-row.cascade-child .qty-input { pointer-events: none }` — empêche toute interaction utilisateur. La quantité est gérée exclusivement par le moteur cascade

### 3.10.2 Enfants cascade manuels

En plus des enfants générés automatiquement par les règles `cascade`, un utilisateur (ou l'AI) peut ajouter manuellement des articles enfants sous un parent FAB.

- **Création** : `addRow(groupId, { parentRowId })` — crée une ligne `cascade-child` + `cascade-locked` dès la création. L'enfant est inséré dans le DOM après les enfants cascade existants du parent via `insertAfterLastChild(parentRowId, newRow)`. Le tag du parent est hérité automatiquement
- **Persistance DB** : `createItem` envoie `parent_item_id` (UUID Supabase, résolu via `itemMap[parentRowId]`) et `cascade_locked: true`. L'enfant apparaît dans `cascadeParentMap` comme tout autre enfant cascade
- **Protection moteur** : `executeCascade` sépare les enfants en `locked` vs `active` au début de la boucle. Les enfants `cascade-locked` (manuels ou verrouillés par changement utilisateur) sont **totalement ignorés** — pas de mise à jour de quantité, pas de suppression comme orphelin, pas de re-résolution
- **AI tool** : `add_catalogue_item` accepte un paramètre optionnel `parent_item_id` (UUID Supabase). Le handler fait un reverse lookup `Object.entries(itemMap)` pour trouver le `rowId` DOM correspondant, puis appelle `addRow(groupId, { parentRowId: rowId })`
- **Contexte AI** : `collectRoomDetail` expose `isFabParent: true` et `itemId` (UUID Supabase via `itemMap`) sur **tout** article `item_type === 'fabrication'`. Trois niveaux de propagation : (1) JSON payload via slim mapping, (2) **prompt texte** via `[FAB parent itemId=UUID]` dans `itemsStr` de l'edge function, (3) règle prompt : fallback racine interdit si parent introuvable

### 3.10.3 Anti-lignes vides

3 gardes empêchent les lignes sans article de persister :

1. **`debouncedSaveItem`** : si le `select.value` est vide, `return` immédiat — rien n'est écrit en DB
2. **`addRow` blur listener** : pour les nouvelles lignes (pas `existingId`, pas `cascade`), un listener `blur` one-shot sur le combobox appelle `removeRow` après 2 secondes si aucun article n'est sélectionné
3. **`openSubmission` filtre** : au chargement, `room.room_items` est filtré par `catalogue_item_id || item_type === 'custom'` — les lignes fantômes legacy sont ignorées
4. **`openSubmission` tri topologique** : après filtrage, les items sont triés pour que chaque parent précède ses enfants (`_addWithChildren` récursif). Les roots sont triés par `sort_order`, puis chaque root est suivi de ses children (eux aussi triés par `sort_order`). Prévient l'affichage d'enfants cascade avant leur parent même si `sort_order` en DB est corrompu

### 3.11 Override par ligne (prix, MO, matériaux)

Chaque ligne de soumission peut avoir des ajustements locaux sans modifier le catalogue :

**Colonnes DB** (`room_items`) :
- `labor_override` JSONB — `{ "Ébénisterie": 60, "Installation": 15 }` (minutes par département)
- `material_override` JSONB — `{ "PANNEAU BOIS": 8.50 }` (coût par catégorie)
- `price_override` NUMERIC — prix de vente fixe

**Mémoire** : `_rowOverrides[rowId] = { labor, material, price }`. Reset dans `openSubmission`, restauré depuis les colonnes DB au chargement.

**Calcul** :
1. Si `price_override` est défini → utilisé directement, bypasse `computeComposedPrice`
2. Si `labor_override`, `material_override`, `laborAuto` ou `materialAuto` → catalogue × auto factors → overlay manual → `computeComposedPrice(merged, includeInstall)`. Per-département : manual gagne si défini, sinon auto-factorisé, sinon catalogue
3. `debouncedSaveItem` sauvegarde le prix effectif dans `unit_price` (compatibilité `quote.html`)

**Rentabilité** : `computeRentabilityData` utilise les overrides. `price_override` → montant flat (comme `__AJOUT__`), pas de décomposition MO/matériaux.

**UI** : Bouton `⚙` (`.btn-ov`) dans `.cell-unit-price`, visible au hover, violet si override actif. Popover `ov-pop` avec 3 sections. Indicateur `.has-override` (bordure gauche violette).

**Reset** : changement d'article catalogue → overrides supprimés automatiquement (dans `updateRow`, check `prevCatId !== selectedId`).

**Exclusions** : pas de bouton override sur les cascade children. Boutons désactivés quand soumission verrouillée (`setEditable`).

**Undo stack** : `_undoStack[]` (max 10 entrées). Après suppression ou modification d'overrides, un snapshot est poussé dans le stack. Bouton flottant `↩ Annuler` (bas gauche, class `.undo-btn`) apparaît 8 secondes après une action destructive. `executeUndo()` restaure le dernier état : recrée la ligne (delete) ou restaure les overrides précédents (override). Stack vidé à chaque `openSubmission`.

### 3.12 Edge cases et limitations

1. **`$match:` re-cascadé sur changement DM** : `reprocessDefaultCascades()` gère les cibles `$default:` ET `$match:` (line ~4155). Les caches `matchDefaults` et `dmChoiceCache` sont invalidés **sélectivement** avant re-cascade (fix #188e) — seules les entrées liées au groupe DM modifié sont supprimées.
2. **Cascade max 3 niveaux** : Suffisant pour la plupart des cas (FAB → matériau → sous-composant), mais des structures plus profondes seraient tronquées.
3. **Polling wait limité à 4 secondes** : Si la création DB est plus lente (connexion faible), le cascade peut échouer avec "Timeout création ligne".
4. **Singulier/pluriel dans le fuzzy match** : Normalisé via regex `([a-zàâäéèêëïîôùûüÿç]{3,})[sx](?=\s|$)` qui strip les s/x finaux.
5. **`findExistingChildForDynamicRule` word-similarity pour `$match:`** : Le matching des enfants existants utilise la similarité par mots — les clés `material_costs` de l'enfant doivent partager au moins un mot avec la catégorie de la règle (ex: `"PANNEAU MÉLAMINE"` matche `"PANNEAU BOIS"` via `"PANNEAU"`).
6. **Fallback catégorie supprimé** : L'ancien fallback par catégorie catalogue dans `findExistingChildForDynamicRule` a été supprimé car il permettait aux règles `$default:` de "voler" les enfants `$match:` (ex: panneau et bande de chant mal assignés).
7. ~~**Debounce global causait perte de données**~~ **CORRIGÉ** : `debouncedSaveItem` utilisait un timer global unique — les créations rapides de 3+ enfants cascade annulaient les saves intermédiaires. Corrigé par `updateItem()` immédiat dans `executeCascade`.
8. ~~**Ask guard bloquait 0 tablettes/partitions**~~ **CORRIGÉ** : `n_tablettes`/`n_partitions` vérifiaient `> 0` mais 0 est valide pour les caissons sans tablettes. Corrigé : vérifie `== null` (défini, pas > 0).
9. **`dmChoiceCache` invalidation sélective** : `reprocessDefaultCascades` invalide uniquement les entrées du type DM modifié (`groupId:changedGroup`) et les entrées cross-DM (`groupId:cross:*`). Les choix "Mémoriser pour cette pièce" des autres types sont préservés.
10. **Diagnostic `findExistingChildForDynamicRule` MISS** : quand `$default:` ou `$match:` ne retrouve pas un enfant existant, un log `cascadeLog('warn')` détaille `validIds`, `dmClientTexts`, `allowedCats`, et IDs enfants non-matchés.

### 3.13 Indicateur de sauvegarde (pattern Linear)

Au repos : aucun indicateur visible (opacity: 0). Feedback transitoire uniquement.

**`showSaveIndicator(error)`** :
- Normal : "Sauvegardé ✓" en `#6B7280` 12px, opacity 1 pendant 2s puis fade-out 300ms
- Erreur (`error=true`) : "Erreur de sauvegarde" en `#DC2626`, reste visible (pas de fade-out)
- CSS : `.save-indicator` opacity 0, `.si-visible` opacity 1, `.si-error` pour erreur

**`updateStatus(status, message)`** :
- Pill `#dataStatus` pour le statut catalogue (online/offline/error/loading)
- `online` : visible 2s puis fade-out (transitoire)
- `offline`/`error`/loading : reste visible (persistant)
- CSS : `.data-status` opacity 0, `.ds-visible` opacity 1

### 3.14 Barre de progression cascade (#141)

Overlay semi-transparent sur la zone articles (`.calc-rows`) pendant `reprocessDefaultCascades`.

- **HTML** : div `.cascade-progress-overlay` (position absolute, z-index 50, pointer-events all) avec barre `.cascade-progress-bar` (3px, animation `cascadeSlide` 1.2s) + texte "⟳ Recalcul…"
- **Ref-counting** : `_cascadeProgressRef` incrémenté à chaque `showCascadeProgress(scopeGroupId)`, décrémenté à chaque `hideCascadeProgress()`. Overlay retiré uniquement quand ref = 0 (gère les callers multi-reprocess)
- **Fade-out** : classe `.fade-out` (opacity 0, transition 150ms), removal DOM après 160ms
- **Target** : `{scopeGroupId}-rows` (zone articles uniquement, pas le header)

---

## 4. Matériaux par défaut

### 4.1 Structure de données

```javascript
// Niveau pièce uniquement (project_rooms.default_materials via roomDM[groupId])
// client_text est l'identifiant primaire pour la résolution cascade
[
  { "type": "Caisson", "catalogue_item_id": "ST-0142", "client_text": "Mélamine blanche", "description": "Mélamine TFL blanc" },
  { "type": "Facades", "catalogue_item_id": "ST-0088", "client_text": "Placage chêne blanc", "description": "Placage chêne blanc FC 8%" }
]
```

**Note** : Le niveau soumission a été retiré. Seul le niveau pièce est utilisé.

**Migration legacy** : au `openSubmission`, les DM sans `client_text` dérivent automatiquement le `client_text` depuis le `catalogue_item_id` pour les données existantes.

### 4.2 Résolution

```
getDefaultMaterialsForGroup(groupId):
  → roomDM[groupId] || []
```

Pas de hiérarchie multi-niveaux. Chaque pièce gère ses propres DM de façon indépendante.

### 4.3 Cache et modales de choix

- `dmChoiceCache[groupId + ':' + typeName]` : Cache la sélection quand plusieurs entrées DM du même type existent
- **Modale 1 — `showDmChoiceModal(groupName, dmEntries)`** : Choix du matériau client (label = `client_text`). Utilisée quand plusieurs DM du même type existent et que `materialCtx` ne disambiguë pas
- **Modale 2 — `showTechnicalItemModal(groupName, catalogueItems)`** : Choix de l'article technique (label = code + `description` + catégorie + prix). Utilisée quand un `client_text` correspond à plusieurs articles catalogue
- **Modale 3 — `showMatchChoiceModal(expenseCategory, scored, keywords)`** : Choix `$match:` multi-résultats (label = code + `description` + catégorie). Séparée du système DM
- Le cache est invalidé quand un DM est modifié ou quand un enfant cascade est changé manuellement

### 4.4 `reprocessDefaultCascades(changedGroup, scopeGroupId)`

Déclenché quand un DM est modifié :
1. Trouve tous les parents (lignes racine) qui ont des règles `$default:` correspondant au groupe modifié
2. Re-exécute `executeCascade()` séquentiellement sur chacun
3. Re-trigger les parents avec `$default:` ET `$match:` targets. Invalide **sélectivement** `matchDefaults` (fix #188e : seules les entrées dont l'expense category partage un mot avec les catégories catalogue liées au `changedGroup` via `categoryGroupMapping` — word-similarity — sont supprimées, les choix `$match:` des catégories non modifiées sont préservés) ET `dmChoiceCache` (seul le type modifié `groupId:changedGroup` + entries cross-DM — les choix mémorisés des autres types sont préservés). Exécute sous guard `_cascadeRunning = true`
4. **Barre de progression** (#141) : `showCascadeProgress()` / `hideCascadeProgress()` affichent un overlay semi-transparent `rgba(255,255,255,0.25)` avec barre indeterminate navy 3px + texte "⟳ Recalcul…" `#9CA3AF` 11px. Bloque l'interaction utilisateur pendant le recalcul. Ref-counting (`_cascadeProgressRef`) pour les callers multi-reprocess (updateRoomDmType appelle 2× pour old+new type, clearRoomDm appelle N× pour chaque type). Fade-out 150ms ease-out

### 4.5 UI

- **Panel pièce** : Par pièce, avec option "Copier de..." (depuis une autre pièce uniquement, pas de template soumission)
- **Autocomplete** : Filtre les articles catalogue des catégories autorisées pour le groupe, déduplique par `client_text` (un seul "Placage chêne blanc" même si 2+ articles techniques existent)
- **Indicateur DM vide** : Classe `.dm-needs-config` sur `.room-dm-label` quand DM count = 0 et ≥1 article dans la pièce. Flèche `←` avec animation `dm-pulse` (opacity 0.35→1, 2.2s). Disparaît dès qu'un DM est ajouté. CSS pur, pas de JS timer
- **Validation DM obligatoires** : `DM_REQUIRED_GROUPS = ['Caisson','Panneaux','Tiroirs','Façades','Poignées']`. `addRow()` bloque l'ajout d'articles si des groupes requis manquent (sauf chargement legacy, cascades, bulk load). Le bouton "+" est grisé (`.dm-blocked`)
- **Groupes cachés** : `DM_HIDDEN_GROUPS = ['Autre','Éclairage']` — filtrés dans `getDmTypes()`, n'apparaissent pas dans le dropdown DM

### 4.6 Enrichissement DM — Phase 1A (#208)

Champs additionnels optionnels sur les entrées DM pour 3 groupes (Caisson, Façades, Panneaux). Stockés dans le JSONB existant `project_rooms.default_materials` — aucune migration SQL requise.

#### Structure JSONB enrichie

```json
{
  "type": "Façades",
  "catalogue_item_id": "ST-0042",
  "client_text": "Placage chêne blanc",
  "style": "Shaker",
  "coupe": "Rift cut",
  "bande_chant": { "catalogue_item_id": "ST-0087", "client_text": "Bande chêne blanc" },
  "finition": { "catalogue_item_id": "ST-0142", "client_text": "Laque claire mate" },
  "bois_brut": { "catalogue_item_id": "ST-0210", "client_text": "Chêne massif FAS" }
}
```

#### Champs par groupe

| Groupe | style | coupe | bande_chant | finition | bois_brut |
|--------|-------|-------|-------------|----------|-----------|
| Caisson | — | ✓ (si placage) | ✓ | ✓ | — |
| Façades | ✓ | ✓ (si placage) | ✓ | ✓ | ✓ |
| Panneaux | ✓ | ✓ (si placage) | ✓ | ✓ | ✓ |

- `style`, `coupe` : texte libre (string)
- `bande_chant`, `finition`, `bois_brut` : objet `{ catalogue_item_id, client_text }` (combobox catalogue)

#### Cascade Tier 0

`resolveMatchTarget` vérifie en priorité les champs enrichis du DM avant le scoring classique :

1. **Tier 0 (nouveau)** : `getEnrichedDmField(dmEntry, expenseCat)` → `ENRICHED_DM_FIELD_MAP` lookup → résolution directe par `catalogue_item_id` ou `client_text` → **zéro modale**
2. **Tiers existants** (inchangés) : `scoreMatchCandidates` → `disambiguateMatchByDm` → `showMatchChoiceModal`

`ENRICHED_DM_FIELD_MAP` : `BANDE DE CHANT` → `bande_chant`, `FINITION`/`FINITION BOIS` → `finition`, `BOIS BRUT`/`BOIS_BRUT` → `bois_brut`

#### Validation cohérence

- Matériau mélamine → `finition` désactivé + auto-supprimé si présent
- `coupe` visible seulement si matériau est un placage (`_isDmPlacage`)
- Warning non-bloquant si bande de chant incompatible avec matériau principal

#### UI

Bouton ▾ sur les lignes DM enrichies → panneau `.rdm-enriched` collapsible. Indicateur `.has-data` (navy) quand sous-champs remplis. Combobox catalogue pour champs objet, texte libre pour champs string.

#### Backward compatibility

- Entrées DM sans champs enrichis : comportement identique (tier 0 retourne `null`, fallback automatique)
- `saveRoomDm` / `copyDmFrom` : sérialisent l'objet complet (sous-champs inclus)
- `getMissingRequiredDm` : vérifie uniquement le matériau principal

### 4.7 Composantes (#209)

Regroupements nommés de propriétés constructives par type DM (Caisson, Façades, Panneaux, Tiroirs, Finition, Poignées).

#### Table `composantes`

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID PK | gen_random_uuid() |
| code | TEXT UNIQUE | Auto COMP-XXX (trigger + séquence) |
| nom | TEXT NOT NULL | Nom descriptif |
| dm_type | TEXT NOT NULL | Type DM associé |
| materiau_client_text | TEXT | Texte client matériau principal |
| materiau_catalogue_id | TEXT FK | Ref catalogue_items |
| style | TEXT | Style libre (ex: Shaker) |
| coupe | TEXT | Coupe libre (ex: Rift cut) |
| bande_chant_client_text | TEXT | Texte client bande de chant |
| bande_chant_catalogue_id | TEXT FK | Ref catalogue_items |
| finition_client_text | TEXT | Texte client finition |
| finition_catalogue_id | TEXT FK | Ref catalogue_items |
| bois_brut_client_text | TEXT | Texte client bois brut |
| bois_brut_catalogue_id | TEXT FK | Ref catalogue_items |
| notes | TEXT | Notes internes |
| is_active | BOOLEAN | Soft delete (default true) |
| usage_count | INTEGER | Compteur utilisation (default 0) |

#### Lien room_items

`room_items.composante_id` UUID FK nullable (ON DELETE SET NULL).

#### CRUD

Drawer dans `catalogue_prix_stele_complet.html`, 480px slide-right, filtre par type DM, modale création/édition avec tous les champs. Soft delete (is_active=false). Code COMP-XXX auto-généré par trigger `trg_composante_auto_code`.

#### RLS

Tous authentifiés, full CRUD (cohérent avec `catalogue_items`).

#### Migration

`sql/composantes.sql`

#### Phase 1B — Enregistrement depuis le panneau DM (calculateur.html)

Deux points d'entrée pour enregistrer des composantes directement depuis le panneau DM du calculateur :

1. **Bouton par ligne** (`.dm-save-composante-btn`) : visible si `dmEntry.client_text` existe. Appelle `saveDmAsComposante(groupId, idx)` qui mappe les champs DM enrichis vers la structure `composantes` et fait un INSERT.

2. **Bouton "Enregistrer tout"** (`.rdm-save-all-btn`) : visible si ≥2 DM configurés dans la pièce. Appelle `saveAllDmAsComposante(groupId)` qui crée une composante de type `"Groupe"` avec nom concaténé et notes résumé.

**Nommage auto** : `buildComposanteName(dmEntry)` → `{type} {style} {client_text} {coupe}` (champs vides omis). Pour un groupe : noms joints par ` / `.

**Mapping DM → composante** :

| Champ DM | Colonne composante |
|----------|-------------------|
| `type` | `dm_type` |
| `client_text` | `materiau_client_text` |
| `catalogue_item_id` | `materiau_catalogue_id` |
| `style` | `style` |
| `coupe` | `coupe` |
| `bande_chant.client_text` | `bande_chant_client_text` |
| `bande_chant.catalogue_item_id` | `bande_chant_catalogue_id` |
| `finition.client_text` | `finition_client_text` |
| `finition.catalogue_item_id` | `finition_catalogue_id` |
| `bois_brut.client_text` | `bois_brut_client_text` |
| `bois_brut.catalogue_item_id` | `bois_brut_catalogue_id` |

#### Phase 1C — Dropdown composantes + Redesign panneau DM

**Redesign visuel** : le panneau DM passe d'un fond blanc à un fond navy `#0B1220` avec texte blanc semi-transparent. Inputs sans bordures visibles (underline `border-bottom` only). Sous-champs enrichis en layout horizontal `flex-wrap` au lieu de vertical. Bookmark SVG (stroke → filled 2s après save).

**Dropdown composantes** : `<select class="dm-comp-select">` inséré dans chaque ligne DM, filtré par `dm_type` depuis `COMPOSANTES_DATA`. `applyComposanteToDm(groupId, dmIndex, composanteId)` :
1. Mappe les champs composante → DM (materiau, style, coupe, bande_chant, finition, bois_brut)
2. Stocke `dm.composante_id = comp.id`
3. `saveRoomDm()` + `renderRoomDm()` + `reprocessDefaultCascades()`

**`DM_REQUIRED_GROUPS`** : `'Finition'` retiré — `['Caisson','Panneaux','Tiroirs','Façades','Poignées']`. Warning non-bloquant si composante Façades/Caisson configurée sans `finition_client_text`.

#### Phase 1D — Résolution cascade par composante_id

Quand une composante est appliquée à un DM (via `applyComposanteToDm`), le `composante_id` est stocké sur l'entrée DM (`dm.composante_id = comp.id`). Le moteur de cascade utilise ce champ pour filtrer les DM candidats en priorité, éliminant les modales de choix ambiguës.

**Helper** : `filterDmByComposante(dmEntries, composanteId)` — filtre les DM par `composante_id`. Si `composanteId` est null/undefined → retourne la liste non filtrée. Si le filtre ne retourne aucun résultat → fallback à la liste complète.

**Points d'injection dans le moteur** :

1. **`resolveCascadeTarget`** (`$default:`) : après `deduplicateDmByClientText()`, le filtre `filterDmByComposante` est appliqué avec `materialCtx.composante_id` sur `dmUnique`. Ceci réduit les candidats DM **avant** le filtre catégorie `getAllowedCategoriesForGroup` et les modales de choix. Si un seul candidat reste après filtre → résolution directe sans modale.

2. **`resolveMatchTarget`** (`$match:`) : les DM récupérés par `getDefaultMaterialsForGroup(groupId)` sont filtrés par `filterDmByComposante` **avant** le lookup DM par word-similarity et le Tier 0 (enriched fields).

**Propagation via `materialCtx`** :

- `materialCtx.composante_id` est peuplé depuis l'entrée DM du parent FAB dans `executeCascade` (deux chemins : single DM entry et multi-DM choice)
- Hérité par copie shallow lors de la construction de `materialCtx` au début de `executeCascade` : `{ chosenClientText: parentMaterialCtx.chosenClientText, composante_id: parentMaterialCtx.composante_id }`
- Se propage automatiquement à toute la chaîne cascade (parent → enfant → petit-enfant, jusqu'à 3 niveaux)

**Rétrocompatibilité** : si `composante_id` est `null` ou absent sur le DM → `filterDmByComposante` retourne la liste complète → le moteur se comporte exactement comme avant. Les 330 tests automatisés passent sans modification.

---

## 5. Workflow de soumission

### 5.1 Machine à états

```
                    ┌──────────────────────────┐
                    │                          │
     ┌──────────►  pending_internal  ◄──────┐ │
     │              │         ▲              │ │
     │              │         │              │ │
     │              ▼         │              │ │
  draft         approved     returned        │ │
     │          _internal                    │ │
     │              │                        │ │
     │              ▼                        │ │
     │          sent_client ────────► lost   │ │
     │              │           ▲     │      │ │
     │              ▼           │     │      │ │
     │          accepted        └─────┘      │ │
     │                                       │ │
     │  (bypass: draft → sent_client) ───────┘ │
     │  (auto-approve: draft → approved) ──────┘
     │
     └── (re-submit: returned → pending_internal)
```

### 5.2 Transitions détaillées

| De | Vers | Fonction | Conditions | Actions |
|----|------|----------|------------|---------|
| draft | pending_internal | `soumettreSoumission()` | Utilisateur non-approbateur | Version + review + snapshot |
| draft | approved_internal | `soumettreSoumission()` | `canApproveQuotes` (auto-approve) | Version + review + snapshot |
| pending_internal | approved_internal | `approveSubmission()` | `canApproveQuotes` | Version + review |
| pending_internal | returned | `returnSubmission()` | `canApproveQuotes` | Review avec commentaire obligatoire |
| returned | pending_internal | `soumettreSoumission()` | Re-soumission | Version + review + snapshot |
| approved_internal | sent_client | `sendToClient()` | — | Version + `public_quote_token` + review + snapshot |
| draft/pending | sent_client | `executeBypass()` | `canBypassApproval` | Log via RPC `log_bypass_approval` + token + review |
| sent_client | accepted | `executeOfflineAcceptance()` | `canApproveQuotes` + double-check guard | Log via RPC `log_offline_acceptance` + review |
| sent_client | lost | (via pipeline) | — | `lost_reason`, `lost_competitor_company_id`, `lost_competitor_price`, `lost_at` |

### 5.3 Verrouillage

Une soumission est éditable seulement quand :
- Status = `draft` ou `returned`
- Status = `pending_internal` ET l'utilisateur a `canApproveQuotes`

`setEditable(false)` désactive tous les inputs, selects, boutons d'action dans le calculateur.

Le déverrouillage (`canUnlockSubmission`) passe par un log immuable dans `submission_unlock_logs`, avec une fenêtre de 30 secondes pour le trigger DB `trg_check_submission_status`.

### 5.4 Tokens de présentation client

- Table `public_quote_tokens` : `{ id, submission_id, token (UUID), created_at, accepted_at, client_name, client_email, signature_data }`
- Créé à l'envoi au client (`sendToClient`)
- Passé en paramètre URL à `quote.html?token={uuid}`
- Vérifié côté serveur par la RPC `get_public_quote`
- L'acceptation passe par la RPC `accept_quote` (met à jour `accepted_at`, `client_name`, `client_email`, `signature_data`)

### 5.5 Snapshots HTML

- Générés par `generateSnapshotHtml()` : HTML complet multi-page avec styles embarqués
- Nettoyés par `uploadSnapshot()` : suppression des éléments interactifs
- Stockés dans le bucket `submission-snapshots` (public) sous `{submission_id}.html`
- Utilisés par `quote.html` pour les soumissions verrouillées (évite de re-rendre)

### 5.6 Versions

Chaque transition crée un snapshot dans `project_versions` :
```json
{
  "version_number": 3,
  "snapshot": { /* données complètes du calculateur */ },
  "status_at_save": "approved_internal",
  "created_by": "user-uuid"
}
```

---

## 6. Assistant AI

### 6.1 Architecture

```
calculateur.html                    ai-assistant Edge Function
  │                                       │
  ├── collectAiContext() ────────────►     │
  │   (projet, rooms, items,              │
  │    catalogue, taux, DM,               ├── buildSystemPrompt()
  │    contacts, benchmarks,              │   (contexte dynamique + learnings)
  │    query_complexity, max_tokens)      │
  ├── messages[] ───────────────────►     ├── Anthropic API
  │   (historique conversation)           │   simple → claude-haiku-4-5
  │                                       │   complex → claude-sonnet-4-5
  │◄──────────────────────────────────    │   max_tokens: 512/1536/4096 adaptatif
  │   { content, tool_use[], model_used } │   10 tools
  │   { content, tool_use[] }             │
  │                                       │
  ├── formatPendingActions()              │
  │   (affichage pour confirmation)       │
  │                                       │
  ├── applyAiPendingActions()             │
  │   └── executeAiTool() ─────────►     │
  │       (exécution côté client)         │
  │       └── tool_result ──────────►     │
  │           (résultats renvoyés)        │
  └───────────────────────────────────    └──
```

### 6.2 Edge Functions par contexte

| Edge Function | Fichiers appelants | Modèle | Streaming | Usage |
|----|------|-------|-----------|-------|
| `ai-assistant` | calculateur.html, approbation.html, catalogue.html | Sonnet 4.5 / Haiku 4.5 (routing dynamique) | Non | Chat estimateur, review approbation |
| `translate` | catalogue.html, calculateur.html, approbation.html | Haiku 4.5 / Sonnet 4 | Non | Traduction, optimisation, génération JSON |
| `catalogue-import` | catalogue.html | Sonnet 4.5 | SSE | Chat import catalogue |
| `contacts-import` | clients.html | Sonnet 4.5 | SSE | Chat import contacts |

### 6.3 Tools de l'assistant estimateur (ai-assistant)

| Tool | Type | Description |
|------|------|-------------|
| `analyze_rentability` | Confirmation requise | Analyse de rentabilité : prix de vente, coûts, marges, heures par département |
| `write_description` | Confirmation requise | Écrit/réécrit la description client d'une pièce en HTML formaté Stele |
| `add_catalogue_item` | Confirmation requise | Ajoute un article catalogue à une pièce avec qty, tag, dimensions (L/H/P) et variables caisson (n_tablettes, n_partitions, n_portes, n_tiroirs) optionnelles |
| `remove_item` | Confirmation obligatoire | Supprime un article d'une pièce via `item_id` (UUID Supabase). Si parent FAB avec enfants cascade, tous les enfants sont supprimés aussi. **Jamais auto-exécuté** (destructif) |
| `modify_item` | Confirmation requise | Modifie une ligne existante (qty, unit_price, description, markup, L, H, P, n_tablettes, n_partitions, n_portes, n_tiroirs) |
| `update_catalogue_item` | Auto après confirmation | Modifie un article catalogue (prix, labor, materials, règles, instruction). Permission `edit_catalogue` requise. Audit trail dans `catalogue_change_log`. Auto-exécuté après confirmation conversationnelle. **Auto-refresh modal (CAT-01)** : après PATCH, `master-agent.js` dispatche `CustomEvent('catalogue-item-updated')` → catalogue modal écoute et auto-refresh si ouverte (dirty check → steleConfirm, fetch DB, update CATALOGUE_DATA, re-populate, toast indigo) |
| `update_submission_line` | Confirmation obligatoire | Ajuste MO, matériaux ou prix de vente d'une ligne de soumission (override local). Fusionne labor/material avec catalogue. Retourne `catalogue_base` + `effective_overrides` pour vérification. **Jamais auto-exécuté** |
| `suggest_items` | Auto-exécution | Recherche dans le catalogue. Read-only |
| `compare_versions` | Auto-exécution | Compare deux versions de soumission. Read-only |
| `save_learning` | Exécuté côté serveur | Sauvegarde une règle organisationnelle (INSERT dans `ai_learnings`) |

### 6.4 Tools de l'import catalogue (catalogue-import)

| Tool | Description |
|------|-------------|
| `search_catalogue` | Recherche pour détection de doublons (auto-exécution) |
| `create_catalogue_item` | Crée un article avec tous les champs |
| `update_catalogue_item` | Met à jour un article existant |
| `delete_catalogue_item` | Supprime un article |
| `filter_catalogue` | Filtre/tri la table catalogue (auto-exécution) |
| `check_usage` | Statistiques d'utilisation (dormant, never_used, most_used) |
| `audit_client_names` | Scan de cohérence client_text (Levenshtein ≤ 3) |
| `regenerate_calc_rules` | Régénère les règles AI d'un article |

### 6.5 Tools de l'import contacts (contacts-import)

| Tool | Description |
|------|-------------|
| `search_contacts` | Recherche pour détection de doublons (auto-exécution) |
| `create_contact` | Crée un contact |
| `create_company` | Crée une entreprise |
| `update_contact` / `update_company` | Met à jour |
| `delete_contact` / `delete_company` | Supprime |
| `link_contact_company` | Lie un contact à une entreprise |
| `filter_contacts` | Filtre la table contacts (auto-exécution) |
| `save_learning` | Sauvegarde une règle organisationnelle |

### 6.6 Modes de traduction (translate)

| Action | Modèle | Description |
|--------|--------|-------------|
| `optimize` | Haiku | Nettoyage/formatage HTML de descriptions meubles |
| `translate` | Haiku | FR → EN |
| `en_to_fr` | Haiku | EN → FR canadien |
| `catalogue_client_text` | Haiku | Génération de texte client depuis description interne (bouton UI retiré, action conservée) |
| `instruction_rewrite` | Haiku | Reformulation d'instruction article (bouton AI dot sur champ Instruction) |
| `catalogue_explication` | Haiku | Amélioration d'explication de règle |
| `catalogue_json` | Sonnet 4 | Conversion explication → JSON structuré |
| `catalogue_pres_rule` | Sonnet 4 | Génération règle de présentation (explication + JSON) |
| `catalogue_calc_rule` | Sonnet 4 | Génération règle de calcul (explication + JSON) |
| `calculateur_description` | Haiku | Génération description client de pièce (panneau proposition). Accepte `defaultMaterials` optionnel dans le body → injecte section "MATÉRIAUX PAR DÉFAUT DE LA PIÈCE" dans le system prompt (#207-2). Réponse nettoyée côté client (strip backticks ` ```html ` / ` ``` `, #207-3) |
| `import_components` | Sonnet 4 | Extraction composants fournisseur (multimodal) |
| `catalogue_labor_modifiers` | Sonnet 4 | Génération barèmes dimensionnels (explication + JSON) |
| `approval_suggest` | Sonnet 4 | Suggestions pour article proposé |

### 6.7 Mode simulation et confirmation

Le flux AI suit un pattern de confirmation utilisateur :

1. L'AI propose des actions via `tool_use` blocks
2. **Read-only tools** (`suggest_items`, `compare_versions`, `search_*`, `filter_*`) → exécutés automatiquement
3. **Action tools** → affichés dans un card de confirmation avec description humaine (`formatPendingActions`)
4. L'utilisateur clique "Appliquer" ou "Ignorer"
5. Sur "Appliquer" : `executeAiTool()` exécute chaque action séquentiellement
6. Les résultats sont renvoyés comme `tool_result` pour un tour de suivi
7. L'AI produit une réponse textuelle finale

### 6.8 Learnings organisationnels

- Table `ai_learnings` : `{ rule, source_context, source_example, created_by, is_active }`
- Jusqu'à 50 règles actives injectées dans chaque prompt AI
- Créables via le tool `save_learning` (exécuté côté serveur dans ai-assistant, côté client dans contacts-import)
- Gérables dans admin.html (toggle actif, suppression)

### 6.9 Prompts overridables

Chaque prompt AI peut être overridé via `app_config` (16 clés) :
`ai_prompt_estimateur`, `ai_prompt_catalogue_import`, `ai_prompt_contacts`, `ai_prompt_fiche_optimize`, `ai_prompt_fiche_translate_fr_en`, `ai_prompt_fiche_translate_en_fr`, `ai_prompt_client_text_catalogue`, `ai_prompt_instruction_catalogue`, `ai_prompt_json_catalogue`, `ai_prompt_pres_rule`, `ai_prompt_calc_rule`, `ai_prompt_description_calculateur`, `ai_prompt_approval_review`, `ai_prompt_labor_modifiers`, `ai_prompt_import_components`, `ai_prompt_expense_pres_rule`

### 6.10 Cascade debug logs

`cascadeDebugLog` — buffer mémoire circulaire (max 200 entrées) capturant les événements du moteur cascade via `cascadeLog(level, msg, data)` (niveaux : `info`, `warn`, `error`). `summarizeCascadeLog()` retourne les 50 dernières entrées en texte pour injection dans le contexte AI.

Deux fonctions de détection contrôlent l'inclusion conditionnelle dans le contexte :
- **`detectCascadeDiagnostic(text)`** : mots-clés cascade/debug/bug/erreur → inclut les logs cascade
- **`detectCalculationContext(text)`** : mots-clés règle/calcul/formule/dimension → inclut les `calculationRules`

### 6.11 Sanitisation tool_use/tool_result

`sanitizeConversationToolUse(messages)` — défense en profondeur avant chaque appel API. Parcourt `aiConversation`, identifie les blocs `tool_use` sans `tool_result` correspondant, et injecte des `tool_result` synthétiques `{"skipped":true}`. Prévient l'erreur Anthropic 400 "tool_use ids found without tool_result blocks".

3 sources d'orphelins corrigées en amont :
1. **`aiDismissPending`** : injecte `{"dismissed":true}` au clic "Ignorer"
2. **`sendAiMessage`** : neutralise les pending tools si l'utilisateur tape un nouveau message
3. **`autoExecutePendingTools`/`aiApplyPending`** : gèrent les follow-up `tool_use` dans la réponse post-exécution (affichent des boutons de confirmation)

### 6.12 Rate limit auto-retry

`callAiAssistant` intercepte les réponses 429 (rate limit) et 529 (overloaded). Affiche "Un instant, le serveur est occupé…", attend 15 secondes, retire le message temporaire (`removeLastAiMessage()`), et retry une seule fois. Si le retry échoue aussi, affiche un message d'erreur propre. Le texte brut de l'API n'est jamais affiché.

### 6.13 Images et annotations AI

Deux sources d'images dans le chat :
- **Chatbox paste/drop** : compressées base64 JPEG 0.90, 3200px max
- **Images de référence** : URL directe Storage, préfère `annotatedUrl` (image avec tags rasterisés) quand disponible

`rasterizeAnnotatedImage()` — au save des annotations, dessine image + tags (rect navy + texte blanc) dans un canvas, upload JPEG 0.92 dans `annotated/{mediaId}.jpg`, stocke l'URL dans `room_media.annotated_url`.

### 6.14 Changement de pièce AI

Quand `aiFocusGroupId` change (scroll ou bouton), `onAiFocusChanged()` insère un séparateur visuel (`.ai-scope-separator`) + un message système dans `aiConversation` pour que Claude comprenne le nouveau contexte. `_lastAiFocusGroupId` évite les doublons.

### 6.15 Budget tokens

**Optimisations token (v2)** :

1. **`catalogueSummary`** : articles de la soumission (max 50) + ★ defaults (max 15). Descriptions tronquées à 40 chars. `client_text` inclus seulement pour les articles en soumission (40 chars max). `instruction` retirée du summary (disponible dans `calculationRules` quand pertinent).

2. **`focusRoomDetail`** : en mode normal, les items sont allégés (pas de `laborMinutes`, `materialCosts`, `rentability`). En mode calcul (détecté par mots-clés), les données complètes sont incluses.

3. **`expenseCategories`** : en mode normal, seulement `name`, `markup`, `waste`. En mode calcul, complet avec templates.

4. **`defaultMaterials`** : format compact dans rooms summary (`type`, `client_text`, `catalogue_item_id` seulement). Dans le system prompt, format texte inline au lieu de JSON indenté.

5. **Troncature historique** : `truncateAiHistory(messages)` garde les 16 derniers messages. Les anciens sont résumés en 1 message condensé (80 chars/user, 100 chars/assistant). Respecte l'intégrité des paires `tool_use`/`tool_result`.

6. **Sections system prompt conditionnelles** : "Comment lire les plans" inclus seulement si `hasImages=true`. "Descriptions client" inclus seulement si `needsDescriptionHelp=true`.

7. **Token measurement** : `console.log('[AI] Token estimate...')` dans `callAiAssistant` — affiche context, messages, total, et détail par composant.

Cible : ≤15K tokens normal, ≤20K diagnostic.

---

## 7. Système de permissions

### 7.1 Architecture

```
app_config.permissions = {
  "Admin": { "catalogue": true, "calculateur": true, "admin": true, ... },
  "Vente": { "catalogue": true, "calculateur": true, "admin": false, ... },
  ...
}

app_config.user_roles = {
  "user@email.com": "Admin",
  "user2@email.com": "Vente",
  ...
}
```

Ou via la table `user_roles` → `roles` (nouveau système DB) :
```
user_roles: { email, role_id } → roles: { name, permissions JSONB }
```

### 7.2 Permissions disponibles (13)

| Permission | Description |
|------------|-------------|
| `catalogue` | Accès au catalogue de prix |
| `catalogue_edit` | Modification du catalogue |
| `calculateur` | Accès au calculateur |
| `clients` | Accès au CRM |
| `documents` | Accès aux documents |
| `assistant` | Accès à l'assistant AI |
| `admin` | Accès à la page admin |
| `approbation` | Accès à la page d'approbation |
| `edit_minutes` | Modification des minutes de travail (prix composé) |
| `edit_materials` | Modification des coûts matériaux (prix composé) |
| `can_approve_quotes` | Approbation de soumissions + auto-approve |
| `can_bypass_approval` | Bypass du processus d'approbation |
| `can_unlock_submission` | Déverrouillage de soumissions verrouillées |

### 7.3 Rôles par défaut (6)

| Rôle | Permissions clés |
|------|-----------------|
| Admin | Toutes |
| Vente | catalogue, calculateur, clients, documents, assistant |
| Chargé de projet | catalogue, calculateur, clients, documents, assistant |
| Achat | catalogue |
| Atelier | catalogue |
| Client | (aucune) |

### 7.4 Vérification

Chaque page HTML appelle `checkPageAccess()` au chargement :
1. Charge `permissions` et `user_roles` depuis `app_config`
2. Détermine le rôle de l'utilisateur courant par email
3. Vérifie si le rôle a la permission requise pour cette page
4. Redirige vers `app.html` si non autorisé
5. Set les flags de capability (`canEditMinutes`, `canApproveQuotes`, etc.)

**Important** : Toutes les vérifications sont **côté client uniquement**. La vraie sécurité repose sur les RLS policies Supabase.

### 7.5 RLS (Row Level Security)

| Table | Policy | Condition |
|-------|--------|-----------|
| `projects` | SELECT/INSERT/UPDATE/DELETE | `auth.uid() = user_id` |
| `submissions` | SELECT/UPDATE | Via JOIN `projects.user_id = auth.uid()` OU any authenticated (pour approbation) |
| `project_rooms` | SELECT/INSERT/UPDATE/DELETE | Via JOIN chain jusqu'à `projects.user_id` |
| `room_items` | SELECT/INSERT/UPDATE/DELETE | Via JOIN chain jusqu'à `projects.user_id` |
| `room_media` | SELECT/INSERT/UPDATE/DELETE | Via JOIN chain jusqu'à `projects.user_id` |
| `chat_messages` | SELECT/INSERT/DELETE | Via JOIN chain OU `user_id = auth.uid()` |
| `catalogue_items` | SELECT | Tous authentifiés |
| `catalogue_items` | INSERT/UPDATE/DELETE | Tous authentifiés |
| `app_config` | SELECT | Tous authentifiés + anon pour clés de présentation |
| `app_config` | INSERT/UPDATE/DELETE | Admin uniquement (via `is_admin()` SECURITY DEFINER) |
| `project_follows` | SELECT/INSERT/DELETE | `user_id = auth.uid()` |
| `submission_reviews` | SELECT/INSERT | Tous authentifiés |
| `ai_learnings` | SELECT/INSERT/UPDATE/DELETE | Tous authentifiés |

**Tokens publics** : `quote.html` utilise uniquement la clé anon. Les données sont servies par la RPC `get_public_quote` (SECURITY DEFINER) qui valide le token côté serveur.

---

## 8. Présentation client (quote.html)

### 8.1 Architecture

Fichier HTML autonome accessible sans authentification. Utilise uniquement la clé anon Supabase.

### 8.2 Pages (séquence de rendu)

| # | Page | Classe CSS | Contenu |
|---|------|-----------|---------|
| 1 | Couverture | `.pv-page-title` | Image de fond, nom client, adresse, numéro de soumission, date |
| 2 | Introduction | `.pv-page-intro` | Image, "À l'attention de", 3 paragraphes configurables, coordonnées |
| 3 | Pourquoi Stele | `.pv-page-why` | Image, texte fixe avec nom designer/architecte |
| 4+ | Pièces | `.pv-page` | Nom + sous-total, description formatée, images (max 6), note installation |
| N-2 | Clauses | `.pv-page` | Clauses conditionnelles (titre + contenu) |
| N-1 | Étapes | `.pv-page-steps` | 8 étapes de projet en grille 2×4 |
| N | Page finale | `.pv-page-final` | 2 colonnes : gauche émotionnelle + droite prix/signature |

### 8.3 Système de traduction

- Langue détectée depuis `?lang=fr|en` (défaut `fr`)
- Dictionnaire `QUOTE_TEXTS` avec ~20 clés FR/EN
- Helper `t(key)` avec fallback
- Portée limitée : page finale + formatage argent/date. Les pages couverture, intro, "pourquoi stele" et étapes restent en français

### 8.4 Acceptation et signature

1. **Formulaire** : Nom (pré-rempli), email (pré-rempli), canvas de signature
2. **Canvas signature** : HiDPI (2x), events mouse + touch, placeholder qui disparaît au premier trait
3. **Validation** : Nom non vide, email non vide, signature dessinée (`sigHasDrawn`)
4. **Soumission** : Appel RPC `accept_quote` avec token + name + email + signature (base64 PNG)
5. **Animation** : Form fade out → banner accepté fade in avec animations staggered (checkmark scale + text fade)

### 8.5 Détection iframe (preview)

```javascript
var isPreviewMode = (window.self !== window.top);
```

En preview : affiche un label "Prévisualisation" au lieu du formulaire d'acceptation.

### 8.6 Snapshot path

Pour les soumissions verrouillées (status ≠ draft/returned/pending_internal) :
1. Fetch du snapshot HTML depuis Storage
2. Vérification du format (skip si ancien format avec `pv-page-total`)
3. Injection du body + `renderAcceptanceSection()` séparé

### 8.7 Navigation

- **Scroll snap** : CSS `scroll-snap-type: y mandatory` avec `scroll-snap-align: start` par page
- **Clavier** : ↓/→/Enter/Space = avancer, ↑/←/Backspace = reculer, Escape = fermer lightbox
- **Click** : Click sur zone non-interactive = avancer
- **Lightbox** : Images cliquables, navigation ←/→, pinch-to-zoom tactile

### 8.8 Smart layouts d'images

`applySmartLayouts()` analyse les ratios des images par pièce et applique une classe de layout optimale :
- `layout-1` : image unique
- `layout-2v` / `layout-2h` / `layout-2-lp` : 2 images (vertical, horizontal, mixte)
- `layout-3h` / `layout-3-featured` : 3 images
- `layout-4-grid` / `layout-4-featured` : 4 images
- `layout-gallery` : 5-6 images en grille 3 colonnes

### 8.9 Données exposées (via `get_public_quote`)

- Projet : `client_name`, `client_email`, `project_address`, `project_city`, `project_postal_code`, `name`, `assigned_to`, `id`
- Soumission : `submission_number`, `status`, `sent_at`, `approved_total`, `global_price_modifier_pct`, `discount_type/value`, `clauses[]`
- Pièces : `name`, `subtotal`, `installation_included`, `price_modifier_pct`, `client_description`, `images[]`
- Token : `accepted_at`, `client_name`, `client_email`, `signature_data`

### 8.10 Export PDF (`shared/pdf-export.js`)

Export server-side de la soumission en PDF via PDFShift API (rendu Chromium) a travers l'Edge Function `pdf-export`.

**Architecture** :
- Client (`shared/pdf-export.js`) : collecte le HTML, construit un document autoportant, appelle l'Edge Function
- Serveur (`supabase/functions/pdf-export/index.ts`) : recoit le HTML, appelle PDFShift API, retourne le PDF binaire
- PDFShift : rendu Chromium server-side, supporte flex/grid nativement, fetch les images directement

**Processus** :
1. `renderPreview()` genere le HTML live dans `#pvContent`
2. Clone le contenu, supprime les elements interactifs (boutons, contenteditable). Textareas converties en divs avec `innerHTML = escapeHtml(value) + newlines→<br>`
3. Reconstruit la page total+signature (`.pv-page-total`) en layout flex 2 colonnes : colonne gauche (55%) texte de cloture emotionnel (titre 38px, 3 paragraphes), separateur vertical 1px, colonne droite total (montant 48px) + lignes signature. `.pv-total-box` masque via `display:none`
3b. **Sanitisation HTML descriptions** : apres le clone, regex remplace les entites HTML double-escapees (`&lt;br&gt;` → `<br>`, `&lt;p&gt;` → `<p>`, etc.) pour corriger les descriptions en DB contenant du HTML echappe
4. **Resolution URLs relatives** : les images avec `src` relatif (ex: `shared/logo.png`) sont prefixees avec `baseUrl` (origin du site) pour que PDFShift puisse les fetch cote serveur. Construit un document HTML complet autoportant : DOCTYPE + head (`<meta name="viewport" content="width=1056">` + Google Fonts Inter, SNAPSHOT_CSS + overrides inline) + body (contenu clone dans div `.pv-content` width 1056px). **Overrides CSS** (tous avec `!important` pour garantir la priorite sur SNAPSHOT_CSS) : `.pv-page{aspect-ratio:unset!important;height:auto!important;overflow:visible!important}` (elimine les pages blanches). `.pv-page{min-height:8.5in!important}` (centrage vertical du contenu court). `.pv-page-title{overflow:hidden!important;height:100%!important}` (couverture pleine hauteur — clip border-radius). `.pv-cover-right{-webkit-border-radius:8px!important;overflow:hidden!important}` (border-radius couverture Chromium). `.pv-page-clause{background:#fff!important}` (clauses fond blanc). `.pv-content{gap:0!important}`. Images : `object-fit:contain!important`, `min-width:0!important`. Conteneurs 2 colonnes : `overflow:hidden!important;max-width:100%!important`. Texte : `word-wrap:break-word!important`
5. Appelle l'Edge Function `pdf-export` via `authenticatedFetch()` avec `{ html: htmlDoc }`
6. L'Edge Function envoie le HTML a PDFShift API (`https://api.pdfshift.io/v3/convert/pdf`) avec params : format Letter, landscape, margin 0, use_print true, wait_for "network"
7. Recoit le PDF binaire, cree un blob URL, declenche le telechargement

**Nom de fichier** : `{OrgName}_{ProjectCode}_{SubNumber}_v{Version}.pdf`
- `org_name` : `introConfig.org_name` (charge depuis `app_config`), fallback "Stele"
- `_sanitizePdfFilename(str)` : NFD strip accents, garde alphanumeriques + `_` + `-`

**Edge Function `pdf-export`** :
- Auth : JWT via `_shared/auth.ts` (meme pattern que les autres EF)
- PDFShift auth : Basic auth avec secret `PDFSHIFT_API_KEY`
- Reponse : `application/pdf` binaire (200) ou JSON erreur (400/401/403/502)
- Deploy : `npx supabase functions deploy pdf-export --no-verify-jwt`

**Dependances** :
- Secret : `PDFSHIFT_API_KEY` (configurer via `npx supabase secrets set`)
- Globales : `currentProject`, `currentSubmission`, `currentLang`, `introConfig`, `renderPreview()`, `SNAPSHOT_CSS`, `authenticatedFetch()`, `SUPABASE_URL`, `steleAlert()`
- **Retirees** : html2pdf.js (CDN), html2canvas, jsPDF

---

## 9. CRM (clients.html)

### 9.1 Modèle de données

- **Contacts** : `first_name`, `last_name`, `email`, `phone`, `address`, `preferred_contact`, `notes`
- **Entreprises** : `name`, `type`, `address`, `phone`, `email`, `website`, `notes`, `extra_data` (JSONB dynamique selon le type)
- **Liaison N:N** : `contact_companies` avec `role`, `work_email`, `work_phone`, `is_primary_contact`
- **Communications** : `contact_id`, `comm_type`, `direction`, `subject`, `content`, `comm_date`

### 9.2 Types d'entreprise (champs dynamiques)

| Type | Champs supplémentaires |
|------|----------------------|
| Designer | `specialite`, `portfolio` (URL) |
| Architecte | `numero_oaq`, `specialite` |
| Entrepreneur | `licence_rbq`, `specialite` |
| Promoteur | `type_projets` |
| Particulier / Autre | Aucun |

### 9.3 AI Import

Chat drawer connecté à `contacts-import` Edge Function via SSE. Supporte :
- Texte libre décrivant des contacts
- Screenshots (images base64 compressées)
- Détection de doublons automatique
- Filtres AI appliqués à la grille de contacts

---

## 10. Administration (admin.html)

### 10.1 Sections configurables

| Section | Clé `app_config` | Description |
|---------|-----------------|-------------|
| Permissions | `permissions` | Matrice rôle × permission |
| Rôles (DB) | Table `roles` + `user_roles` | CRUD rôles avec permissions JSONB |
| Catégories catalogue | `catalogue_categories` | Liste de catégories |
| Groupes de matériaux | `material_groups` | Groupes pour DM (7 par défaut) |
| Mapping cat→groupes | `category_group_mapping` | Associe groupes aux catégories |
| Catégories de dépense | `expense_categories` | 24 catégories avec markup, waste, templates, calc_rule, presentation_rule, AI buttons. Textareas `.input-template` : scrollbar fine 6px sans flèches (`::-webkit-scrollbar-button{display:none}`, `scrollbar-width:thin`) |
| Taux horaires | `taux_horaires` | 7 départements avec taux, frais, salaire |
| Tags média | `media_tags` | Tags pour images (avec propagation rename) |
| Préfixes tags | `tag_prefixes` | C=Caisson, F=Filler, P=Panneau, etc. |
| Types d'entreprise | `company_types` | Types pour le CRM |
| Rôles de contact | `contact_roles` | Rôles dans les projets |
| Types de communication | `communication_types` | Appel, Courriel, Texto, etc. |
| Statuts pipeline | `pipeline_statuses` | Slug + label + couleur |
| Sources de projet | `project_sources` | Origine des projets |
| Types de projet | `project_types` | Classification des projets |
| Prompts AI (12) | `ai_prompt_*` | Prompts overridables |
| AI Learnings | Table `ai_learnings` | Règles organisationnelles |
| Image couverture | `cover_image_url` | Image de fond pour les soumissions |
| Page introduction | `presentation_intro_*` | Textes et coordonnées |
| Page "Pourquoi" | `why_title`, `why_text`, `why_image_url` | Titre, texte HTML, image. Placeholder `{designer}` interpolé |
| Étapes du projet | `project_steps` | JSONB array `[{title, description}]` — 8 étapes éditables |
| Format description | `description_format_rules` | Règles injectées dans les prompts AI (estimateur + description) |

### 10.2 Pattern de sauvegarde

```javascript
saveConfig(key, value, feedbackId):
  POST /rest/v1/app_config { key, value }
  avec Prefer: resolution=merge-duplicates (upsert)
  Fallback: localStorage si Supabase échoue
```

---

## 11. Base de données Supabase

### 11.1 Tables principales

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

composantes (regroupements propriétés constructives par type DM)
  └── room_items.composante_id FK (nullable, ON DELETE SET NULL)

contacts ─── contact_companies ─── companies
  └── communications

app_config (key-value JSONB)
chat_messages (par soumission ou par contexte)
ai_learnings (règles organisationnelles)
employees
roles ─── user_roles
user_profiles
quote_clauses
submission_unlock_logs (immuable)
```

### 11.2 Colonnes générées

- `room_items.line_total` : `qty × unit_price × (1 + markup/100)` — **ne pas écrire dessus** (Note : n'inclut pas qty_multiplier, le calcul réel est côté client)
- `room_items.qty_multiplier` : NUMERIC DEFAULT 1. Multiplicateur global par ligne. Total effectif = `unit_price × quantity × qty_multiplier`. Hérité par les enfants cascade. Migration : `sql/qty_multiplier.sql`

### 11.3 Séquences

| Séquence | Usage | Format |
|----------|-------|--------|
| `project_code_seq` | Codes projet auto | EP001, EP002... |
| `catalogue_code_seq` | Codes catalogue auto | ST-0001, ST-0002... |
| `composante_code_seq` | Codes composante auto | COMP-001, COMP-002... |
| `submission_number_seq` | Numéros soumission auto | 100, 101... |

### 11.4 Triggers

| Trigger | Table | Action | Description |
|---------|-------|--------|-------------|
| `trg_project_auto_code` | projects (INSERT) | `generate_project_code()` | Auto-génère code + nom |
| `trg_project_name_on_city` | projects (UPDATE) | `update_project_name_on_city()` | Recalcule nom quand ville change |
| `trg_catalogue_auto_code` | catalogue_items (INSERT) | `generate_catalogue_code()` | Auto-génère ST-XXXX |
| `trg_composante_auto_code` | composantes (INSERT) | `generate_composante_code()` | Auto-génère COMP-XXX |
| `trg_check_submission_status` | submissions (UPDATE) | `check_submission_status_transition()` | Valide les transitions d'état |

### 11.5 Fonctions RPC

| Fonction | Type | Description |
|----------|------|-------------|
| `get_public_quote(p_token)` | SECURITY DEFINER | Retourne les données de soumission pour affichage public |
| `accept_quote(p_token, p_name, p_email, p_signature)` | SECURITY DEFINER | Enregistre l'acceptation client |
| `approve_catalogue_item(p_item_id, p_new_status)` | SECURITY DEFINER | Vérifie permissions + change le statut |
| `is_admin()` | SECURITY DEFINER | Helper pour vérifier si l'user est Admin (évite circularité RLS) |
| `log_bypass_approval(...)` | RPC | Log immuable pour bypass |
| `log_offline_acceptance(...)` | RPC | Log immuable pour acceptation offline |

### 11.6 Storage Buckets

| Bucket | Accès | Contenu |
|--------|-------|---------|
| `room-images` | Authentifié | Images de pièces (JPEG compressé) |
| `submission-snapshots` | Public read, auth write | HTML snapshots des soumissions |
| `submission-plans` | Authentifié | Plans PDF |
| `fiche-images` | Authentifié | Images de fiches de vente (originals + cropped) |
| `admin-assets` | Authentifié | Image couverture, image intro |

---

## 12. Edge Functions

### 12.1 Module partagé `_shared/auth.ts`

**JWT Validation à deux niveaux** :
1. **Primaire** : ES256 via JWKS (clé publique Supabase Auth v2, cachée 1h)
2. **Fallback** : HS256 avec `JWT_SECRET` (tokens legacy)

**CORS** : Origines autorisées `https://scopewright.ca` et `https://www.scopewright.ca`

**Tolérance horloge** : 30 secondes sur l'expiration

### 12.2 ai-assistant/index.ts (~965 lignes)

- **Modèle** : Routing dynamique — `claude-haiku-4-5-20251001` si `query_complexity === "simple"`, sinon `claude-sonnet-4-5-20250929` (non-streaming)
- **Max tokens** : 512 (simple) / 1536 (complex) / 4096 (diagnostic), clampé 512-4096
- **Prompt dynamique** : System prompt enrichi avec contexte projet complet (taux, dépenses, DM, rooms, items, catalogue, learnings)
- **2 modes** : `ai_prompt_estimateur` (calculateur) et `ai_prompt_approval_review` (approbation)
- **9 tools** définis avec schémas JSON + `save_learning` server-side
- **`save_learning`** exécuté côté serveur (INSERT direct dans `ai_learnings`)
- **Boucle tool** : Si la réponse contient `save_learning`, exécute et relance pour réponse finale
- **Sanitization** : `sanitizeConversationToolUse()` injecte `tool_result` synthétiques pour `tool_use` orphelins

### 12.3 translate/index.ts (~669 lignes)

- **Modèles** : Haiku 4.5 (texte), Sonnet 4 (JSON)
- **13 actions** couvrant traduction, optimisation, génération JSON, reformulation instruction, barèmes
- **Prefill assistant** : `"{"` pour forcer output JSON
- **Multi-texte** : Concaténation avec `===SEPARATOR===`
- **Multimodal** : Support images base64 pour `import_components`
- **Retry** : Backoff exponentiel (1s → 8s) sur 429/529, max 3 retries
- **Learnings** : toujours injectés dans le prompt (contrairement à catalogue-import/contacts-import)

### 12.4 catalogue-import/index.ts (~581 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (SSE streaming)
- **8 tools** : CRUD catalogue + analytics + audit + régénération
- **Contexte dynamique** : Stats catalogue, catégories, codes existants, article ouvert, usage
- **Streaming** : TransformStream relay des événements SSE Anthropic
- **Bug connu** : n'injecte pas les learnings (contrairement à ai-assistant et translate)

### 12.5 contacts-import/index.ts (~492 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (SSE streaming)
- **10 tools** : CRUD contacts/companies + liaison + filtres + learning
- **Contexte dynamique** : Counts contacts/companies, types configurés, learnings
- **Bug connu** : n'injecte pas les learnings

### 12.6 ai-master/index.ts (~688 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (non-streaming)
- **9 tools** : 4 read-only auto-exécutés (`list_learnings`, `read_prompt`, `list_all_prompts`, `get_catalogue_item`) + 5 write avec approbation client (`update_learning`, `delete_learning`, `update_prompt_section`, `log_prompt_change`, `update_catalogue_item`). `update_catalogue_item` dispatche `CustomEvent('catalogue-item-updated')` après PATCH pour auto-refresh de la modale catalogue (CAT-01)
- **Context** : MASTER_CONTEXT.md + CLAUDE.md (section-based, keyword-matched) + données vivantes (`description_format_rules`, `expense_categories`, `taux_horaires`) + fraîcheur contexte
- **`update_prompt_section`** : 3 niveaux de matching (exact, regex whitespace-tolerant, fuzzy line-by-line ≥85%)

### 12.7 pdf-export/index.ts (~99 lignes)

- **Modèle** : Aucun (pass-through vers PDFShift API)
- **Input** : `{ html: string }`
- **Output** : PDF binaire (landscape Letter, marges 0, `use_print: true`, `wait_for: "network"`)
- **Secret** : `PDFSHIFT_API_KEY`

---

## 13. Google Apps Script

### 13.1 Endpoint

`doPost(e)` reçoit un POST JSON depuis `calculateur.html` (via `fetch` en mode `no-cors` avec `Content-Type: text/plain`).

### 13.2 Données reçues

```json
{
  "projectCode": "EP042",
  "projectManager": "Jean Dupont",
  "managerEmail": "jean@stele.ca",
  "projectDate": "2026-03-01",
  "description": "Cuisine moderne...",
  "meubles": [
    { "code": "ST-0001", "description": "Caisson 24x30", "type": "pi2", "markup": 38, "unitPrice": 120, "quantity": 8, "lineTotal": 960 }
  ],
  "total": 15000,
  "images": ["data:image/jpeg;base64,..."],
  "submissionNumber": "105",
  "submissionTitle": "Cuisine principale"
}
```

### 13.3 Output

- **Email HTML** : Template Stele-branded avec tables par meuble + sous-totaux + grand total
- **Pièce jointe PDF** : Même contenu généré via `HtmlService.createHtmlOutput().getAs('application/pdf')`
- **Images** : Converties de base64 en Blob, ajoutées comme pièces jointes
- **Destinataire** : `soumissions@stele.ca` avec CC au project manager
- **Sujet** : `Estimation Stele — #105 — Jean Dupont (3 image(s) jointe(s))`

---

## 14. Tests automatisés — Moteur cascade

### 14.1 Architecture

Tests Node.js headless (0 dépendances externes) couvrant les fonctions pures du moteur cascade. Les fonctions sont extraites de `calculateur.html` en copies paramétrées dans `tests/cascade-helpers.js` — les globales (`CATALOGUE_DATA`, `categoryGroupMapping`, `cascadeLog`) sont remplacées par des paramètres explicites.

```bash
node tests/cascade-engine.test.js
# Attendu : 282 passed, 0 failed, exit code 0
```

### 14.2 Fichiers

| Fichier | Contenu | Lignes |
|---------|---------|--------|
| `tests/cascade-engine.test.js` | Mini runner (`describe`/`it`/`assert`/`assertEqual`/`assertDeepEqual`/`assertApprox`) + 292 assertions en 34 groupes | ~2 302 |
| `tests/cascade-helpers.js` | 19 fonctions pures + constante `MATCH_STOP_WORDS` | ~618 |
| `tests/fixtures/catalogue.js` | 21 articles réalistes (8 FAB + 13 MAT) | ~330 |
| `tests/fixtures/room-dm.js` | 5 configurations DM (`room-1` à `room-5`) + `CATEGORY_GROUP_MAPPING` | ~49 |

### 14.3 Fonctions extraites (19)

| Fonction | Paramétrage |
|----------|-------------|
| `evalFormula(expr, vars, log)` | `cascadeLog` → `log` callback |
| `normalizeDmType(str)` | Aucun |
| `extractMatchKeywords(clientText, stopWords)` | `MATCH_STOP_WORDS` → paramètre |
| `scoreMatchCandidates(candidates, keywords)` | Aucun |
| `deduplicateDmByClientText(entries)` | Aucun |
| `itemHasMaterialCost(item, expCatUpper)` | Aucun |
| `getAllowedCategoriesForGroup(groupName, mapping)` | `categoryGroupMapping` → paramètre |
| `isFormulaQty(formulaStr)` | Extraction inline |
| `computeCascadeQty(ruleQty, vars, rootQty, log)` | Combine `evalFormula` + branchement |
| `checkAskCompleteness(askFields, vars)` | Aucun |
| `inferAskFromDimsConfig(dimsConfig)` | Aucun |
| `mergeOverrideChildren(parentOverrides, ownOverrides)` | Aucun |
| `isRuleOverridden(ruleTarget, ancestorOverrides)` | Aucun |
| `findExistingChildForDynamicRule(...)` | Paramètres explicites au lieu de globals |
| `computeChildDims(childDims, vars, log)` | Pure — retourne `{length_in, height_in, depth_in}` |
| `evaluateLaborModifiers(item, vars, log)` | Pure — retourne `{labor_factor, material_factor, label}` ou null |
| `checkDefaultItemMatchCategory(defaultItem, matchCategory)` | Aucun |
| `parseFraction(str)` | Aucun |
| `computeRentabilityPure(lines, tauxHoraires, expenseCategories)` | Aucun |

### 14.4 Groupes de tests (28)

1. **evalFormula** (17) — arithmétique, variables L/H/P/QTY, n_tablettes/n_partitions, ceil/floor/round/min/max, null, unsafe, division par zéro
2. **normalizeDmType** (9) — lowercase, accents, pluriel s/x, null, Façades→Facade
3. **isFormulaQty** (8) — constantes vs formules avec variables dimensionnelles
4. **computeCascadeQty** (9) — constante × rootQty, formule = total (pas × rootQty), résultat ≤0
5. **mergeOverrideChildren** (4) — vide, parent seul, own seul, concat
6. **isRuleOverridden** (7) — $match bloqué/non-bloqué, $default jamais bloqué, code direct jamais bloqué
7. **override_children integration** (10) — FAB ST-0001 : propres rules passent, descendants bloqués, FAB enfants autonomes
8. **checkAskCompleteness** (12) — complet, L=0, L absent, n_tablettes=0 valide, alias, champ inconnu
9. **inferAskFromDimsConfig** (6) — l+h+p, l+h, vide, null
10. **extractMatchKeywords + scoreMatchCandidates** (9) — extraction, stop words, scoring, tri
11. **deduplicateDmByClientText** (5) — uniques, duplicates, fallback catalogue_item_id
12. **getAllowedCategoriesForGroup** (6) — Caisson→3 cats, Finition→1, inconnu→null
13. **itemHasMaterialCost** (8) — flat cost, {cost,qty}, zéro, case-insensitive, absent, null
14. **findExistingChildForDynamicRule** (8) — $default exact/fallback/already-matched, $match word overlap
15. **n_portes / n_tiroirs** (14) — evalFormula substitution, isFormulaQty detection, checkAskCompleteness guards
16. **computeChildDims** (11) — L/H/P formulas, only defined keys, unsafe formula omitted
17. **evaluateLaborModifiers — basic** (~8) — null, vide, first-match, label fallback
18. **evaluateLaborModifiers — formulas** (~6) — L×H, ceil/floor, n_tablettes, matériau seul
19. **evaluateLaborModifiers — integration** (~6) — ST-0006 scénarios complets avec facteurs
20. **checkDefaultItemMatchCategory** (~8) — mélamine vs finition, placage vs finition, bande de chant
21. **computeChildDims — additional** — scénarios complémentaires
22. **undo stack** — save/restore, max size
23. **token optimization** — budget tokens, troncature
24. **cumulative baremes** (~6) — facteurs multipliés, mixed true/false, all false
25. **MAT with dims_config** (~4) — dims fields, formula auto-qty
26. **parseFraction** (~8) — entiers, décimaux, fractions simples, mixtes, trait d'union, invalides
27. **calculation_rule_ai fallback** (~4) — labor_modifiers dans calculation_rule_ai
28. **computeRentabilityPure** (17) — marges, prix zéro, installation, loss_override, frais fixes

### 14.5 Synchronisation

Les copies dans `cascade-helpers.js` doivent être mises à jour manuellement si la logique source dans `calculateur.html` change. Les numéros de lignes source sont documentés dans les commentaires d'en-tête de chaque fonction. Après modification du moteur cascade :

1. Vérifier si les fonctions extraites ont changé
2. Mettre à jour les copies si nécessaire
3. Rouler `node tests/cascade-engine.test.js`
4. Vérifier 0 failures avant commit

---

*Fin du manuel technique. Ce document couvre l'intégralité de l'architecture, des systèmes et des flux de données de la plateforme Scopewright/Stele.*
