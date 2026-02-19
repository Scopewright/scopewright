# ARCHITECTURE — Scopewright (Stele)

> Documentation de référence du projet. Dernière mise à jour : 2026-02-15.
> Dernier audit complet : 2026-02-10.

---

## Table des matières

1. [Structure des fichiers](#1-structure-des-fichiers)
2. [Structure Supabase](#2-structure-supabase)
3. [Prix composé (labor + matériaux)](#3-prix-composé-labor--matériaux)
4. [Système de permissions](#4-système-de-permissions)
5. [Authentification & tokens](#5-authentification--tokens)
6. [Google Apps Script (envoi email)](#6-google-apps-script-envoi-email)
7. [Edge Functions Supabase](#7-edge-functions-supabase)
8. [Assistant AI (Chatbox)](#8-assistant-ai-chatbox)
9. [Système de tags](#9-système-de-tags)
10. [Matériaux par défaut](#10-matériaux-par-défaut)
11. [Plans PDF](#11-plans-pdf)
12. [Annotations sur images](#12-annotations-sur-images)
13. [État d'avancement](#13-état-davancement)
14. [Audit — Points d'attention](#14-audit--points-dattention)

---

## 1. Structure des fichiers

### Fichiers de l'application web (déployés sur Netlify)

| Fichier | Rôle | Auth requise |
|---------|------|:------------:|
| `index.html` | Page d'accueil publique (landing page) | Non |
| `login.html` | Authentification Supabase (email/mot de passe) | Non |
| `app.html` | Tableau de bord — grille de cartes vers les outils, filtrées par permissions | Oui |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — affichage, CRUD items, images, prix composé | Oui |
| `calculateur.html` | Calculateur de projets — gestion projets, meubles, lignes, estimation, AI assistant | Oui |
| `admin.html` | Administration — permissions, rôles, catégories, tags, taux horaires, dépenses, nomenclature tags | Oui |
| `approbation.html` | Approbation : soumissions (workflow) + items proposés au catalogue | Oui |
| `quote.html` | Soumission client — vue publique avec acceptation + signature | Non (token URL) |
| `clients.html` | Gestion des clients (CRM) — contacts, entreprises, communications | Oui |
| `fiche.html` | Fiche de vente d'un produit — affichage public + éditeur authentifié | Optionnel |

### Fichiers de support

| Fichier | Rôle |
|---------|------|
| `google_apps_script.gs` | Cloud function Google Apps Script : génère l'email HTML + PDF d'estimation |
| `supabase/functions/ai-assistant/index.ts` | Edge Function Supabase : assistant AI avec Claude Sonnet 4.5 + tools |
| `supabase/functions/translate/index.ts` | Edge Function Supabase : traduction FR↔EN + optimisation descriptions via Claude Haiku |
| `catalogue.json` | Données de catalogue en JSON (export/fallback) |

### Fichiers SQL (migrations manuelles)

| Fichier | Rôle |
|---------|------|
| `sql/chat_messages.sql` | Table `chat_messages` + RLS + index (persistance conversations AI) |
| `sql/tags.sql` | Colonne `tag` sur `room_items` + nomenclature `tag_prefixes` dans `app_config` |
| `sql/default_materials.sql` | Colonne `default_materials` JSONB sur `submissions` |
| `sql/annotations.sql` | Colonne `annotations` JSONB sur `room_media` |

### Fichiers hors application (outils locaux, non déployés)

| Fichier | Rôle |
|---------|------|
| `dashboard.html` | Prototype de Gantt/timeline — localStorage uniquement, aucune intégration Supabase |
| `soumission.html` | Calculateur de soumission standalone — données hardcodées, pas de backend |
| `soumission.py` | Script Python pour soumission (outil local) |
| `convert_pptx_to_html.py` | Convertisseur PowerPoint → HTML |
| `catalogue_prix_stele.html` | Ancienne version du catalogue (remplacée par `_complet`) |
| `*.ps1` | Scripts PowerShell utilitaires (Excel, données) |
| `*.xlsx` | Fichiers Excel de travail (portes, soumissions, etc.) |
| `*.pdf` | Documents de référence (plans, guide de marque) |
| `landing-page/` | Landing page séparée (ne pas modifier — projet indépendant) |

### Déploiement

- **Hébergement** : Netlify (auto-deploy depuis GitHub)
- **Repo** : `Scopewright/scopewright` — branche `main`
- **Backend** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Email** : Google Apps Script (déploiement manuel requis après chaque modification du `.gs`)
- **Edge Functions** : Supabase Edge Functions (Deno) — déployées via `npx supabase functions deploy <nom>`
  - `ai-assistant` : assistant AI via Anthropic Claude Sonnet 4.5 — **DÉPLOYÉ**
  - `translate` : traduction FR↔EN + optimisation via Anthropic Claude Haiku — **DÉPLOYÉ**
- **Secret requis** : `ANTHROPIC_API_KEY` configuré dans Supabase Secrets Dashboard

---

## 2. Structure Supabase

**URL** : `https://rplzbtjfnwahqodrhpny.supabase.co`

### 2.1 Tables

#### `catalogue_items` — Produits du catalogue

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT (PK) | Code produit (ex: `BUD-001`, `PAN-003`) |
| `category` | TEXT | Catégorie (Budgétaire, Panneaux, Poignées, etc.) |
| `description` | TEXT | Description du produit |
| `type` | TEXT | Type d'unité (`unitaire`, `pi²`, `linéaire`, `%`) |
| `price` | NUMERIC | Prix unitaire (ou NULL pour "sur demande") |
| `instruction` | TEXT | Instructions / tooltip |
| `image_url` | TEXT | URL de l'image principale (synchronisée depuis item_media) |
| `in_calculator` | BOOLEAN | Visible dans le calculateur (défaut: true) |
| `has_sales_sheet` | BOOLEAN | Indique si une fiche de vente existe |
| `sort_order` | INTEGER | Ordre d'affichage |
| `labor_minutes` | JSONB | Minutes de travail par département (prix composé) |
| `material_costs` | JSONB | Coûts matériaux par catégorie (prix composé) |
| `status` | TEXT | `approved`, `pending`, ou NULL (= approved) |
| `proposed_by` | TEXT | Email de l'utilisateur ayant proposé l'item |

**Utilisée par** : catalogue_prix_stele_complet.html, calculateur.html, approbation.html, fiche.html

---

#### `projects` — Projets utilisateur

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `user_id` | UUID (FK → auth.users) | Propriétaire du projet |
| `name` | TEXT | Nom du projet |
| `client_name` | TEXT | Nom du client |
| `client_email` | TEXT | Email du client |
| `client_phone` | TEXT | Téléphone du client |
| `client_address` | TEXT | Adresse du client |
| `project_code` | TEXT | Code de projet (ex: `SOU-20260129-205814`) |
| `status` | TEXT | Legacy — le statut vit maintenant sur `submissions` |
| `description` | TEXT | Description / notes |
| `designer` | TEXT | Nom du designer / chargé de projet |
| `notes` | TEXT | Notes internes |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

**RLS** : `auth.uid() = user_id` — chaque utilisateur ne voit que ses propres projets.

**Utilisée par** : calculateur.html

---

#### `submissions` — Soumissions d'un projet

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK → projects) | Projet parent |
| `submission_number` | INTEGER (UNIQUE) | Numéro séquentiel global (séquence, démarre à 100) |
| `title` | TEXT | Titre de la soumission |
| `status` | TEXT | Statut workflow (voir §2.3) |
| `current_version` | INTEGER | Dernier numéro de version snapshot |
| `approved_total` | NUMERIC | Total approuvé (rempli à l'approbation) |
| `approved_by` | UUID | Utilisateur ayant approuvé |
| `approved_at` | TIMESTAMPTZ | Date d'approbation |
| `sent_at` | TIMESTAMPTZ | Date d'envoi au client |
| `accepted_at` | TIMESTAMPTZ | Date d'acceptation client |
| `accepted_by_name` | TEXT | Nom du client qui a accepté |
| `bypass_approval` | BOOLEAN | Indique si l'approbation a été bypassée |
| `clauses` | JSONB | Clauses du contrat `[{ clause_id, title, content, content_en, sort_order }]` |
| `default_materials` | JSONB | Matériaux par défaut `[{ type, catalogue_item_id, description }]` |
| `created_at` | TIMESTAMPTZ | Date de création |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

**Contrainte statut** : `draft`, `pending_internal`, `returned`, `approved_internal`, `sent_client`, `accepted`, `invoiced`

**RLS** : propriétaire via JOIN `projects.user_id = auth.uid()`, approbateurs peuvent voir/modifier les soumissions `pending_internal`.

**Utilisée par** : calculateur.html, approbation.html, quote.html

---

#### `submission_reviews` — Historique d'approbation/retour

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission concernée |
| `reviewer_id` | UUID (FK → auth.users) | Approbateur / auteur de l'action |
| `action` | TEXT | Type d'action (voir liste ci-dessous) |
| `comment` | TEXT | Commentaire (obligatoire pour retour) |
| `version_at_review` | INTEGER | Numéro de version au moment de la révision |
| `created_at` | TIMESTAMPTZ | Date de la révision |

**Actions possibles** : `submitted`, `approved`, `returned`, `sent`, `bypass`, `offline_accepted`, `invoiced`, `duplicated`, `unlocked`, `lost`, `reopened`

**RLS** : authentifié peut insérer, propriétaire + approbateurs peuvent lire.

**Utilisée par** : calculateur.html, approbation.html

---

#### `project_rooms` — Pièces / meubles d'une soumission

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK → projects) | Projet parent (transition, sera supprimé) |
| `submission_id` | UUID (FK → submissions) | Soumission parent |
| `name` | TEXT | Nom du meuble / de la pièce |
| `sort_order` | INTEGER | Ordre d'affichage |
| `installation_included` | BOOLEAN | Toggle installation (défaut: true) |
| `images` | JSONB | Images legacy (base64) `[{ name, dataUrl, showInQuote }]` |
| `client_description` | TEXT | Description visible par le client (FR) |
| `client_description_en` | TEXT | Description visible par le client (EN) |

**RLS** : via JOIN chain depuis `projects` (propriétaire) ou `submissions` (approbateur).

**Utilisée par** : calculateur.html, quote.html

---

#### `room_items` — Lignes de calcul d'un meuble

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `room_id` | UUID (FK → project_rooms) | Meuble parent |
| `item_type` | TEXT | `catalogue` ou `custom` (personnalisé) |
| `catalogue_item_id` | TEXT (FK → catalogue_items) | Réf. catalogue (si `item_type=catalogue`) |
| `description` | TEXT | Description (auto ou manuelle) |
| `unit_type` | TEXT | Type d'unité |
| `unit_price` | NUMERIC | Prix unitaire calculé |
| `quantity` | NUMERIC | Quantité |
| `markup` | NUMERIC | Majoration en % |
| `line_total` | NUMERIC (GENERATED) | `quantity × unit_price × (1 + markup/100)` — colonne calculée PostgreSQL |
| `installation_included` | BOOLEAN | Toggle installation par ligne (défaut: true) |
| `sort_order` | INTEGER | Ordre d'affichage |
| `tag` | TEXT | Tag d'identification (ex: `C1`, `F2`, `P1`) — voir §9 |

**RLS** : via JOIN chain depuis `projects`.

**Utilisée par** : calculateur.html

---

#### `room_media` — Images des meubles (Supabase Storage)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `room_id` | UUID (FK → project_rooms) | Meuble parent |
| `original_url` | TEXT | URL Supabase Storage de l'image originale |
| `cropped_url` | TEXT | URL de l'image recadrée |
| `crop_ratio` | TEXT | Format de recadrage (`16:9`, `9:16`, `1:1`) |
| `crop_data` | JSONB | Données Cropper.js pour le recadrage |
| `tags` | JSONB (array) | Tags de classification (ex: `["presentation_soumission"]`) |
| `annotations` | JSONB (array) | Labels visuels placés sur l'image — voir §12 |
| `source_metadata` | JSONB | Métadonnées de source (ex: plan PDF, page, coords) |
| `sort_order` | INTEGER | Ordre d'affichage |

**Storage bucket** : `room-images` (chemins `originals/{submissionId}/...` et `cropped/{submissionId}/...`)

**Utilisée par** : calculateur.html, quote.html

---

#### `project_versions` — Snapshots historiques

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `project_id` | UUID (FK → projects) | Projet associé (transition) |
| `submission_id` | UUID (FK → submissions) | Soumission associée |
| `version_number` | INTEGER | Numéro de version séquentiel |
| `snapshot` | JSONB | Snapshot complet des données du calculateur |
| `status_at_save` | TEXT | Statut de la soumission au moment du snapshot |
| `created_by` | TEXT | ID de l'utilisateur |

**Utilisée par** : calculateur.html — snapshot créé automatiquement lors de : soumission pour approbation, approbation, envoi au client, acceptation hors-ligne, bypass, déverrouillage d'urgence.

**Contenu enrichi du snapshot** : le snapshot JSONB inclut `projectName`, `clientName`, `clientEmail`, `clientAddress`, `designer`, `clauses`, `status`, `approvedTotal`, et pour chaque meuble : `clientDescription`, `installationIncluded`, `mediaUrls[]` (références sans base64).

---

#### `chat_messages` — Persistance des conversations AI

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission associée |
| `role` | TEXT | `user`, `assistant`, ou `summary` |
| `content` | TEXT | Contenu textuel du message |
| `image_urls` | TEXT[] | URLs des images envoyées (array PostgreSQL) |
| `tool_calls` | JSONB | Appels d'outils AI (pour historique) |
| `pending_actions` | JSONB | Actions en attente de confirmation |
| `created_at` | TIMESTAMPTZ | Date du message |

**Index** : `idx_chat_messages_submission(submission_id, created_at)`

**RLS** : SELECT, INSERT, DELETE — propriétaire via JOIN `submissions → projects.user_id = auth.uid()`

**Utilisée par** : calculateur.html (drawer AI)

---

#### `submission_plans` — Plans PDF attachés aux soumissions

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission associée |
| `file_path` | TEXT | Chemin dans le bucket `submission-plans` |
| `file_type` | TEXT | Type de fichier (ex: `application/pdf`) |
| `version_number` | INTEGER | Version du plan (incrémentale) |
| `uploaded_by` | UUID | Utilisateur ayant uploadé |
| `created_at` | TIMESTAMPTZ | Date d'upload |

**Storage bucket** : `submission-plans` (chemins `{submissionId}/v{version}_{filename}`)

**Utilisée par** : calculateur.html (modal Plans)

---

#### `employees` — Employés

| Colonne | Type | Description |
|---------|------|-------------|
| `name` | TEXT | Nom de l'employé |
| `email` | TEXT | Email |
| `sort_order` | INTEGER | Ordre d'affichage |

**Utilisée par** : calculateur.html (dropdown "chargé de projet" dans le modal d'envoi)

---

#### `app_config` — Configuration et permissions

| Colonne | Type | Description |
|---------|------|-------------|
| `key` | TEXT (PK) | Clé de configuration |
| `value` | JSONB | Valeur (polymorphe) |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

**Clés stockées :**

| Clé | Type de valeur | Description | Gérée dans |
|-----|---------------|-------------|------------|
| `permissions` | `{ "NomRôle": { "clé_permission": bool } }` | Matrice rôles × permissions | admin.html |
| `user_roles` | `{ "email": "NomRôle" }` | Attribution email → rôle | admin.html |
| `catalogue_categories` | `["Budgétaire", "Panneaux", ...]` | Catégories du catalogue | admin.html |
| `media_tags` | `["fiche_client", "catalogue", "technique", "dessin"]` | Tags pour les médias | admin.html |
| `taux_horaires` | `[{ department, taux_horaire, frais_fixe, salaire }]` | Taux horaires par département (7 depts) | admin.html |
| `expense_categories` | `[{ name, markup, waste }]` | Catégories de dépenses + majoration % + perte % (23 cats) | admin.html |
| `tag_prefixes` | `[{ prefix, label_fr, label_en, sort_order }]` | Nomenclature des tags (C, F, P, T, M, A) | admin.html |

---

#### `item_media` — Médias des items du catalogue

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `catalogue_item_id` | TEXT (FK → catalogue_items) | Item associé |
| `file_url` | TEXT | URL publique (Supabase Storage) |
| `file_type` | TEXT | `image` ou `pdf` |
| `tags` | JSONB (array) | Tags de classification (ex: `["fiche_client", "technique"]`) |
| `sort_order` | INTEGER | Ordre d'affichage |

**Storage** : bucket `fiche-images`, chemin `{itemId}/{timestamp}_{index}.{ext}`

**Utilisée par** : catalogue_prix_stele_complet.html (CRUD complet), fiche.html (lecture), admin.html (propagation renommage tags)

---

#### `fiches_vente` — Fiches de vente (contenu éditorial)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `catalogue_item_id` | TEXT (FK → catalogue_items) | Item associé |
| `published` | BOOLEAN | Publié (visible sans auth) ou brouillon |
| *(contenu JSONB)* | JSONB | Métadonnées éditées dans fiche.html |

**Utilisée par** : fiche.html (lecture publique + CRUD authentifié)

---

#### `quote_clauses` — Bibliothèque de clauses contractuelles

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `title` | TEXT | Titre de la clause (ex: "Délai de livraison") |
| `content_fr` | TEXT | Contenu en français |
| `content_en` | TEXT | Contenu en anglais |
| `sort_order` | INTEGER | Ordre d'affichage dans la bibliothèque |
| `created_at` | TIMESTAMPTZ | Date de création |

**Utilisée par** : calculateur.html (bibliothèque de clauses dans le panneau droit de l'aperçu, glisser-déposer vers la soumission)

---

#### `submission_unlock_logs` — Journal de déverrouillage d'urgence (IMMUABLE)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission déverrouillée |
| `unlocked_by` | UUID | ID utilisateur Supabase qui a déverrouillé |
| `unlocked_by_name` | TEXT | Nom complet saisi par l'utilisateur |
| `reason` | TEXT | Raison du déverrouillage (obligatoire) |
| `previous_status` | TEXT | Statut avant déverrouillage |
| `ip_address` | INET | Adresse IP capturée côté serveur |
| `created_at` | TIMESTAMPTZ | Date de l'action |

**RLS** : INSERT + SELECT uniquement (pas de UPDATE/DELETE) → table immuable pour audit.

**Utilisée par** : calculateur.html (via RPC `log_submission_unlock`)

---

#### `public_quote_tokens` — Tokens de soumission publique

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission associée |
| `token` | TEXT (UNIQUE) | Token aléatoire pour URL publique |
| `accepted_at` | TIMESTAMPTZ | Date d'acceptation en ligne |
| `accepted_by_name` | TEXT | Nom du signataire |
| `accepted_by_email` | TEXT | Email du signataire |
| `accepted_from_ip` | INET | IP du signataire |
| `signature_data` | TEXT | Données de signature (base64 PNG) |
| `created_at` | TIMESTAMPTZ | Date de création du token |

**Utilisée par** : calculateur.html (création token), quote.html (lecture + acceptation)

---

#### Tables CRM (`clients.html`)

| Table | Colonnes principales | Description |
|-------|---------------------|-------------|
| `contacts` | id, first_name, last_name, phone, email | Contacts CRM |
| `companies` | id, name | Entreprises |
| `contact_companies` | contact_id, company_id | Table de jonction |
| `communications` | id, contact_id, type, content, created_at | Log des interactions |
| `user_profiles` | user_id, contact_id | Liaison auth.users ↔ contacts |
| `roles` | id, name, sort_order | Rôles système (6 rôles) |
| `user_roles` | email, role_id | Attribution email → rôle DB |

---

#### `waitlist` — Inscriptions landing page (publique)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `name` | TEXT | Nom |
| `email` | TEXT (indexé) | Email |
| `company` | TEXT | Entreprise |
| `message` | TEXT | Message |
| `lang` | TEXT | Langue (`fr` ou `en`) |
| `created_at` | TIMESTAMPTZ (indexé) | Date d'inscription |

**RLS** : INSERT anon (public), SELECT authentifié (admin uniquement)

---

### 2.2 Storage Buckets

| Bucket | Usage | Pattern de chemin | Utilisé dans |
|--------|-------|-------------------|--------------|
| `fiche-images` | Médias du catalogue produit | `{itemId}/{timestamp}_{index}.{ext}` | catalogue, fiche.html |
| `room-images` | Images des meubles (projets) | `originals/{subId}/...`, `cropped/{subId}/...` | calculateur.html, quote.html |
| `submission-plans` | Plans PDF des soumissions | `{subId}/v{version}_{filename}` | calculateur.html |

### 2.3 Relations entre les tables

```
auth.users
  └─── projects (user_id)
         └─── submissions (project_id)
                ├─── project_rooms (submission_id)
                │      ├─── room_items (room_id)
                │      └─── room_media (room_id)
                ├─── project_versions (submission_id)
                ├─── submission_reviews (submission_id)
                ├─── submission_plans (submission_id)
                ├─── chat_messages (submission_id)
                ├─── public_quote_tokens (submission_id)
                └─── submission_unlock_logs (submission_id)

catalogue_items (id = code texte)
  └─── item_media (catalogue_item_id)
  └─── fiches_vente (catalogue_item_id)
  └─── room_items (catalogue_item_id) — référence optionnelle

contacts → contact_companies → companies (CRM)
communications (contact_id)
user_profiles (user_id → contact_id)

employees — table indépendante (liste pour dropdowns)
app_config — table clé-valeur indépendante (configuration globale)
quote_clauses — bibliothèque de clauses (indépendante, copiées dans submissions.clauses)
waitlist — inscriptions publiques (landing page)
```

### 2.4 Workflow des soumissions

```
draft → pending_internal ←→ returned
  │        ↓
  │   approved_internal → sent_client → accepted → invoiced
  │                           ↑ bypass        ↑ offline
  │                           │               │
  └───────────────────────────┘               │
                                              │
  ┌───────────────────────────────────────────┘
  │  Déverrouillage d'urgence (can_unlock_submission) :
  │  tout statut verrouillé → draft (avec audit immuable)
```

| Statut | Label FR | Signification |
|--------|----------|---------------|
| `draft` | Brouillon | En cours de rédaction |
| `pending_internal` | En approbation | Soumise pour révision interne |
| `returned` | Retournée | Retournée avec commentaire par l'approbateur |
| `approved_internal` | Approuvée | Approuvée en interne, prête à envoyer |
| `sent_client` | Envoyée client | Lien public généré, envoyée au client |
| `accepted` | Acceptée | Client a accepté (signature en ligne ou hors-ligne) |
| `invoiced` | Facturée | Facturée (statut terminal) |

**Chemins alternatifs :**

- **Auto-approbation** : `can_approve_quotes` → `draft`/`returned` directement à `approved_internal`
- **Bypass** : `can_bypass_approval` → `draft`/`returned` directement à `sent_client` (token généré, logged)
- **Acceptation hors-ligne** : `sent_client` → `accepted` via confirmation manuelle (RPC `log_offline_acceptance`)
- **Déverrouillage d'urgence** : tout statut verrouillé → `draft` (permission `can_unlock_submission`, snapshot + audit immuable avec IP)
- **Duplication** : toute soumission → nouveau brouillon (copie profonde rooms + items + media, via RPC `duplicate_submission`)

**Gel du contenu** : Dès qu'une soumission quitte le statut `draft`/`returned`, le calculateur est verrouillé : inputs, boutons, checkboxes, zones de drop d'images, et suppression d'images sont désactivés. La fonction `isSubmissionCurrentlyEditable()` centralise cette logique.

**Numérotation** : Séquence PostgreSQL `submission_number_seq`, démarre à 100, globale (pas par projet).

### 2.5 Fonctions RPC Supabase

| Fonction | Paramètres | Description |
|----------|-----------|-------------|
| `log_bypass_approval` | `p_submission_id, p_user_name, p_reason` | Log immuable d'un bypass avec capture IP (`SECURITY DEFINER`) |
| `log_offline_acceptance` | `p_submission_id, p_user_name, p_acceptance_method, p_acceptance_date, p_client_name, p_notes` | Log immuable d'une acceptation hors-ligne avec capture IP |
| `log_submission_unlock` | `p_submission_id, p_user_name, p_reason, p_previous_status` | Log immuable d'un déverrouillage d'urgence avec capture IP |
| `duplicate_submission` | `p_submission_id` → `UUID` | Copie profonde d'une soumission (rooms, items, media) en nouveau brouillon |
| `get_public_quote` | `p_token` | Retourne les données de soumission pour la vue client publique |

---

## 3. Prix composé (labor + matériaux)

### 3.1 Concept

Certains items du catalogue n'ont pas de prix fixe. Leur prix est **calculé dynamiquement** à partir de :
- **Minutes de travail** par département (main d'oeuvre)
- **Coûts de matériaux** par catégorie de dépense

### 3.2 Structure des données JSONB

**`labor_minutes`** sur `catalogue_items` :
```json
{
  "Gestion/dessin": 15,
  "Coupe/edge": 30,
  "Assemblage": 20,
  "Machinage": 10,
  "Sablage": 15,
  "Peinture": 25,
  "Installation": 45
}
```

**`material_costs`** sur `catalogue_items` :
```json
{
  "BOIS BRUT": 45.00,
  "PANNEAUX MDF": 30.00,
  "QUINCAILLERIE": 12.50
}
```

### 3.3 Données de configuration (app_config)

**`taux_horaires`** — 7 départements fixes :
```json
[
  { "department": "Gestion/dessin", "taux_horaire": 65.00, "frais_fixe": 10.00, "salaire": 35.00 },
  { "department": "Coupe/edge",     "taux_horaire": 55.00, "frais_fixe": 8.00,  "salaire": 30.00 },
  { "department": "Assemblage",     "taux_horaire": 55.00, "frais_fixe": 8.00,  "salaire": 30.00 },
  { "department": "Machinage",      "taux_horaire": 60.00, "frais_fixe": 10.00, "salaire": 32.00 },
  { "department": "Sablage",        "taux_horaire": 50.00, "frais_fixe": 7.00,  "salaire": 28.00 },
  { "department": "Peinture",       "taux_horaire": 55.00, "frais_fixe": 8.00,  "salaire": 30.00 },
  { "department": "Installation",   "taux_horaire": 65.00, "frais_fixe": 12.00, "salaire": 35.00 }
]
```
> Le profit est affiché dans admin.html : `profit = taux_horaire - frais_fixe - salaire`

**`expense_categories`** — 23 catégories avec majoration :
```json
[
  { "name": "BOIS BRUT", "markup": 30, "waste": 5 },
  { "name": "PANNEAUX MDF", "markup": 30, "waste": 3 },
  ...
]
```

### 3.4 Formule de calcul

La fonction `computeComposedPrice(item, includeInstallation)` dans `calculateur.html` :

```
Prix = Main d'oeuvre + Matériaux

Main d'oeuvre = Σ pour chaque département :
  (minutes / 60) × taux_horaire
  (exclut "Installation" si includeInstallation = false)

Matériaux = Σ pour chaque catégorie de dépense :
  coût × (1 + markup% / 100 + waste% / 100)

  waste% = facteur de perte (défaut: 0%)
  Prix coûtant = coût × (1 + waste/100) — inclut la perte, PAS le markup
  Profit matériaux = coût × markup/100 — le markup seulement
  Prix vendu = coût × (1 + waste/100 + markup/100) — perte + markup parallèles
```

Si le résultat est > 0, il remplace `item.price`. Sinon, le prix fixe `item.price` est utilisé.

### 3.5 Toggle Installation

- Chaque meuble (`project_rooms`) a un champ `installation_included` (BOOLEAN, défaut: true)
- Dans le calculateur, un checkbox par meuble contrôle ce toggle
- Quand décoché : le département "Installation" est **exclu** du calcul de prix composé
- La valeur est persistée en base et restaurée au chargement du projet

### 3.6 Édition du prix composé

**Dans `catalogue_prix_stele_complet.html`** (modal d'édition) :
- Tableaux de saisie pour les minutes et les coûts matériaux
- Calcul en temps réel avec breakdown `(MO: $X + Mat: $Y)`
- Auto-remplissage du champ prix
- Contrôlé par les permissions `edit_minutes` et `edit_materials`

**Dans `calculateur.html`** :
- Lecture seule — le prix composé est calculé automatiquement à partir des données du catalogue
- Pas de vérification des permissions `edit_minutes` / `edit_materials` (non nécessaire car pas d'édition)

---

## 4. Système de permissions

### 4.1 Rôles

6 rôles prédéfinis (gérés dans `admin.html`) :

| Rôle | Description |
|------|-------------|
| **Admin** | Accès complet à toutes les fonctionnalités |
| **Vente** | Catalogue (lecture + édition), calculateur, pas d'admin |
| **Chargé de projet** | Catalogue (lecture), calculateur, pas d'édition |
| **Achat** | Catalogue (lecture), édition matériaux (prix composé) |
| **Atelier** | Documents uniquement |
| **Client** | Aucun accès (rôle par défaut) |

### 4.2 Clés de permissions

| Clé | Description | Admin | Vente | Chargé projet | Achat | Atelier | Client |
|-----|-------------|:-----:|:-----:|:--------------:|:-----:|:-------:|:------:|
| `catalogue` | Voir le catalogue | ✓ | ✓ | ✓ | ✓ | — | — |
| `catalogue_edit` | Éditer le catalogue | ✓ | ✓ | — | — | — | — |
| `calculateur` | Accès au calculateur | ✓ | ✓ | ✓ | — | — | — |
| `documents` | Accès aux documents | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `assistant` | Assistant de vente | ✓ | ✓ | — | — | — | — |
| `admin` | Panneau d'administration | ✓ | — | — | — | — | — |
| `approbation` | Approuver les propositions | ✓ | — | — | — | — | — |
| `edit_minutes` | Éditer les minutes (prix composé) | ✓ | — | — | — | — | — |
| `edit_materials` | Éditer les matériaux (prix composé) | ✓ | — | — | ✓ | — | — |
| `can_approve_quotes` | Approuver les soumissions (workflow) | ✓ | — | — | — | — | — |
| `can_bypass_approval` | Envoyer sans approbation (bypass) | ✓ | — | — | — | — | — |
| `can_unlock_submission` | Déverrouiller une soumission vendue | ✓ | — | — | — | — | — |

### 4.3 Stockage

- **Matrice** : `app_config` clé `permissions` → JSONB `{ "Admin": { "catalogue": true, ... }, ... }`
- **Attribution** : `app_config` clé `user_roles` → JSONB `{ "email@stele.ca": "Admin", ... }`
- **Défaut** : si pas de rôle trouvé pour un email → rôle `Client`
- **Merge** : les permissions sauvegardées sont fusionnées avec les défauts pour les nouvelles clés

### 4.4 Vérification par page

| Page | Permissions vérifiées | Méthode |
|------|----------------------|---------|
| `app.html` | Toutes (affichage des cartes) | Classe CSS `tool-card--no-access` + suppression href |
| `catalogue_prix_stele_complet.html` | `catalogue_edit`, `edit_minutes`, `edit_materials` | Boutons d'édition masqués |
| `calculateur.html` | `calculateur` | `checkPageAccess()` → redirige `app.html` si refusé |
| `admin.html` | `admin` | `checkPageAccess()` → redirige `app.html` si refusé |
| `approbation.html` | `approbation` | `checkPageAccess()` → redirige `app.html` si refusé |
| `fiche.html` | `catalogue_edit` | Bouton d'édition masqué |

> **Attention** : Les vérifications `checkPageAccess()` sont **côté client uniquement** (JavaScript). Elles peuvent être contournées via DevTools en modifiant localStorage. La vraie protection doit venir du **RLS Supabase** sur les tables. Voir [section 14](#14-audit--points-dattention).

---

## 5. Authentification & tokens

### 5.1 Flux d'authentification

```
index.html (public)
  → login.html
    → POST /auth/v1/token?grant_type=password
    → Stockage localStorage :
        sb_access_token   (JWT, ~1h)
        sb_refresh_token  (~30 jours)
        sb_user_email
        sb_user_id
    → Redirection vers app.html
```

### 5.2 Refresh automatique

Toutes les pages authentifiées utilisent `authenticatedFetch(url, options)` :

1. Exécute le fetch avec `Authorization: Bearer {access_token}`
2. Si réponse 401 : tente un refresh via `POST /auth/v1/token?grant_type=refresh_token`
3. Si refresh réussi : met à jour les tokens en localStorage, rejoue la requête
4. Si refresh échoué : vide le localStorage, redirige vers `login.html`

### 5.3 Clé API

La clé anon Supabase est incluse dans toutes les requêtes via le header `apikey`.

---

## 6. Google Apps Script (envoi email)

### 6.1 Endpoint

```
https://script.google.com/macros/s/AKfycby.../exec
```

### 6.2 Payload (envoyé depuis `calculateur.html`)

```json
{
  "projectCode": "#100 — Cuisine Tremblay",
  "projectManager": "Nom du chargé",
  "managerEmail": "email@stele.ca",
  "projectDate": "29 janvier 2026",
  "description": "Notes optionnelles",
  "submissionNumber": 100,
  "submissionTitle": "Cuisine Tremblay",
  "meubles": [
    {
      "name": "Cuisine",
      "items": [
        {
          "type": "catalogue",
          "description": "Panneau MDF 3/4",
          "quantity": 5,
          "unitPrice": "45,00 $",
          "lineTotal": "225,00 $"
        }
      ],
      "subtotal": "225,00 $",
      "images": [{ "name": "photo.jpg", "mimeType": "image/jpeg", "data": "base64..." }]
    }
  ],
  "total": "225,00 $",
  "images": []
}
```

### 6.3 Traitement côté GAS

1. Parse le JSON reçu
2. Génère un email HTML avec tableaux par meuble + sous-totaux + total
3. Convertit le HTML en PDF (via `HtmlService`)
4. Envoie à `soumissions@stele.ca` + CC au chargé de projet
5. Attache les images en pièces jointes

### 6.4 Contraintes techniques

- Fetch avec `mode: 'no-cors'` — pas de lecture de la réponse côté client
- `Content-Type: text/plain` (obligatoire pour no-cors)
- Redéploiement manuel requis après chaque modification du `.gs`

---

## 7. Edge Functions Supabase

### 7.1 `ai-assistant` — Assistant AI intelligent

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/ai-assistant/index.ts` |
| **Modèle** | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| **Max tokens** | 4096 |
| **JWT** | Vérifié (défaut Supabase — pas de `--no-verify-jwt`) |
| **Secret** | `ANTHROPIC_API_KEY` |
| **Statut** | DÉPLOYÉ |

**6 outils disponibles :**

| Outil | Action | Confirmation requise |
|-------|--------|:--------------------:|
| `analyze_rentability` | Calcul rentabilité (projet ou pièce) | Oui |
| `write_description` | Rédiger/réécrire description client HTML | Oui |
| `add_catalogue_item` | Ajouter un article du catalogue | Oui |
| `update_item_quantity` | Modifier quantité d'une ligne | Oui |
| `suggest_items` | Rechercher dans le catalogue | Non (lecture seule) |
| `compare_versions` | Comparer deux versions de soumission | Non (lecture seule) |

**Mode simulation** : L'AI propose les modifications en texte. L'utilisateur doit explicitement confirmer avant exécution côté client.

Voir §8 pour les détails complets.

### 7.2 `translate` — Traduction et optimisation

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `supabase/functions/translate/index.ts` |
| **Modèle** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| **Max tokens** | 4096 (simple) / 8192 (batch) |
| **JWT** | Vérifié (défaut) |
| **Secret** | `ANTHROPIC_API_KEY` |
| **Statut** | DÉPLOYÉ |

**3 modes :**

| Mode | Description |
|------|-------------|
| `translate` | Traduction FR → EN |
| `en_to_fr` | Traduction EN → FR canadien |
| `optimize` | Optimisation/formatage descriptions client en HTML structuré |

**Batch** : supporte le traitement groupé via séparateur `===SEPARATOR===` en un seul appel API.

### 7.3 Déploiement

```bash
# Déployer une Edge Function
npx supabase functions deploy ai-assistant
npx supabase functions deploy translate

# Configurer le secret API (une seule fois)
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

> **Note** : `supabase` CLI n'est pas installé globalement — utiliser `npx supabase`.

---

## 8. Assistant AI (Chatbox)

### 8.1 Architecture

```
┌──────────────────┐    authenticatedFetch    ┌───────────────────────┐    API call    ┌─────────────┐
│  calculateur.html │  ──────────────────►    │  ai-assistant (Edge)  │  ──────────►  │  Anthropic   │
│  (Drawer UI)      │  ◄──────────────────    │  (system prompt +     │  ◄──────────  │  Claude 4.5  │
│                   │      JSON response      │   tools + context)    │   response    │  Sonnet      │
└──────────────────┘                          └───────────────────────┘               └─────────────┘
         │                                              │
         │  save/load                                   │  build context
         ▼                                              ▼
┌──────────────────┐                          ┌───────────────────────┐
│  chat_messages    │                          │  project data:        │
│  (Supabase table) │                          │  rooms, items, rates, │
│                   │                          │  catalogue, client    │
└──────────────────┘                          └───────────────────────┘
```

### 8.2 UI — Drawer latéral

- Tiroir fixe à droite (440px), ouvert via bouton "AI" dans le header du calculateur
- **Scope** : `project` (toute la soumission) ou `room` (pièce spécifique via bouton "AI" sur chaque meuble)
- **Quick actions** : 4 boutons prédéfinis (Rentabilité, Résumé, Descriptions, Améliorer marge)
- **Images** : drag & drop ou coller des images, compressées en JPEG 80% (max 1200px)
- **Confirmation** : les actions proposées par l'AI s'affichent avec boutons [Appliquer] / [Ignorer]

### 8.3 Contexte envoyé à l'AI

La fonction `collectAiContext()` assemble :
- Infos projet : nom, client, designer, adresse
- Soumission : id, numéro, statut, titre
- Résumé des pièces : nom, nb items, sous-total, installation
- Détails pièce focus (si scope=room) : items, prix, rentabilité
- Taux horaires + catégories de dépenses (markup, waste)
- Résumé du catalogue (groupé par catégorie)
- Fiche client (via table `contacts` : nom, email, entreprise, notes, historique communications)
- Benchmarks, matériaux par défaut, nomenclature des tags
- Images de référence marquées "AI"

### 8.4 Persistance

- Messages sauvés dans `chat_messages` par soumission
- Chargement au premier ouverture du drawer (`loadAiChat`)
- Reset au changement de soumission (`resetAiChat` — vide `aiConversation`, `aiClientFileCache`, `aiFocusGroupId`)

### 8.5 Exécution des outils (côté client)

Les outils sont exécutés dans `calculateur.html` par `executeAiTool(toolName, toolInput)` :
- `analyze_rentability` → appelle `computeRentabilityData()`
- `write_description` → met à jour le textarea et appelle `saveClientDescription()`
- `add_catalogue_item` → appelle `addRow()`, sélectionne l'item, met la quantité
- `update_item_quantity` → trouve la ligne par index, met à jour la quantité
- `suggest_items` → filtre `CATALOGUE_DATA` par recherche texte
- `compare_versions` → charge deux snapshots depuis `project_versions` et compare

---

## 9. Système de tags

### 9.1 Concept

Chaque ligne du calculateur peut porter un **tag** identifiant l'élément physique auquel elle correspond (ex: `C1` = Caisson 1, `F2` = Filler 2).

### 9.2 Nomenclature des préfixes

Configurable dans `admin.html` (section "Nomenclature des tags"), stockée dans `app_config.tag_prefixes` :

| Préfixe | Label FR | Label EN |
|---------|----------|----------|
| C | Caisson | Cabinet |
| F | Filler | Filler |
| P | Panneau | Panel |
| T | Tiroir | Drawer |
| M | Moulure | Moulding |
| A | Accessoire | Accessory |

### 9.3 Colonne `room_items.tag`

- `TEXT`, nullable, défaut `NULL`
- Valeur libre (ex: `C1`, `C2`, `F1`, `P3`)
- Input de 4 caractères dans la première colonne de chaque ligne du calculateur
- Sauvegardé via `saveRowTag()` (debounce)

### 9.4 Fonctionnalités liées

- **Barre de filtre** : `refreshTagFilterBar()` + `filterByTag()` — filtre les lignes par préfixe (C, F, P) ou tag exact (C1, C2). Chips granulaires quand un préfixe est actif.
- **Tri par colonnes** : `sortGroupRows()` — tri asc/desc sur Tag, Article, Prix, Quantité, Total
- **Rentabilité par tag** : dans le modal Rentabilité, ventilation par préfixe (prix vente, heures, matériaux, profit, marge)
- **Annotations sur images** : voir §12 — les tags placés sur les images correspondent aux tags des lignes

---

## 10. Matériaux par défaut

### 10.1 Concept

Chaque soumission peut définir des **matériaux par défaut** (ex: "Caisson → Merisier ME1", "Poignées → Bouton noir B-302"). Ces informations sont envoyées comme contexte à l'assistant AI et affichées dans la section de configuration de la soumission.

### 10.2 Structure JSONB (`submissions.default_materials`)

```json
[
  { "type": "Caisson", "catalogue_item_id": "BUD-001", "description": "Merisier ME1" },
  { "type": "Façades et panneaux apparents", "catalogue_item_id": null, "description": "Laque blanche" },
  { "type": "Tiroirs", "catalogue_item_id": "TIR-003", "description": "Legrabox Blum" }
]
```

### 10.3 Types fixes

6 types prédéfinis (variable `DM_TYPES` dans calculateur.html) :
- Caisson
- Façades et panneaux apparents
- Tiroirs
- Poignées
- Éclairage
- Autre

### 10.4 UI

- Section "Matériaux par défaut" dans la configuration de soumission
- Bouton "+ Ajouter un matériau" → ajoute une ligne
- Dropdown type + champ autocomplete qui cherche dans `CATALOGUE_DATA`
- L'autocomplete montre tous les items groupés par catégorie au focus (scrollable)
- Un item résolu affiche `[CODE] Description` en vert avec X pour supprimer

---

## 11. Plans PDF

### 11.1 Upload et versioning

- Modal "Plans" dans le calculateur (bouton dans le header de la soumission)
- Upload PDF → stocké dans bucket `submission-plans` avec chemin `{submissionId}/v{version}_{filename}`
- Chaque nouveau upload incrémente `version_number`
- Historique complet affiché avec date, nom de fichier, taille

### 11.2 Viewer PDF intégré

- Utilise **pdf.js** (chargé dynamiquement depuis CDN)
- Viewer en nouvelle fenêtre (`window.open`) avec contrôles :
  - Navigation page par page (précédent/suivant/saut)
  - Zoom (in/out/fit)
  - Capture d'écran d'une zone → ouvre le crop modal du calculateur → sauvegarde comme image de meuble
- Les captures PDF incluent `source_metadata` (plan_id, page, coordinates) dans `room_media`

### 11.3 Viewer inline

- Viewer PDF aussi intégré directement dans le calculateur (panneau latéral)
- Mêmes fonctionnalités que le standalone mais dans le contexte de la soumission
- Capture → sélection de la pièce cible → crop → sauvegarde dans `room_media`

---

## 12. Annotations sur images

### 12.1 Concept

Les designers placent des **labels de tags** (C1, F1, P1...) directement sur les images des meubles pour identifier visuellement les éléments physiques. Ces labels correspondent aux tags des lignes du calculateur (§9).

### 12.2 Structure JSONB (`room_media.annotations`)

```json
[
  { "id": "C1", "prefix": "C", "number": 1, "x": 0.45, "y": 0.32, "hasArrow": false, "arrowX": null, "arrowY": null },
  { "id": "C2", "prefix": "C", "number": 2, "x": 0.70, "y": 0.55, "hasArrow": true, "arrowX": 0.82, "arrowY": 0.60 }
]
```

- `x`, `y` = position du label en coordonnées relatives (0-1) par rapport à l'image
- `arrowX`, `arrowY` = point cible de la flèche (relatif aussi)

### 12.3 Modal d'annotation

- Bouton crayon (✏) sur chaque miniature d'image (toujours visible, top-left)
- Badge vert avec le nombre d'annotations si > 0
- Modal plein écran avec :
  - Dropdown préfixe (Caisson, Filler, Panneau, etc.) depuis `tagPrefixes`
  - Affichage du prochain numéro disponible (ex: "Prochain: C3")
  - Toggle "Mode flèche" pour placer une flèche pointant vers un élément
  - SVG overlay sur l'image pour le rendu des labels et flèches
- **Clic** sur l'image → place le tag au point cliqué
- **Drag & drop** → repositionner un label existant
- **Clic sur label** → confirmation de suppression (numéro réutilisable)
- **Auto-sauvegarde** → debounce 500ms vers `room_media.annotations`

---

## 13. État d'avancement

### 13.1 Fonctionnalités terminées

| Fonctionnalité | Page(s) | Notes |
|----------------|---------|-------|
| Landing page | index.html | Statique, complète |
| Authentification | login.html | Email/password, refresh auto |
| Tableau de bord | app.html | Cartes filtrées par permissions |
| Catalogue CRUD | catalogue_prix_stele_complet.html | Ajouter, éditer, supprimer items |
| Prix composé (catalogue) | catalogue_prix_stele_complet.html | Saisie minutes + matériaux, calcul temps réel |
| Gestion des médias | catalogue_prix_stele_complet.html | Upload, tags, images + PDF, Supabase Storage |
| Fiches de vente | fiche.html | Affichage public + éditeur authentifié |
| Calculateur de projets | calculateur.html | CRUD projets, meubles, lignes |
| Prix composé (calculateur) | calculateur.html | Calcul auto, toggle installation |
| Items personnalisés | calculateur.html | Mode "Ajout" (description + prix libre) |
| Proposition d'items | calculateur.html | Mode "Proposer" → status pending |
| Images par meuble | calculateur.html | Upload, compression, crop (Cropper.js), Storage |
| Envoi d'estimation | calculateur.html + GAS | Email HTML + PDF, snapshots versions |
| Administration | admin.html | 7 sections de configuration |
| Approbation | approbation.html | Approuver / rejeter items pending |
| Permissions par rôle | admin.html → toutes pages | Matrice 6 rôles × 12 permissions |
| Cache offline | catalogue + calculateur | LocalStorage fallback |
| Aperçu soumission | calculateur.html | Vue prévisualisation landscape 8½×11, édition descriptions client, images filtrées (showInQuote) |
| Vue client | calculateur.html | Mode lecture seule dans l'aperçu (masque outils d'édition) |
| Présentation plein écran | calculateur.html | Fullscreen API, navigation page par page |
| Bibliothèque de clauses | calculateur.html | Drag-and-drop depuis panneau droit, sauvegarde dans submissions.clauses JSONB |
| Traduction FR/EN | calculateur.html | Toggle langue dans l'aperçu, dictionnaire i18n |
| Traduction automatique | calculateur.html + Edge Function | Bouton "Traduire tout" via Claude Haiku |
| Soumission client | quote.html | Page publique landscape paginée, acceptation + signature |
| Bypass approbation | calculateur.html | Envoyer directement au client sans approbation |
| Acceptation hors-ligne | calculateur.html | Confirmer vente par autre moyen |
| Marquage facturée | calculateur.html | Transition accepted → invoiced |
| Gel du contenu | calculateur.html | Verrouillage complet à sent_client |
| Snapshots enrichis | calculateur.html | Versions incluent projet, client, descriptions, clauses, mediaUrls |
| Historique des versions | calculateur.html | Drawer latéral, overlay lecture seule |
| Duplication soumission | calculateur.html | Copie profonde via RPC |
| Déverrouillage d'urgence | calculateur.html | Audit immuable (nom, raison, IP) |
| Preuve d'acceptation | calculateur.html | Page verte dans la présentation |
| Assistant AI (chatbox) | calculateur.html + Edge Function | Claude Sonnet 4.5, 6 outils, mode simulation |
| Système de tags | calculateur.html + admin.html | Tags C1/F1/P1 sur lignes, nomenclature configurable |
| Filtre par tag | calculateur.html | Barre de filtre avec chips préfixe + granulaire |
| Tri par colonnes | calculateur.html | Clic sur en-tête → tri asc/desc |
| Matériaux par défaut | calculateur.html | Par soumission, dropdown + autocomplete catalogue |
| Plans PDF | calculateur.html | Upload versioning, viewer pdf.js, capture d'écran |
| Annotations sur images | calculateur.html | Labels de tags (SVG), flèches, drag & drop |
| Rentabilité par tag | calculateur.html | Ventilation dans le modal Rentabilité |
| Gestion clients (CRM) | clients.html | Contacts, entreprises, communications |

### 13.2 Non implémenté / en attente

| Élément | Détail | Statut |
|---------|--------|--------|
| Documents | Carte "Documents" dans app.html affiche "Bientôt" | Non implémenté |
| Page Analyse projet | Page dédiée à l'analyse de rentabilité d'un projet | Non implémenté |
| Cleanup SQL transition | Supprimer `project_id` de `project_rooms` et `project_versions` | En attente de stabilisation |
| Données CRM avancées | Intégration avec calculateur (pré-remplir client depuis contact) | Non implémenté |

### 13.3 Améliorations potentielles identifiées

| Catégorie | Description |
|-----------|-------------|
| **Sécurité** | Permissions côté client uniquement (voir section 14) |
| **Validation** | Pas de validation email côté admin, pas de limites sur les champs numériques |
| **UX** | Pas d'indication de changements non sauvegardés dans admin.html |
| **Données** | Pas de gestion de conflits d'édition simultanée (last write wins) |
| **Code** | `authenticatedFetch()` dupliqué dans chaque fichier HTML (pas de module partagé) |

---

## 14. Audit — Points d'attention

> Audit réalisé le 2026-02-10. Cette section documente les problèmes identifiés et leur sévérité.

### 14.1 Problèmes critiques

#### XSS — Injection HTML sans escaping

Plusieurs fichiers injectent des données utilisateur/catalogue dans `innerHTML` via template literals **sans échappement HTML**. La fonction `escapeHtml()` existe dans 3 fichiers mais n'est pas appliquée partout.

| Fichier | Fonction | Variables non échappées |
|---------|----------|------------------------|
| calculateur.html | `addFurnitureGroup()` | Nom du meuble dans `value=""` |
| calculateur.html | `updateRow()` | `item.description`, `item.instruction` dans tooltip |
| calculateur.html | `renderProjectList()` | `proj.name`, `proj.client_name` |
| catalogue.html | `generatePriceTables()` | `item.description`, `item.instruction`, `item.image_url` |
| catalogue.html | onclick handlers | Catégorie et `item.id` dans attributs `onclick` |
| google_apps_script.gs | `genererHtmlCourriel()` | `description`, `item.description`, `item.code` dans HTML email |

**Risque** : Un utilisateur peut injecter du JavaScript via un nom de projet, un article proposé, ou une description. Si un admin visualise ces données, le code s'exécute dans son navigateur.

**Correction recommandée** : Appliquer `escapeHtml()` à toute donnée utilisateur avant insertion dans `innerHTML`.

#### Permissions côté client uniquement

Les fonctions `checkPageAccess()` ajoutées dans calculateur, admin et approbation vérifient les permissions en JavaScript. Contournable en modifiant `localStorage` via DevTools.

**Correction recommandée** : Ajouter des policies RLS dans Supabase pour protéger `app_config` en écriture (admin seulement).

### 14.2 Problèmes moyens

#### `authenticatedFetch()` incohérent entre fichiers

| Fichier | Sur échec refresh 401 | Comportement |
|---------|----------------------|--------------|
| admin.html | Redirect login.html | Correct |
| app.html | Redirect login.html | Correct |
| calculateur.html | Redirect login.html | Correct |
| catalogue.html | Redirect login.html | Correct |
| **fiche.html** | **Retourne response** | **Pas de redirect** |
| **approbation.html** | **Retourne response** | **Pas de redirect** |

#### Code dupliqué cross-fichiers

`refreshAccessToken()`, `authenticatedFetch()`, `DEFAULT_PERMISSIONS`, `DEFAULT_USER_ROLES`, `escapeHtml()` et `checkPageAccess()` sont dupliqués dans 3 à 6 fichiers.

#### Performance — Chargement séquentiel (calculateur.html)

4 requêtes Supabase en séquence au démarrage. Pourrait utiliser `Promise.all()` pour paralléliser.

### 14.3 Points forts confirmés

- **Zéro dépendance externe** — Pas de risque npm/supply-chain
- **`.gitignore` whitelist** — Stratégie default-deny, seuls les fichiers essentiels sont trackés
- **Token refresh robuste** — `authenticatedFetch()` gère bien les 401 (quand implémenté correctement)
- **RLS Supabase sur projets** — `auth.uid() = user_id` bien en place
- **`escapeHtml()` existe** — Implémentation correcte via `textContent` → `innerHTML`, juste pas appliquée partout
- **Audit immuable** — Tables d'audit avec INSERT/SELECT only, capture IP côté serveur
