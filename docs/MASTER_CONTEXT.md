# MASTER_CONTEXT.md — Scopewright System Knowledge (AI-optimized)

> Ce document est optimisé pour être lu par une AI. Pas de prose — sections courtes, labels clairs, règles explicites.
> Dernière mise à jour : 2026-03-16

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
| `calculateur.html` | ~23 150 | App principale — projets, pipeline, soumissions, cascade, DM, AI chat |
| `catalogue_prix_stele_complet.html` | ~8 720 | Catalogue prix — CRUD articles, images, AI import, composantes, coupes |
| `admin.html` | ~4 040 | Administration — 6 volets sidebar, prompts AI, Agent Maître |
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
| `shared/master-agent.js` | Agent Maître drawer global — FAB, chat UI, tool approval, doc sync |
| `shared/sanity-checks.js` | `runSanityChecks()` — checks déterministes (no AI) |

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

submission_plans (plans PDF — project-level)

catalogue_items (id TEXT PK auto ST-XXXX, RLS trop permissif — SEC-01)
  ├── catalogue_item_components
  └── item_media

composantes (regroupements propriétés constructives par type DM)
  ├── composante_groupe_items (liaison groupe → composantes membres)
  └── referenced by room_items.composante_id

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
- `room_items.composante_id` = UUID FK vers `composantes` (nullable, ON DELETE SET NULL)

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

## 5. EDGE FUNCTIONS (6)

| Fonction | Modèle AI | Streaming | Tools | Rôle |
|----------|-----------|-----------|-------|------|
| `ai-assistant` | Sonnet 4.5 | Non | 9 | Assistant estimateur + approbation + catalogue |
| `ai-master` | Sonnet 4.5 | Non | 10 | Agent Maître global (4 read-only + 6 write, section-based context, images multimodal) |
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
- **Rôle** : Conseil architecture, gestion prompts/learnings, audit système, recommandations
- **Modèle** : Sonnet 4.5. **Tools** : 10 — 4 read-only auto-executed server-side (`list_learnings`, `read_prompt`, `list_all_prompts`, `get_catalogue_item`), 6 write tools with client-side approval (`create_learning`, `update_learning`, `delete_learning`, `update_prompt_section` — 3 niveaux de matching (exact, regex, fuzzy) + mode `insert_after`, `log_prompt_change`, `update_catalogue_item` — modifie `calculation_rule_ai`, `instruction`, `loss_override_pct`, `labor_modifiers` avec audit trail)
- **`list_all_prompts`** : retourne métadonnées uniquement (clé, label, edge_function, modèle, char_count, has_override) — pas le contenu. Utiliser `read_prompt` pour le contenu complet
- **`get_catalogue_item`** : recherche par code exact (`code: "ST-0042"`) ou texte (`search: "placage"`) sur description/client_text. Max 5 résultats. Retourne id, description, client_text, item_type, category, labor_modifiers, calculation_rule_ai, instruction, labor_minutes, material_costs, is_default, dims_config, loss_override_pct
- **Contexte** : Section-based — MASTER_CONTEXT.md découpé par `## N.` headers, keyword matching sélectionne les sections pertinentes. `master_claude_md` + learnings toujours inclus. Fraîcheur vérifiée via `master_context_synced_at` (alerte si >24h)
- **Prompt rules** : section "LIMITES DE MES OUTILS" dans `DEFAULT_MASTER_PROMPT` — interdit modifications code, SQL, app_config (hors prompts), déploiements. Simulation obligatoire avant changement
- **UI** : `shared/master-agent.js` — drawer global (FAB 30px/0.28 au repos, 44px/1.0 hover, 200ms transition). Session-only (pas de persistance messages). Ouverture silencieuse (pas d'auto-question). **Images** : paste + drag-drop, compressées JPEG 0.90 max 3200px, envoyées en base64 multimodal via `images[]` dans le body
- **Sanity checks** : `shared/sanity-checks.js` — 4 checks déterministes (presRuleKeys, descriptionsNotEmpty, totalNotZero, cascadeOrphans). Badge sur FAB. Hooks dans `openSubmitModal()`
- **Prompt changelog** : `app_config.prompt_change_log` JSONB array `[{key, old_text, new_text, reason, timestamp}]`
- **Sync timestamp** : `app_config.master_context_synced_at` — écrit par `masterAgentSyncDocs()`, lu par `ai-master` pour injection fraîcheur. Migration : `sql/master_sync_timestamp.sql`

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
| `coupe_types` | JSONB array | Types de coupe placage `[{code, label, facteur, facteur_defaut, facteurs}]` |
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
- **NE PAS MODIFIER** sans rouler `node tests/cascade-engine.test.js` (372 assertions, 39 groupes)

### 8.2 Matériaux par défaut (DM)
- Room-level uniquement (`roomDM[groupId]`). `client_text` = identifiant primaire
- 5 groupes requis : Caisson, Panneaux, Tiroirs, Façades, Poignées (Finition retiré)
- 2 groupes cachés : Autre, Éclairage
- `reprocessDefaultCascades` re-cascade sur changement DM (avec guard + barre progression)
- **Bouton Recalculer (#218)** : barre dirty en haut du panneau DM quand un DM est modifié. `_dmDirtyTypes` trace les types changés. Bouton déclenche `recalculateDmCascades` → `reprocessDefaultCascades` par type. Auto-clear après reprocess
- **Panneau DM navy** : fond `#0B1220`, texte `rgba(255,255,255,*)`, zéro bordure d'input visible, `border-radius: 4px 4px 0 0`, zéro gap vers `.calc-header`

#### Enrichissement DM (#208)
- 3 groupes enrichis : **Caisson** (matériau + coupe + bande_chant + finition), **Façades** (matériau + style + coupe + bande_chant + finition + bois_brut), **Panneaux** (idem Façades)
- Sous-champs catalogue (`materiau`, `bande_chant`, `finition`, `bois_brut`) : `{ catalogue_item_id, client_text }`. Texte libre : `style`, `coupe` (dropdown `COUPE_TYPES`)
- Types enrichis : champ principal **readonly**, construit automatiquement depuis sous-champs via `_rebuildDmClientText` (format `"{panneau} {coupe}"`)
- Moteur cascade Tier 0 : `getEnrichedDmField(dmEntry, expenseCat)` → résolution directe depuis sous-champs enrichis, sans modale

#### Composantes (#209)
- Table `composantes` : UUID PK, code `COMP-XXX` auto-généré, `dm_type`, `nom`, `materiau_*`, `bande_chant_*`, `finition_*`, `bois_brut_*`, `style`, `coupe`, `is_active`, soft delete
- **Drawer CRUD** : `catalogue_prix_stele_complet.html` — bouton "Composantes", filtre par type DM, modale création/édition
- **Phase 1B** : bookmark SVG par ligne DM (stroke → filled persistant quand composante enregistrée). `buildComposanteName(dmEntry)` = nom auto. "Enregistrer tout" pour composante groupe
- **Phase 1C** : dropdown composantes dans le panneau DM (`.dm-comp-select`), filtré par `dm_type`. `applyComposanteToDm` applique tous les champs
- **Phase 1D** : `filterDmByComposante(dmEntries, composanteId)` — résolution cascade filtrée par `materialCtx.composante_id` (type-aware : skip si dm_type mismatch #219). Propagé dans toute la chaîne parent→enfant→petit-enfant
- **#215** : `resolveByComposante` composante-first — résolution directe depuis les champs composante avant fuzzy/modales. Cross-type lookup. `resolveByComposante` avec `client_text` seul → lookup `CATALOGUE_DATA` par texte exact
- **#219b** : per-rule `composante_id` — chaque `$default:X` override `materialCtx.composante_id` avec le DM ciblé (guard : les deux types doivent être non-vides ET différents). **Tier 0 enriched dans `$default:`** : `getEnrichedDmField` consulté avant le choix DM entry — résolution directe via sous-champ materiau (symétrique avec `resolveMatchTarget`)
- **Guard stale data** (DEC-052/055) : au chargement, détecte `materiau.client_text` corrompu (contient `|` ou > 60 chars) → lookup catalogue pour récupérer le texte brut, ou vide si ID absent. Puis rebuild `entry.client_text` + save DB
- `COMPOSANTES_DATA` : array global mis à jour en mémoire après chaque INSERT
- `room_items.composante_id` : UUID FK (nullable) — lien entre ligne article et composante

#### Groupes de composantes (#217)
- **Concept** : ensemble nommé de composantes (Caisson + Façades + Panneaux…) applicable d'un coup à une pièce. Code `GRP-XXX`
- **Table** : `composante_groupe_items` — liaison groupe→composantes (groupe_id, composante_id, ordre). RLS authentifié. Migration idempotent. Guard 404 : `loadComposanteGroupeItems` tolère la table absente sans affecter `COMPOSANTES_DATA`
- **Trigger** : `generate_composante_code()` génère `GRP-XXX` quand `dm_type = 'Groupe'`
- **`COMPOSANTES_GROUPE_ITEMS`** : objet global `{ groupe_id: [...] }` chargé au démarrage
- **Catalogue** : modale groupe sans champs matériaux, section membres (ajouter/retirer). Bouton "Nouveau groupe" séparé dans le drawer
- **Calculateur** : bouton "Groupe" dans le footer DM → modale choix → `applyGroupeToDm` (applique chaque composante membre au DM correspondant, reprocess cascade une seule fois)
- **Migration** : `sql/composante_groupes.sql`

#### Coupes de placage
- `app_config.coupe_types` : JSONB array `[{code, label, facteur, facteur_defaut, facteurs, notes}]`. `facteurs` = objet par essence `{chene_blanc: 1.10, noyer: 1.15, ...}`. Fallback `COUPE_TYPES_DEFAULT` (6 entrées)
- `COUPE_TYPES` : global chargé au démarrage (`loadCoupeTypes`)
- **Drawer CRUD** dans le catalogue : bouton "Coupes", modale 560px avec tableau facteurs par essence (9 essences)
- **Détection essence** (#219) : `_detectEssence(clientText)` — 9 essences (chêne blanc/rouge, noyer, érable, merisier, frêne, cerisier, pin noueux, acajou), keywords FR+EN, NFD normalized
- **Dropdown** dans panneau DM enrichi (champ `coupe`) et modale composante
- **Facteur prix** : `getCoupeFacteur(coupeLabel, articleClientText)` → essence → `facteurs[essence]` → `facteur_defaut` → `facteur` → 1.0. Appliqué aux catégories panneau/placage (`_isPlacageCategory` exclut bande/brut/finition). Intégré dans `getRowTotal`, `updateRow`, `computeRentabilityData`

### 8.3 Prix composé
```
Prix = Σ(labor_minutes[dept]/60 × taux_horaire[dept])
     + Σ(material_costs[cat] × coupe_factor × (1 + waste%/100) × (1 + markup%/100))
```
- `coupe_factor` appliqué uniquement aux catégories placage (`_isPlacageCategory` : contient "placage" ou = "panneau bois")
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
| ARCH-01 | `calculateur.html` ~23 150 lignes | Maintenabilité critique |
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

- **Fichier** : `tests/cascade-engine.test.js` — 372 assertions, 39 groupes
- **Runner** : Inline, 0 dépendances (`node tests/cascade-engine.test.js`)
- **Helpers** : `tests/cascade-helpers.js` — 21 fonctions pures copiées de calculateur.html
- **Fixtures** : `tests/fixtures/catalogue.js` (21 articles), `tests/fixtures/room-dm.js` (5 configs DM), `tests/fixtures/enriched-dm.js` (DM enrichis)
- **Synchronisation** : copies manuelles — mettre à jour si logique source change
- **RÈGLE** : Rouler AVANT tout push touchant le moteur cascade

---

## 16. INFRASTRUCTURE SYNC (app_config master_*)

| Clé app_config | Source | Rôle |
|----------------|--------|------|
| `master_context` | `docs/MASTER_CONTEXT.md` | Ce document — connaissance système |
| `master_claude_md` | `CLAUDE.md` | Instructions projet + conventions |
| `master_user_guide` | `docs/USER_GUIDE.md` | Guide utilisateur (section-based, keyword-matched) |

Synchronisation déclenchée depuis admin.html volet "Agent Maître" ou le drawer global (fetch fichiers statiques → PATCH app_config). 3 documents synchronisés.

---

## 17. CARTE COMPLÈTE ADMIN.HTML (6 volets)

### Volet 1 — Présentation

| Section | Clé `app_config` | Contenu |
|---------|-------------------|---------|
| Image de couverture | `cover_image` | URL image plein écran page couverture quote.html. JPEG/PNG paysage haute-résolution |
| Page Introduction | `intro_title`, `intro_text`, `intro_signature` | Titre, texte riche HTML, signature architecte. Aussi `intro_title_en`, `intro_text_en`, `intro_signature_en` pour EN |
| Page Pourquoi | `why_title`, `why_text`, `why_image_url` | Titre, texte HTML (placeholder `{designer}` interpolé), image. Aussi `why_title_en`, `why_text_en` pour EN |
| Étapes du projet | `project_steps` | JSONB array de 8 objets `[{title, description}]`. Affiché dans quote.html. Fallback `STEPS_I18N` hardcodé si absent |
| Format description client | `description_format_rules` | TEXT — règles de formatage obligatoires pour toutes les descriptions AI (injecté dans `ai-assistant` et `translate` action `description_calculateur`) |

### Volet 2 — Catalogue

| Section | Clé `app_config` | Contenu |
|---------|-------------------|---------|
| Catégories du catalogue | `catalogue_categories` | JSONB array — liste des catégories catalogue. Auto-sync avec les catégories distinctes des articles |
| Groupes matériaux | `category_group_mapping` | JSONB object `{catégorie: groupe_DM}` — mapping catégories catalogue → groupes DM (Caisson, Façades, Tiroirs, etc.) |
| Tags médias | `media_tags` | JSONB array — tags disponibles pour annoter les images/plans |
| Catégories de dépenses | `expense_categories` | JSONB array `[{name, markup_pct, waste_pct, calc_rule_template, pres_rule_template, presentation_rule}]` — chaque catégorie a : nom, % markup, % perte, template JSON règle calcul, template JSON règle présentation, et JSON présentation |
| Données de base | `taux_horaires` | JSONB array `[{department, rate, salary, fixed_cost}]` — 7 départements MO (Gestion/dessin, Coupe/edge, Assemblage, Machinage, Sablage, Peinture, Installation) + taux horaire, salaire, frais fixe |
| Nomenclature des tags | `tag_nomenclature` | JSONB array — préfixes tags plans (C=Caisson, P=Panneau, E=Étagère, PI=Île, F=Façade, A=Accessoire, PO=Poignée, EC=Éclairage, RM=Range-manteau) |

### Volet 3 — Workflow

| Section | Clé `app_config` | Contenu |
|---------|-------------------|---------|
| Types d'entreprise | `company_types` | JSONB array — types d'entreprise pour CRM |
| Rôles de contact | `contact_roles` | JSONB array — rôles possibles pour les contacts (architecte, entrepreneur, client, etc.) |
| Types de communication | `communication_types` | JSONB array — types de communication (appel, courriel, réunion, etc.) |
| Statuts du pipeline | `pipeline_statuses` | JSONB array `[{value, label, color}]` — statuts visuels pour le pipeline commercial |
| Sources de projet | `project_sources` | JSONB array — sources d'acquisition des projets |
| Types de projet | `project_types` | JSONB array — classification des projets (Résidentiel, Commercial, etc.) |

### Volet 4 — Équipe

| Section | Contenu |
|---------|---------|
| Permissions par rôle | Matrice 13 permissions × 6 rôles (clé `app_config.permissions`). Checkboxes par rôle. Vérification côté client uniquement |
| Gestion des rôles | CRUD rôles dans table `roles`. Modale ajout/modification. Un rôle peut être supprimé seulement s'il n'est pas attribué |
| Attribution des rôles | Table `user_roles` (email → rôle). Dropdown rôle par employé. Clé `app_config.user_roles` aussi utilisée (legacy) |

### Volet 5 — Prompts AI

| Section | Contenu |
|---------|---------|
| Prompts AI | Dropdown de 16 prompts (sur 19 existants — 3 manquants : explication_catalogue, json_catalogue, approval_suggest). Textarea éditable. Sauvegarde dans `app_config` |
| Mémoire AI | Table `ai_learnings` — CRUD de règles organisationnelles textuelles. Chaque règle a un contexte source |

### Volet 6 — Agent Maître

| Section | Contenu |
|---------|---------|
| Synchroniser les docs | Bouton fetch MASTER_CONTEXT.md + CLAUDE.md depuis Netlify → stocke dans `app_config` (`master_context`, `master_claude_md`, `master_context_synced_at`) |
| Ouvrir l'Agent Maître | Bouton ouvre le drawer global `shared/master-agent.js`. Auto-question contextuelle au 1er open |

---

## 18. CLÉS `app_config` DE CONTENU VIVANT

Ces clés définissent le comportement du produit et changent **sans déploiement** :

| Clé | Type | Rôle | Impact |
|-----|------|------|--------|
| `description_format_rules` | TEXT | Format obligatoire descriptions client FR/EN | Injecté dans `ai-assistant` (via `buildSystemPrompt`) et `translate` (action `description_calculateur`) |
| `project_steps` | JSONB array | 8 étapes `[{title, description}]` affichées dans quote.html | Fallback `STEPS_I18N` si absent |
| `why_title` | TEXT | Titre page "Pourquoi [Atelier]" dans quote.html | Placeholder `{designer}` interpolé avec nom architecte |
| `why_text` | TEXT (HTML) | Texte page "Pourquoi" | Contient du HTML riche |
| `why_image_url` | TEXT (URL) | Image page "Pourquoi" | URL vers Storage Supabase |
| `cover_image` | TEXT (URL) | Image couverture quote.html | Fond plein écran page 1 |
| `intro_title` / `intro_text` / `intro_signature` | TEXT | Page introduction quote.html | Aussi versions `_en` pour traduction |
| `expense_categories` | JSONB array | Catégories dépenses + markup% + perte% + templates | Source de vérité pour prix composé et rentabilité |
| `taux_horaires` | JSONB array | 7 départements MO + taux horaire + salaire + frais fixe | Base de calcul main-d'œuvre |
| `tag_nomenclature` | JSONB array | Préfixes tags plans (C, P, E, PI, F, A, PO, EC, RM) | Annotations + cascade matching |
| `catalogue_categories` | JSONB array | Catégories catalogue (auto-sync) | Filtrage et classification articles |
| `category_group_mapping` | JSONB object | Mapping catégories → groupes DM | `getAllowedCategoriesForGroup()` |
| `coupe_types` | JSONB array | Types de coupe placage `[{code, label, facteur, facteur_defaut, facteurs}]` | Facteur prix matériaux placage + dropdown DM/composante |
| `pipeline_statuses` | JSONB array | Statuts visuels pipeline `[{value, label, color}]` | Vue pipeline commercial |
| `permissions` | JSONB | Matrice 13 permissions × 6 rôles | Vérification côté client uniquement |
| `prompt_change_log` | JSONB array | Historique modifications prompts `[{key, old_text, new_text, reason, timestamp}]` | Traçabilité Agent Maître |
| `master_context_synced_at` | TEXT (ISO datetime) | Timestamp dernière synchronisation docs → ai-master | Fraîcheur contexte (alerte >24h) |

---

## 19. STRUCTURE COMPLÈTE D'UN ARTICLE CATALOGUE

### Champs principaux

| Champ | Type | Description |
|-------|------|-------------|
| `id` | TEXT PK | Code auto ST-XXXX (trigger `trg_catalogue_auto_code`) |
| `category` | TEXT | Catégorie catalogue (ex: "Base", "Haut", "Tiroirs") |
| `item_type` | TEXT | Classification : `fabrication` (FAB) ou `material` (MAT) |
| `unit_type` | TEXT | Type unité : `pi²`, `pi³`, `unitaire`, `pi.lin` |
| `description` | TEXT | Description technique interne |
| `client_text` | TEXT | Texte visible par le client (nom commercial) |
| `instruction` | TEXT | Instructions spéciales pour fabrication |
| `price` | NUMERIC | Prix manuel (si pas de prix composé) |
| `in_calculator` | BOOLEAN | Visible dans le calculateur |
| `is_default` | BOOLEAN | Article par défaut ★ (affiché en premier dans combobox) |
| `status` | TEXT | `approved`, `pending`, `rejected` |
| `dims_config` | JSONB | `{l:bool, h:bool, p:bool}` — champs dims affichés |
| `loss_override_pct` | NUMERIC | % perte spécifique (remplace le `waste` catégorie) |

### Prix composé

| Champ | Type | Contenu |
|-------|------|---------|
| `labor_minutes` | JSONB | `{département: minutes}` — 7 départements : Gestion/dessin, Coupe/edge, Assemblage, Machinage, Sablage, Peinture, Installation |
| `material_costs` | JSONB | `{catégorie: coût}` — 17 catégories : BANDE DE CHANT, BOIS BRUT, DIVERS, ÉCLAIRAGE, FINITION, FOURNITURE, MÉTAL, PANNEAU BOIS, PANNEAU MDF, PANNEAU MÉLAMINE, PLACAGE, POIGNÉES, QUINCAILLERIE, SOUS TRAITANCE, STRATIFIÉ, TIROIRS, VITRIER, PORTES SOUS TRAITANCE |

### Règle de calcul (`calculation_rule_ai` JSONB)

```json
{
  "ask": ["L", "H", "P", "n_tablettes"],
  "cascade": [
    { "target": "$default:Caisson", "qty": "1" },
    { "target": "$match:PANNEAU BOIS", "qty": "L * H / 144", "child_dims": { "L": "L", "H": "H" } },
    { "target": "ST-0042", "qty": "2" }
  ],
  "override_children": ["Caisson", "Panneaux"],
  "notes": "Texte explicatif pour l'AI"
}
```

- **`ask`** : variables requises avant cascade (L, H, P, QTY, n_tablettes, n_partitions, n_portes, n_tiroirs)
- **`cascade`** : règles enfants (3 types cibles). `child_dims` : formules dimensionnelles
- **`override_children`** : catégories bloquées chez les descendants
- **`notes`** : contexte pour l'AI (pas fonctionnel)

### Règle de présentation (`presentation_rule` JSONB + `presentation_rule_human` TEXT)

- `presentation_rule` : JSON structuré (squelette déterministe pour `assembleRoomDescription`)
- `presentation_rule_human` : explication texte libre (ex: "Inscrire dans la section détail le total de pi² de recouvrement")
- Les deux sont injectés dans le contexte AI : description (`aiGenerateDescription`) et chatbox estimateur (`collectRoomDetail` → `presRuleHuman`)

```json
{
  "sections": [
    { "key": "CAISSON", "label": "Caisson", "template": "Caisson en {client_text}" },
    { "key": "FAÇADES", "label": "Façades", "template": "{qty} façade(s) en {client_text}" }
  ],
  "exclude": ["quincaillerie", "vis"],
  "detail_bullets": [
    { "text": "Finition intérieure", "sub": "Mélamine blanche" }
  ]
}
```

- **`sections`** : groupement visuel par clé (CAISSON, FAÇADES, PANNEAUX, TIROIRS, POIGNÉES, DÉTAILS, FINITION, EXCLUSIONS)
- **`exclude`** : articles filtrés de la description client (par client_text substring)
- **`detail_bullets`** : bullets injectés dans la section DÉTAILS

### Barèmes dimensionnels (`labor_modifiers` JSONB)

```json
{
  "cumulative": false,
  "modifiers": [
    {
      "condition": "L > 48",
      "label": "Grand (> 48 po)",
      "labor_factor": { "Machinage": 1.5, "Assemblage": 1.25 },
      "material_factor": { "PANNEAU MÉLAMINE": 1.20 },
      "labor_minutes": { "Assemblage": "n_partitions * 12" }
    }
  ]
}
```

- **`condition`** : expression évaluée par `evalFormula` (variables dims)
- **`labor_factor`** / **`material_factor`** : multiplicateurs par département/catégorie
- **`labor_minutes`** : minutes absolues ajoutées (nombre ou expression)
- **`cumulative`** : si true, tous les modificateurs vrais sont appliqués (facteurs multipliés, minutes sommées)

### Flags et métadonnées

| Champ | Rôle |
|-------|------|
| `in_calculator` | Article visible dans le calculateur (false = catalogue seulement) |
| `is_default` | Article ★ par défaut — affiché en premier dans le combobox |
| `is_fiche` | Article avec fiche de vente publique (`fiche.html`) |
| `fiche_*` | Champs fiche de vente (titre, sous-titre, description, specs, prix affiché) |
| `supplier_code` | Code fournisseur de référence |
| `status` | `approved` (actif), `pending` (en attente d'approbation), `rejected` |

---

## 20. VUES ET FLUX UTILISATEUR

### Pipeline commercial (`calculateur.html` — Vue 1)

3 vues interchangeables :
- **Table** : colonnes ★, Prio, Nom, Archit., Montant, Prob%, Statut, Remise, Resp., Type. Tri par colonne, filtres texte/statut/type/assigné/suivi
- **Cartes** : Kanban par statut pipeline. Drag & drop entre colonnes
- **Soumissions** : liste plate de toutes les soumissions avec statut workflow

**Archivage projets** (#221) : `projects.is_archived` BOOLEAN. Projets archivés masqués par défaut, bouton "Projets archivés (N)" dans les filtres. Suppression uniquement depuis la vue archivés (double confirmation). `toggleArchiveProject`, `toggleArchiveProjectFilter`

### Vue projet (`calculateur.html` — drawer latéral)

- **Onglets** : Estimateur (lead), Vendeur/CP, Approbateur, Remise interne, Remise client
- **Infos** : Client, Adresse, Ville, Code postal, Source, Type, Montant, Probabilité, Dates
- **Soumissions** : liste des soumissions du projet avec statut, montant, actions

### Calculateur (`calculateur.html` — Vue 2)

Flux par pièce (room group) :
1. **Pièce** : nom éditable, DM (5 requis + optionnels, panneau navy enrichi), modificateur % sous-total
2. **Lignes** : TAG, article (combobox), QM, L×H×P, n_tab/n_part/n_portes/n_tiroirs, prix unit., quantité, installation ☑, total
3. **Cascade** : FAB parent → enfants automatiques (collapsibles, badge +N)
4. **Sous-total** pièce + modificateur % = total pièce
5. **Grand total** : somme des pièces × modificateur global

### Aperçu soumission (`calculateur.html` — renderPreview)

Layout par pièce :
- **Gauche** : description client HTML (générée par AI ou manuelle)
- **Droite** : grille d'images annotées (plans avec tags), max 6 images
- **Footer** : bibliothèque de clauses (drag-drop ordre), toggle FR/EN
- **Page total** : texte clôture + breakdown montants + taxes + lignes signature

### Présentation client (`quote.html`)

Pages séquentielles :
1. **Couverture** : image fond plein écran + logo + titre projet
2. **Introduction** : titre + texte + signature architecte
3. **Pourquoi [Atelier]** : titre + texte + image (données dynamiques `app_config`)
4. **Pièces** : 1 page par pièce (description + images + sous-total)
5. **Étapes** : 8 étapes projet (données dynamiques `app_config.project_steps`)
6. **Total + signature** : montant + taxes + formulaire acceptation + signature canvas

### Export PDF

- PDFShift Chromium server-side (Edge Function `pdf-export`)
- Layout identique à l'aperçu (landscape Letter, marges 0)
- `@media print` dans SNAPSHOT_CSS pour pagination
- Nom fichier : `{OrgName}_{ProjectCode}_{SubNumber}_v{Version}.pdf`

---

## 21. MATÉRIAUX PAR DÉFAUT (DM) — DÉTAIL

### Structure

Room-level uniquement (`roomDM[groupId]`). Chaque pièce a ses propres DM.

**5 types requis** (`DM_REQUIRED_GROUPS`) :
1. **Caisson** — matériau principal du caisson (mélamine, placage, etc.)
2. **Façades** — matériau des portes/façades
3. **Tiroirs** — matériau des tiroirs
4. **Panneaux** — panneaux apparents (peut avoir 2 entrées)
5. **Poignées** — type de poignées

**Types non requis** : Finition (retiré des requis, reste disponible)

**2 types cachés** (`DM_HIDDEN_GROUPS`) : Autre, Éclairage — filtrés du dropdown.

### Format d'une entrée DM

```json
{
  "type": "Caisson",
  "client_text": "Placage de chêne blanc",
  "catalogue_item_id": "ST-0015",
  "description": "Placage chêne blanc 1/4 feuille",
  "composante_id": "uuid-composante",
  "materiau": { "catalogue_item_id": "ST-0015", "client_text": "Placage chêne blanc" },
  "coupe": "Livre ouvert",
  "bande_chant": { "catalogue_item_id": "ST-0087", "client_text": "Bande chêne blanc" },
  "finition": { "catalogue_item_id": "ST-0090", "client_text": "Laque polyuréthane" },
  "bois_brut": null,
  "style": "Shaker"
}
```

- **`client_text`** = identifiant primaire pour la résolution cascade (pas `catalogue_item_id`)
- **`catalogue_item_id`** = optionnel — référence article technique
- Un DM avec `client_text` sans `catalogue_item_id` est valide
- **Champs enrichis** (optionnels) : `materiau`, `coupe`, `bande_chant`, `finition`, `bois_brut`, `style` — présents sur Caisson, Façades, Panneaux
- **`composante_id`** : référence vers la composante utilisée (propagé dans `materialCtx` pour filtrer la résolution cascade)

### Actions UI

- **+ Ajouter** : dropdown type → recherche catalogue (groupé par `client_text` dédupliqué) → sélection
- **Copier de...** : copie les DM d'une autre pièce de la même soumission
- **Effacer tout** : supprime tous les DM de la pièce
- **Indicateur DM vide** : flèche `←` avec animation pulse quand aucun DM et ≥1 article dans la pièce
- **Validation** : `addRow()` bloque l'ajout d'articles si DM requis manquent (toast + ouvre panneau DM)

### Résolution cascade depuis DM

1. `$default:Façades` → cherche DM de type "Façades" dans la pièce
2. **Filtre par composante** : si `materialCtx.composante_id` défini, `filterDmByComposante` réduit les candidats DM (fallback liste complète si aucun match)
3. **Tier 0 enrichi** : `getEnrichedDmField(dmEntry, expenseCat)` — si le DM a un sous-champ enrichi pour la catégorie → résolution directe sans modale
4. Si 1 seul DM → utilise son `client_text` pour trouver l'article catalogue
5. Si multiple → modale choix matériau (`showDmChoiceModal`)
6. Filtre `CATALOGUE_DATA` par `client_text` + catégories autorisées (`getAllowedCategoriesForGroup`)
7. Si multiple articles techniques → modale choix technique (`showTechnicalItemModal`)
8. Résultat = `catalogue_item_id` final pour la ligne enfant

### Panneau DM — Design navy

- Fond `#0B1220`, texte `rgba(255,255,255,*)`, palette opacités (0.07→0.85)
- Sous-champs enrichis : layout `flex-wrap`, indent 100px, labels 10px
- Bookmark SVG : stroke au repos → filled persistant quand composante enregistrée
- Dropdown composantes : filtré par `dm_type`, transparent sur navy
- Autocomplete navy : fond `#131c2e`, items `rgba(255,255,255,0.7)`, `min-width: max-content`
- Overflow : `.furniture-group` et `.rdm-enriched` en `overflow: visible` pour dropdowns
