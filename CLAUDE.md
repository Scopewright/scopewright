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
- `override_children` : empêche la duplication de matériaux cascade entre niveaux
- Quantités calculées par unité puis multipliées par `rootQty` (quantité du FAB racine)
- Dimensions propagées depuis le FAB racine à toute profondeur
- Guards : `_cascadeRunning` (re-entrance), `_isLoadingSubmission` (chargement), debounce 400ms

**Résolution échouée** : quand `$default:` ou `$match:` ne trouve aucun article valide :
- **Pas de ligne enfant créée** — la règle est simplement sautée (`continue`)
- **Toast actionnable** affiché 6s : identifie le parent, la cible échouée, et dit exactement quel DM configurer
- **Console warn** avec détail technique (target, groupId, DM disponibles)
- `getDefaultMaterialKeywords` n'a **pas de fallback "first-available"** — si aucun DM ne correspond à la catégorie, retourne null (évite de sélectionner un article non pertinent)

Détails complets : `docs/TECHNICAL_MANUAL.md` §3

### Matériaux par défaut (DM)

**Room-level uniquement** (`roomDM[groupId]`). Le niveau soumission a été retiré.
- `getDefaultMaterialsForGroup(groupId)` retourne `roomDM[groupId]` ou `[]`
- `reprocessDefaultCascades(changedGroup, scopeGroupId)` — re-cascade quand un DM change (scopeGroupId obligatoire)
- Cache choix : `dmChoiceCache[groupId + ':' + typeName]`
- "Copier de…" : copie depuis une autre pièce uniquement (pas de template soumission)

### Workflow de soumission

Machine à états : `draft → pending_internal ↔ returned → approved_internal → sent_client → accepted`
- Auto-approbation : utilisateurs avec `can_approve_quotes` → draft directement à `approved_internal`
- Bypass : utilisateurs avec `can_bypass_approval` → draft à `sent_client`
- Verrouillage via `setEditable(false)`, déverrouillage audité dans `submission_unlock_logs`
- Snapshots HTML uploadés dans Storage à chaque transition
- Détails complets : `docs/TECHNICAL_MANUAL.md` §5

### Système de permissions (13 permissions, 6 rôles)

`app_config.permissions` (matrice rôle × permission) + `app_config.user_roles` (email → rôle).
Ou via tables DB `roles` + `user_roles`.
**IMPORTANT** : Toutes les vérifications sont **côté client uniquement** (`checkPageAccess()`). La sécurité réelle repose sur les RLS policies Supabase.

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
- `docs/AUDIT_REPORT.md` — Rapport d'audit : 15 problèmes de sécurité, 15 bugs, 13 risques architecturaux, 27 recommandations priorisées
- `ARCHITECTURE.md` — Vue d'ensemble architecturale (legacy, remplacé par TECHNICAL_MANUAL)
- `CHANGELOG.md` — Historique des modifications datées
- `sql/` — Fichiers de migration SQL à exécuter manuellement dans Supabase SQL Editor
