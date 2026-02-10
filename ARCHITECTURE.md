# ARCHITECTURE — Scopewright (Stele)

> Documentation de référence du projet. Dernière mise à jour : 2026-02-10.
> Dernier audit complet : 2026-02-10.

---

## Table des matières

1. [Structure des fichiers](#1-structure-des-fichiers)
2. [Structure Supabase](#2-structure-supabase)
3. [Prix composé (labor + matériaux)](#3-prix-composé-labor--matériaux)
4. [Système de permissions](#4-système-de-permissions)
5. [Authentification & tokens](#5-authentification--tokens)
6. [Google Apps Script (envoi email)](#6-google-apps-script-envoi-email)
7. [État d'avancement](#7-état-davancement)
8. [Audit — Points d'attention](#8-audit--points-dattention)

---

## 1. Structure des fichiers

### Fichiers de l'application web (déployés sur Netlify)

| Fichier | Rôle | Auth requise |
|---------|------|:------------:|
| `index.html` | Page d'accueil publique (landing page) | Non |
| `login.html` | Authentification Supabase (email/mot de passe) | Non |
| `app.html` | Tableau de bord — grille de cartes vers les outils, filtrées par permissions | Oui |
| `catalogue_prix_stele_complet.html` | Catalogue de prix — affichage, CRUD items, images, prix composé | Oui |
| `calculateur.html` | Calculateur de projets — gestion projets, meubles, lignes, estimation | Oui |
| `admin.html` | Administration — permissions, rôles, catégories, tags, taux horaires, dépenses | Oui |
| `approbation.html` | Approbation : soumissions (workflow) + items proposés au catalogue | Oui |
| `fiche.html` | Fiche de vente d'un produit — affichage public + éditeur authentifié | Optionnel |

### Fichiers de support

| Fichier | Rôle |
|---------|------|
| `google_apps_script.gs` | Cloud function Google Apps Script : génère l'email HTML + PDF d'estimation |
| `catalogue.json` | Données de catalogue en JSON (export/fallback) |

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

### Déploiement

- **Hébergement** : Netlify (auto-deploy depuis GitHub)
- **Repo** : `Scopewright/scopewright` — branche `main`
- **Backend** : Supabase (PostgreSQL + Auth + Storage)
- **Email** : Google Apps Script (déploiement manuel requis après chaque modification du `.gs`)

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
| `created_at` | TIMESTAMPTZ | Date de création |
| `updated_at` | TIMESTAMPTZ | Dernière modification |

**Contrainte statut** : `draft`, `pending_internal`, `returned`, `approved_internal`, `sent_client`, `accepted`, `invoiced`

**RLS** : propriétaire via JOIN `projects.user_id = auth.uid()`, approbateurs peuvent voir/modifier les soumissions `pending_internal`.

**Utilisée par** : calculateur.html, approbation.html

---

#### `submission_reviews` — Historique d'approbation/retour

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | Identifiant unique |
| `submission_id` | UUID (FK → submissions) | Soumission concernée |
| `reviewer_id` | UUID (FK → auth.users) | Approbateur |
| `action` | TEXT | `approved` ou `returned` |
| `comment` | TEXT | Commentaire (obligatoire pour retour) |
| `version_at_review` | INTEGER | Numéro de version au moment de la révision |
| `created_at` | TIMESTAMPTZ | Date de la révision |

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
| `images` | JSONB | Images attachées au meuble `[{ name, dataUrl }]` |

**RLS** : via JOIN chain depuis `projects` (propriétaire) ou `submissions` (approbateur).

**Utilisée par** : calculateur.html

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

**RLS** : via JOIN chain depuis `projects`.

**Utilisée par** : calculateur.html

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

**Utilisée par** : calculateur.html (créé lors de l'envoi d'une estimation ou soumission pour approbation)

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
| `taux_horaires` | `[{ department, taux_horaire, frais_fixe, salaire }]` | Taux horaires par département | admin.html |
| `expense_categories` | `[{ name, markup }]` | Catégories de dépenses + majoration % | admin.html |

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

### 2.2 Relations entre les tables

```
auth.users
  └─── projects (user_id)
         └─── submissions (project_id)
                └─── project_rooms (submission_id)
                │      └─── room_items (room_id)
                └─── project_versions (submission_id)
                └─── submission_reviews (submission_id)

catalogue_items (id = code texte)
  └─── item_media (catalogue_item_id)
  └─── fiches_vente (catalogue_item_id)
  └─── room_items (catalogue_item_id) — référence optionnelle

employees — table indépendante (liste pour dropdowns)

app_config — table clé-valeur indépendante (configuration globale)
```

### 2.3 Workflow des soumissions

```
draft → pending_internal ←→ returned
         ↓
  approved_internal → sent_client → accepted → invoiced
```

| Statut | Label FR | Signification |
|--------|----------|---------------|
| `draft` | Brouillon | En cours de rédaction |
| `pending_internal` | En approbation | Soumise pour révision interne |
| `returned` | Retournée | Retournée avec commentaire par l'approbateur |
| `approved_internal` | Approuvée | Approuvée en interne, prête à envoyer |
| `sent_client` | Envoyée client | Envoyée au client (email via GAS) |
| `accepted` | Acceptée | Client a accepté |
| `invoiced` | Facturée | Facturée (statut terminal) |

**Auto-approbation** : Un utilisateur avec la permission `can_approve_quotes` peut passer directement de `draft`/`returned` à `approved_internal` sans passer par `pending_internal`.

**Numérotation** : Séquence PostgreSQL `submission_number_seq`, démarre à 100, globale (pas par projet).

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
  { "name": "BOIS BRUT", "markup": 30 },
  { "name": "PANNEAUX MDF", "markup": 30 },
  { "name": "QUINCAILLERIE", "markup": 30 },
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
  coût × (1 + markup% / 100)
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

> **Attention** : Les vérifications `checkPageAccess()` sont **côté client uniquement** (JavaScript). Elles peuvent être contournées via DevTools en modifiant localStorage. La vraie protection doit venir du **RLS Supabase** sur les tables. Voir [section 8](#8-audit--points-dattention).

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

## 7. État d'avancement

### 7.1 Fonctionnalités terminées

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
| Images par meuble | calculateur.html | Upload, compression, lightbox |
| Envoi d'estimation | calculateur.html + GAS | Email HTML + PDF, snapshots versions |
| Administration | admin.html | 6 sections de configuration |
| Approbation | approbation.html | Approuver / rejeter items pending |
| Permissions par rôle | admin.html → toutes pages | Matrice 6 rôles × 9 permissions |
| Cache offline | catalogue + calculateur | LocalStorage fallback |

### 7.2 En cours / incomplet

| Élément | Détail | Statut |
|---------|--------|--------|
| ~~Catégories hardcodées~~ | Dropdown de catégories dans catalogue et approbation | **CORRIGÉ** — chargé depuis `app_config` |
| ~~Types d'unité hardcodés~~ | Dropdown type (pi², unitaire, linéaire, %) | **CORRIGÉ** — extrait dynamiquement |
| ~~Permissions non vérifiées~~ | Pages sans vérification côté client | **CORRIGÉ** — `checkPageAccess()` ajouté (client-side uniquement) |
| Toggle installation 3 niveaux | Projet → section → ligne | **CORRIGÉ** — cascade implémentée |
| Modal Rentabilité | Analyse financière par meuble ou projet | **CORRIGÉ** — prix vente, coûtant, heures, marges |
| Workflow soumissions | Projets → Soumissions avec approbation 7 étapes | **IMPLÉMENTÉ** — tables `submissions`, `submission_reviews` créées, calculateur + approbation mis à jour |
| Documents | Carte "Documents" dans app.html affiche "Bientôt" | **Non implémenté** |
| Assistant vente | Carte "Assistant vente" dans app.html affiche "Bientôt" | **Non implémenté** |
| Page Analyse projet | Page dédiée à l'analyse de rentabilité d'un projet | **Non implémenté** |
| Cleanup SQL transition | Supprimer `project_id` de `project_rooms` et `project_versions` après stabilisation | **En attente** — garder `project_id` durant la période de transition |

### 7.3 Améliorations potentielles identifiées

| Catégorie | Description |
|-----------|-------------|
| **Sécurité** | ~~Ajouter vérification de permissions côté client~~ (fait — mais client-side uniquement, voir section 8) |
| **Validation** | Pas de validation email côté admin, pas de limites sur les champs numériques |
| **UX** | Pas d'indication de changements non sauvegardés dans admin.html |
| **UX** | Pas de recherche/filtre dans le catalogue (navigation par catégorie uniquement) |
| **Données** | Pas d'audit trail (qui a changé quoi, quand) — seulement `updated_at` sur app_config |
| **Données** | Pas de gestion de conflits d'édition simultanée (last write wins) |
| **Code** | `generateNextCode()` a 2 implémentations légèrement différentes (calculateur vs catalogue) |
| **Code** | Certains appels Supabase n'ont pas de `.catch()` — échecs silencieux possibles |

---

## 8. Audit — Points d'attention

> Audit réalisé le 2026-02-10. Cette section documente les problèmes identifiés et leur sévérité.

### 8.1 Problèmes critiques

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

#### ~~`createVersion()` non awaité~~ — **CORRIGÉ**

`createVersion()` est maintenant correctement `await`é dans `envoyerEstimation()` et `submitForApproval()`.

### 8.2 Problèmes moyens

#### `authenticatedFetch()` incohérent entre fichiers

| Fichier | Sur échec refresh 401 | Comportement |
|---------|----------------------|--------------|
| admin.html | Redirect login.html | Correct |
| app.html | Redirect login.html | Correct |
| calculateur.html | Redirect login.html | Correct |
| catalogue.html | Redirect login.html | Correct |
| **fiche.html** | **Retourne response** | **Pas de redirect** |
| **approbation.html** | **Retourne response** | **Pas de redirect** |

Les 2 fichiers problématiques laissent l'utilisateur dans une session morte.

#### Code dupliqué cross-fichiers

`refreshAccessToken()`, `authenticatedFetch()`, `DEFAULT_PERMISSIONS`, `DEFAULT_USER_ROLES`, `escapeHtml()` et `checkPageAccess()` sont dupliqués dans 3 à 6 fichiers. Toute modification doit être répliquée manuellement partout.

#### Performance — Chargement séquentiel (calculateur.html)

4 requêtes Supabase en séquence au démarrage (`await` l'une après l'autre). Pourrait utiliser `Promise.all()` pour paralléliser.

#### Performance — Pas de `limit` sur les requêtes Supabase

`loadProjects()`, `loadProjectRooms()`, `loadCatalogueData()` chargent toutes les données sans pagination. Acceptable pour le volume actuel mais ne scale pas.

#### GAS — Validation d'entrée insuffisante

`google_apps_script.gs` ne valide pas la structure JSON, ne limite pas la taille des images base64, et ne valide pas l'email CC par regex.

### 8.3 Points mineurs

| Problème | Fichier(s) | Impact |
|----------|------------|--------|
| Variable `fetchFn` déclarée mais jamais utilisée | fiche.html:868 | Code mort, confusion |
| Mix `var`/`let`/`const` | fiche.html, catalogue.html (sections anciennes) | Incohérence de style |
| `MAX_IMAGES` et `MAX_GROUP_IMAGES` redondants (même valeur 4) | calculateur.html:36, 2217 | Maintenance |
| `loadMediaTags()` utilise `fetch()` direct au lieu de `authenticatedFetch()` | catalogue.html:1652 | Incohérence pattern |
| `querySelectorAll('.calc-row')` sans cache | calculateur.html | Performance mineure |
| Pas de bouton logout sur fiche.html | fiche.html | UX |

### 8.4 Points forts confirmés

- **Zéro dépendance externe** — Pas de risque npm/supply-chain
- **`.gitignore` whitelist** — Stratégie default-deny, seuls les fichiers essentiels sont trackés
- **Token refresh robuste** — `authenticatedFetch()` gère bien les 401 (quand implémenté correctement)
- **Aucune fonction morte** — Tout le code déclaré est utilisé (sauf `fetchFn` dans fiche.html)
- **RLS Supabase sur projets** — `auth.uid() = user_id` bien en place
- **`escapeHtml()` existe** — Implémentation correcte via `textContent` → `innerHTML`, juste pas appliquée partout

### 8.5 Evaluation globale

**Note : 6.5 / 10**

Le projet est fonctionnel et bien organisé au niveau Git, mais les vulnérabilités XSS et les permissions client-only empêchent un score plus élevé. Les corrections XSS sont la priorité #1.

### 8.6 Fichiers orphelins

33+ fichiers (~68 Mo) dans le répertoire local mais **correctement exclus de Git** par le `.gitignore` whitelist. Incluent :

- 4 fichiers HTML legacy (`dashboard.html`, `catalogue_prix_stele.html`, `soumission.html`, `SOU-*.html`)
- 18 scripts PowerShell (automatisation Excel legacy)
- 8 fichiers Excel + 5 PDF (données projet et référence)
- 2 artefacts système (`nul`, `images/` vide)

**Aucun impact sur le déploiement** — ces fichiers n'atteignent jamais GitHub/Netlify.
