# CLAUDE.md — Instructions pour Claude Code

> Ce fichier est lu automatiquement par Claude Code à l'ouverture du projet.

## Architecture du projet

Scopewright est une application web pour l'estimation de cuisines et meubles sur mesure.

- **Pas de build system** — Chaque page est un fichier HTML autonome avec CSS + JS inline
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Déploiement** : Netlify auto-deploy depuis GitHub (branche `main`)
- **Pas de framework JS** — Vanilla JS uniquement, pas de React/Vue/Angular

## Fichiers clés

| Fichier | Rôle | Taille |
|---------|------|--------|
| `calculateur.html` | Application principale — projets, soumissions, meubles, lignes, AI chatbox, annotations | ~10K lignes |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — CRUD items, images, prix composé | ~2K lignes |
| `admin.html` | Administration — permissions, rôles, taux horaires, catégories, tags | ~1.2K lignes |
| `approbation.html` | Approbation soumissions + items proposés | ~1.1K lignes |
| `quote.html` | Vue client publique — soumission + acceptation + signature | ~1K lignes |
| `clients.html` | CRM — contacts, entreprises, communications | ~800 lignes |
| `fiche.html` | Fiches de vente produits | ~1.2K lignes |
| `supabase/functions/ai-assistant/index.ts` | Edge Function AI — Claude Sonnet 4.5, 6 outils | ~400 lignes |
| `supabase/functions/translate/index.ts` | Edge Function traduction — Claude Haiku, 3 modes | ~200 lignes |
| `google_apps_script.gs` | Envoi email estimation (GAS) | ~250 lignes |

## Conventions de code

- **Langage** : HTML + CSS + JavaScript vanilla (ES6+ ok, mais pas de modules)
- **Variables** : `var` pour scope fonction (code legacy), `let`/`const` pour nouveau code
- **Nommage** : camelCase pour fonctions/variables, UPPER_SNAKE pour constantes
- **CSS** : Variables CSS (`--stele-black: #0A0203`, `--stele-green: #4b6050`, `--stele-gray: #C8C8C8`)
- **Supabase** : Toujours utiliser `authenticatedFetch()` pour les requêtes (gère le refresh token 401)
- **Sécurité** : Toujours appliquer `escapeHtml()` / `escapeAttr()` pour les données utilisateur dans innerHTML
- **IDs DOM** : Pattern `${groupId}-rows`, `${groupId}-total`, `${rowId}-unit-price` etc.
- **Maps DOM↔DB** : `roomMap[groupDomId] = supabaseRoomUUID`, `itemMap[rowDomId] = supabaseItemUUID`

## Comment fonctionne le chatbox AI

1. **Client** (`calculateur.html`) : drawer latéral droit, `collectAiContext()` assemble le contexte projet
2. **Edge Function** (`ai-assistant/index.ts`) : reçoit messages + contexte, construit le system prompt dynamique, appelle Anthropic API avec 6 outils
3. **Mode simulation** : l'AI propose les modifications en texte, l'utilisateur confirme explicitement avant exécution
4. **Exécution côté client** : `executeAiTool()` applique les modifications dans le DOM + sauvegarde Supabase
5. **Persistance** : messages sauvés dans table `chat_messages` par soumission

## Edge Functions — déploiement

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

## Edge Functions — Authentification

Les 4 Edge Functions sont déployées avec `--no-verify-jwt` (la vérification
native du gateway Supabase retournait "Invalid JWT" sur des tokens valides).

La vérification JWT est effectuée manuellement dans chaque fonction via le
module partagé `_shared/auth.ts` qui utilise la bibliothèque `jose` pour :
- Valider la signature cryptographique HS256 avec `JWT_SECRET`
- Vérifier l'expiration (avec tolérance de 30s)
- Extraire le userId du claim `sub`

Prérequis : le secret `JWT_SECRET` doit être configuré dans les
secrets des Edge Functions (Dashboard > Settings > API > JWT Secret, puis
`npx supabase secrets set JWT_SECRET="..."`).

Le client Supabase est créé séparément avec le token brut pour que le RLS
fonctionne normalement.

## Ne pas toucher

- `landing-page/` — Projet indépendant, ne pas modifier
- `dashboard.html`, `soumission.html` — Prototypes legacy, pas de backend
- `*.ps1`, `*.xlsx`, `*.pdf` — Fichiers locaux, exclus de Git
- Fichiers dans `.gitignore` — Le projet utilise un whitelist pattern (default-deny)

## Tables Supabase principales

- `projects` → `submissions` → `project_rooms` → `room_items` (hiérarchie principale)
- `room_media` — images des meubles (Storage bucket `room-images`)
- `submission_plans` — plans PDF (Storage bucket `submission-plans`)
- `chat_messages` — conversations AI par soumission
- `catalogue_items` — produits du catalogue (PK = code texte ex: `BUD-001`)
- `app_config` — configuration clé-valeur (permissions, taux_horaires, expense_categories, tag_prefixes...)
- `room_items.line_total` est une **colonne générée PostgreSQL** — ne pas essayer de l'écrire directement

## RLS (Row Level Security)

- `projects` : `auth.uid() = user_id`
- Tables enfants (submissions, rooms, items, media, chat) : via JOIN chain jusqu'à `projects.user_id`
- `app_config` : lecture authentifiée, **pas de protection écriture** (point d'attention)
- Tables d'audit (`submission_unlock_logs`) : INSERT + SELECT only (immuable)

## Points d'attention

- `authenticatedFetch()` est **dupliqué** dans chaque fichier HTML — modifier partout si changement
- Les vérifications de permissions sont **côté client uniquement** (contournable via DevTools)
- Google Apps Script nécessite un **redéploiement manuel** après modification du `.gs`
- Les images sont compressées client-side (canvas resize + JPEG 0.7) avant upload
- `room_items.line_total` est une colonne PostgreSQL GENERATED — ne pas écrire dessus

## Documentation

- `ARCHITECTURE.md` — Documentation technique complète (tables, workflow, Edge Functions, etc.)
- `CHANGELOG.md` — Historique des modifications datées
- `sql/` — Fichiers de migration SQL à exécuter manuellement dans Supabase SQL Editor
