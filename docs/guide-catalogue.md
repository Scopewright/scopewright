# Guide du catalogue Stele

> Documentation fonctionnelle et technique du systeme de catalogue de prix.
> Derniere mise a jour : 2026-03-05

---

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture a 3 couches](#2-architecture-a-3-couches)
3. [Anatomie d'un article](#3-anatomie-dun-article)
4. [Codes ST-xxxx](#4-codes-st-xxxx)
5. [Systeme de prix](#5-systeme-de-prix)
6. [Categories de depense](#6-categories-de-depense)
7. [Categories catalogue et groupes soumission](#7-categories-catalogue-et-groupes-soumission)
8. [Templates de regles par categorie](#8-templates-de-regles-par-categorie)
9. [Cascades](#9-cascades)
10. [Contraintes](#10-contraintes)
11. [Materiaux par defaut](#11-materiaux-par-defaut)
12. [Texte client et presentation](#12-texte-client-et-presentation)
13. [Permissions et roles](#13-permissions-et-roles)
14. [Workflow d'un article](#14-workflow-dun-article)
15. [Workflow d'une soumission](#15-workflow-dune-soumission)
16. [Sandbox](#16-sandbox)
17. [AI dans le catalogue](#17-ai-dans-le-catalogue)
18. [Audit](#18-audit)
19. [FAQ — Questions cles](#19-faq--questions-cles)
20. [Bugs connus et limitations](#20-bugs-connus-et-limitations)

---

## 1. Vue d'ensemble

Le catalogue Stele est un repertoire centralise de tous les produits, materiaux et services utilises pour estimer des cuisines et meubles sur mesure. Il alimente le calculateur de soumissions et la presentation client.

**Fichiers impliques** :

| Fichier | Role |
|---------|------|
| `catalogue_prix_stele_complet.html` | Interface CRUD du catalogue (modal d'edition, audit, sandbox, AI) |
| `calculateur.html` | Consomme le catalogue pour creer des soumissions |
| `approbation.html` | Revue et approbation des articles proposes |
| `admin.html` | Configuration des categories de depense, taux horaires, permissions |
| `supabase/functions/ai-assistant/index.ts` | Edge Function AI — utilise le contexte catalogue |
| `supabase/functions/translate/index.ts` | Genere textes client, regles de calcul/presentation |
| `supabase/functions/catalogue-import/index.ts` | Import conversationnel (chat AI) |

---

## 2. Architecture a 3 couches

Le catalogue fonctionne sur 3 couches distinctes :

### Couche 1 — Donnees (Supabase PostgreSQL)

Tables principales :

| Table | Role |
|-------|------|
| `catalogue_items` | Articles du catalogue (PK = code texte `ST-xxxx`) |
| `catalogue_item_components` | Composantes fournisseur liees a un article |
| `item_media` | Images et PDF associes (bucket `fiche-images`) |
| `app_config` | Configuration : categories, taux, permissions, templates |
| `ai_learnings` | Regles d'apprentissage organisationnel pour l'AI |
| `companies` | Fournisseurs (filtre `company_type = 'Fournisseurs'`) |

Cles `app_config` utilisees par le catalogue :

| Cle | Type | Role |
|-----|------|------|
| `taux_horaires` | Array | Taux horaires par departement |
| `expense_categories` | Array | Categories de depense avec markup, waste, templates |
| `catalogue_categories` | Array | Noms de categories pour le dropdown |
| `material_groups` | Array | Groupes de materiaux pour les soumissions |
| `category_group_mapping` | Object | Mapping categorie catalogue → groupe soumission |
| `media_tags` | Array | Tags disponibles pour les images |
| `permissions` | Object | Permissions par role |
| `user_roles` | Object | Mapping email → role |
| `shop_code_prefix` | Text | Prefixe des codes article (defaut: `ST`) |

### Couche 2 — Logique metier (JavaScript inline)

Toute la logique est dans les fichiers HTML, en vanilla JS :

- **Prix compose** : `computeComposedPrice()`, `updateComposedPrice()`
- **Cascades** : `executeCascade()`, `resolveCascadeTarget()`
- **Contraintes** : `processConstraints()`, `findRoomItemsByGroup()`
- **Formules** : `evalFormula()` — evaluation securisee (whitelist regex)
- **Sandbox** : `sbExecuteCascade()`, `sbProcessConstraints()`, `sbBuildDescription()`
- **Audit** : `runFullAudit()`, `runSaveValidation()`

### Couche 3 — AI (Edge Functions Supabase)

4 Edge Functions interviennent :

| Fonction | Modele | Role |
|----------|--------|------|
| `translate` | Haiku 4.5 / Sonnet 4 | Genere texte client, regles de calcul/presentation, import composantes |
| `catalogue-import` | Sonnet 4.5 | Chat conversationnel : CRUD articles, recherche, audit |
| `ai-assistant` | Sonnet 4.5 | Chatbox du calculateur (utilise le contexte catalogue) |

---

## 3. Anatomie d'un article

Chaque article `catalogue_items` possede ces colonnes :

### Identification

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | TEXT (PK) | Code unique auto-genere (`ST-0001`). Voir [section 4](#4-codes-st-xxxx). |
| `category` | TEXT | Categorie catalogue (ex: "Tiroirs", "Poignees"). |
| `description` | TEXT | Description technique interne (pas visible au client). |
| `item_type` | TEXT | Classification : `fabrication` ou `materiau`. Voir [FAQ Q4](#q4--a-quoi-sert-le-champ-item_type-classification-). |
| `status` | TEXT | `approved`, `pending`, `rejected`, ou `null` (legacy = approuve). |
| `proposed_by` | TEXT | Email du proposeur (si `status = pending`). |

### Prix

| Colonne | Type | Description |
|---------|------|-------------|
| `price` | NUMERIC | Prix fixe. `null` si prix compose. |
| `labor_minutes` | JSONB | Minutes par departement : `{"Assemblage": 30, "Finition": 15}`. |
| `material_costs` | JSONB | Couts par categorie de depense : `{"Quincaillerie": 12.50}`. |
| `loss_override_pct` | NUMERIC | Override de la perte (%) par article. `null` = utilise le waste de la categorie de depense. |

### Logique

| Colonne | Type | Description |
|---------|------|-------------|
| `type` | TEXT | Unite de mesure : `pi2`, `unitaire`, `lineaire`, `%`. |
| `calculation_rule_human` | TEXT | Regle de calcul en langage naturel. |
| `calculation_rule_ai` | JSONB | Regle structuree : cascades, contraintes, ask, notes. |
| `dims_config` | JSONB | Dimensions applicables : `{"l": true, "h": true, "p": false}`. |
| `instruction` | TEXT | Instructions de prise de mesure pour l'estimateur. Bouton AI (`.btn-ai-dot`) pour reformulation structuree via action `instruction_rewrite` (Haiku). |

### Presentation

| Colonne | Type | Description |
|---------|------|-------------|
| `client_text` | TEXT | Nom visible au client dans la soumission. |
| `client_text_en` | TEXT | Version anglaise du texte client. |
| `presentation_rule_human` | TEXT | Regle de presentation en langage naturel. |
| `presentation_rule` | JSONB | Regle de presentation structuree (JSON). |

### Affichage et medias

| Colonne | Type | Description |
|---------|------|-------------|
| `in_calculator` | BOOLEAN | Visible dans le combobox du calculateur. |
| `has_sales_sheet` | BOOLEAN | Possede une fiche de vente detaillee. |
| `is_default` | BOOLEAN | Article par defaut (etoile ★). |
| `sort_order` | INTEGER | Ordre d'affichage dans le catalogue. |
| `image_url` | TEXT | URL image principale (legacy, remplace par `item_media`). |

### Fournisseurs (legacy)

| Colonne | Type | Description |
|---------|------|-------------|
| `supplier_name` | TEXT | Fournisseur principal (remplace par `catalogue_item_components`). |
| `supplier_sku` | TEXT | SKU fournisseur (remplace par `catalogue_item_components`). |

### Contexte de proposition

| Colonne | Type | Description |
|---------|------|-------------|
| `proposal_context` | JSONB | Reponses du formulaire guide lors de la proposition : `{ constraints, notes_for_approver }`. |

### Tables associees

**`catalogue_item_components`** — Composantes fournisseur :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | |
| `catalogue_item_id` | TEXT (FK) | Reference vers `catalogue_items.id`. |
| `supplier_name` | TEXT | Nom du fournisseur. |
| `supplier_sku` | TEXT | Code fournisseur. |
| `description` | TEXT | Description de la composante. |
| `expense_category` | TEXT | Categorie de depense (doit correspondre a `expense_categories`). |
| `qty_per_unit` | NUMERIC | Quantite par unite d'article. |
| `unit_cost` | NUMERIC | Cout unitaire. |
| `notes` | TEXT | Notes additionnelles. |
| `sort_order` | INTEGER | Ordre d'affichage. |

**`item_media`** — Medias associes :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID (PK) | |
| `catalogue_item_id` | TEXT (FK) | Reference vers `catalogue_items.id`. |
| `file_url` | TEXT | URL dans le bucket Supabase Storage `fiche-images`. |
| `file_type` | TEXT | `image` ou `pdf`. |
| `tags` | JSONB | Tags : `["fiche_client", "catalogue", "technique"]`. |

---

## 4. Codes ST-xxxx

Chaque article recoit un code unique au format `{PREFIXE}-{XXXX}`.

### Mecanisme

1. **Sequence PostgreSQL** : `catalogue_code_seq` — compteur auto-incremente
2. **Trigger** : `trg_catalogue_auto_code` — se declenche a l'INSERT
3. **Prefixe** : lu depuis `app_config.shop_code_prefix` (defaut: `ST`)
4. **Format** : `ST-0001`, `ST-0042`, `ST-0150`, etc. (zero-padde a 4 chiffres)

### Comportement

- Le code est genere cote serveur par le trigger — jamais cote client
- Le client envoie un INSERT sans `id` → le trigger le remplit
- Les codes sont **sequentiels et immuables** : un article supprime ne libere pas son code
- Le prefixe peut etre change dans `admin.html` (cle `shop_code_prefix`), mais les codes existants ne sont **pas** renommes

### Utilisation dans les cascades

Les cascades referencent les articles par leur code :
```json
{ "target": "ST-0015", "qty": "L * P / 144" }
```

Si un code reference dans une cascade n'existe plus en base, la cascade est **ignoree silencieusement**.

---

## 5. Systeme de prix

### Prix fixe vs prix compose

Chaque article a **soit** un prix fixe, **soit** un prix compose. Jamais les deux.

**Prix fixe** : `price` contient une valeur numerique. Pour les articles simples.

**Prix compose** : `price = null`. Le prix est calcule a partir de `labor_minutes` + `material_costs`.

Detection :
```javascript
function hasComposedPrice(item) {
    var lm = item.labor_minutes || {};
    var mc = item.material_costs || {};
    return Object.values(lm).some(v => v > 0) || Object.values(mc).some(v => v > 0);
}
```

### Formule du prix compose

```
Prix = Σ(minutes/60 × taux_horaire) + Σ(cout × (1 + markup%/100 + waste%/100))
```

#### Main-d'oeuvre (`labor_minutes`)

```json
{ "Assemblage": 30, "Finition": 15, "Installation": 10 }
```

Cout par departement = `(minutes / 60) × taux_horaire_du_departement`

Les taux viennent de `app_config.taux_horaires` :
```json
[
  { "department": "Assemblage", "taux_horaire": 45.00 },
  { "department": "Finition", "taux_horaire": 50.00 }
]
```

#### Materiaux (`material_costs`)

```json
{ "Quincaillerie": 12.50, "Peinture": 8.00, "Bois": 45.00 }
```

Cout par categorie = `cout × (1 + markup%/100 + waste%/100)`

**Important** : markup et waste sont **additionnes**, pas composes.
- `(1 + markup/100 + waste/100)` ✓
- `(1 + markup/100) × (1 + waste/100)` ✗

#### Decomposition dans la modal

| Libelle | Formule |
|---------|---------|
| Prix coutant | `cout × (1 + waste/100)` |
| Profit | `cout × markup/100` |
| Total materiau | prix coutant + profit |

### Override de perte par article (`loss_override_pct`)

Par defaut, le waste (%) vient de la categorie de depense. Certains articles ont des pertes atypiques (ex: Corian ~40% vs 20% standard pour sa categorie).

Le champ `loss_override_pct` (NUMERIC, nullable) permet un override par article :

```javascript
var waste = item.loss_override_pct != null
    ? item.loss_override_pct
    : (expCat.waste || 0);
```

**Dans la modal catalogue** : un input "Perte (%)" apparait dans la section prix compose. Quand une valeur est saisie, l'input a une bordure orange (`.has-override`) et le prix se recalcule immediatement. Quand le champ est vide, la perte retombe au defaut de la categorie.

**Portee** : l'override s'applique **uniformement a toutes les categories de depense** de l'article. Il remplace le waste de chaque categorie, pas d'une categorie specifique.

**Points de resolution** : Le champ est lu dans `updateComposedPrice()` (catalogue), `computeComposedPrice()` (calculateur), `computeRentabilityData()` (calculateur), `openRentab()` (calculateur), et `updateComposedPrice()` (approbation).

## 5b. Baremes et modificateurs (`labor_modifiers`)

Section separee de `calculation_rule_ai` dans la modale catalogue (visible admin uniquement, entre "Regles de cascade" et "Composantes").

### Principe

Les baremes appliquent des **facteurs multiplicateurs** automatiques sur les minutes MO et/ou les couts materiaux en fonction des dimensions de l'article. Exemples : largeur > 36 po → +25% machinage, volume > 10 pi3 → +20% panneaux.

### Structure JSON

```json
{
  "modifiers": [
    {
      "condition": "L > 48",
      "label": "Grand (> 48 po)",
      "labor_factor": { "Machinage": 1.5 },
      "material_factor": { "PANNEAU MELAMINE": 1.20 }
    },
    {
      "condition": "L > 36",
      "label": "Moyen (> 36 po)",
      "labor_factor": { "Machinage": 1.25 }
    },
    {
      "condition": "L <= 36",
      "label": "Standard",
      "labor_factor": null
    }
  ]
}
```

- **condition** : expression evaluable (variables L, H, P, QTY, n_tablettes, n_partitions, n_portes, n_tiroirs; fonctions ceil, floor, round, min, max)
- **label** : description courte affichee dans le popover
- **labor_factor** : multiplicateur par departement MO (1.0 = base, 1.5 = +50%). 3 formats : objet `{ "Machinage": 1.5 }`, nombre scalaire `1.5` (applique a tous), ou objet cle vide `{ "": 1.5 }` (normalise automatiquement)
- **material_factor** : multiplicateur par categorie materiau (meme logique, 3 formats)
- **First-match** : seul le premier modificateur dont la condition est vraie est applique

### Hierarchie d'override dans le calculateur

1. **Prix global** (`ov.price`) — override total, ignore tout le reste
2. **Per-departement/categorie** (manual et auto ne sont **pas mutuellement exclusifs**) :
   - Pour chaque dept MO : `manual` si defini, sinon `auto-factored` (catalogue × facteur), sinon `catalogue`
   - Pour chaque cat materiau : idem
   - Un override manuel sur Gestion preserve les valeurs auto-factorisees d'Assemblage et Installation
3. **Catalogue** — valeurs de base si aucun override ni bareme

### Popover 3 colonnes

Le popover d'override affiche 3 colonnes : Cat (catalogue), Auto (bareme), Manuel (override).
- La colonne Auto affiche la valeur *apres application du facteur* (ex: 60 min × 1.25 = 75 min)
- Un banner bleu indique le bareme actif
- Un indicateur ⚙ apparait sur la ligne quand un bareme est actif

### Evaluation dans le calculateur

`evaluateLaborModifiers` est appele **inline** dans `updateRow()` a chaque appel (pas de pattern differe). Le lookup se fait directement via `selectedId` → `CATALOGUE_DATA`. Les baremes sont donc reevalues automatiquement a chaque changement de dimensions.

### AI

Le bouton AI dans la section baremes genere le JSON structure depuis l'explication en langage naturel. Action `catalogue_labor_modifiers` dans la edge function `translate`. Prompt editable dans admin.html.

Les tools AI `add_catalogue_item` et `modify_item` supportent les variables caisson (`n_tablettes`, `n_partitions`, `n_portes`, `n_tiroirs`). Quand l'AI ajoute un caisson avec 2 portes, `n_portes=2` est passe au DOM et a la DB, permettant a la cascade de generer les facades automatiquement.

---

## 6. Categories de depense

### Qu'est-ce qu'une categorie de depense

Les categories de depense (`expense_categories`) definissent les types de couts materiaux. Chacune porte un markup (marge) et un waste (perte). Elles sont configurees dans `admin.html` et stockees dans `app_config`.

### Liste des categories par defaut

Les 24 categories par defaut (toutes avec markup 30%, waste 0%) :

| Categorie | Categorie | Categorie |
|-----------|-----------|-----------|
| BANDE DE CHANT | FOURNITURE BUREAU | PLACAGE |
| BOIS BRUT | FOURNITURE D'ATELIER | POIGNEES |
| COLLAGE DE BOIS | METAL | QUINCAILLERIE |
| DECOUPE NUMERIQUE | PANNEAU BOIS | SOUS TRAITANCE |
| DEMENAGEMENT | PANNEAU MDF | STRATIFIE |
| DIVERS | PANNEAU MELAMINE | TIROIRS |
| ECLAIRAGE | FINITION BOIS | VITRIER |
| FINITION OPAQUE | FINITION TEINTURE | PORTES SOUS TRAITANCE |

### Structure dans `app_config`

```json
[
  {
    "name": "PANNEAU BOIS",
    "markup": 30,
    "waste": 20,
    "calc_template": "cascade $default:Facades pour L*H/144 pi2 si materiau bois",
    "pres_template": "Mentionner l'essence de bois et le type de grain"
  }
]
```

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String | Nom unique de la categorie (uppercase). |
| `markup` | Number | Marge en % appliquee sur le cout. |
| `waste` | Number | Perte en % appliquee sur le cout. |
| `calc_template` | String | Template pour la generation automatique de regles de calcul (voir [section 8](#8-templates-de-regles-par-categorie)). |
| `pres_template` | String | Template pour la generation automatique de regles de presentation. |
| `rules_template` | String | Legacy — ancien champ unifie, remplace par `calc_template` + `pres_template`. |

---

## 7. Categories catalogue et groupes soumission

### Distinction importante

Il y a **deux concepts de "categorie"** distincts :

| Concept | Stockage | Exemple | Usage |
|---------|----------|---------|-------|
| **Categorie catalogue** | `catalogue_items.category` | "Tiroirs", "Poignees", "Carcasses" | Organise le catalogue, filtre les articles dans la modal |
| **Categorie de depense** | `app_config.expense_categories` | "QUINCAILLERIE", "PANNEAU BOIS" | Calcul du prix compose (markup + waste sur `material_costs`) |

La categorie catalogue sert a **classer** les articles. La categorie de depense sert a **calculer** les couts materiaux. Un article de categorie catalogue "Tiroirs" peut avoir des couts dans les categories de depense "QUINCAILLERIE" + "TIROIRS" + "BOIS BRUT".

### Groupes de materiaux (`material_groups`)

Les groupes definissent les sections de materiaux par defaut dans une soumission :

```json
["Caisson", "Facades", "Panneaux", "Tiroirs", "Poignees", "Eclairage", "Autre"]
```

### Mapping categories → groupes (`category_group_mapping`)

Ce mapping lie les categories catalogue aux groupes soumission :

```json
{
  "Carcasses": ["Caisson"],
  "Facades": ["Facades"],
  "Panneaux": ["Panneaux"],
  "Poignees": ["Poignees"],
  "Tiroirs": ["Tiroirs"],
  "Eclairage LED": ["Eclairage"]
}
```

**Lecture** : La cle est le nom de la **categorie catalogue**. La valeur est un tableau de **groupes soumission** auxquels cette categorie est associee.

**Impact** :
1. Le dropdown de materiau par defaut "Caisson" ne montre que les articles de categorie "Carcasses"
2. Les contraintes `requires_swap` / `requires_choice` utilisent ce mapping pour trouver les articles d'un groupe dans une piece
3. Les cascades `$default:Caisson` resolvent vers le materiau par defaut du groupe "Caisson"

### Pastille orange dans admin.html

Un indicateur orange s'affiche a cote de `category_group_mapping` si des categories du catalogue n'apparaissent dans aucun groupe. Ces articles ne seront jamais proposes comme materiau par defaut et ne seront pas detectes par les contraintes.

---

## 8. Templates de regles par categorie

### Objectif

Les templates sont des instructions par categorie de depense qui guident l'AI lors de la generation automatique de regles de calcul et de presentation. Ils permettent de definir des patterns recurrents une seule fois, au niveau de la categorie.

### Templates de calcul (`calc_template`)

Definissent comment les articles d'une categorie doivent etre calcules :

```
cascade $default:Facades pour L*H/144 pi2 si materiau bois
```

### Templates de presentation (`pres_template`)

Definissent comment les articles d'une categorie doivent etre presentes au client :

```
Mentionner l'essence de bois et le type de grain
```

### Ou les configurer

Dans `admin.html` → section `expense_categories`. Chaque categorie a deux textareas :
- **CALCUL** : template pour `calc_template`
- **PRESENTATION** : template pour `pres_template`

### Comment l'AI les utilise

Quand l'utilisateur clique "Regles de base" dans la modal d'edition :

1. `autoGenerateBaseRules()` collecte les templates `calc_template` et `pres_template` de toutes les categories
2. Envoie deux prompts separes a l'Edge Function `translate` :
   - Un prompt avec les templates de calcul → genere `calculation_rule_human` + `calculation_rule_ai`
   - Un prompt avec les templates de presentation → genere `presentation_rule_human` + `presentation_rule`
3. Les resultats sont injectes dans les champs correspondants de la modal

### Affichage dans la modal

Quand un admin ouvre la modal, un bandeau bleu clair en haut (hint banner) affiche les templates actifs en deux sections :
- **CALCUL** : templates `calc_template` par categorie
- **PRESENTATION** : templates `pres_template` par categorie

Ce bandeau n'est visible que pour les admins et seulement si des templates existent.

### Retrocompatibilite

L'ancien champ unifie `rules_template` est toujours lu si `calc_template` n'existe pas :
```javascript
return c.calc_template || c.rules_template;
```

---

## 9. Cascades

### Qu'est-ce qu'une cascade

Une cascade cree automatiquement des lignes enfants quand un article parent est selectionne dans le calculateur. Exemple : selectionner "Ilot de cuisine" ajoute automatiquement "Comptoir granit", "Dosseret", "Eclairage sous-comptoir" avec des quantites calculees.

Les cascades sont **gerees automatiquement** : elles se mettent a jour quand les dimensions changent et se suppriment quand l'article parent est retire.

### Structure JSON

Dans `calculation_rule_ai.cascade` :

```json
{
  "cascade": [
    {
      "target": "ST-0015",
      "qty": "L * P / 144",
      "condition": "L > 0"
    },
    {
      "target": "$default:Facades",
      "qty": "L * H / 144"
    }
  ]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `target` | String | Code article (`ST-0015`), reference dynamique (`$default:NomGroupe`), ou correspondance auto (`$match:CatégorieDépense`). **Obligatoire.** |
| `qty` | String/Number | Quantite ou formule. Par defaut `1`. **Important** : le champ s'appelle `qty`, jamais `formula`. |
| `condition` | String/null | Formule booleenne. Si presente, la cascade ne s'execute que si la condition est vraie. |
| `override_children` | String[] | Categories de depense a bloquer chez les descendants. Ex: `["BANDE DE CHANT", "FINITION BOIS"]`. L'item qui declare l'override traite ses propres regles — seuls ses descendants les sautent. |

**Quantites : constante vs formule**

Le moteur detecte automatiquement si `qty` est une constante ou une formule dimensionnelle via regex `/\b(L|H|P|QTY|n_tablettes|n_partitions)\b/` :

| Type | Exemple | Comportement |
|------|---------|-------------|
| Constante | `"2"`, `"4"` | Quantite **par unite FAB** — multipliee par `rootQty` (quantite du parent). 6 caissons × 2 = 12 |
| Formule dimensionnelle | `"L * H / 144"` | Resultat **total** — PAS multiplie par `rootQty`. La formule calcule deja la surface totale |

Cela evite le doublement des quantites pour les formules qui utilisent des dimensions physiques.

### Le target dynamique `$default:`

La syntaxe `$default:NomDuGroupe` reference le materiau par defaut de la piece pour un groupe donne.

**Resolution** :
1. Extrait le nom de groupe (ex: `"Facades"`)
2. Cherche dans les materiaux par defaut de la piece (`roomDM[groupId]`) l'entree de type `"Facades"`
3. Si plusieurs entrees du meme type : `materialCtx` desambigue d'abord, puis `dmChoiceCache`, puis modale de choix
4. Identifie le `client_text` du DM choisi → filtre `CATALOGUE_DATA` par `client_text` + categories autorisees (`getAllowedCategoriesForGroup`)
5. Si un seul article technique correspond → utilise directement. Si plusieurs → modale technique (code + description + categorie + prix)
6. Si aucun defaut defini → cascade ignoree, toast "Aucun materiau par defaut pour : Facades"

**Avantage** : L'article de fabrication n'est pas lie a un materiau specifique. Chaque piece peut utiliser des materiaux differents, et les cascades s'adaptent automatiquement.

### Le target dynamique `$match:`

La syntaxe `$match:CATÉGORIE_DÉPENSE` resout automatiquement un article par correspondance de mots-cles. La categorie dans la regle est un **hint** (pas un filtre litteral) — la categorie effective est derivee dynamiquement depuis le DM.

**Resolution** :
1. **Deriver les categories effectives** (`effectiveExpCats`) :
   - Commence avec la categorie de la regle (ex: `"PANNEAU BOIS"`)
   - Cherche le DM : room DM direct par type d'abord (prioritaire), puis fallback `materialCtx.chosenClientText` → article catalogue → cles `material_costs`. **Depuis 2026-03-05** : le `materialCtx` est mis a jour par le `$default:` precedent, donc `$match:` freres utilisent le contexte du materiau effectivement resolu (ex: melamine, pas chene blanc)
   - Pour chaque cle `material_costs` du DM, verifie la **similarite par mots** : au moins un mot en commun avec la categorie de la regle (ex: `"PANNEAU MELAMINE"` matche `"PANNEAU BOIS"` via `"PANNEAU"`)
   - `effectiveExpCats` = union de toutes les categories correspondantes

2. **Filtrer les candidats** : articles avec `material_costs[key] > 0` pour au moins une cle dans `effectiveExpCats` (exclut `item_type=fabrication`)

3. **Chaine de mots-cles** (chaque etape independante) :
   - Etape 1 : `client_text` du parent → extraction mots-cles (sans stop words)
   - Etape 2 : `description` du parent → extraction mots-cles
   - Etape 3 : mots-cles DM via `getDefaultMaterialKeywords()`

4. **Scoring** : `scoreMatchCandidates(keywords, candidates)` — Levenshtein + substring. Relaxation si > 2 mots-cles donnent 0 resultats

5. 1 resultat → utilise directement. Plusieurs → modale de choix (code + description + categorie). 0 → toast d'erreur

6. Le choix est persiste dans `submissions.match_defaults` (JSONB)

**Exemple** : `$match:PANNEAU BOIS` avec DM = "Melamine grise 805" (article ST-0012 avec `material_costs["PANNEAU MELAMINE"]`). Le mot "PANNEAU" est commun → `effectiveExpCats = ["PANNEAU BOIS", "PANNEAU MELAMINE"]` → ST-0012 est candidat.

**Sandbox** : dans le sandbox catalogue, `$match:` prend silencieusement le premier resultat (pas de popup interactive).

### Execution dans le calculateur

`executeCascade(parentRowId, depth, parentOverrides, materialCtx)` :

1. **Ask guard** (depth 0 uniquement) : si l'article declare `calculation_rule_ai.ask`, verifie que toutes les variables sont remplies (L/H/P/QTY > 0, n_tablettes/n_partitions != null, 0 valide)
2. **Pre-peuple materialCtx** depuis le DM de la categorie du parent FAB (si pas deja fourni)
3. Lit les regles `cascade` de l'article
4. Pour chaque regle :
   - Verifie `cascade_suppressed` (enfants supprimes manuellement)
   - Verifie `override_children` (categories surchargees par un ancetre)
   - Resout le target (`$default:`, `$match:`, ou code direct) — async pour `$match:`
   - **Apres `$default:`** : propage l'ID (`_defaultResolvedId`) et le `client_text` resolu dans `materialCtx` (3 points de sortie : cache hit, candidat unique, modale technique). Marque `materialCtx._updatedBySiblingDefault = true`. Si la resolution est **fraiche** (via `resolveCascadeTarget`, pas via enfant existant), active le flag `_defaultResolvedFresh` pour forcer la re-resolution des `$match:` freres
   - **`_defaultResolvedFresh`** : quand `$default:` resout via `resolveCascadeTarget` (= DM a change), les `$match:` suivants **sautent** `findExistingChildForDynamicRule` et forcent une resolution fraiche via `resolveMatchTarget`. L'ancien enfant est retrouve par `cascadeRuleTarget` fallback et mis a jour (`itemChanged = true`). Previent la retention d'enfants stale (ex: bande de chant PVC reste apres passage melamine → placage)
   - **Filtre categorie `$match:` post-resolution** : si `materialCtx._defaultResolvedId` existe, verifie que l'article $default a une relation avec la categorie $match. Check 1 : cles `material_costs` contenant un mot de la categorie. Check 2 : regles cascade ciblant la meme categorie. Si aucune relation → resolution rejetee silencieusement (**pas de toast**). Ex: melamine (costs: PANNEAU MELAMINE, cascade: BANDE DE CHANT seulement) → FINITION BOIS rejete. Placage (cascade: BANDE DE CHANT + FINITION BOIS) → FINITION BOIS accepte
   - Evalue la condition (si presente)
   - Evalue la quantite : **constante** (× `rootQty`) ou **formule dimensionnelle** (resultat total, pas de multiplication)
   - Si l'enfant existe deja → met a jour la quantite
   - Sinon → cree une nouvelle ligne enfant
   - **Persist immediat** via `updateItem()` (bypass debounce global)
5. Supprime les enfants orphelins (regles qui n'existent plus)
6. Recursion jusqu'a **profondeur 3** avec `materialCtx` herite

### Guards et protections

| Guard | Declencheur | Effet |
|-------|------------|-------|
| `_cascadeRunning` | Re-entrance | Empeche les cascades paralleles |
| `_isLoadingSubmission` | Chargement | Bloque les cascades pendant le chargement |
| Debounce 400ms | `scheduleCascade` | Evite les cascades en rafale |
| `opts.skipCascade` | Toggle installation | Empeche le toggle installation de declencher une cascade |
| `cascade_suppressed` | Suppression manuelle enfant | Memorise les enfants supprimes, empeche la regeneration |
| Anti-lignes vides | `debouncedSaveItem`, `addRow` blur, `openSubmission` | 3 gardes empechent les lignes sans article de persister |
| Tri topologique | `openSubmission` | Tri defensif des items charges : parents toujours avant leurs enfants, meme si `sort_order` DB est corrompu |

### Propagation installation

`toggleRowInstallation` → `propagateInstallationToCascadeChildren(parentRowId, checked)` : quand l'utilisateur coche/decoche l'installation sur un article parent, le toggle est propage recursivement a tous les enfants cascade via `findCascadeChildren`. Sauvegarde DB immediate, `skipCascade: true`.

### Formules disponibles

Variables :

| Variable | Source | Guard |
|----------|--------|-------|
| `L` | Longueur du parent FAB racine | > 0 |
| `H` | Hauteur du parent FAB racine | > 0 |
| `P` | Profondeur du parent FAB racine | > 0 |
| `QTY` | Quantite du parent FAB racine | > 0 |
| `n_tablettes` | Nombre de tablettes | != null (0 valide) |
| `n_partitions` | Nombre de partitions | != null (0 valide) |

Fonctions :

| Fonction | Description |
|----------|-------------|
| `ceil(x)` | Arrondi superieur |
| `floor(x)` | Arrondi inferieur |
| `round(x)` | Arrondi au plus proche |
| `min(a, b)` | Minimum |
| `max(a, b)` | Maximum |

**Securite** : `evalFormula()` valide par regex que l'expression ne contient que des chiffres, operateurs arithmetiques, et les fonctions autorisees. Tout autre caractere est rejete.

### Visuel

Les lignes enfants cascades ont la classe `.cascade-child` : bordure verte gauche 2px, fond vert tres leger.

---

## 10. Contraintes

### Vue d'ensemble

Les contraintes sont des regles declenchees **une seule fois** quand un article est selectionne pour la premiere fois. Elles servent a ajouter des articles complementaires ou a valider la compatibilite des materiaux.

Tracking : `row.dataset.constraintsProcessed` empeche les re-executions.

### Difference cascade vs contrainte

| Aspect | Cascade | Contrainte |
|--------|---------|------------|
| **Gestion** | Automatique (creation/update/suppression) | One-shot (creation a la selection) |
| **Enfants** | Marques `.cascade-child`, lies au parent | Marques `.constraint-added`, independants |
| **Quantite** | Recalculee quand les dimensions changent | Fixe ou calculee une seule fois |
| **Suppression** | Auto-supprimes si parent retire | Restent si parent retire |
| **Recursion** | Oui (profondeur max 3) | Non |
| **Interaction** | Transparente, pas de confirmation | Peut demander confirmation (modal) |

### Type 1 : `auto_add`

Ajoute un article avec quantite fixe.

```json
{
  "type": "auto_add",
  "item_id": "ST-0030",
  "quantity": 4,
  "message": "Pattes de caisson ajoutees automatiquement"
}
```

Comportement :
1. Verifie que l'article n'est pas deja present dans la piece
2. Si doublon → toast "deja present", arret
3. Cree une ligne, selectionne l'article, fixe la quantite
4. Herite le tag du parent, ajoute la classe `.constraint-added` (bordure bleue gauche)

### Type 2 : `auto_add_calculated`

Comme `auto_add` mais avec quantite calculee par formule.

```json
{
  "type": "auto_add_calculated",
  "item_id": "EDG-001",
  "quantity_formula": "(L + H) * 2",
  "message": "Edge bois calcule selon dimensions"
}
```

Si les dimensions ne sont pas encore saisies → ajoute l'article avec quantite 0 + avertissement "Quantite a ajuster selon les dimensions".

### Type 3 : `requires_swap`

Verifie la compatibilite avec les articles existants d'un groupe dans la piece et propose un remplacement.

```json
{
  "type": "requires_swap",
  "target_group": "Facades",
  "current_must_match": "replaq",
  "search_in": "description",
  "warning": "Cette poignee necessite des panneaux a replaquer",
  "swap_logic": "same_client_text_with_match"
}
```

| Champ | Description |
|-------|-------------|
| `target_group` | Groupe de materiau a verifier (via `category_group_mapping`). |
| `current_must_match` | Sous-chaine que l'article cible **doit** contenir. |
| `search_in` | Champ a chercher : `description` (defaut) ou `client_text`. |
| `swap_logic` | Logique de remplacement. Seul `same_client_text_with_match` est implemente. |

**Exemple** : L'estimateur ajoute une poignee qui necessite du "replaque". Le systeme detecte que les facades sont en melamine (pas "replaq"), trouve la version replaquee (meme `client_text`, description avec "replaq"), et propose le swap.

### Type 4 : `requires_choice`

Force un choix compatible dans un groupe selon une condition.

```json
{
  "type": "requires_choice",
  "target_group": "Finition",
  "conditions": [
    {
      "if_description_contains": "melamine",
      "restrict_to": "opaque",
      "message": "Panneau melamine - finition opaque requise"
    }
  ]
}
```

Comportement :
1. Determine quelle condition correspond a l'article source (premiere correspondance)
2. Cherche les articles du `target_group` dans la piece
3. Verifie si chacun contient un des patterns de `restrict_to`
4. Pour chaque incompatible → propose remplacement ou conserve avec avertissement

### Champ de matching des contraintes

Les contraintes `requires_swap` et `requires_choice` trouvent les articles dans une piece via `findRoomItemsByGroup(groupName)`. Cette fonction :
1. Inverse le `category_group_mapping` pour trouver les categories catalogue correspondant au groupe
2. Cherche les lignes de la piece dont l'article a une de ces categories
3. Retourne ces lignes pour evaluation

Le champ `search_in` determine **ou** chercher la sous-chaine : dans `description` (technique, interne) ou dans `client_text` (visible au client).

### Elements visuels

| Element | Classe CSS | Apparence |
|---------|-----------|-----------|
| Ligne ajoutee par contrainte | `.constraint-added` | Bordure bleue gauche 2px |
| Ligne enfant cascade | `.cascade-child` | Bordure verte gauche 2px |
| Avertissement | `.constraint-warn` | ⚠ orange avec tooltip |
| Toast | `.constraint-toast` | Bandeau bas, fond navy, 3 secondes |
| Modal confirmation | `.constraint-modal` | Overlay sombre, boite blanche 460px |

---

## 11. Materiaux par defaut

### Fonctionnement

Chaque piece definit ses materiaux par defaut. Stockes dans `project_rooms.default_materials` (via `roomDM[groupId]`). Le niveau soumission a ete retire.

`client_text` est l'identifiant primaire — un DM represente un materiau client, pas un article technique.

```json
[
  { "type": "Caisson", "catalogue_item_id": "ST-0005", "client_text": "Melamine blanche", "description": "Melamine TFL blanc" },
  { "type": "Facades", "catalogue_item_id": "ST-0012", "client_text": "Placage chene blanc", "description": "Placage chene blanc FC 8%" }
]
```

**Migration legacy** : au chargement (`openSubmission`), les DM sans `client_text` derivent automatiquement le `client_text` depuis le `catalogue_item_id`.

### Utilisation dans les cascades

Quand une cascade a `target: "$default:Facades"` :
1. Cherche dans `roomDM[groupId]` les entrees de type `"Facades"`
2. Si plusieurs entrees du meme type → `materialCtx` desambigue, sinon `dmChoiceCache`, sinon modale de choix (Modale 1 : label = `client_text`)
3. Filtre `CATALOGUE_DATA` par `client_text` + categories autorisees (`getAllowedCategoriesForGroup`)
4. Si plusieurs articles techniques correspondent → modale technique (Modale 2 : code + description + categorie + prix)
5. Retourne le `catalogue_item_id` final
6. **Propage** le `client_text` de l'article resolu dans `materialCtx.chosenClientText` — permet aux `$match:` freres de scorer dans le bon contexte

Si aucun defaut defini → cascade ignoree + toast d'avertissement.

### Priorisation dans le combobox

Quand l'estimateur ouvre un combobox article dans le calculateur :
- Section superieure bleue : "Materiaux par defaut" — articles correspondants
- Section inferieure : reste du catalogue, groupe par categorie
- Le dropdown DM deduplique par `client_text` (un seul "Placage chene blanc" meme si 2+ articles techniques existent)

### Quand un defaut change

`reprocessDefaultCascades(changedGroup, scopeGroupId)` :
1. Scanne toutes les lignes de la piece
2. Trouve celles dont les cascades utilisent `$default:{changedGroup}`
3. Re-execute `executeCascade()` sequentiellement sur chacune
4. **Limitation** : ne traite PAS les cibles `$match:` — seuls les `$default:` et les `$match:` des parents avec `$default:` sont re-cascades

### Validation et UI

- **Groupes requis** : `DM_REQUIRED_GROUPS = ['Caisson','Panneaux','Tiroirs','Facades','Finition','Poignees']`. L'ajout d'articles est bloque si des groupes requis manquent
- **Groupes caches** : `DM_HIDDEN_GROUPS = ['Autre','Eclairage']` — filtres du dropdown DM
- **Indicateur vide** : classe `.dm-needs-config` avec fleche pulse quand DM count = 0 et ≥1 article dans la piece
- **Copier de...** : copie les DM depuis une autre piece uniquement (pas de template soumission)

---

## 12. Texte client et presentation

### Le champ `client_text`

Nom court visible au client dans la soumission. C'est un **fragment** qui apparait dans des listes, pas une phrase complete.

Exemples : "Placage de chene blanc FC", "Tiroir tandem box 500mm".

### Le champ `presentation_rule`

Instructions structurees (JSON) pour assembler la description client d'une piece. Chaque article definit dans quelles sections de la description il apparait et comment son `client_text` est formate.

**Forme humaine** (`presentation_rule_human`) : description en langage naturel.

**Forme AI** (`presentation_rule`) : JSON structure avec `sections` :
```json
{
  "sections": [
    { "key": "CAISSON", "label": "Caisson", "template": "{client_text}" },
    { "key": "FAÇADES", "label": "Facades et panneaux apparents", "template": "en {client_text}" }
  ],
  "exclude": ["elements a ne jamais mentionner"],
  "notes": "instructions supplementaires"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `sections[].key` | String | Groupe materiau en MAJUSCULES (CAISSON, FAÇADES, PANNEAUX, COMPTOIR, TIROIRS, POIGNÉES, QUINCAILLERIE, ÉCLAIRAGE, FINITION, RANGEMENT, DÉTAILS, EXCLUSIONS) |
| `sections[].label` | String | Nom affiche dans la description |
| `sections[].template` | String | Template avec `{client_text}` comme placeholder |
| `exclude` | String[] | Elements a ne jamais mentionner au client |
| `notes` | String | Instructions supplementaires pour l'AI |

### Assemblage de la description

Deux mecanismes d'assemblage :

**1. Bouton assembler (⚡)** : `assembleRoomDescription()` dans le calculateur. Assemblage deterministe sans appel AI :
- Materiaux par defaut en premier (ex: "Caisson : Melamine blanche")
- Sections des `presentation_rule` dans l'ordre standard
- Fallback "Details" pour les articles sans `presentation_rule`

**2. Bouton AI (●)** : `aiGenerateDescription()` dans le calculateur. Appel a l'edge function `translate` pour generer/reviser la description avec contexte complet.

**Sandbox** : `sbBuildDescription()` assemble automatiquement la description a chaque changement — materiaux par defaut dynamiques + sections `presentation_rule` + fallback details.

### Formatage dans la soumission client

`formatDescriptionForDisplay()` detecte les mots-cles (CAISSON, FACADES, TIROIRS, POIGNEES, etc.), les met en gras, applique la casse de phrase, et cree des listes a puces.

---

## 13. Permissions et roles

### Roles disponibles

| Role | Description |
|------|-------------|
| Admin | Acces complet a toutes les fonctions |
| Vente | Estimateurs — creation de soumissions |
| Charge de projet | Gestion de projets |
| Achat | Achats et fournisseurs |
| Atelier | Production |
| Client | Acces externe limite |

### Permissions pertinentes au catalogue

| Permission | Cle | Qui | Effet |
|------------|-----|-----|-------|
| Acces catalogue | `catalogue` | Tous les employes | Voir le catalogue (lecture seule) |
| Edition catalogue | `catalogue_edit` | Admin, Achat | Modifier les articles existants et en creer |
| Edition catalogue (AI) | `edit_catalogue` | Admin, Achat | Permet au tool AI `update_catalogue_item` de modifier un article depuis le calculateur. Audit trail dans `catalogue_change_log` |
| Edition minutes | `edit_minutes` | Admin | Modifier les minutes de main-d'oeuvre dans le prix compose |
| Edition materiaux | `edit_materials` | Admin, Achat | Modifier les couts materiaux dans le prix compose |
| Approbation articles | `can_approve_quotes` | Admin | Approuver/rejeter les articles `pending` |
| Admin | `admin` | Admin | Sandbox, templates, configurations, changement de categorie sur articles existants |

### Configuration

Dans `admin.html` → section "Permissions" :
- `app_config.permissions` : objet `{ role: { permission: true/false } }`
- `app_config.user_roles` : objet `{ "email@example.com": "Admin" }`

### Points importants

- Les verifications de permissions sont **cote client uniquement** (contournable via DevTools)
- Le changement de categorie sur un article existant est reserve aux admins (`catSelect.disabled = !isNewItem && !isAdmin`)
- L'acces a la sandbox est reserve aux admins

---

## 14. Workflow d'un article

### Cycle de vie

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Utilisateur avec catalogue_edit                         │
│  ─────────────────────────────                           │
│  Cree un article → status = null ou approved             │
│  → Directement utilisable dans le calculateur            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Utilisateur SANS catalogue_edit                         │
│  ────────────────────────────────                        │
│  Propose un article → status = pending                   │
│  proposed_by = son email                                 │
│  ↓                                                       │
│  Visible par : auteur + admins seulement                 │
│  ↓                                                       │
│  Approbateur (can_approve_quotes) :                      │
│    → Approuve → status = approved → utilisable           │
│    → Rejette → status = rejected → invisible             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Contexte de proposition

Quand un non-editeur propose un article, le formulaire guide capture :
- **Contraintes** (`proposal_context.constraints`) : restrictions ou exigences
- **Notes pour l'approbateur** (`proposal_context.notes_for_approver`) : informations complementaires

Ces informations sont visibles par l'approbateur dans `approbation.html`.

### Impact du statut

| Statut | Visible catalogue | Visible calculateur | Modifiable |
|--------|-------------------|---------------------|------------|
| `null` (legacy) | Oui | Oui | Oui (si permission) |
| `approved` | Oui | Oui | Oui (si permission) |
| `pending` | Auteur + admins | Non | Auteur + admins |
| `rejected` | Non | Non | Non |

### Validations a la sauvegarde

`runSaveValidation()` avant chaque sauvegarde :

| Check | Severite | Description |
|-------|----------|-------------|
| Pas de prix | Erreur (bloquant) | Ni prix fixe ni prix compose. Bypass au 2e clic |
| Pas de client_text | Info (non-bloquant) | S'affiche mais ne bloque pas la sauvegarde |

### Comportement apres sauvegarde

La modale reste ouverte apres sauvegarde. Un toast navy "Sauvegarde ✓" apparait au-dessus du footer (2.5s, auto-fade). L'utilisateur ferme manuellement via Annuler, X ou Escape.

---

## 15. Workflow d'une soumission

### Statuts

```
draft → pending_internal ↔ returned → approved_internal → sent_client → accepted → invoiced
```

| Statut | Qui | Description |
|--------|-----|-------------|
| `draft` | Estimateur | Brouillon, en cours d'edition |
| `pending_internal` | Estimateur | Soumis pour approbation interne |
| `returned` | Approbateur | Retourne avec commentaires |
| `approved_internal` | Approbateur | Approuve, pret a envoyer |
| `sent_client` | Estimateur | Envoye au client |
| `accepted` | Client | Accepte et signe |
| `invoiced` | Admin | Facture |

### Auto-approbation

Les utilisateurs avec la permission `can_approve_quotes` passent directement de `draft` a `approved_internal`, sans etape `pending_internal`.

### Lien avec le catalogue

- Chaque ligne de soumission (`room_items`) reference un `catalogue_item_id`
- Le prix utilise (`unit_price`) est copie depuis le catalogue au moment de la selection
- Les cascades/contraintes s'executent au moment de la selection, pas a la visualisation
- Les materiaux par defaut (`default_materials`) resolvent les `$default:` des cascades

---

## 16. Sandbox

### Ce que c'est

La sandbox est un panneau de previsualisation en temps reel a cote de la modal d'edition. Elle simule cascades et contraintes sans affecter les vraies soumissions. **Visible uniquement pour les admins.**

### A quoi ca sert

1. **Tester les cascades** : voir quels articles se cascadent, avec quelles quantites
2. **Tester les materiaux par defaut** : voir comment `$default:` se resout
3. **Tester les formules** : entrer des dimensions L/H/P et voir les quantites calculees
4. **Previsualiser les descriptions** : voir comment le texte client s'assemble
5. **Editer en temps reel** : chaque modification dans la modal se reflete instantanement

### Comment l'utiliser

1. Ouvrir un article dans la modal d'edition
2. Cliquer le bouton "Sandbox" (admins seulement)
3. La modal se divise en deux : formulaire a gauche, sandbox a droite
4. La sandbox montre :
   - **Materiaux par defaut** : dropdowns pour chaque groupe
   - **Description** : previsualisation du texte assemble
   - **Dimensions** : champs L/H/P (selon `dims_config`)
   - **Lignes catalogue** : tableau article courant + enfants cascades
   - **Sous-total** : prix total calcule

### Ce qui est simule vs ce qui est reel

| Aspect | Simule | Commentaire |
|--------|--------|-------------|
| Cascades (`$default:`, formules, conditions) | Oui | Meme logique que le calculateur |
| Contraintes `auto_add` / `auto_add_calculated` | Oui | Ajoute des lignes sandbox |
| Contraintes `requires_swap` / `requires_choice` | Partiellement | Avertissement texte, pas de modal interactive |
| Prix compose | Oui | Meme calcul que le calculateur |
| Materiaux par defaut | Oui | Independants de la soumission |
| Sauvegarde en base | Non | Aucune ecriture Supabase |

### Reactivite

La sandbox ecoute les changements dans la modal :
- `editClientText`, `editPrice`, `editDescription` → `sbItemOverrides`
- Inputs du prix compose → `sbItemOverrides.labor_minutes` / `material_costs`
- `editCalcRuleAi` (JSON) → reprocesse cascades + contraintes
- Checkboxes dimensions → met a jour la visibilite des champs

---

## 17. AI dans le catalogue

### Boutons AI dans la modal d'edition

4 boutons AI, chacun appelle l'Edge Function `translate` :

#### 1. Texte client

- **Action** : `catalogue_client_text`
- **Modele** : Haiku 4.5
- **Input** : Contexte article + textes similaires de la meme categorie
- **Output** : Texte client genere/ameliore en respectant le style existant

#### 2. Regle de presentation

- **Action** : `catalogue_pres_rule`
- **Modele** : Sonnet 4
- **Input** : Contexte article + `presentation_rule_human` + exemples
- **Output** : JSON structure `{ sections, order, prefix }` + texte humain

#### 3. Regle de calcul

- **Action** : `catalogue_calc_rule`
- **Modele** : Sonnet 4
- **Input** : Contexte article + `calculation_rule_human` + tous les codes existants + categories
- **Output** : JSON `{ cascade, constraints, ask }` + texte humain

#### 4. Import composantes

- **Action** : `import_components`
- **Modele** : Sonnet 4 (vision)
- **Input** : Texte + images (screenshots de prix, factures)
- **Output** : Composantes extraites. Recapitulatif editable avant application.

### "Regles de base" (autoGenerateBaseRules)

Bouton qui genere automatiquement les regles de calcul ET de presentation en une seule action, en utilisant les templates par categorie (voir [section 8](#8-templates-de-regles-par-categorie)).

Envoie deux prompts separes (calcul et presentation) et remplit les 4 champs :
- `calculation_rule_human` + `calculation_rule_ai`
- `presentation_rule_human` + `presentation_rule`

### Assistant catalogue (import drawer)

Chat conversationnel (`catalogue-import` Edge Function, Sonnet 4.5) avec 7 outils :

| Outil | Auto-execute | Confirmation |
|-------|:----------:|:----------:|
| `search_catalogue` | Oui | — |
| `filter_catalogue` | Oui | — |
| `check_usage` | Oui | — |
| `audit_client_names` | Oui | — |
| `create_catalogue_item` | — | Oui |
| `update_catalogue_item` | — | Oui |
| `delete_catalogue_item` | — | Oui |

Outils en lecture seule : execution auto (max 5 boucles). Outils d'ecriture : recap + confirmation utilisateur.

### Tool `update_catalogue_item` (depuis le calculateur)

L'assistant AI du calculateur (`ai-assistant` Edge Function) peut modifier un article catalogue directement, sans quitter le calculateur. Tool `update_catalogue_item` :

- **Champs modifiables** (whitelist) : `price`, `labor_minutes`, `material_costs`, `calculation_rule_ai`, `instruction`, `loss_override_pct`
- **Permission** : `edit_catalogue` requise (permission `canEditCatalogue`)
- **Audit** : snapshot avant/apres dans `catalogue_change_log` (qui, quand, quoi)
- **Jamais auto-execute** : confirmation obligatoire via boutons "Appliquer / Ignorer" — meme si l'utilisateur dit "oui" ou "go"
- **CATALOGUE_DATA** : mis a jour en memoire apres application (pas de rechargement page necessaire)

### Tool `update_submission_line` (override par ligne)

L'assistant AI du calculateur peut ajuster les minutes MO, couts materiaux ou prix de vente d'une ligne dans la soumission courante. Tool `update_submission_line` :

- **Override local** : ne modifie PAS le catalogue — ajustement per-soumission uniquement
- **Champs** : `overrides.labor_minutes` (fusionne avec catalogue), `overrides.material_costs` (fusionne avec catalogue), `overrides.price` (remplace entierement le prix compose)
- **Jamais auto-execute** : simulation obligatoire (avant/apres), confirmation requise
- **Pas d'audit DB** : pas de table dedicee, historique dans le chat uniquement
- **Reset** : changement d'article catalogue → overrides supprimes automatiquement

### Cascade debug logs

`cascadeDebugLog` — buffer memoire circulaire (200 entrees max) capturant tous les `cascadeLog(level, msg, data)` du moteur cascade. `summarizeCascadeLog()` retourne les 50 dernieres entrees en texte.

Deux detections independantes controlent l'inclusion dans le contexte AI :
- `detectCascadeDiagnostic(text)` — mots-cles cascade (cascade, debug, bug, manqu, erreur, $default, $match…) → inclut les logs
- `detectCalculationContext(text)` — mots-cles calcul (regle, formule, dimension, pourquoi, comment…) → inclut `calculationRules`

Usage : l'utilisateur demande "pourquoi la bande de chant n'est pas generee?" → les logs sont injectes dans le contexte AI → l'assistant peut diagnostiquer le probleme.

### Images annotees rasterisees

`rasterizeAnnotatedImage()` — au save des annotations, dessine image + tags (rectangles navy + texte blanc) dans un canvas, upload JPEG 0.92 dans `annotated/{mediaId}.jpg`, stocke l'URL dans `room_media.annotated_url`. L'AI recoit l'image annotee quand disponible (les tags sont visibles directement sur l'image).

### Rate limit auto-retry (429/529)

`callAiAssistant` intercepte les erreurs 429 (rate limit) et 529 (overloaded). Affiche "Un instant, le serveur est occupe…", attend 15s, retire le message temporaire, et retry une seule fois. Si le retry echoue aussi, message d'erreur propre (jamais le texte brut de l'API).

### Sanitisation tool_use/tool_result

`sanitizeConversationToolUse(messages)` — defense en profondeur avant chaque appel API. Detecte les blocs `tool_use` orphelins (sans `tool_result` correspondant) et injecte des `tool_result` synthetiques `{"skipped":true}`. Previent l'erreur API 400 "tool_use ids found without tool_result blocks".

### Apprentissage organisationnel (`ai_learnings`)

Table de regles apprises injectees dans les prompts systeme :
```
Regles apprises de cette organisation :
1. Toujours utiliser "chene blanc FC" et non "white oak"
2. Les tiroirs tandem box sont par defaut 500mm
```

---

## 18. Audit

### Le bouton "Auditer"

Ouvre un tiroir lateral droit avec une analyse complete du catalogue.

### Checks de l'audit complet

`runFullAudit()` sur tous les articles :

| # | Check | Severite | Description |
|---|-------|----------|-------------|
| 1 | Variantes texte client | WARNING | `client_text` presque identiques (Levenshtein 1-3) dans la meme categorie. Identifie le texte minoritaire comme suspect. |
| 2 | Client text manquant | INFO | Articles sans `client_text`. |
| 3 | Pas de prix | CRITICAL | Articles sans prix fixe ni prix compose. |
| 4 | Categorie non classee | WARNING | Categorie vide ou "Non classe". |
| 5 | Incoherences orthographiques | WARNING | Descriptions similaires (Levenshtein 1-3). |
| 6 | Articles jamais utilises | INFO | `usage_count = 0`. |
| 7 | Articles dormants | INFO | Non utilises depuis 60+ jours. |
| 8 | Prix aberrants | WARNING | Prix hors IQR (interquartile range) dans la meme categorie. |
| 9 | Regles de calcul obsoletes | WARNING | Articles avec `$default:` dans `calculation_rule_ai` (migrer vers `$match:`). |
| 10 | Regles de calcul manquantes | WARNING | Articles sans `calculation_rule_ai` (si des templates existent). |
| 11 | **Textes clients similaires** | WARNING | Groupement par `normalizeForGrouping()` (lowercase, sans accents, sans articles FR de/du/des/au/aux/le/la/les/en/un/une). Detecte des `client_text` differents qui normalisent au meme texte. Bouton **Uniformiser** par groupe → PATCH tous les articles minoritaires vers le texte le plus frequent. |
| 12 | **Cles depense similaires** | WARNING | `normalizeExpenseKey()` (uppercase, sans accents, strip S/X pluriel). Detecte "PANNEAU BOIS" vs "PANNEAUX BOIS" dans la meme categorie catalogue. |

### Navigation

Resultats groupes par severite (critical > warning > info). Chaque article cliquable → ouvre `openEditModal(itemId)` avec navigation scopee au groupe d'audit (fleches prev/next limitees au meme finding).

---

## 19. FAQ — Questions cles

### Q1 — Quelle est la difference entre "categorie catalogue" et "categorie de depense" ?

**Categorie catalogue** (`catalogue_items.category`) : sert a **organiser** les articles dans l'interface (filtres, dropdown, affichage par sections). Exemples : "Tiroirs", "Poignees", "Carcasses", "Budgetaire".

**Categorie de depense** (`app_config.expense_categories[].name`) : sert au **calcul du prix compose**. C'est le type de cout materiau, avec son propre markup et waste. Exemples : "QUINCAILLERIE", "PANNEAU BOIS", "FINITION OPAQUE".

Un article de categorie catalogue "Tiroirs" peut avoir des couts dans les categories de depense "QUINCAILLERIE" (5$) + "TIROIRS" (45$) + "BOIS BRUT" (12$).

### Q2 — Sur quel champ matchent les contraintes `requires_swap` / `requires_choice` ?

Le champ `search_in` de la contrainte determine ou chercher `current_must_match` :
- `"description"` (defaut) : cherche dans `catalogue_items.description` (technique, interne)
- `"client_text"` : cherche dans `catalogue_items.client_text` (visible au client)

La recherche est case-insensitive et cherche une sous-chaine (`.toLowerCase().indexOf()`).

### Q3 — Quelle est la portee d'injection des templates ?

Les templates (`calc_template` / `pres_template`) sont injectes dans le prompt AI de deux facons :

1. **"Regles de base"** (`autoGenerateBaseRules`) : tous les templates de toutes les categories sont injectes en bloc dans le prompt. L'AI genere des regles pour l'article courant en tenant compte de tous les templates.

2. **Bandeau hint** : Affiches dans la modal pour reference de l'admin. Ne sont pas envoyes automatiquement aux boutons AI individuels (texte client, regle calcul, regle presentation).

Les templates ne sont **pas** injectes dans le calculateur ni dans l'Edge Function `ai-assistant`. Leur portee est exclusivement la generation de regles dans la modal catalogue.

### Q4 — A quoi sert le champ `item_type` (classification) ?

`item_type` a deux valeurs possibles :

- **`fabrication`** : article fabrique sur mesure (meuble, caisson, ilot). Les dimensions L/H/P sont pertinentes et affichees dans le calculateur. Le champ `dims_config` controle quelles dimensions sont actives.

- **`materiau`** : article materiau (panneau, placage, quincaillerie). Les dimensions ne sont generalement pas demandees car elles sont calculees par les cascades du parent.

**Impact** :
- `dims_config` n'est visible dans la modal que si `item_type = 'fabrication'`
- Dans le calculateur, les champs dimension (L/H/P) sont affiches selon `dims_config` de l'article
- L'AI utilise `item_type` pour comprendre si l'article est un produit fini ou une composante

### Q5 — Le `dims_config` controle-t-il les dimensions dans le calculateur ?

Oui. `dims_config` est un objet JSONB `{ "l": true, "h": true, "p": false }` qui determine quelles colonnes de dimensions sont visibles dans le calculateur pour cet article.

- `l: true` → colonne Longueur visible
- `h: true` → colonne Hauteur visible
- `p: false` → colonne Profondeur masquee

**Valeurs par defaut** : si `dims_config` est null, toutes les dimensions sont considerees actives (pour un article de type `fabrication`). Pour un `materiau`, les dimensions ne sont pas affichees.

**Interaction avec les cascades** : les formules de cascade (`L * H / 144`) utilisent les dimensions du parent. Si une dimension est desactivee, sa valeur sera 0, ce qui peut donner un resultat 0 dans la formule.

---

## 20. Bugs connus et limitations

### Securite

1. **`evalFormula()` utilise `new Function()`** : Bien que la validation regex soit stricte, l'execution dynamique de code client reste un vecteur potentiel. Les formules proviennent du JSONB en base, modifiables uniquement par les editeurs de catalogue.

2. **Pas de validation serveur des regles JSON** : les champs `calculation_rule_ai` et `presentation_rule` acceptent n'importe quel JSON. Pas de schema validation cote Supabase.

3. **Permissions cote client uniquement** : les verifications `catalogue_edit`, `edit_minutes`, etc. sont dans le JavaScript. Un utilisateur technique peut contourner via DevTools. Le RLS Supabase protege les donnees mais ne fait pas de validation granulaire des champs.

### Coherence des donnees

4. **`price` et prix compose non mutuellement exclusifs en base** : rien n'empeche un article d'avoir les deux. Le client utilise `hasComposedPrice()` pour choisir l'affichage, mais les valeurs peuvent etre desynchronisees.

5. **`supplier_name` et `supplier_sku` coexistent avec `catalogue_item_components`** : les colonnes legacy sur `catalogue_items` ne sont plus utilisees par l'interface mais pas supprimees.

6. **`image_url` coexiste avec `item_media`** : meme situation, lu pour compatibilite.

### Fonctionnalites partielles

7. **Contraintes swap/choice dans la sandbox** : affichent uniquement un avertissement texte, pas de modal interactive. La sandbox n'a pas le contexte multi-lignes interactif.

8. **Pas de filtrage proactif du combobox par `requires_choice`** : les restrictions ne se declenchent que si un article du groupe cible **existe deja** dans la piece. Le filtrage en amont ("quand l'estimateur ajoute un article, filtrer les options compatibles") n'est pas implemente.

9. **`$match:` pas re-cascade sur changement DM** : `reprocessDefaultCascades()` ne gere que `$default:`. Les `$match:` ne sont pas recalcules quand un DM change — seul un re-trigger manuel le fait.

### Performance

10. **`CATALOGUE_DATA` charge en entier** : tous les articles approuves en memoire au demarrage. Correct pour quelques centaines d'articles. Pourrait necessiter de la pagination pour plusieurs milliers.

11. **Cache localStorage d'une heure** : un article approuve peut prendre jusqu'a 1 heure pour apparaitre sur un poste qui a deja visite la page.

### CSS duplique

12. **CSS de presentation duplique dans calculateur.html** : `calculateur.html` contient 2 copies du CSS de presentation de soumission (styles inline + chaine CSS pour l'apercu/impression). Toute modification CSS dans `quote.html` doit etre repliquee aux 2 endroits dans `calculateur.html`.

### Bugs corriges (2026-03-03)

13. ~~**Perte de donnees cascade via debounce global**~~ **CORRIGE** : `debouncedSaveItem` utilisait un timer global unique. Les creations rapides de 3+ enfants cascade annulaient les saves intermediaires. Corrige par `updateItem()` immediat dans `executeCascade`.

14. ~~**Ask guard bloquait 0 tablettes/partitions**~~ **CORRIGE** : `n_tablettes`/`n_partitions` verifiaient `> 0` mais 0 est valide pour les caissons. Corrige : verifie `== null`.

15. ~~**`findExistingChildForDynamicRule` fallback categorie**~~ **CORRIGE** : le fallback par categorie catalogue permettait aux `$default:` de voler les enfants `$match:`. Supprime.

### Bugs corriges (2026-03-05)

16. ~~**rootQty multipliait les formules dimensionnelles**~~ **CORRIGE** : `qty = evalFormula(rule.qty) * rootQty` doublait les quantites pour les formules L/H/P. Fix : detection constante vs formule par regex.

17. ~~**tool_use orphelins → erreur API 400**~~ **CORRIGE** : `sanitizeConversationToolUse` + 3 corrections amont (dismiss, nouveau message, follow-up).

18. ~~**429/529 affiche brut**~~ **CORRIGE** : auto-retry 15s + message propre.

19. ~~**Toggle installation declenchait cascade → duplication enfants**~~ **CORRIGE** : `opts.skipCascade` + propagation installation aux enfants cascade.

20. ~~**Lignes vides persistantes**~~ **CORRIGE** : 3 gardes (debouncedSaveItem skip, blur listener 2s, openSubmission filtre).

21. ~~**Upload plan PDF avec caracteres invalides**~~ **CORRIGE** : sanitisation filename (NFD, apostrophes, em dash, espaces).

22. ~~**`$match:` resolvait dans le mauvais contexte materiau**~~ **CORRIGE** : `resolveCascadeTarget` propage `materialCtx.chosenClientText` apres chaque resolution `$default:`.

23. ~~**Instruction manquant dans catalogueSummary**~~ **CORRIGE** : champ `instruction` reinclus (tronque 80 car).

### Code partage (2026-03-02)

- `shared/auth.js` — `authenticatedFetch()` extrait (7 fichiers → 1)
- `shared/utils.js` — `escapeHtml()` / `escapeAttr()` extrait (8 fichiers → 1)
- `shared/pricing.js` — `computeComposedPrice()` / `computeCatItemPrice()` extrait (3 fichiers → 1)
- `steleConfirm()` / `steleAlert()` — encore duplique (signatures differentes par fichier)
