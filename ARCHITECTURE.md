# ARCHITECTURE -- Scopewright (Stele)

> Documentation technique de reference du projet. Derniere mise a jour : 2026-02-23.

---

## Table des matieres

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Arborescence des fichiers](#2-arborescence-des-fichiers)
3. [Tables Supabase](#3-tables-supabase)
4. [Edge Functions](#4-edge-functions)
5. [Flow d'authentification](#5-flow-dauthentification)
6. [Points d'integration API Claude](#6-points-dintegration-api-claude)
7. [Deploiement](#7-deploiement)
8. [Buckets Storage](#8-buckets-storage)

---

## 1. Vue d'ensemble du projet

Scopewright est une application web pour l'estimation de cuisines et meubles sur mesure, destinee a l'equipe de Stele.

### Principes architecturaux

- **Pas de build system** -- Chaque page est un fichier HTML autonome avec CSS et JS inline
- **Pas de framework JS** -- Vanilla JavaScript uniquement (ES6+), pas de React, Vue ou Angular
- **Zero dependance npm** -- Aucun risque supply-chain, tout est auto-contenu
- **Backend Supabase** -- PostgreSQL + Auth + Storage + Edge Functions (Deno)
- **Deploiement Netlify** -- Auto-deploy depuis GitHub (branche `main`), aucune etape de build
- **Edge Functions Deno** -- 4 fonctions pour l'IA (Claude Anthropic) et la traduction
- **Email via Google Apps Script** -- Envoi d'estimations en HTML + PDF

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | HTML + CSS + JavaScript vanilla (fichiers autonomes) |
| Backend | Supabase (PostgreSQL 15 + Auth + Storage + Edge Functions) |
| IA | Anthropic Claude (Sonnet 4.5, Sonnet 4, Haiku 4.5) via Edge Functions |
| Hebergement | Netlify (auto-deploy) |
| Email | Google Apps Script |
| Repo | GitHub -- `Scopewright/scopewright`, branche `main` |

---

## 2. Arborescence des fichiers

### 2.1 Pages de l'application (deployees sur Netlify)

| Fichier | Lignes | Taille | Role | Auth |
|---------|-------:|-------:|------|:----:|
| `calculateur.html` | 16 019 | 832 Ko | Application principale -- projets, soumissions, meubles, lignes, AI chatbox, annotations, pipeline | Oui |
| `catalogue_prix_stele_complet.html` | 6 526 | 314 Ko | Catalogue de prix -- CRUD items, images, prix compose, AI import | Oui |
| `admin.html` | 2 622 | 165 Ko | Administration -- permissions, roles, taux horaires, categories, prompts AI | Oui |
| `clients.html` | 2 343 | 126 Ko | CRM -- contacts, entreprises, communications, AI import | Oui |
| `approbation.html` | 1 927 | 79 Ko | Approbation soumissions + articles proposes au catalogue | Oui |
| `quote.html` | 1 765 | 75 Ko | Vue client publique -- soumission + acceptation + signature | Non (token URL) |
| `fiche.html` | 1 177 | 49 Ko | Fiches de vente produits -- affichage public + editeur authentifie | Optionnel |
| `app.html` | 659 | 30 Ko | Tableau de bord (grille 2 colonnes responsive, cartes filtrees par permissions) | Oui |
| `index.html` | 316 | 16 Ko | Landing page / marketing | Non |
| `login.html` | 247 | 8 Ko | Authentification Supabase (email/mot de passe) | Non |

### 2.2 Edge Functions Supabase (Deno)

| Fichier | Lignes | Role |
|---------|-------:|------|
| `supabase/functions/ai-assistant/index.ts` | 748 | Assistant AI principal -- Claude Sonnet 4.5, 7 outils |
| `supabase/functions/catalogue-import/index.ts` | 588 | Assistant AI catalogue -- Claude Sonnet 4.5, streaming SSE, 7 outils |
| `supabase/functions/contacts-import/index.ts` | 515 | Assistant AI contacts -- Claude Sonnet 4.5, streaming SSE, 10 outils |
| `supabase/functions/translate/index.ts` | 511 | Traduction et optimisation -- Claude Haiku 4.5 / Sonnet 4, 10 actions |

### 2.3 Autres fichiers de support

| Fichier | Role |
|---------|------|
| `google_apps_script.gs` | Cloud function Google Apps Script : generation email HTML + PDF d'estimation |
| `catalogue.json` | Donnees de catalogue en JSON (export/fallback) |

### 2.4 Migrations SQL

36 fichiers dans `sql/`, executes manuellement dans le SQL Editor de Supabase. Pas de runner de migrations, pas de versioning automatique, pas de up/down.

Fichiers notables :

| Fichier | Role |
|---------|------|
| `sql/chat_messages.sql` | Table `chat_messages` + RLS + index |
| `sql/tags.sql` | Colonne `tag` sur `room_items` + nomenclature `tag_prefixes` |
| `sql/default_materials.sql` | Colonne `default_materials` JSONB sur `submissions` |
| `sql/annotations.sql` | Colonne `annotations` JSONB sur `room_media` |
| `sql/pipeline_projects.sql` | Colonnes pipeline sur `projects` |
| `sql/project_auto_code.sql` | Trigger auto-generation `project_code` |
| `sql/catalogue_item_components.sql` | Table `catalogue_item_components` |
| `sql/ai_learnings.sql` | Table `ai_learnings` pour apprentissages AI |
| `sql/cascade.sql` | Contraintes CASCADE sur les FK |
| `sql/catalogue_approve_rpc.sql` | RPC `approve_catalogue_item` |
| `sql/submission_snapshots.sql` | Bucket + config pour snapshots HTML |
| `sql/lost_status_and_archiving.sql` | Statuts `lost` et archivage |
| `sql/room_price_override.sql` | Override de prix par meuble |
| `sql/submission_discount.sql` | Rabais sur soumissions |
| `sql/dimensions.sql` | Colonnes dimensions sur `room_items` |

### 2.5 Fichiers hors application (non deployes)

| Fichier | Role |
|---------|------|
| `dashboard.html` | Prototype legacy (3 224 lignes, 141 Ko) -- localStorage uniquement, aucune integration Supabase |
| `soumission.html` | Calculateur de soumission standalone -- donnees hardcodees |
| `soumission.py` | Script Python utilitaire |
| `convert_pptx_to_html.py` | Convertisseur PowerPoint vers HTML |
| `landing-page/` | Landing page separee (projet independant -- ne pas modifier) |
| `*.ps1` | Scripts PowerShell utilitaires |
| `*.xlsx` | Fichiers Excel de travail |
| `*.pdf` | Documents de reference |

---

## 3. Tables Supabase

**URL** : `https://rplzbtjfnwahqodrhpny.supabase.co`

### 3.1 Schema relationnel

```
auth.users
  +--- projects (user_id)
  |      +--- submissions (project_id)
  |      |      +--- project_rooms (submission_id)
  |      |      |      +--- room_items (room_id)
  |      |      |      +--- room_media (room_id)
  |      |      +--- project_versions (submission_id)
  |      |      +--- submission_reviews (submission_id)
  |      |      +--- submission_plans (submission_id)
  |      |      +--- chat_messages (submission_id)
  |      |      +--- public_quote_tokens (submission_id)
  |      |      +--- submission_unlock_logs (submission_id)
  |      +--- project_contacts (project_id) --- contacts / companies
  |      +--- project_follows (project_id, user_id)
  |
  catalogue_items (id = code texte, ex: BUD-001)
  |      +--- catalogue_item_components (catalogue_item_id)
  |      +--- item_media (catalogue_item_id)
  |      +--- fiches_vente (catalogue_item_id)
  |      +--- room_items (catalogue_item_id) -- reference optionnelle
  |
  contacts --- contact_companies --- companies (CRM)
  communications (contact_id)
  user_profiles (user_id -> contact_id)
  |
  employees -- table independante (liste pour dropdowns)
  app_config -- table cle-valeur independante (configuration globale)
  quote_clauses -- bibliotheque de clauses (independante)
  ai_learnings -- apprentissages AI (independante)
  roles / user_roles -- roles systeme (6 roles)
  waitlist -- inscriptions landing page (publique)
  v_catalogue_usage_stats -- vue materialisee
```

### 3.2 Tables principales (28+ tables)

#### `projects` -- Projets utilisateur

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `user_id` | UUID (FK -> auth.users) | Proprietaire du projet |
| `name` | TEXT | Nom auto-compose `{code} {city}` (trigger) |
| `project_code` | TEXT | Code auto-genere par trigger (`project_code_seq`) |
| `client_name` | TEXT | Nom du client |
| `client_email` | TEXT | Email du client |
| `client_phone` | TEXT | Telephone du client |
| `client_address` | TEXT | Adresse du client |
| `project_address` | TEXT | Adresse du projet |
| `project_city` | TEXT | Ville du projet |
| `project_postal_code` | TEXT | Code postal |
| `pipeline_status` | TEXT | Statut pipeline commercial |
| `source` | TEXT | Source du projet |
| `project_type` | TEXT | Type de projet |
| `estimated_amount` | NUMERIC | Montant estime (calcule) |
| `amount_override` | NUMERIC | Montant override (priorite, affiche en rouge) |
| `probability` | NUMERIC | Probabilite (%) |
| `assigned_to` | TEXT | Responsable assigne |
| `priority` | TEXT | Priorite |
| `expected_start_date` | DATE | Date debut prevue |
| `expected_end_date` | DATE | Date fin prevue |
| `internal_deadline` | DATE | Date limite interne |
| `client_deadline` | DATE | Date limite client |
| `designer` | TEXT | Designer / charge de projet |
| `description` | TEXT | Description / notes |
| `notes` | TEXT | Notes internes |
| `status` | TEXT | Legacy (le statut vit sur `submissions`) |
| `updated_at` | TIMESTAMPTZ | Derniere modification |

**RLS** : `auth.uid() = user_id` -- chaque utilisateur ne voit que ses propres projets.

---

#### `submissions` -- Soumissions d'un projet

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK -> projects) | Projet parent |
| `submission_number` | INTEGER (UNIQUE) | Numero sequentiel global (sequence, demarre a 100) |
| `title` | TEXT | Titre de la soumission |
| `status` | TEXT | Statut workflow (voir ci-dessous) |
| `current_version` | INTEGER | Dernier numero de version snapshot |
| `approved_total` | NUMERIC | Total approuve (rempli a l'approbation) |
| `approved_by` | UUID | Utilisateur ayant approuve |
| `approved_at` | TIMESTAMPTZ | Date d'approbation |
| `sent_at` | TIMESTAMPTZ | Date d'envoi au client |
| `accepted_at` | TIMESTAMPTZ | Date d'acceptation client |
| `accepted_by_name` | TEXT | Nom du client qui a accepte |
| `bypass_approval` | BOOLEAN | Indique si l'approbation a ete bypassee |
| `clauses` | JSONB | Clauses du contrat |
| `default_materials` | JSONB | Materiaux par defaut |
| `created_at` | TIMESTAMPTZ | Date de creation |
| `updated_at` | TIMESTAMPTZ | Derniere modification |

**Workflow des statuts** :

```
draft --> pending_internal <--> returned
  |          |
  |     approved_internal --> sent_client --> accepted --> invoiced
  |                              ^                ^
  |          bypass -------------|  offline ------|
  |
  +-- Deverrouillage d'urgence : tout statut verrouille --> draft (audit immuable)
```

| Statut | Label FR | Signification |
|--------|----------|---------------|
| `draft` | Brouillon | En cours de redaction |
| `pending_internal` | En approbation | Soumise pour revision interne |
| `returned` | Retournee | Retournee avec commentaire |
| `approved_internal` | Approuvee | Approuvee en interne, prete a envoyer |
| `sent_client` | Envoyee client | Lien public genere, envoyee au client |
| `accepted` | Acceptee | Client a accepte (signature en ligne ou hors-ligne) |
| `invoiced` | Facturee | Facturee (statut terminal) |

---

#### `submission_reviews` -- Historique d'approbation

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK -> submissions) | Soumission concernee |
| `reviewer_id` | UUID (FK -> auth.users) | Auteur de l'action |
| `action` | TEXT | `submitted`, `approved`, `returned`, `sent`, `bypass`, `offline_accepted`, `invoiced`, `duplicated`, `unlocked`, `lost`, `reopened` |
| `comment` | TEXT | Commentaire (obligatoire pour retour) |
| `version_at_review` | INTEGER | Version au moment de la revision |
| `created_at` | TIMESTAMPTZ | Date de la revision |

---

#### `project_rooms` -- Meubles d'une soumission

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK -> projects) | Projet parent (transition, sera supprime) |
| `submission_id` | UUID (FK -> submissions) | Soumission parent |
| `name` | TEXT | Nom du meuble / de la piece |
| `sort_order` | INTEGER | Ordre d'affichage |
| `installation_included` | BOOLEAN | Toggle installation (defaut: true) |
| `images` | JSONB | Images legacy (base64) |
| `client_description` | TEXT | Description visible par le client (FR) |
| `client_description_en` | TEXT | Description visible par le client (EN) |

**RLS** : via JOIN chain depuis `projects.user_id = auth.uid()`.

---

#### `room_items` -- Lignes de calcul d'un meuble

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `room_id` | UUID (FK -> project_rooms) | Meuble parent |
| `item_type` | TEXT | `catalogue` ou `custom` |
| `catalogue_item_id` | TEXT (FK -> catalogue_items) | Reference catalogue (si `item_type=catalogue`) |
| `description` | TEXT | Description (auto ou manuelle) |
| `unit_type` | TEXT | Type d'unite (`unitaire`, `pi2`, `lineaire`, `%`) |
| `unit_price` | NUMERIC | Prix unitaire calcule |
| `quantity` | NUMERIC | Quantite |
| `markup` | NUMERIC | Majoration en % |
| `line_total` | NUMERIC (GENERATED) | `quantity * unit_price * (1 + markup/100)` -- **colonne calculee PostgreSQL, ne pas ecrire** |
| `installation_included` | BOOLEAN | Toggle installation par ligne |
| `sort_order` | INTEGER | Ordre d'affichage |
| `tag` | TEXT | Tag d'identification (ex: `C1`, `F2`, `P1`) |

---

#### `room_media` -- Images des meubles (Supabase Storage)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `room_id` | UUID (FK -> project_rooms) | Meuble parent |
| `original_url` | TEXT | URL Supabase Storage de l'image originale |
| `cropped_url` | TEXT | URL de l'image recadree |
| `crop_ratio` | TEXT | Format de recadrage (`16:9`, `9:16`, `1:1`) |
| `crop_data` | JSONB | Donnees Cropper.js pour le recadrage |
| `tags` | JSONB (array) | Tags de classification (ex: `["presentation_soumission"]`) |
| `annotations` | JSONB (array) | Labels visuels places sur l'image (voir section annotations) |
| `source_metadata` | JSONB | Metadonnees de source (plan PDF, page, coords) |
| `sort_order` | INTEGER | Ordre d'affichage |

---

#### `catalogue_items` -- Produits du catalogue

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT (PK) | Code produit (ex: `BUD-001`, `PAN-003`) |
| `category` | TEXT | Categorie |
| `description` | TEXT | Description du produit |
| `type` | TEXT | Type d'unite (`unitaire`, `pi2`, `lineaire`, `%`) |
| `price` | NUMERIC | Prix unitaire (ou NULL pour "sur demande") |
| `instruction` | TEXT | Instructions / tooltip |
| `image_url` | TEXT | URL de l'image principale |
| `in_calculator` | BOOLEAN | Visible dans le calculateur |
| `has_sales_sheet` | BOOLEAN | Indique si une fiche de vente existe |
| `sort_order` | INTEGER | Ordre d'affichage |
| `labor_minutes` | JSONB | Minutes de travail par departement (prix compose) |
| `material_costs` | JSONB | Couts materiaux par categorie (prix compose) |
| `status` | TEXT | `approved`, `pending`, ou NULL (= approved) |
| `proposed_by` | TEXT | Email de l'utilisateur ayant propose l'item |

---

#### `catalogue_item_components` -- Composants des items catalogue

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `catalogue_item_id` | TEXT (FK -> catalogue_items) | Item parent |
| `category` | TEXT | Categorie de composant |
| *(autres colonnes)* | - | Details du composant |

---

#### `item_media` -- Medias des items du catalogue

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `catalogue_item_id` | TEXT (FK -> catalogue_items) | Item associe |
| `file_url` | TEXT | URL publique (Supabase Storage) |
| `file_type` | TEXT | `image` ou `pdf` |
| `tags` | JSONB (array) | Tags de classification |
| `sort_order` | INTEGER | Ordre d'affichage |

---

#### `project_versions` -- Snapshots historiques

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK -> projects) | Projet associe (transition) |
| `submission_id` | UUID (FK -> submissions) | Soumission associee |
| `version_number` | INTEGER | Numero de version sequentiel |
| `snapshot` | JSONB | Snapshot complet (projet, client, clauses, meubles, descriptions, mediaUrls) |
| `status_at_save` | TEXT | Statut de la soumission au moment du snapshot |
| `created_by` | TEXT | ID de l'utilisateur |

---

#### `chat_messages` -- Conversations AI

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK -> submissions) | Soumission associee |
| `role` | TEXT | `user`, `assistant`, ou `summary` |
| `content` | TEXT | Contenu textuel du message |
| `image_urls` | TEXT[] | URLs des images envoyees (array PostgreSQL) |
| `tool_calls` | JSONB | Appels d'outils AI (historique) |
| `pending_actions` | JSONB | Actions en attente de confirmation |
| `created_at` | TIMESTAMPTZ | Date du message |

**Index** : `idx_chat_messages_submission(submission_id, created_at)`

---

#### `submission_plans` -- Plans PDF

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK -> submissions) | Soumission associee |
| `file_path` | TEXT | Chemin dans le bucket `submission-plans` |
| `file_type` | TEXT | Type de fichier |
| `version_number` | INTEGER | Version du plan (incrementale) |
| `uploaded_by` | UUID | Utilisateur ayant uploade |
| `created_at` | TIMESTAMPTZ | Date d'upload |

---

#### `public_quote_tokens` -- Tokens de soumission publique

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK -> submissions) | Soumission associee |
| `token` | TEXT (UNIQUE) | Token aleatoire pour URL publique |
| `accepted_at` | TIMESTAMPTZ | Date d'acceptation en ligne |
| `accepted_by_name` | TEXT | Nom du signataire |
| `accepted_by_email` | TEXT | Email du signataire |
| `accepted_from_ip` | INET | IP du signataire |
| `signature_data` | TEXT | Donnees de signature (base64 PNG) |
| `created_at` | TIMESTAMPTZ | Date de creation du token |

---

#### `submission_unlock_logs` -- Journal de deverrouillage (IMMUABLE)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK -> submissions) | Soumission deverrouillee |
| `unlocked_by` | UUID | ID utilisateur |
| `unlocked_by_name` | TEXT | Nom complet |
| `reason` | TEXT | Raison du deverrouillage (obligatoire) |
| `previous_status` | TEXT | Statut avant deverrouillage |
| `ip_address` | INET | Adresse IP (capturee cote serveur) |
| `created_at` | TIMESTAMPTZ | Date de l'action |

**RLS** : INSERT + SELECT uniquement -- table immuable pour audit.

---

#### `app_config` -- Configuration et permissions

| Colonne | Type | Description |
|---------|------|-------------|
| `key` | TEXT (PK) | Cle de configuration |
| `value` | JSONB | Valeur (polymorphe) |
| `updated_at` | TIMESTAMPTZ | Derniere modification |

**Cles stockees** :

| Cle | Type de valeur | Description |
|-----|---------------|-------------|
| `permissions` | `{ "NomRole": { "cle_permission": bool } }` | Matrice roles x permissions |
| `user_roles` | `{ "email": "NomRole" }` | Attribution email -> role |
| `catalogue_categories` | `["Budgetaire", "Panneaux", ...]` | Categories du catalogue |
| `media_tags` | `["fiche_client", "catalogue", ...]` | Tags pour les medias |
| `taux_horaires` | `[{ department, taux_horaire, frais_fixe, salaire }]` | Taux horaires par departement (7 depts) |
| `expense_categories` | `[{ name, markup, waste }]` | Categories de depenses + majoration % + perte % (23 cats) |
| `tag_prefixes` | `[{ prefix, label_fr, label_en, sort_order }]` | Nomenclature des tags (C, F, P, T, M, A) |
| `pipeline_statuses` | Array | Statuts du pipeline commercial |
| `project_sources` | Array | Sources de projets |
| `project_types` | Array | Types de projets |
| `project_code_prefix` | String | Prefixe des codes projet |
| `ai_prompt_overrides` | Object | Prompts AI personnalisables |

**RLS** : lecture authentifiee, **pas de protection ecriture** (point d'attention securite).

---

#### Tables CRM

| Table | Colonnes principales | Description |
|-------|---------------------|-------------|
| `contacts` | id, first_name, last_name, phone, email | Contacts CRM |
| `companies` | id, name | Entreprises |
| `contact_companies` | contact_id, company_id | Table de jonction N-N |
| `communications` | id, contact_id, type, content, created_at | Log des interactions |
| `project_contacts` | project_id, contact_id, role, is_primary | Contacts associes a un projet |

---

#### Autres tables

| Table | Description |
|-------|-------------|
| `employees` | Liste des employes (nom, email, sort_order) -- dropdowns |
| `fiches_vente` | Fiches de vente editorielles (liaison catalogue_item_id) |
| `quote_clauses` | Bibliotheque de clauses contractuelles (titre, contenu FR/EN) |
| `ai_learnings` | Apprentissages organisationnels AI (rule, is_active, created_at) |
| `user_profiles` | Liaison auth.users <-> contacts (user_id -> contact_id) |
| `roles` | Roles systeme (id, name, sort_order) -- 6 roles |
| `user_roles` | Attribution email -> role DB (email, role_id) |
| `waitlist` | Inscriptions landing page (public, INSERT anon) |
| `v_catalogue_usage_stats` | Vue statistiques d'utilisation du catalogue |

### 3.3 Fonctions RPC Supabase

| Fonction | Parametres | Description | Utilisee par |
|----------|-----------|-------------|--------------|
| `get_public_quote` | `p_token` | Retourne les donnees de soumission pour la vue publique (pas d'auth) | quote.html |
| `accept_quote` | *(token + signature)* | Acceptation en ligne de la soumission (pas d'auth) | quote.html |
| `approve_catalogue_item` | *(item_id)* | Approuver un item catalogue pending | catalogue |
| `get_next_plan_version` | *(submission_id)* | Obtenir le prochain numero de version de plan | calculateur.html |
| `duplicate_submission` | `p_submission_id` -> UUID | Copie profonde d'une soumission (rooms, items, media) | calculateur.html |
| `log_submission_unlock` | `p_submission_id, p_user_name, p_reason, p_previous_status` | Log immuable de deverrouillage avec capture IP (`SECURITY DEFINER`) | calculateur.html |
| `log_bypass_approval` | `p_submission_id, p_user_name, p_reason` | Log immuable de bypass avec capture IP | calculateur.html |
| `log_offline_acceptance` | `p_submission_id, p_user_name, p_acceptance_method, p_acceptance_date, p_client_name, p_notes` | Log immuable d'acceptation hors-ligne avec capture IP | calculateur.html |

### 3.4 RLS (Row Level Security)

| Table / Groupe | Politique |
|----------------|-----------|
| `projects` | `auth.uid() = user_id` |
| Tables enfants (submissions, rooms, items, media, chat, plans, tokens, unlock_logs) | Via JOIN chain jusqu'a `projects.user_id` |
| `submission_reviews` | Authentifie peut inserer ; proprietaire + approbateurs peuvent lire |
| `submission_unlock_logs` | INSERT + SELECT uniquement (immuable) |
| `app_config` | Lecture authentifiee, **pas de protection ecriture** |
| `waitlist` | INSERT anon (public), SELECT authentifie |
| `project_follows` | `auth.uid() = user_id` |

---

## 4. Edge Functions

### 4.1 `ai-assistant` -- Assistant AI principal

| Propriete | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/ai-assistant/index.ts` (748 lignes) |
| **Modele** | `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5) |
| **Max tokens** | 4 096 |
| **Transport** | Non-streaming (reponse JSON complete) |
| **JWT** | Deploye avec `--no-verify-jwt` ; verification manuelle (base64 decode + exp, pas de verification de signature) |
| **Secret** | `ANTHROPIC_API_KEY` |

**7 outils disponibles** :

| Outil | Action | Confirmation requise |
|-------|--------|:--------------------:|
| `analyze_rentability` | Calcul rentabilite (projet ou piece) | Oui |
| `write_description` | Rediger/reecrire description client HTML | Oui |
| `add_catalogue_item` | Ajouter un article du catalogue a un meuble | Oui |
| `modify_item` | Modifier un item existant (quantite, prix, etc.) | Oui |
| `suggest_items` | Rechercher dans le catalogue | Non (lecture seule) |
| `compare_versions` | Comparer deux versions de soumission | Non (lecture seule) |
| `save_learning` | Sauvegarder un apprentissage organisationnel | Oui |

**Mode simulation** : l'AI propose les modifications en texte. L'utilisateur doit confirmer explicitement avant execution cote client via `executeAiTool()`.

**Utilise par** : calculateur.html (drawer AI chatbox), approbation.html (revue), catalogue (revue).

---

### 4.2 `translate` -- Traduction et optimisation

| Propriete | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/translate/index.ts` (511 lignes) |
| **Modele texte** | `claude-haiku-4-5-20251001` (Claude Haiku 4.5) |
| **Modele JSON/vision** | `claude-sonnet-4-20250514` (Claude Sonnet 4) -- pour les actions complexes |
| **Max tokens** | 4 096 (simple) / 8 192 (batch) |
| **Transport** | Non-streaming (reponse JSON) |
| **JWT** | Deploye avec `--no-verify-jwt` ; verification manuelle |
| **Retry** | `fetchWithRetry` avec backoff exponentiel |

**10 actions disponibles** :

| Action | Modele | Description |
|--------|--------|-------------|
| `translate` | Haiku | Traduction FR -> EN |
| `en_to_fr` | Haiku | Traduction EN -> FR canadien |
| `optimize` | Haiku | Optimisation/formatage descriptions client en HTML structure |
| `catalogue_client_text` | Haiku | Texte client pour item catalogue |
| `catalogue_explication` | Haiku | Explication d'un item catalogue |
| `catalogue_json` | **Sonnet** | Extraction JSON structuree |
| `catalogue_pres_rule` | **Sonnet** | Regle de presentation catalogue |
| `catalogue_calc_rule` | **Sonnet** | Regle de calcul catalogue |
| `calculateur_description` | Haiku | Description pour le calculateur |
| `import_components` | **Sonnet** | Import de composants (vision) |

**Batch** : traitement groupe via separateur `===SEPARATOR===` en un seul appel API.

---

### 4.3 `catalogue-import` -- Assistant AI catalogue

| Propriete | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/catalogue-import/index.ts` (588 lignes) |
| **Modele** | `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5) |
| **Max tokens** | 4 096 |
| **Transport** | Streaming SSE (Server-Sent Events) |
| **JWT** | Deploye avec `--no-verify-jwt` ; verification manuelle |
| **Retry** | Aucune logique de retry |

**7 outils disponibles** :

| Outil | Description |
|-------|-------------|
| `search_catalogue` | Rechercher dans le catalogue |
| `create_catalogue_item` | Creer un nouvel item |
| `update_catalogue_item` | Modifier un item existant |
| `delete_catalogue_item` | Supprimer un item |
| `filter_catalogue` | Filtrer le catalogue par criteres |
| `check_usage` | Verifier l'utilisation d'un item dans les soumissions |
| `audit_client_names` | Auditer les noms clients |

**Utilise par** : catalogue_prix_stele_complet.html (drawer AI lateral).

---

### 4.4 `contacts-import` -- Assistant AI contacts

| Propriete | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/contacts-import/index.ts` (515 lignes) |
| **Modele** | `claude-sonnet-4-5-20250929` (Claude Sonnet 4.5) |
| **Max tokens** | 4 096 |
| **Transport** | Streaming SSE (Server-Sent Events) |
| **JWT** | Deploye avec `--no-verify-jwt` ; verification manuelle |
| **Retry** | 429 rate limit : 2 retries, delai 5s |

**10 outils disponibles** :

| Outil | Description |
|-------|-------------|
| `search_contacts` | Rechercher des contacts |
| `create_contact` | Creer un nouveau contact |
| `create_company` | Creer une nouvelle entreprise |
| `update_contact` | Modifier un contact |
| `update_company` | Modifier une entreprise |
| `delete_contact` | Supprimer un contact |
| `delete_company` | Supprimer une entreprise |
| `link_contact_company` | Associer un contact a une entreprise |
| `filter_contacts` | Filtrer les contacts par criteres |
| `save_learning` | Sauvegarder un apprentissage |

**Utilise par** : clients.html (drawer AI lateral).

---

## 5. Flow d'authentification

### 5.1 Flux principal

```
index.html (public)
  --> login.html
    --> POST /auth/v1/token?grant_type=password
    --> Stockage localStorage :
          sb_access_token   (JWT, ~1h)
          sb_refresh_token  (~30 jours)
          sb_user_email
          sb_user_id
    --> Redirection vers app.html
```

### 5.2 Pages sans authentification

| Page | Acces |
|------|-------|
| `index.html` | Public (landing page) |
| `login.html` | Public (formulaire d'authentification) |
| `quote.html` | Public via token URL (soumission client) |
| `fiche.html` | Mode dual : affichage public + editeur authentifie |

### 5.3 Refresh automatique des tokens

Toutes les pages authentifiees utilisent `authenticatedFetch(url, options)` :

1. Execute le fetch avec `Authorization: Bearer {access_token}`
2. **Refresh proactif** : verifie l'expiration 300s avant terme
3. Si reponse **401** : tente un refresh via `POST /auth/v1/token?grant_type=refresh_token`
4. Si refresh reussi : met a jour les tokens en localStorage, rejoue la requete originale
5. Si refresh echoue : retry 2x avec 1s d'attente, puis vide localStorage et redirige vers `login.html`

### 5.4 Garde de session

Chaque page authentifiee verifie la presence du token en localStorage au chargement. Sans token valide, redirection vers `login.html`.

### 5.5 Edge Functions -- Verification JWT

Les 4 Edge Functions sont deployees avec `--no-verify-jwt` (la verification JWT native de Supabase retournait "Invalid JWT" sur des tokens valides). Chaque fonction effectue une verification manuelle :

1. Verifie la presence du header `Authorization: Bearer ...`
2. Decode le payload JWT en base64
3. Verifie la presence du claim `sub` (user ID)
4. Verifie que `exp` n'est pas depasse (grace period de 30s)
5. **Pas de verification de signature** -- le client Supabase initialise avec le token enforce le RLS

### 5.6 Points d'attention

- `authenticatedFetch()` est **duplique** dans chaque fichier HTML -- modifier partout si changement
- Comportement incoherent : `fiche.html` et `approbation.html` retournent la reponse au lieu de rediriger vers login en cas d'echec de refresh
- Les verifications de permissions sont **cote client uniquement** (contournables via DevTools)
- La cle anon Supabase est incluse dans toutes les requetes via le header `apikey`

---

## 6. Points d'integration API Claude

L'application utilise l'API Anthropic Claude a travers 4 Edge Functions. Toutes les communications passent par les Edge Functions Supabase (jamais d'appel direct depuis le navigateur).

### 6.1 Modeles utilises

| Modele | ID | Utilisation |
|--------|----|-------------|
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | ai-assistant, catalogue-import, contacts-import |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | translate (actions JSON/vision) |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | translate (texte simple) |

### 6.2 Secret

Toutes les Edge Functions utilisent la variable d'environnement `ANTHROPIC_API_KEY` configuree dans Supabase Secrets.

### 6.3 Architecture d'appel

```
Navigateur (HTML page)
  |
  | authenticatedFetch() avec JWT
  v
Edge Function Supabase (Deno)
  |
  | 1. Verification JWT manuelle
  | 2. Construction system prompt + contexte
  | 3. Appel API Anthropic (HTTPS)
  |
  v
API Anthropic (https://api.anthropic.com/v1/messages)
  |
  | Reponse JSON ou stream SSE
  v
Edge Function
  |
  | Relay de la reponse au navigateur
  v
Navigateur
  |
  | Execution des outils cote client (si confirme par l'utilisateur)
  v
DOM + Supabase (sauvegarde)
```

### 6.4 Contexte AI (calculateur)

La fonction `collectAiContext()` dans `calculateur.html` assemble le contexte envoye a l'assistant AI :

- Infos projet : nom, client, designer, adresse
- Soumission : id, numero, statut, titre
- Resume des pieces : nom, nombre d'items, sous-total, installation
- Details piece focus (si scope=room) : items, prix, rentabilite
- Taux horaires et categories de depenses (markup, waste)
- Resume du catalogue (groupe par categorie)
- Fiche client (via table `contacts` : nom, email, entreprise, notes, historique)
- Benchmarks, materiaux par defaut, nomenclature des tags
- Images de reference marquees "AI"
- Apprentissages organisationnels (table `ai_learnings`)

### 6.5 Persistance des conversations

- Messages sauves dans `chat_messages` par soumission
- Chargement au premier ouverture du drawer AI (`loadAiChat`)
- Reset au changement de soumission

### 6.6 Prompts personnalisables

Les prompts systeme des Edge Functions `catalogue-import` et `contacts-import` sont personnalisables via `app_config` cle `ai_prompt_overrides` (administrable dans `admin.html`).

---

## 7. Deploiement

### 7.1 Netlify (frontend)

| Propriete | Valeur |
|-----------|--------|
| **Source** | GitHub -- `Scopewright/scopewright` |
| **Branche** | `main` |
| **Build** | Aucun (pas de build step) |
| **Configuration** | Pas de `netlify.toml`, pas de `_headers` |
| **Deploiement** | Auto-deploy a chaque push sur `main` |

Tous les fichiers HTML sont servis directement sans transformation.

### 7.2 Supabase (backend)

| Propriete | Valeur |
|-----------|--------|
| **URL** | `https://rplzbtjfnwahqodrhpny.supabase.co` |
| **Services** | PostgreSQL + Auth + Storage + Edge Functions |
| **Migrations** | 36 fichiers SQL dans `sql/`, executes manuellement dans le SQL Editor |
| **Edge Functions** | 4 fonctions Deno deployees via CLI |

### 7.3 Deploiement des Edge Functions

```bash
# CLI pas installe globalement -- utiliser npx
npx supabase functions deploy ai-assistant
npx supabase functions deploy catalogue-import
npx supabase functions deploy contacts-import
npx supabase functions deploy translate

# Configurer le secret API (une seule fois)
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Les 4 fonctions sont deployees avec `--no-verify-jwt` (verification manuelle dans le code).

### 7.4 Google Apps Script

| Propriete | Valeur |
|-----------|--------|
| **Fichier source** | `google_apps_script.gs` |
| **Deploiement** | Manuel dans l'editeur Google Apps Script |
| **Declencheur** | Endpoint web (`doPost`) |
| **Contrainte** | Redeploiement manuel **obligatoire** apres chaque modification du `.gs` |

### 7.5 Migrations SQL

- 36 fichiers dans `sql/`
- Executees manuellement dans le SQL Editor de Supabase
- Pas de runner de migrations automatique
- Pas de versioning (pas de up/down)
- Pas de tracking d'execution (verifier manuellement)

---

## 8. Buckets Storage

Supabase Storage est utilise pour stocker les fichiers binaires (images, PDF, snapshots).

| Bucket | Usage | Pattern de chemin | Utilise par |
|--------|-------|-------------------|-------------|
| `room-images` | Images des meubles (projets) | `originals/{submissionId}/...`, `cropped/{submissionId}/...` | calculateur.html, quote.html |
| `fiche-images` | Medias du catalogue produit | `{itemId}/{timestamp}_{index}.{ext}` | catalogue_prix_stele_complet.html, fiche.html |
| `submission-plans` | Plans PDF des soumissions | `{submissionId}/v{version}_{filename}` | calculateur.html |
| `submission-snapshots` | Snapshots HTML de soumissions verrouillee | *(chemin variable)* | calculateur.html |
| `assets` | Images statiques (cover, intro) | *(chemin variable)* | calculateur.html (presentation) |

### 8.1 Traitement des images

- **Compression cote client** : canvas resize + JPEG qualite 0.7 avant upload
- **Recadrage** : Cropper.js integre dans calculateur.html, ratios `16:9`, `9:16`, `1:1`
- **Originals** : toujours conserves dans `originals/` meme apres recadrage
- **Cropped** : version recadree dans `cropped/`, metadonnees dans `room_media.crop_data`

### 8.2 Plans PDF

- Upload avec versioning incremental via RPC `get_next_plan_version`
- Viewer integre avec pdf.js (charge dynamiquement depuis CDN)
- Capture d'ecran d'une zone du PDF -> crop modal -> sauvegarde dans `room_media` avec `source_metadata`
