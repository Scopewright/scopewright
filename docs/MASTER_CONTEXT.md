# MASTER_CONTEXT.md — Scopewright System Knowledge (AI-optimized)

> Ce document est optimisé pour être lu par une AI. Pas de prose — sections courtes, labels clairs, règles explicites.
> Dernière mise à jour : 2026-03-11

---

## 1. IDENTITÉ SYSTÈME

- **Nom** : Scopewright
- **Domaine** : Estimation cuisines et meubles sur mesure (ébénisterie)
- **Marque client** : Stele (pages client-facing)
- **Stack** : HTML + CSS + JS vanilla (pas de framework, pas de build system)
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI** : Anthropic API (Claude Sonnet 4.5, Haiku 4.5, Sonnet 4)
- **Déploiement** : Netlify auto-deploy depuis GitHub (`main` branch)
- **Email** : Google Apps Script (redéploiement manuel requis)
- **Repo** : Scopewright/scopewright

---

## 2. FICHIERS PRINCIPAUX

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `calculateur.html` | ~21 700 | App principale — projets, pipeline, soumissions, cascade, DM, AI chat |
| `catalogue_prix_stele_complet.html` | ~8 500 | Catalogue prix — CRUD articles, images, AI import |
| `admin.html` | ~4 200 | Administration — 6 volets sidebar, prompts AI, Agent Maître |
| `approbation.html` | ~2 200 | Approbation soumissions, AI review |
| `clients.html` | ~2 280 | CRM — contacts, entreprises, AI import |
| `quote.html` | ~2 080 | Vue client publique — soumission + acceptation + signature |
| `fiche.html` | ~1 120 | Fiches produits client |
| `app.html` | ~685 | Tableau de bord navigation |
| `login.html` | ~247 | Auth Supabase |

### Fichiers partagés (`shared/`)

| Fichier | Fonctions exportées |
|---------|-------------------|
| `shared/auth.js` | `SUPABASE_URL`, `SUPABASE_KEY`, `authenticatedFetch()`, `refreshAccessToken()` |
| `shared/utils.js` | `escapeHtml()`, `escapeAttr()` |
| `shared/pricing.js` | `computeComposedPrice()`, `computeCatItemPrice()` |
| `shared/presentation-client.js` | Texte, descriptions, clauses, images, snapshot, status UI (~730 lignes) |
| `shared/pdf-export.js` | `exportSubmissionPdf()` via PDFShift API |

---

## 3. TABLES SUPABASE (HIÉRARCHIE)

```
projects (user_id → RLS)
  ├── submissions (status machine: draft→pending→approved→sent→accepted)
  │     ├── project_rooms (pièces)
  │     │     ├── room_items (lignes calcul, parent_item_id pour cascade)
  │     │     └── room_media (images + annotations JSONB)
  │     ├── project_versions (snapshots)
  │     ├── submission_reviews (historique approbation, immuable)
  │     └── public_quote_tokens (liens client, PAS d'expiration — SEC-05)
  ├── project_follows (★ par utilisateur)
  └── project_contacts (liaison contacts)

catalogue_items (id TEXT PK auto ST-XXXX, RLS trop permissif — SEC-01)
  ├── catalogue_item_components
  └── item_media

contacts ─── contact_companies ─── companies
  └── communications

app_config (key TEXT PK, value JSONB)
chat_messages (par soumission/contexte)
ai_learnings (règles organisationnelles, RLS trop permissif — RI-08)
employees, roles, user_roles, user_profiles
quote_clauses, submission_unlock_logs
catalogue_change_log (audit AI)
```

### Colonnes critiques

- `app_config.value` = **JSONB**. Strings: `to_jsonb('text'::text)`. Objects: `'...'::jsonb`
- `room_items.line_total` = **colonne générée** (ne pas écrire dessus)
- `catalogue_items.id` = TEXT PK auto-généré par trigger `trg_catalogue_auto_code`
- `room_items.cascade_suppressed` = JSONB array d'IDs supprimés manuellement
- `room_items.labor_override/material_override/price_override` = overrides par ligne

---

## 4. RLS — RÈGLES ABSOLUES

| Table | Policy | Risque |
|-------|--------|--------|
| `projects` | `auth.uid() = user_id` | OK |
| `submissions/rooms/items/media` | JOIN chain → `projects.user_id` | OK |
| `app_config` | Auth lecture + anon partiel + admin écriture via `is_admin()` | Fragile |
| `catalogue_items` | Tout authentifié : full CRUD | **TROP PERMISSIF** |
| `ai_learnings` | Tout authentifié : full CRUD | **TROP PERMISSIF** |
| `app_config` anon | Policy `anon_read_branding` — 16 clés listées explicitement | Doit être mise à jour quand on ajoute des clés |

---

## 5. EDGE FUNCTIONS (5)

| Fonction | Modèle AI | Streaming | Tools | Rôle |
|----------|-----------|-----------|-------|------|
| `ai-assistant` | Sonnet 4.5 | Non | 9 | Assistant estimateur + approbation + catalogue |
| `ai-master` | Sonnet 4.5 | Non | 0 | Agent Maître (admin, conseil architecture, read-only) |
| `translate` | Haiku 4.5 / Sonnet 4 | Non | 0 (13 actions) | Traductions, génération règles, descriptions |
| `catalogue-import` | Sonnet 4.5 | SSE | 8 | Import articles catalogue |
| `contacts-import` | Sonnet 4.5 | SSE | 10 | Import contacts CRM |
| `pdf-export` | — | Non | — | Export PDF via PDFShift API |

### Auth commune

- `_shared/auth.ts` : JWT ES256 (JWKS) + fallback HS256
- CORS : `scopewright.ca` + `www.scopewright.ca`
- Déployées avec `--no-verify-jwt` (vérification manuelle)

### Déploiement

```bash
npx supabase functions deploy <nom> --no-verify-jwt
```

---

## 6. AGENTS AI — INVENTAIRE

### Agent Estimateur (`ai-assistant`, prompt_key: `ai_prompt_estimateur`)
- **Rôle** : Assistant pour estimateurs — rentabilité, articles, descriptions, ajustements
- **Modèle** : Sonnet 4.5. **Tools** : 9 (analyze_rentability, write_description, add/remove/modify_item, suggest_items, compare_versions, update_catalogue_item, update_submission_line)
- **Limites** : Mode simulation obligatoire (propose → confirme → exécute). `update_submission_line` et `remove_item` jamais auto-exécutés
- **Contexte** : Projet, soumission, pièces, articles, DM, taux horaires, dépenses, catalogue résumé, logs cascade (conditionnel)

### Agent Approbation (`ai-assistant`, prompt_key: `ai_prompt_approval_review`)
- **Rôle** : Analyse nouveaux articles proposés par estimateurs (4 axes : comparaison interne, industrie, cohérence, verdict)
- **Modèle** : Sonnet 4.5. **Tools** : mêmes 9 mais contexte réduit
- **Limites** : Pas de contexte projet riche, analyse catalogue uniquement

### Agent Catalogue (`catalogue-import`)
- **Rôle** : Import d'articles catalogue depuis texte/fichier fournisseur
- **Modèle** : Sonnet 4.5. **Tools** : 8 (create/update articles, components). **Streaming** : SSE
- **Limites** : Bug — n'injecte pas les learnings

### Agent Contacts (`contacts-import`)
- **Rôle** : Import contacts CRM depuis texte/fichier
- **Modèle** : Sonnet 4.5. **Tools** : 10 (create/update contacts, companies, communications). **Streaming** : SSE
- **Limites** : Confirmation par boutons Apply/Ignore uniquement (pas de double confirmation texte)

### Agent Maître (`ai-master`, prompt_key: `ai_prompt_master`)
- **Rôle** : Conseil architecture, détection incohérences, audit système, recommandations
- **Modèle** : Sonnet 4.5. **Tools** : 0 (lecture seule, consultatif)
- **Limites** : Admin only. Pas de modifications. Session-only (pas de persistance messages)

### Actions Translate (`translate`, 13 actions)
- **Rôle** : Génération règles (calc_rule, pres_rule, labor_modifiers, expense_pres_rule), traductions (FR↔EN), descriptions, instructions, composants
- **Modèle** : Haiku 4.5 (descriptions, traductions, instructions) ou Sonnet 4 (règles JSON)
- **Limites** : Pas de tools, réponse directe

---

## 7. PROMPTS AI — 19 CLÉS `app_config`

| Clé | Edge Function | Modèle | Admin visible |
|-----|---------------|--------|---------------|
| `ai_prompt_estimateur` | ai-assistant | Sonnet 4.5 | Oui |
| `ai_prompt_approval_review` | ai-assistant | Sonnet 4.5 | Oui |
| `ai_prompt_master` | ai-master | Sonnet 4.5 | Oui |
| `ai_prompt_catalogue_import` | catalogue-import | Sonnet 4.5 | Oui |
| `ai_prompt_contacts` | contacts-import | Sonnet 4.5 | Oui |
| `ai_prompt_fiche_optimize` | translate | Haiku 4.5 | Oui |
| `ai_prompt_fiche_translate_fr_en` | translate | Haiku 4.5 | Oui |
| `ai_prompt_fiche_translate_en_fr` | translate | Haiku 4.5 | Oui |
| `ai_prompt_client_text_catalogue` | translate | Haiku 4.5 | Oui |
| `ai_prompt_pres_rule` | translate | Sonnet 4 | Oui |
| `ai_prompt_calc_rule` | translate | Sonnet 4 | Oui |
| `ai_prompt_labor_modifiers` | translate | Sonnet 4 | Oui |
| `ai_prompt_expense_pres_rule` | translate | Sonnet 4 | Oui |
| `ai_prompt_description_calculateur` | translate | Haiku 4.5 | Oui |
| `ai_prompt_import_components` | translate | Sonnet 4 | Oui |
| `ai_prompt_instruction_catalogue` | translate | Haiku 4.5 | Oui |
| `ai_prompt_explication_catalogue` | translate | Haiku 4.5 | Non (manquant) |
| `ai_prompt_json_catalogue` | translate | Haiku 4.5 | Non (manquant) |
| `ai_prompt_approval_suggest` | translate | Sonnet 4 | Non (manquant) |

### Clés `app_config` non-AI

| Clé | Type | Rôle |
|-----|------|------|
| `description_format_rules` | TEXT | Règles format descriptions client AI |
| `why_title/why_text/why_image_url` | TEXT | Page "Pourquoi" (quote.html) |
| `project_steps` | JSONB array | 8 étapes projet (quote.html) |
| `category_group_mapping` | JSONB object | Mapping catégories catalogue → groupes DM |
| `permissions` | JSONB | Matrice rôle × permission (13 permissions, 6 rôles) |
| `user_roles` | JSONB | email → rôle |
| `taux_horaires` | JSONB array | Départements MO + taux + salaire + frais fixes |
| `expense_categories` | JSONB array | Catégories dépenses + markup + waste + templates |
| `catalogue_categories` | JSONB array | Catégories catalogue (auto-sync) |
| `media_tags` | JSONB array | Tags médias |
| `pipeline_statuses` | JSONB array | Statuts pipeline |
| `master_context` | TEXT | Ce document (sync depuis admin) |
| `master_claude_md` | TEXT | CLAUDE.md (sync depuis admin) |

---

## 8. SYSTÈMES PRINCIPAUX

### 8.1 Moteur cascade (`executeCascade`)
- Crée automatiquement lignes enfants depuis règles `cascade` d'un FAB parent
- Récursion max 3 niveaux. 3 types cibles : code direct, `$default:Type`, `$match:CATÉGORIE`
- Guards : `_cascadeRunning`, `_isLoadingSubmission`, debounce 400ms, `skipCascade`, `ask` completeness
- `materialCtx` propagé parent→enfant→petit-enfant, mis à jour par `$default:` après résolution
- `child_dims` : formules dimensionnelles. Multi-instance quand `child_dims` + qty > 1
- Persistance immédiate (pas de debounce). Enfants locked protégés. `cascade_suppressed` pour suppressions manuelles
- **NE PAS MODIFIER** sans rouler `node tests/cascade-engine.test.js` (282 assertions, 28 groupes)

### 8.2 Matériaux par défaut (DM)
- Room-level uniquement (`roomDM[groupId]`). `client_text` = identifiant primaire
- 6 groupes requis : Caisson, Panneaux, Tiroirs, Façades, Finition, Poignées
- 2 groupes cachés : Autre, Éclairage
- `reprocessDefaultCascades` re-cascade sur changement DM (avec guard + barre progression)

### 8.3 Prix composé
```
Prix = Σ(labor_minutes[dept]/60 × taux_horaire[dept])
     + Σ(material_costs[cat] × (1 + waste%/100) × (1 + markup%/100))
```
- `loss_override_pct` sur article remplace `waste` par catégorie
- Overrides par ligne : `price_override` > `labor_override`/`material_override` > catalogue

### 8.4 Barèmes (`labor_modifiers`)
- Ajustements automatiques basés sur dimensions
- First-match (défaut) ou cumulatif (`"cumulative": true`)
- `labor_factor`/`material_factor` (multiplicateurs) + `labor_minutes` (minutes additives)
- Évalué inline dans `updateRow()` à chaque changement de dims

### 8.5 Workflow soumission
- `draft → pending_internal ↔ returned → approved_internal → sent_client → accepted → invoiced`
- Auto-approbation : `can_approve_quotes`. Bypass : `can_bypass_approval`
- Verrouillage `setEditable(false)`, snapshots HTML à chaque transition
- Suppression projet bloquée si soumission `accepted` ou `invoiced`

### 8.6 Export PDF
- PDFShift API (Chromium server-side) via Edge Function `pdf-export`
- Format landscape Letter, marges 0, `use_print: true`
- `@media print` dans SNAPSHOT_CSS gère pagination + sizing

### 8.7 Pipeline commercial
- 3 vues : Table, Cartes, Soumissions
- `project_code` auto-généré par trigger DB
- `amount_override` : priorité affichage (rouge)

---

## 9. CONVENTIONS DE CODE — RÈGLES ABSOLUES

1. **Jamais de `<select>` natif** → Custom dropdown (pattern Linear/Notion)
2. **Jamais de `<input type="date">`** → Custom date picker (pattern Apple/Linear)
3. **Toujours `escapeHtml()`/`escapeAttr()`** pour données utilisateur dans innerHTML
4. **Toujours `authenticatedFetch()`** pour requêtes Supabase
5. **`var` dans shared/** (évite redéclaration entre `<script>` tags), `let`/`const` ailleurs
6. **camelCase** fonctions/variables, **UPPER_SNAKE** constantes
7. **`skipCascade: true`** sur tout `updateRow()` qui n'est PAS un changement de dims/article
8. **Seuil 2000 lignes JS** → extraire dans `shared/`
9. **Fonctions partagées obligatoires** — jamais de copier-coller entre fichiers
10. **Design tokens** : `scopewright-tokens.css` (navy `#0B1220`). Client-facing : Stele colors (`#0A0203`, `#4b6050`)

---

## 10. PERMISSIONS (13 × 6 rôles)

| Permission | Description |
|-----------|-------------|
| `view_projects` | Voir les projets |
| `create_projects` | Créer des projets |
| `edit_projects` | Modifier les projets |
| `delete_projects` | Supprimer les projets |
| `view_submissions` | Voir les soumissions |
| `edit_submissions` | Modifier les soumissions |
| `can_approve_quotes` | Approuver sans workflow |
| `can_bypass_approval` | Bypass approbation → envoi direct |
| `edit_catalogue` | Modifier le catalogue |
| `edit_minutes` | Modifier minutes MO |
| `edit_materials` | Modifier coûts matériaux |
| `view_rentability` | Voir la rentabilité |
| `admin` | Accès admin complet |

**IMPORTANT** : Vérifications **côté client uniquement** — contournable via DevTools (RC-02)

---

## 11. RISQUES ACTIFS CRITIQUES

| ID | Risque | Impact |
|----|--------|--------|
| SEC-01 | `catalogue_items` RLS trop permissif | Tout user peut DELETE articles |
| SEC-05 | Tokens publics sans expiration | Lien compromis reste valide indéfiniment |
| SEC-08 | Pas de validation schéma Edge Functions | Payload arbitraire possible |
| RC-02 | Permissions client-side uniquement | Bypass via DevTools |
| ARCH-01 | `calculateur.html` ~21 700 lignes | Maintenabilité critique |
| ARCH-10 | Supabase single backend | Pas d'abstraction, vendor lock-in |
| BUG-04 | Prix composé vs manuel ambigu | Confusion source de vérité |

---

## 12. BUGS ACTIFS (non corrigés)

| ID | Sévérité | Description |
|----|----------|-------------|
| BUG-01 | MOYEN | Race condition polling timeout cascade rapide |
| BUG-02 | MOYEN | Race condition uploads médias séquentiels |
| BUG-03 | FAIBLE | `_pendingCascadeRowId` pas FIFO |
| BUG-04 | IMPORTANT | Prix composé vs prix manuel — source de vérité ambiguë |
| BUG-05 | MOYEN | `approved_total` override après modification |
| BUG-06 | FAIBLE | Numéros de page hardcodés quote.html |
| BUG-07 | FAIBLE | `saveComponents` delete-all sans transaction |
| BUG-09 | FAIBLE | `dmChoiceCache` persiste entre pièces |
| BUG-10 | FAIBLE | Piège QTY × auto-multiplication |
| BUG-11 | MOYEN | Orphelins Storage non nettoyés |
| BUG-12 | FAIBLE | Orphelins `cascadeParentMap` après suppression parent |
| BUG-13 | FAIBLE | Deux Levenshtein distinctes |
| BUG-14 | FAIBLE | Signature canvas perdue au resize |
| BUG-15 | FAIBLE | Bouton fullscreen en iframe sans allowfullscreen |

---

## 13. DÉCISIONS ARCHITECTURALES CLÉS

| ID | Décision | Raison |
|----|----------|--------|
| DEC-001 | DM identifié par `client_text` (pas `catalogue_item_id`) | Un matériau client ≠ un article technique |
| DEC-005 | Save immédiat dans `executeCascade` | Debounce global perdait les enfants |
| DEC-008 | Pas de refactor prématuré du monolithe | Acceptable à MVP |
| DEC-020 | Override par ligne sans modifier catalogue | Flexibilité estimateur |
| DEC-024 | `cascade_suppressed` mémoire de suppression | Empêcher regénération |
| DEC-027 | Extraction `shared/presentation-client.js` | Réutilisation calculateur↔quote |
| DEC-031 | PDFShift server-side (remplace html2pdf.js) | Rendu fidèle Chromium |

---

## 14. CHEMINS DE RENDU SOUMISSION

| Chemin | Fichier | Source données | Live/Figé |
|--------|---------|----------------|-----------|
| Aperçu | calculateur.html `renderPreview()` | DOM + mémoire JS | Live |
| Présentation | quote.html (iframe) `renderQuote()` | RPC `get_public_quote` | Live/snapshot |
| Lien client | quote.html (direct) | Même RPC | Live/snapshot |
| Snapshot | calculateur.html `uploadSnapshot()` | HTML de renderPreview | Figé |
| Email | google_apps_script.gs | Paramètres client | Figé |
| PDF | shared/pdf-export.js | HTML + PDFShift | Figé |

---

## 15. TESTS AUTOMATISÉS

- **Fichier** : `tests/cascade-engine.test.js` — 282 assertions, 28 groupes
- **Runner** : Inline, 0 dépendances (`node tests/cascade-engine.test.js`)
- **Helpers** : `tests/cascade-helpers.js` — 19 fonctions pures copiées de calculateur.html
- **Fixtures** : `tests/fixtures/catalogue.js` (21 articles), `tests/fixtures/room-dm.js` (5 configs DM)
- **Synchronisation** : copies manuelles — mettre à jour si logique source change
- **RÈGLE** : Rouler AVANT tout push touchant le moteur cascade

---

## 16. INFRASTRUCTURE SYNC (app_config master_*)

| Clé app_config | Source | Rôle |
|----------------|--------|------|
| `master_context` | `docs/MASTER_CONTEXT.md` | Ce document — connaissance système |
| `master_claude_md` | `CLAUDE.md` | Instructions projet + conventions |

Synchronisation déclenchée depuis admin.html volet "Agent Maître" (fetch fichiers statiques → PATCH app_config).
