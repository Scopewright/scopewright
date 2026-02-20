# CHANGELOG — Scopewright (Stele)

---

## 2026-02-20

### Features — Rebranding & AI assistants
- **Rebranding visuel** — Passage du vert Stele au bleu marine Scopewright (#0B1220) sur toutes les pages internes
- **Header uniforme** — 56px, logo Scopewright + lien "← Menu", identique sur toutes les pages
- **Dashboard split screen** — Panneau gauche (cartes), panneau droit (branding Scopewright)
- **Login split screen** — Même pattern que le dashboard
- **Assistant AI catalogue** — Drawer latéral avec streaming SSE, CRUD items, reverse pricing
- **Assistant AI contacts** — Drawer latéral sur la page contacts
- **AI prompt editor** — Section dans admin.html pour personnaliser les prompts AI (app_config `ai_prompt_overrides`)
- **Catalogue single table** — Refonte : table unique avec dropdown catégorie (plus d'onglets), barre de recherche, tri colonnes
- **Bouton AI uniforme** — Cercle subtil avec breathing animation sur toutes les pages
- **Clients → Contacts** — Renommage global
- **Approbation directe** — Badge pending cliquable pour approuver les items catalogue

### Edge Functions
- **Deployed `catalogue-import`** — Streaming SSE, CRUD catalogue items
- **Deployed `contacts-import`** — Streaming SSE, actions contacts

### Bug Fixes
- **Fix: AI approval status** — L'assistant catalogue voit maintenant le statut d'approbation des articles
- **Fix: Preview band color** — La bande de l'aperçu soumission reste verte (client-facing)
- **Fix: Dashboard layout** — Marges 48px égales, centrage vertical du contenu
- **Fix: Rentability modal total** — Correction du calcul total
- **Fix: AI filter action** — Le filtrage AI agit directement sur la table au lieu d'afficher dans le chat

---

## 2026-02-17

### Features — Pipeline commercial
- **Pipeline views** — 3 vues pour la page projets : Table (14 colonnes triables), Cartes (enrichies avec statut/montant/deadline), Soumissions (toutes les soumissions avec mini-timeline)
- **Pipeline statuses** — Statuts configurables via admin.html (A contacter → Vendu/Perdu), badges colorés
- **Filter bar** — Recherche texte + filtres par statut pipeline, responsable, type de projet
- **Project pipeline fields** — Montant estimé, probabilité, pondéré, responsable, priorité, source, type, deadlines (internes + client), dates prévues
- **Submission assignment** — Estimateur, Vendeur/CP, Approbateur (dropdowns employés), deadlines par soumission, auto-save
- **Enhanced edit info modal** — Tous les champs pipeline (statut, source, type, montant, probabilité slider, responsable, priorité, dates)
- **Admin config** — 3 nouvelles sections : Statuts du pipeline (label + couleur + slug), Sources de projet, Types de projet

### Database Changes
- `sql/pipeline_projects.sql` — 11 nouvelles colonnes sur `projects` (pipeline_status, source, project_type, estimated_amount, probability, assigned_to, priority, expected_start_date, expected_end_date, internal_deadline, client_deadline) + index
- `sql/pipeline_submissions.sql` — 5 nouvelles colonnes sur `submissions` (estimateur, vendeur_cp, approbateur, internal_deadline, client_deadline)
- `app_config` keys: `pipeline_statuses`, `project_sources`, `project_types`

---

## 2026-02-15

### Features
- **Sortable columns** — Clic sur les en-têtes Tag, Article, Prix unit., Quantité, Total pour trier les lignes asc/desc dans chaque meuble (`sortGroupRows`, `getRowSortValue`)
- **Granular tag filter** — La barre de filtre par tag supporte maintenant les tags exacts (C1, C2) en plus des préfixes (C). Chips granulaires affichés quand un préfixe est actif
- **Tag annotation tool** — Modal plein écran pour placer des labels de tags (C1, F1, P1) sur les images des meubles avec SVG overlay, drag & drop, mode flèche, auto-numérotation
- **Rentability by tag** — Ventilation par préfixe de tag dans le modal Rentabilité (prix vente, heures, matériaux, profit, marge)
- **Tag filter bar** — Barre de filtrage rapide par préfixe de tag au-dessus des meubles du calculateur
- **AI assistant chatbox** — Drawer latéral avec Claude Sonnet 4.5, 6 outils (rentabilité, descriptions, ajout articles, quantités, suggestions, comparaison versions), mode simulation avec confirmation
- **AI per-room focus** — Bouton "AI" sur chaque meuble pour restreindre le scope de l'assistant à une pièce
- **Chat persistence** — Messages AI sauvés dans table `chat_messages` par soumission
- **Tag system** — Colonne `tag` sur `room_items`, nomenclature configurable dans admin.html (`tag_prefixes`)
- **Default materials rewrite** — Section matériaux par défaut refaite : dropdown 6 types fixes + autocomplete catalogue avec navigation scrollable
- **PDF capture fix** — Captures d'écran depuis le viewer PDF inline maintenant fonctionnelles (redirigées vers le crop modal existant)
- **Browseable catalogue autocomplete** — L'autocomplete des matériaux par défaut affiche tous les items groupés par catégorie au focus

### Bug Fixes
- **Fix: Duplicate ID admin.html** — `sectionTags` dupliqué empêchait l'ouverture de "Nomenclature des tags" → renommé `sectionTagPrefixes`
- **Fix: AI cache stale data** — `aiClientFileCache`, `aiFocusGroupId`, `aiCurrentScope` réinitialisés dans `resetAiChat()`
- **Fix: Inline PDF capture** — 5 bugs corrigés (mauvais bucket, mauvais schéma, pas de crop, pas de mediaId retourné, mauvais tags)
- **Fix: Annotation button visibility** — Bouton crayon maintenant toujours visible (opacity 0.7) au lieu de seulement au hover

### Database Changes
- `ALTER TABLE room_items ADD COLUMN tag TEXT DEFAULT NULL` (sql/tags.sql)
- `INSERT INTO app_config tag_prefixes` — nomenclature C/F/P/T/M/A (sql/tags.sql)
- `ALTER TABLE submissions ADD COLUMN default_materials JSONB DEFAULT '{}'` (sql/default_materials.sql)
- `ALTER TABLE room_media ADD COLUMN annotations JSONB DEFAULT '[]'` (sql/annotations.sql)
- `CREATE TABLE chat_messages` + RLS + index (sql/chat_messages.sql)

### Edge Functions
- **Deployed `ai-assistant`** — Claude Sonnet 4.5, 6 tools, JWT verified
- Existing `translate` unchanged

---

## 2026-02-14

### Features
- **Translate Edge Function** — 3 modes: FR→EN, EN→FR, optimize descriptions
- **PDF viewer standalone** — Nouvelle fenêtre avec pdf.js, navigation, zoom, capture d'écran
- **Loading animation** — Animation de chargement dans le viewer PDF standalone
- **Crop modal for PDF captures** — Capture → crop modal → sauvegarde dans room_media

### Bug Fixes
- **Fix: PDF captures instant display** — Les captures PDF apparaissent immédiatement dans les rooms
- **Fix: Favicon background** — Changé en noir

---

## 2026-02-12

### Features
- **Enriched snapshots** — Versions incluent projectName, clientName, designer, clauses, mediaUrls
- **Emergency unlock** — Remettre en brouillon avec audit immuable (nom, raison, IP)
- **Submission duplication** — Copie profonde via RPC `duplicate_submission`
- **Proof of acceptance** — Page verte dans la présentation avec signature, méthode, date, IP
- **Offline acceptance** — Confirmer vente par autre moyen (courriel, téléphone, papier)

---

## 2026-02-10

### Features
- **Audit complet** — Premier audit de sécurité et qualité du code (score: 6.5/10)
- **Clause library** — Drag-and-drop de clauses contractuelles dans les soumissions
- **FR/EN translation** — Toggle langue dans l'aperçu, dictionnaire i18n pour labels
- **Fullscreen presentation** — Navigation page par page (Fullscreen API)
- **Client view** — Mode lecture seule dans l'aperçu
- **Preview mode** — Vue prévisualisation landscape 8½×11

---

## 2026-02-08

### Features
- **Submission workflow** — 7 statuts (draft → invoiced), approbation interne, bypass, auto-approbation
- **Content freeze** — Verrouillage complet après envoi client
- **Bypass approval** — Envoyer directement sans approbation (permission dédiée, log immuable)

---

## 2026-02-05

### Features
- **Public quote (quote.html)** — Page publique avec signature canvas + acceptation en ligne
- **Composed pricing** — Prix = labor_minutes × taux_horaire + material_costs × (1 + markup + waste)
- **Installation toggle** — Par meuble et par ligne, exclut département Installation du calcul

---

## 2026-01-29

### Features
- **Calculator MVP** — Projets, soumissions, meubles, lignes avec catalogue
- **Image management** — Upload, compression, lightbox, Supabase Storage
- **Permissions system** — 6 rôles, 12 permissions, matrice dans admin.html
- **Catalogue CRUD** — Ajouter, éditer, supprimer items avec images et PDF
- **Email estimation** — Via Google Apps Script (HTML + PDF)
