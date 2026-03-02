# Manuel Technique Scopewright/Stele

> Document exhaustif pour assistant AI. Couvre l'architecture, les systèmes, les flux de données et les mécanismes internes de la plateforme Scopewright.
>
> **Dernière mise à jour** : 2026-03-01

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

---

## 1. Architecture générale

### 1.1 Stack technique

| Couche | Technologie | Détail |
|--------|------------|--------|
| Frontend | HTML/CSS/JS vanilla | Fichiers autonomes, pas de build system, pas de framework |
| Backend | Supabase | PostgreSQL + Auth + Storage + Edge Functions |
| AI | Anthropic API | Claude Sonnet 4.5 (assistant), Haiku 4.5 (traduction), Sonnet 4 (JSON) |
| Déploiement | Netlify | Auto-deploy depuis GitHub (branche `main`) |
| Email | Google Apps Script | Envoi de soumissions par courriel |
| CDN | Google Fonts, PDF.js | Inter, Cormorant Garamond, PDF.js 3.11.174 |

### 1.2 Structure des fichiers

| Fichier | Rôle | Taille approx. |
|---------|------|----------------|
| `calculateur.html` | Application principale — projets, soumissions, rooms, items, cascade, AI chatbox, annotations, pipeline, preview | ~18 600 lignes |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — CRUD items, images, prix composé, sandbox, AI import | ~9 200 lignes |
| `admin.html` | Administration — permissions, rôles, catégories, taux, tags, prompts AI, présentation | ~2 900 lignes |
| `approbation.html` | Approbation — soumissions pendantes + articles proposés, AI review chat | ~2 300 lignes |
| `quote.html` | Vue client publique — soumission multi-page + acceptation + signature | ~2 060 lignes |
| `clients.html` | CRM — contacts, entreprises, communications, AI import | ~2 340 lignes |
| `fiche.html` | Fiches de vente produits — présentation client d'un article catalogue | ~1 200 lignes |
| `app.html` | Tableau de bord — grille 2 colonnes responsive, navigation vers les modules | ~300 lignes |
| `login.html` | Authentification Supabase — email/password, refresh token | ~200 lignes |
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

**Pattern `authenticatedFetch()`** (dupliqué dans chaque fichier HTML) :
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
- `calc_template` (optionnel) : template pour la génération AI de règles de calcul
- `pres_template` (optionnel) : template pour la génération AI de règles de présentation

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

**Variables disponibles dans les formules** : `L` (longueur pouces), `H` (hauteur pouces), `P` (profondeur pouces), `QTY` (quantité racine FAB), `n_tablettes`, `n_partitions`

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

### 2.7 Prix composé

```
Prix = Σ(labor_minutes[dept] / 60 × taux_horaire[dept])
     + Σ(material_costs[cat] × (1 + markup%/100 + waste%/100))
```

- `loss_override_pct` sur l'article remplace le `waste` par catégorie
- Les composants fournisseur (`catalogue_item_components`) verrouillent automatiquement les inputs de `material_costs` pour les catégories concernées
- Si aucun prix composé n'est défini, le prix manuel (`price`) est utilisé

---

## 3. Moteur de cascade

### 3.1 Vue d'ensemble

Le moteur de cascade (`executeCascade`) crée automatiquement des lignes enfants (matériaux, composants) basées sur les règles `cascade` d'un article parent. Il supporte la récursion jusqu'à 3 niveaux de profondeur.

### 3.2 Flow complet

```
scheduleCascade(rowId)
  └── debounce 400ms (sauf immediate=true)
       └── runCascadeNow(rowId)
            └── executeCascade(parentRowId, depth=0, parentOverrides=[])
                 │
                 ├── Guards: depth < 3, itemMap[rowId] exists, dims/qty > 0
                 │
                 ├── Récupérer dims via getRootDimsForCascade(parentRowId)
                 │   └── Remonte cascadeParentMap → lit dim-l/dim-h/dim-p de la racine
                 │
                 ├── Récupérer rootQty via getRootQtyForCascade(parentRowId)
                 │   └── Remonte cascadeParentMap → lit qty-input de la racine FAB
                 │
                 ├── vars = { L, H, P, QTY: rootQty, n_tablettes, n_partitions }
                 │
                 ├── Séparer enfants existants: locked (ignorés) vs active
                 │
                 ├── Pour chaque règle cascade:
                 │   ├── Vérifier override_children (skip si catégorie overridée)
                 │   ├── Résoudre la cible (direct / $default: / $match:)
                 │   ├── Évaluer condition (si présente)
                 │   ├── Calculer qty = evalFormula(rule.qty, vars) × rootQty
                 │   ├── Réutiliser enfant existant OU créer nouvelle ligne
                 │   ├── Hériter le tag du parent
                 │   └── Ajouter à matchedChildRowIds
                 │
                 ├── Supprimer orphelins actifs (non matchés)
                 │
                 ├── syncSortOrderForGroup(groupId)
                 │
                 └── Récursion: pour chaque enfant matché
                      └── executeCascade(childRowId, depth+1, mergedOverrides)
```

### 3.3 Résolution des cibles

| Pattern | Mécanisme | Détail |
|---------|-----------|--------|
| `"ST-0042"` | Code direct | Utilise l'article catalogue directement |
| `"$default:Facades"` | Matériau par défaut | Lookup dans DM (room → submission → vide). Si multiples entrées du même type → `showDmChoiceModal()`, résultat caché dans `dmChoiceCache` |
| `"$match:BANDE DE CHANT"` | Correspondance par mots-clés | 3 étapes de résolution (voir ci-dessous) |

**Résolution `$match:`** (`resolveMatchTarget`) :

1. **Étape 1** : Extraire les mots-clés du `client_text` du parent
2. **Étape 2** : Si pas de résultat, extraire de la `description` du parent
3. **Étape 3** : Si toujours pas, fallback vers les mots-clés du matériau par défaut (`getDefaultMaterialKeywords` avec normalisation singulier/pluriel)

À chaque étape :
- `extractMatchKeywords(text)` → enlève les stop words, garde les mots ≥ 3 caractères
- Filtre les candidats : articles avec `material_costs[expenseCategory]` > 0
- `scoreMatchCandidates(keywords, candidates)` → score par Levenshtein + substring
- **Relaxation** : si > 2 mots-clés donnent 0 résultats, réessaye avec seulement les 2 meilleurs
- Résultat caché dans `matchDefaults` (persisté dans `submission.match_defaults`)

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

### 3.5 Multiplication rootQty

Les quantités cascade sont calculées **par unité** puis multipliées par la quantité racine :

```javascript
var qtyPerUnit = evalFormula(rule.qty, vars); // ex: L*H/144 = 1 pi²
var qty = qtyPerUnit * rootQty;               // ex: 1 × 8 = 8 pi²
```

- `rootQty` est toujours la QTY du FAB racine (pas du parent immédiat)
- À profondeur 0 : `rootQty = parentQty` (pas de traversal)
- À profondeur 1+ : `getRootQtyForCascade()` remonte `cascadeParentMap` jusqu'à la racine
- `vars.QTY = rootQty` à toute profondeur (disponible pour conditions, pas pour formules qty)

### 3.6 Passage de dimensions

`getRootDimsForCascade(rowId)` :
- Remonte `cascadeParentMap` jusqu'à la racine (le FAB avec les inputs dim-l/dim-h/dim-p)
- Retourne `{ L, H, P, n_tablettes, n_partitions }`
- Les dimensions racine sont utilisées à TOUTE profondeur de cascade
- Si le parent immédiat a ses propres dims (cas rare de FAB enfant), elles overrident les racine

### 3.7 Guards et protections

| Guard | Variable | Rôle |
|-------|----------|------|
| Profondeur max | `depth >= 3` | Empêche les boucles infinies |
| Re-entrance | `_cascadeRunning` | Un seul cascade actif à la fois. `_pendingCascadeRowId` queue 1 cascade |
| Chargement | `_isLoadingSubmission` | Toutes les cascades dropped pendant `openSubmission()` |
| Debounce | `scheduleCascade` | 400ms (sauf `immediate=true`) |
| Polling | `while (!itemMap[row] && attempts < 50)` | Attend que la création DB se termine (80ms × 50 = 4s max) |
| Contraintes | `dataset.constraintsProcessed` | Empêche le re-triggering des contraintes sur le même article |
| Article changé | `dataset.lastCatalogueId` | Détecte le changement pour reset les enfants |
| Locked children | `cascade-locked` CSS class | Enfants verrouillés invisibles au moteur (override manuel) |

### 3.8 Edge cases et limitations

1. **`$match:` non re-cascadé sur changement DM** : `reprocessDefaultCascades()` ne gère que les cibles `$default:`. Les `$match:` ne sont pas recalculés quand on change un matériau par défaut — seul un re-trigger manuel de la cascade du parent le fait.
2. **Cascade max 3 niveaux** : Suffisant pour la plupart des cas (FAB → matériau → sous-composant), mais des structures plus profondes seraient tronquées.
3. **Polling wait limité à 4 secondes** : Si la création DB est plus lente (connexion faible), le cascade peut échouer avec "Timeout création ligne".
4. **Singulier/pluriel dans le fuzzy match** : Normalisé via regex `([a-zàâäéèêëïîôùûüÿç]{3,})[sx](?=\s|$)` qui strip les s/x finaux.

---

## 4. Matériaux par défaut

### 4.1 Structure de données

```javascript
// Niveau soumission (submissions.default_materials)
[
  { "type": "Caisson", "catalogue_item_id": "ST-0142", "description": "Mélamine TFL blanc" },
  { "type": "Facades", "catalogue_item_id": "ST-0088", "description": "Laqué blanc" }
]

// Niveau pièce (project_rooms.default_materials via roomDM[groupId])
// Même structure, override TOTAL (pas merge) le niveau soumission
```

### 4.2 Hiérarchie de résolution

```
getDefaultMaterialsForGroup(groupId):
  1. roomDM[groupId] si non vide → UTILISE (override total)
  2. currentSubmission.default_materials → UTILISE
  3. [] (vide)
```

**Important** : L'override est total, pas un merge. Si une pièce a des DM pour "Caisson" mais pas pour "Facades", elle n'héritera PAS les "Facades" de la soumission.

### 4.3 Cache et modal de choix

- `dmChoiceCache[groupId + ':' + typeName]` : Cache la sélection quand plusieurs entrées DM du même type existent
- `showDmChoiceModal(groupName, entries)` : Modal radio-button pour choisir parmi les candidats
- Le cache est invalidé quand un DM est modifié (`dmSelectItem()`)

### 4.4 `reprocessDefaultCascades(changedGroup, scopeGroupId)`

Déclenché quand un DM est modifié :
1. Trouve tous les parents (lignes racine) qui ont des règles `$default:` correspondant au groupe modifié
2. Re-exécute `executeCascade()` séquentiellement sur chacun
3. **Limitation** : Ne traite PAS les cibles `$match:` — seuls les `$default:` sont re-cascadés

### 4.5 UI

- **Panel soumission** : Panneau dépliable avec autocomplete groupé par `categoryGroupMapping`
- **Panel pièce** : Par pièce, avec options "Copier depuis..." (autre pièce ou soumission)
- **Autocomplete** : Filtre les articles catalogue `is_default=true` des catégories autorisées pour le groupe

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
  │    contacts, benchmarks)              │   (contexte dynamique + learnings)
  │                                       │
  ├── messages[] ───────────────────►     ├── Anthropic API
  │   (historique conversation)           │   claude-sonnet-4-5
  │                                       │   max_tokens: 4096
  │◄──────────────────────────────────    │   6 tools
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
| `ai-assistant` | calculateur.html, approbation.html, catalogue.html | Sonnet 4.5 | Non | Chat estimateur, review approbation |
| `translate` | catalogue.html, calculateur.html, approbation.html | Haiku 4.5 / Sonnet 4 | Non | Traduction, optimisation, génération JSON |
| `catalogue-import` | catalogue.html | Sonnet 4.5 | SSE | Chat import catalogue |
| `contacts-import` | clients.html | Sonnet 4.5 | SSE | Chat import contacts |

### 6.3 Tools de l'assistant estimateur (ai-assistant)

| Tool | Type | Description |
|------|------|-------------|
| `analyze_rentability` | Confirmation requise | Analyse de rentabilité : prix de vente, coûts, marges, heures par département |
| `write_description` | Confirmation requise | Écrit/réécrit la description client d'une pièce en HTML formaté Stele |
| `add_catalogue_item` | Confirmation requise | Ajoute un article catalogue à une pièce avec qty, tag, dimensions optionnelles |
| `modify_item` | Confirmation requise | Modifie une ligne existante (qty, unit_price, description, markup, L, H, P) |
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
| `catalogue_client_text` | Haiku | Génération de texte client depuis description interne |
| `catalogue_explication` | Haiku | Amélioration d'explication de règle |
| `catalogue_json` | Sonnet 4 | Conversion explication → JSON structuré |
| `catalogue_pres_rule` | Sonnet 4 | Génération règle de présentation (explication + JSON) |
| `catalogue_calc_rule` | Sonnet 4 | Génération règle de calcul (explication + JSON) |
| `calculateur_description` | Haiku | Génération description client de pièce |
| `import_components` | Sonnet 4 | Extraction composants fournisseur (multimodal) |
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

Chaque prompt AI peut être overridé via `app_config` (12 clés) :
`ai_prompt_estimateur`, `ai_prompt_catalogue_import`, `ai_prompt_contacts`, `ai_prompt_fiche_optimize`, `ai_prompt_fiche_translate_fr_en`, `ai_prompt_fiche_translate_en_fr`, `ai_prompt_client_text_catalogue`, `ai_prompt_json_catalogue`, `ai_prompt_pres_rule`, `ai_prompt_calc_rule`, `ai_prompt_description_calculateur`, `ai_prompt_approval_review`

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
| Catégories de dépense | `expense_categories` | 24 catégories avec markup, waste, templates |
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

- `room_items.line_total` : `qty × unit_price × (1 + markup/100)` — **ne pas écrire dessus**

### 11.3 Séquences

| Séquence | Usage | Format |
|----------|-------|--------|
| `project_code_seq` | Codes projet auto | EP001, EP002... |
| `catalogue_code_seq` | Codes catalogue auto | ST-0001, ST-0002... |
| `submission_number_seq` | Numéros soumission auto | 100, 101... |

### 11.4 Triggers

| Trigger | Table | Action | Description |
|---------|-------|--------|-------------|
| `trg_project_auto_code` | projects (INSERT) | `generate_project_code()` | Auto-génère code + nom |
| `trg_project_name_on_city` | projects (UPDATE) | `update_project_name_on_city()` | Recalcule nom quand ville change |
| `trg_catalogue_auto_code` | catalogue_items (INSERT) | `generate_catalogue_code()` | Auto-génère ST-XXXX |
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

### 12.2 ai-assistant/index.ts (~757 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (non-streaming)
- **Max tokens** : 4096
- **Prompt dynamique** : System prompt enrichi avec contexte projet complet (taux, dépenses, DM, rooms, items, catalogue, learnings)
- **2 modes** : `ai_prompt_estimateur` (calculateur) et `ai_prompt_approval_review` (approbation)
- **7 tools** définis avec schémas JSON
- **`save_learning`** exécuté côté serveur (INSERT direct dans `ai_learnings`)
- **Boucle tool** : Si la réponse contient `save_learning`, exécute et relance pour réponse finale

### 12.3 translate/index.ts (~527 lignes)

- **Modèles** : Haiku 4.5 (texte), Sonnet 4 (JSON)
- **11 actions** couvrant traduction, optimisation, génération JSON
- **Prefill assistant** : `"{"` pour forcer output JSON
- **Multi-texte** : Concaténation avec `===SEPARATOR===`
- **Multimodal** : Support images base64 pour `import_components`
- **Retry** : Backoff exponentiel (1s → 8s) sur 429/529, max 3 retries

### 12.4 catalogue-import/index.ts (~581 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (SSE streaming)
- **8 tools** : CRUD catalogue + analytics + audit + régénération
- **Contexte dynamique** : Stats catalogue, catégories, codes existants, article ouvert, usage
- **Streaming** : TransformStream relay des événements SSE Anthropic

### 12.5 contacts-import/index.ts (~493 lignes)

- **Modèle** : `claude-sonnet-4-5-20250929` (SSE streaming)
- **10 tools** : CRUD contacts/companies + liaison + filtres + learning
- **Contexte dynamique** : Counts contacts/companies, types configurés, learnings

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

*Fin du manuel technique. Ce document couvre l'intégralité de l'architecture, des systèmes et des flux de données de la plateforme Scopewright/Stele.*
