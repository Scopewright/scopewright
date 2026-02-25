# Guide technique du catalogue Stele

> Documentation fonctionnelle et technique de `catalogue_prix_stele_complet.html` et des systemes associes.
> Derniere mise a jour : 2026-02-24

---

## Table des matieres

- [A. Architecture des donnees](#a-architecture-des-donnees)
- [B. Systeme de prix](#b-systeme-de-prix)
- [C. Systeme de cascades](#c-systeme-de-cascades)
- [D. Systeme de contraintes](#d-systeme-de-contraintes)
- [E. Categories et groupes](#e-categories-et-groupes)
- [F. Materiaux par defaut](#f-materiaux-par-defaut)
- [G. Texte client et presentation](#g-texte-client-et-presentation)
- [H. Approbation et permissions](#h-approbation-et-permissions)
- [I. Audit et validation](#i-audit-et-validation)
- [J. AI dans le catalogue](#j-ai-dans-le-catalogue)
- [K. Sandbox editeur de regles](#k-sandbox-editeur-de-regles)
- [L. Observations](#l-observations)

---

## A. Architecture des donnees

### Table `catalogue_items`

Table principale du catalogue. Chaque ligne est un article (produit, materiau, service).

| Colonne | Type | Role |
|---------|------|------|
| `id` | TEXT (PK) | Code unique, ex: `BUD-001`, `TIR-003`. Sert de cle primaire textuelle. |
| `category` | TEXT | Categorie de l'article (ex: "Budgetaire", "Tiroirs", "Poignees"). |
| `description` | TEXT | Description technique interne (non visible au client). |
| `type` | TEXT | Unite de mesure : `pi2`, `unitaire`, `lineaire`, `%`. |
| `price` | NUMERIC | Prix fixe. `null` si prix compose (labor + materiaux). |
| `instruction` | TEXT | Instructions de prise de mesure / calcul pour l'estimateur. |
| `image_url` | TEXT | URL de l'image principale (legacy, remplace par `item_media`). |
| `in_calculator` | BOOLEAN | Visible dans le combobox du calculateur. |
| `has_sales_sheet` | BOOLEAN | Possede une fiche de vente detaillee. |
| `is_default` | BOOLEAN | Article par defaut (etoile). |
| `sort_order` | INTEGER | Ordre d'affichage dans le catalogue. |
| `status` | TEXT | `approved`, `pending`, `rejected`, ou `null` (legacy = approuve). |
| `proposed_by` | TEXT | Email de l'utilisateur qui a propose l'article (si `pending`). |
| `item_type` | TEXT | Classification : `fabrication` ou `materiau`. Determine la visibilite des dimensions. |
| `dims_config` | JSONB | Dimensions applicables : `{ "L": true, "H": true, "P": false }`. |
| `labor_minutes` | JSONB | Minutes de main-d'oeuvre par departement. Voir section B. |
| `material_costs` | JSONB | Couts materiaux par categorie de depense. Voir section B. |
| `calculation_rule_human` | TEXT | Regle de calcul en langage naturel (pour l'estimateur). |
| `calculation_rule_ai` | JSONB | Regle structuree pour le moteur de cascades/contraintes. Voir sections C et D. |
| `client_text` | TEXT | Nom/description visible au client dans la soumission. Voir section G. |
| `client_text_en` | TEXT | Version anglaise du texte client. |
| `presentation_rule_human` | TEXT | Regle de presentation en langage naturel. |
| `presentation_rule` | JSONB | Regle de presentation structuree (JSON). Voir section G. |
| `supplier_name` | TEXT | Fournisseur principal (legacy). |
| `supplier_sku` | TEXT | SKU du fournisseur (legacy). |

**Colonne generee** : `line_total` sur `room_items` (pas sur `catalogue_items`).

### Table `catalogue_item_components`

Composantes fournisseur liees a un article du catalogue.

| Colonne | Type | Role |
|---------|------|------|
| `id` | UUID (PK) | Identifiant unique. |
| `catalogue_item_id` | TEXT (FK) | Reference vers `catalogue_items.id`. |
| `supplier_name` | TEXT | Nom du fournisseur. |
| `supplier_sku` | TEXT | Code fournisseur. |
| `description` | TEXT | Description de la composante. |
| `expense_category` | TEXT | Categorie de depense (doit correspondre a `expense_categories`). |
| `qty_per_unit` | NUMERIC | Quantite par unite d'article. |
| `unit_cost` | NUMERIC | Cout unitaire. |
| `notes` | TEXT | Notes additionnelles. |
| `sort_order` | INTEGER | Ordre d'affichage. |

### Table `item_media`

Medias (images, PDF) associes a un article du catalogue.

| Colonne | Type | Role |
|---------|------|------|
| `id` | UUID (PK) | Identifiant unique. |
| `catalogue_item_id` | TEXT (FK) | Reference vers `catalogue_items.id`. |
| `file_url` | TEXT | URL dans le bucket Supabase Storage `fiche-images`. |
| `file_type` | TEXT | `image` ou `pdf`. |
| `tags` | JSONB | Tags associes (ex: `["fiche_client", "catalogue"]`). |

### Cles `app_config` utilisees par le catalogue

| Cle | Type | Role |
|-----|------|------|
| `taux_horaires` | Array | Taux horaires par departement : `[{ "department": "Assemblage", "taux_horaire": 45 }, ...]` |
| `expense_categories` | Array | Categories de depenses materiaux : `[{ "name": "Quincaillerie", "markup": 30, "waste": 5 }, ...]` |
| `catalogue_categories` | Array | Liste des categories disponibles dans le dropdown. |
| `media_tags` | Array | Tags disponibles pour les medias : `["fiche_client", "catalogue", "technique", ...]` |
| `material_groups` | Array | Groupes de materiaux pour les soumissions : `["Caisson", "Facades et panneaux apparents", "Tiroirs", "Poignees", ...]` |
| `category_group_mapping` | Object | Mapping categories catalogue vers groupes soumission. Voir section E. |
| `permissions` | Object | Permissions par role. |
| `user_roles` | Object | Mapping email vers role. |
| `ai_prompt_catalogue_import` | Text | Override du prompt systeme pour l'assistant catalogue (optionnel). |

### Table `ai_learnings`

Regles d'apprentissage organisationnel injectees dans les prompts AI.

| Colonne | Type | Role |
|---------|------|------|
| `id` | UUID (PK) | Identifiant unique. |
| `learning` | TEXT | La regle apprise (ex: "Toujours utiliser chene blanc FC pour les projets residentiels"). |
| `context` | TEXT | Contexte d'application. |
| `is_active` | BOOLEAN | Active ou non. |

### Table `companies` (fournisseurs)

| Colonne | Type | Role |
|---------|------|------|
| `id` | UUID (PK) | Identifiant unique. |
| `name` | TEXT | Nom de l'entreprise. |
| `company_type` | TEXT | Type : `Fournisseurs`, `Client`, etc. |

Le catalogue filtre `company_type = 'Fournisseurs'` pour les dropdowns fournisseur dans les composantes.

### Cycle de vie d'un article

```
Creation (editeur ou AI)
    |
    v
[status = 'pending']  ── si cree par un non-admin
    |                      (proposed_by = email)
    v
Approbation par admin
    |
    v
[status = 'approved']  ── visible dans le calculateur
    |
    v
Utilisation dans les soumissions
    |
    v
(optionnel) Rejet → [status = 'rejected']
```

**Articles legacy** : `status = null` sont traites comme approuves (compatibilite).

---

## B. Systeme de prix

### Prix fixe vs prix compose

Chaque article a **soit** un prix fixe, **soit** un prix compose. Jamais les deux en meme temps.

**Prix fixe** : La colonne `price` contient une valeur numerique. Utilise pour les articles simples ou le prix ne depend pas de main-d'oeuvre ni de materiaux detailles.

**Prix compose** : La colonne `price` est `null`. Le prix est calcule dynamiquement a partir de `labor_minutes` + `material_costs`.

La detection se fait par :
```javascript
function hasComposedPrice(item) {
    var lm = item.labor_minutes || {};
    var mc = item.material_costs || {};
    var hasLabor = Object.values(lm).some(function(v) { return v > 0; });
    var hasMat = Object.values(mc).some(function(v) { return v > 0; });
    return hasLabor || hasMat;
}
```

### Calcul du prix compose

**Formule globale** :

```
Prix = Somme(minutes / 60 x taux_horaire_dept) + Somme(cout x (1 + markup%/100 + waste%/100))
```

#### Main-d'oeuvre (`labor_minutes`)

Structure JSONB :
```json
{
  "Assemblage": 30,
  "Finition": 15,
  "Installation": 10
}
```

Les cles sont des noms de departement. Les valeurs sont en **minutes**.

Calcul par departement :
```
cout_mo_dept = (minutes / 60) x taux_horaire_du_departement
```

Les taux horaires viennent de `app_config.taux_horaires` :
```json
[
  { "department": "Assemblage", "taux_horaire": 45.00 },
  { "department": "Finition", "taux_horaire": 50.00 },
  { "department": "Installation", "taux_horaire": 55.00 }
]
```

#### Materiaux (`material_costs`)

Structure JSONB :
```json
{
  "Quincaillerie": 12.50,
  "Peinture": 8.00,
  "Bois": 45.00
}
```

Les cles sont des noms de categorie de depense. Les valeurs sont le **cout unitaire**.

Calcul par categorie :
```
cout_mat_cat = cout x (1 + markup%/100 + waste%/100)
```

Les markup et waste viennent de `app_config.expense_categories` :
```json
[
  { "name": "Quincaillerie", "markup": 30, "waste": 0 },
  { "name": "Peinture", "markup": 25, "waste": 10 },
  { "name": "Bois", "markup": 35, "waste": 15 }
]
```

**Attention** : le waste et le markup sont **additionnes**, pas composes. `(1 + markup/100 + waste/100)`, pas `(1 + markup/100) x (1 + waste/100)`.

#### Decomposition pour affichage

Dans la modale d'edition, le prix compose montre :
- **Prix coutant** = cout x (1 + waste/100)
- **Profit** = cout x markup/100
- **Total materiau** = prix coutant + profit

### Le champ `calculation_rule_ai`

Ce champ JSONB contient la logique structuree pour les cascades et les contraintes. Structure complete :

```json
{
  "cascade": [
    {
      "target": "ITEM-CODE ou $default:NomGroupe",
      "qty": "formule ou nombre",
      "condition": "formule booleenne (optionnel)"
    }
  ],
  "constraints": [
    {
      "type": "auto_add | auto_add_calculated | requires_swap | requires_choice",
      ...parametres selon le type
    }
  ],
  "ask": ["L", "H", "P"],
  "notes": "explication optionnelle"
}
```

- `cascade` : regles d'ajout automatique d'articles lies (voir section C)
- `constraints` : regles de validation et d'ajout conditionnel (voir section D)
- `ask` : dimensions a demander lors de la selection
- `notes` : documentation interne

---

## C. Systeme de cascades

### Qu'est-ce qu'une cascade

Une cascade cree automatiquement des lignes enfants quand un article parent est selectionne dans le calculateur. Exemple : quand on selectionne "Ilot de cuisine", la cascade peut automatiquement ajouter "Comptoir granit", "Dosseret", "Eclairage sous-comptoir" avec des quantites calculees.

Les cascades sont **gerees automatiquement** : elles se mettent a jour quand les dimensions changent et se suppriment quand l'article parent est retire.

### Structure JSON des cascades

Dans `calculation_rule_ai.cascade` :

```json
{
  "cascade": [
    {
      "target": "GRA-001",
      "qty": "L * P / 144",
      "condition": "L > 0"
    },
    {
      "target": "$default:Facades et panneaux apparents",
      "qty": "L * H / 144",
      "condition": null
    }
  ]
}
```

| Champ | Type | Role |
|-------|------|------|
| `target` | String | Code article (`GRA-001`) ou reference dynamique (`$default:NomGroupe`). **Obligatoire.** |
| `qty` | String/Number | Quantite ou formule. Par defaut `1`. |
| `condition` | String/null | Formule booleenne. Si presente, la cascade ne s'execute que si la condition est vraie. |

### Le target dynamique `$default:`

La syntaxe `$default:NomDuGroupe` permet de referencer le materiau par defaut de la soumission pour un groupe donne.

**Resolution** :
```javascript
function resolveCascadeTarget(target) {
    if (!target.startsWith('$default:')) return target;
    var groupName = target.substring(9);  // "Facades et panneaux apparents"
    var dm = getDefaultMaterials();        // depuis currentSubmission.default_materials
    for (var i = 0; i < dm.length; i++) {
        if (dm[i].type === groupName && dm[i].catalogue_item_id) {
            return dm[i].catalogue_item_id;   // retourne "FAC-012"
        }
    }
    return null;  // pas de defaut defini -> cascade ignoree
}
```

**Exemple concret** : Un article "Caisson base" a la cascade `$default:Facades et panneaux apparents`. Si le materiau par defaut pour les facades est "Placage chene blanc FC" (code FAC-012), la cascade ajoute FAC-012 avec la quantite calculee.

**Quand le defaut change** : La fonction `reprocessDefaultCascades(changedGroup)` scanne toutes les lignes du calculateur, trouve celles dont les cascades utilisent `$default:{changedGroup}`, et re-execute les cascades. Les anciens enfants sont supprimes et remplaces.

### Execution dans le calculateur

La fonction `executeCascade(parentRowId, depth)` :

1. Lit les regles `cascade` de l'article selectionne
2. Pour chaque regle :
   - Resout le target (`$default:` ou code direct)
   - Evalue la condition (si presente)
   - Evalue la quantite (formule avec L/H/P/QTY)
   - Si l'enfant existe deja, met a jour la quantite
   - Sinon, cree une nouvelle ligne enfant
3. Supprime les enfants orphelins (regles qui n'existent plus)
4. Recursion jusqu'a profondeur 3

Les lignes enfants ont la classe CSS `.cascade-child` (bordure verte gauche, fond leger).

### Formules disponibles

Les formules dans `qty` et `condition` supportent :

| Variable | Source |
|----------|--------|
| `L` | Longueur (dim-l) de la ligne parent |
| `H` | Hauteur (dim-h) de la ligne parent |
| `P` | Profondeur (dim-p) de la ligne parent |
| `QTY` | Quantite de la ligne parent |

| Fonction | Equivalent |
|----------|------------|
| `ceil(x)` | `Math.ceil(x)` |
| `floor(x)` | `Math.floor(x)` |
| `round(x)` | `Math.round(x)` |
| `min(a, b)` | `Math.min(a, b)` |
| `max(a, b)` | `Math.max(a, b)` |

**Securite** : `evalFormula()` valide que l'expression ne contient que des chiffres, operateurs arithmetiques, et les fonctions autorisees. Tout autre caractere est rejete.

### Difference cascade vs contrainte

| Aspect | Cascade | Contrainte |
|--------|---------|------------|
| **Gestion** | Automatique (creation/mise a jour/suppression) | One-shot (creation a la selection) |
| **Enfants** | Marques `.cascade-child`, lies au parent | Marques `.constraint-added`, independants |
| **Quantite** | Recalculee quand les dimensions changent | Fixe ou calculee une seule fois |
| **Suppression** | Auto-supprimes si parent retire | Restent si parent retire |
| **Recursion** | Oui (profondeur max 3) | Non |
| **Interaction** | Transparente, pas de confirmation | Peut demander confirmation (modal) |

---

## D. Systeme de contraintes

### Vue d'ensemble

Les contraintes sont des regles declenchees **une seule fois** quand un article est selectionne pour la premiere fois. Elles servent a ajouter des articles complementaires ou a valider la compatibilite des materiaux.

La fonction `processConstraints(rowId)` est appelee depuis `updateRow()` a chaque selection d'article. Elle ne s'execute qu'une fois par article (tracking via `row.dataset.constraintsProcessed`).

### Type 1 : `auto_add`

Ajoute un article avec quantite fixe.

```json
{
  "type": "auto_add",
  "item_id": "PAT-001",
  "quantity": 4,
  "message": "Pattes de caisson ajoutees automatiquement"
}
```

| Champ | Type | Role |
|-------|------|------|
| `item_id` | String | Code de l'article a ajouter. **Obligatoire.** |
| `quantity` | Number | Quantite fixe. Par defaut `1`. |
| `message` | String | Message toast affiche. Par defaut "Article ajoute automatiquement". |

**Comportement** :
1. Verifie que l'article n'existe pas deja dans la piece (`getRoomCatalogueIds`)
2. Si doublon, affiche un toast "deja present" et s'arrete
3. Cree une nouvelle ligne avec `addRow(groupId, { skipFocus: true })`
4. Attend que `itemMap[newRowId]` soit peuple (max 4 secondes)
5. Selectionne l'article, fixe la quantite, herite le tag du parent
6. Ajoute la classe `.constraint-added` (bordure bleue gauche)
7. Affiche le toast

### Type 2 : `auto_add_calculated`

Comme `auto_add` mais avec quantite calculee par formule.

```json
{
  "type": "auto_add_calculated",
  "item_id": "EDG-001",
  "quantity_formula": "(L + H) * 2",
  "unit": "lineaire",
  "message": "Edge bois calcule selon dimensions"
}
```

| Champ | Type | Role |
|-------|------|------|
| `item_id` | String | Code de l'article a ajouter. **Obligatoire.** |
| `quantity_formula` | String | Formule avec variables L/H/P/QTY. |
| `message` | String | Message toast. |

**Comportement** :
1. Meme logique anti-doublon que `auto_add`
2. Lit les dimensions L/H/P et la quantite QTY de la ligne parent
3. Si dimensions disponibles, evalue la formule via `evalFormula()`
4. Si dimensions absentes ou formule = 0, ajoute l'article avec quantite 0 + avertissement ⚠ "Quantite a ajuster selon les dimensions (formule : ...)"
5. L'estimateur doit entrer les dimensions, puis ajuster manuellement la quantite

### Type 3 : `requires_swap`

Verifie la compatibilite d'un article avec ceux de la piece et propose un remplacement.

```json
{
  "type": "requires_swap",
  "target_group": "Facades et panneaux apparents",
  "current_must_match": "replaq",
  "search_in": "description",
  "warning": "Cette poignee necessite des panneaux a replaquer",
  "swap_logic": "same_client_text_with_match"
}
```

| Champ | Type | Role |
|-------|------|------|
| `target_group` | String | Groupe de materiau a verifier (via `category_group_mapping`). |
| `current_must_match` | String | Sous-chaine que l'article cible **doit** contenir. |
| `search_in` | String | Champ a chercher : `description` (defaut) ou `client_text`. |
| `warning` | String | Message affiche dans la modale. |
| `swap_logic` | String | Logique de remplacement. Seul `same_client_text_with_match` est implemente. |

**Comportement** :
1. Trouve les articles du `target_group` dans la piece via `findRoomItemsByGroup()`
2. Si aucun article de ce groupe, ne fait rien
3. Verifie si chaque article contient `current_must_match` dans le champ specifie
4. Si tous correspondent, ne fait rien
5. Pour chaque article non-compatible :
   - Cherche un remplacement dans le catalogue avec `same_client_text_with_match` :
     meme `client_text` + `current_must_match` present dans la description
   - Affiche une modale avec "Remplacer par [nom]" et "Garder quand meme"
   - Si remplacement accepte : swap l'article, reset les contraintes, toast
   - Si garde : ajoute ⚠ orange avec tooltip sur la ligne

**Exemple concret** : L'estimateur ajoute une poignee qui necessite du "replaque". Le systeme cherche les facades de la piece, detecte qu'elles sont en melamine (pas "replaq"), trouve la version replaquee du meme article (meme `client_text`, description avec "replaq"), et propose le swap.

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
    },
    {
      "if_description_contains": "bois",
      "restrict_to": "clair|teinture",
      "message": "Panneau bois - finition claire ou teinture"
    }
  ]
}
```

| Champ | Type | Role |
|-------|------|------|
| `target_group` | String | Groupe de materiau a verifier. |
| `conditions` | Array | Liste de conditions mutuellement exclusives. |
| `conditions[].if_description_contains` | String | Sous-chaine dans la description de l'article **source** (celui qu'on ajoute). |
| `conditions[].restrict_to` | String | Patterns acceptables dans le groupe cible, separes par `\|`. |
| `conditions[].message` | String | Message de la modale. |

**Comportement** :
1. Determine quelle condition correspond a l'article source (premiere correspondance)
2. Si aucune condition ne correspond, ne fait rien
3. Cherche les articles du `target_group` dans la piece
4. Verifie si chacun contient au moins un des patterns de `restrict_to`
5. Pour chaque incompatible :
   - Cherche un remplacement compatible (meme `client_text` + pattern compatible)
   - Affiche modale "Remplacer" / "Garder quand meme"
   - Meme logique de swap/warning que `requires_swap`

### Elements visuels des contraintes

| Element | Classe CSS | Apparence |
|---------|-----------|-----------|
| Ligne ajoutee par contrainte | `.constraint-added` | Bordure bleue gauche 2px, fond bleu tres leger |
| Ligne enfant cascade | `.cascade-child` | Bordure verte gauche 2px, fond vert tres leger |
| Avertissement | `.constraint-warn` | ⚠ orange avec tooltip au hover |
| Toast | `.constraint-toast` | Bandeau bas centre, fond navy, texte blanc, 3 secondes |
| Modale confirmation | `.constraint-modal` | Overlay sombre, boite blanche 460px, boutons primaire/secondaire |

---

## E. Categories et groupes

### Categories de depense (`expense_categories`)

Les categories de depense servent au calcul du prix compose (cote materiaux). Chacune a un markup et un waste.

Structure dans `app_config` :
```json
[
  { "name": "Quincaillerie", "markup": 30, "waste": 0 },
  { "name": "Peinture", "markup": 25, "waste": 10 },
  { "name": "Bois franc", "markup": 35, "waste": 15 },
  { "name": "Melamine", "markup": 30, "waste": 5 }
]
```

### Groupes de materiaux (`material_groups`)

Les groupes definissent les sections de materiaux par defaut dans une soumission.

Defauts hardcodes (surcharges par `app_config`) :
```json
["Caisson", "Facades et panneaux apparents", "Tiroirs", "Poignees", "Eclairage", "Autre"]
```

### Mapping categories -> groupes (`category_group_mapping`)

Ce mapping lie les categories du catalogue aux groupes de soumission. Il determine :
1. Quels articles apparaissent dans quel dropdown de materiau par defaut
2. Quels articles sont trouves par `findRoomItemsByGroup()` pour les contraintes

Structure dans `app_config` :
```json
{
  "Poignees": ["Poignees"],
  "Tiroirs": ["Tiroirs"],
  "Carcasses": ["Caisson"],
  "Facades": ["Facades et panneaux apparents"],
  "Eclairage LED": ["Eclairage"]
}
```

**Lecture** : La cle est le nom de la **categorie catalogue**. La valeur est un tableau de **groupes soumission** auxquels cette categorie est associee.

**Inversion** (pour trouver les categories d'un groupe) :
```javascript
function getAllowedCategoriesForGroup(groupName) {
    var allowed = [];
    Object.keys(categoryGroupMapping).forEach(function(cat) {
        if (categoryGroupMapping[cat].indexOf(groupName) !== -1) {
            allowed.push(cat);
        }
    });
    return allowed.length > 0 ? allowed : null;
}
```

### Impact sur le dropdown des materiaux par defaut

Dans le calculateur, chaque groupe de materiau a un dropdown. Ce dropdown est peuple uniquement avec les articles dont la categorie est mappee a ce groupe.

Exemple : le dropdown "Caisson" ne montre que les articles de la categorie "Carcasses" (car `"Carcasses": ["Caisson"]`).

### Pastille orange des categories non mappees

Dans `admin.html`, un indicateur orange s'affiche a cote de "category_group_mapping" si des categories du catalogue n'apparaissent dans aucun groupe. Cela signifie que ces articles ne seront jamais proposes comme materiau par defaut et ne seront pas detectes par les contraintes `requires_swap` / `requires_choice`.

---

## F. Materiaux par defaut

### Fonctionnement au niveau de la soumission

Chaque soumission peut definir des materiaux par defaut pour chaque groupe. Stockes dans `submissions.default_materials` :

```json
[
  { "type": "Caisson", "catalogue_item_id": "CAI-001", "description": "Melamine blanche" },
  { "type": "Facades et panneaux apparents", "catalogue_item_id": "FAC-012", "description": "Placage chene blanc FC" },
  { "type": "Poignees", "catalogue_item_id": "POI-005", "description": "Barre inox 128mm" }
]
```

### Utilisation dans les cascades

Quand une regle cascade a `target: "$default:Facades et panneaux apparents"`, le systeme :
1. Cherche dans `default_materials` l'entree de type `"Facades et panneaux apparents"`
2. Retourne son `catalogue_item_id` (ex: `FAC-012`)
3. Utilise cet article comme cible de la cascade

Si aucun materiau par defaut n'est defini pour ce groupe, la cascade est **ignoree silencieusement** (affiche un toast "Aucun materiau par defaut pour : NomGroupe").

### Priorisation dans les combobox

Quand l'estimateur ouvre le combobox d'un champ article dans le calculateur, les articles correspondant aux materiaux par defaut sont affiches **en premier**, dans une section distincte intitulee "Materiaux par defaut" (texte bleu).

Les autres articles suivent, groupes par categorie.

### Quand un defaut change

La fonction `reprocessDefaultCascades(changedGroup)` :
1. Scanne toutes les lignes du calculateur
2. Trouve celles dont les cascades utilisent `$default:{changedGroup}`
3. Re-execute les cascades : supprime les anciens enfants, cree les nouveaux

---

## G. Texte client et presentation

### Le champ `client_text`

**Role** : Nom court visible au client dans la soumission. C'est ce que le client voit dans son document de presentation.

**Format attendu** : Texte bref et descriptif, ex: "Placage de chene blanc FC", "Tiroir tandem box 500mm".

**Pas une description complete** : le `client_text` est un **fragment** qui apparait dans des listes ou des enonces. Pas de phrase complete avec sujet-verbe-complement.

**Le champ `client_text_en`** : version anglaise, generee ou saisie manuellement.

### Le champ `presentation_rule`

**Role** : Instructions structurees (JSON) pour assembler la description client d'une piece dans la soumission.

**Forme humaine** (`presentation_rule_human`) : description en langage naturel de comment presenter l'article.

**Forme AI** (`presentation_rule`) : JSON structure.

Structure typique :
```json
{
  "sections": ["Caisson", "Facades", "Tiroirs", "Poignees", "Details"],
  "order": ["material_first", "dimensions_after"],
  "prefix": "Inclut :"
}
```

### Comment l'AI utilise ces champs

L'AI du calculateur (`ai-assistant` Edge Function) utilise `client_text` et `presentation_rule` pour generer la description HTML d'une piece/meuble. Le texte client de chaque article dans la piece est assemble selon les regles de presentation, avec des sections et un ordre definis.

Dans la sandbox, la fonction `sbBuildDescription()` assemble aussi les textes :
1. En-tetes de materiaux par defaut (ex: "CAISSON : Melamine blanche")
2. Section "DETAILS" avec les `client_text` des articles de la piece (dedupliques)

---

## H. Approbation et permissions

### Permissions pertinentes

| Permission | Cle | Role |
|------------|-----|------|
| Acces catalogue | `catalogue` | Voir le catalogue (lecture seule). |
| Edition catalogue | `catalogue_edit` | Modifier les articles. |
| Edition minutes | `edit_minutes` | Modifier les minutes de main-d'oeuvre. |
| Edition materiaux | `edit_materials` | Modifier les couts materiaux. |
| Approbation articles | `can_approve_quotes` | Approuver les articles `pending`. |
| Admin | `admin` | Acces complet. |

Ces permissions sont definies par role dans `app_config.permissions`, puis chaque utilisateur est associe a un role via `app_config.user_roles`.

### Workflow d'approbation

**Utilisateur avec `catalogue_edit`** : cree un article → `status = null` ou `status = 'approved'` (directement utilisable).

**Utilisateur sans `catalogue_edit` mais avec acces catalogue** : propose un article → `status = 'pending'`, `proposed_by = email`. L'article est visible uniquement par son auteur et les admins.

**Approbateur** (`can_approve_quotes`) : voit les articles pending, peut les approuver ou les rejeter.

### Impact du statut

| Statut | Visible dans catalogue | Visible dans calculateur | Modifiable |
|--------|----------------------|-------------------------|------------|
| `null` (legacy) | Oui | Oui | Oui (si permission) |
| `approved` | Oui | Oui | Oui (si permission) |
| `pending` | Auteur + admins seulement | Non | Auteur + admins |
| `rejected` | Non | Non | Non |

### Articles pending dans le calculateur

Le filtre de chargement dans le calculateur :
```
status = 'approved' OR status IS NULL
OR (status = 'pending' AND proposed_by = current_user)
```

Les articles pending sont visibles mais **grisés** dans le combobox (pas selectionnable pour une soumission officielle).

---

## I. Audit et validation

### Validations a la sauvegarde

Quand l'utilisateur clique "Enregistrer" dans la modale d'edition, `runSaveValidation()` execute :

1. **Pas de prix** : ni prix fixe ni prix compose → erreur (bloque la sauvegarde)
2. **Pas de client_text** : avertissement informatif
3. **Texte client quasi-doublon** : Levenshtein 1-3 avec un autre article de la meme categorie → avertissement "Variante possible (apostrophe, espace, coquille)"

Les avertissements sont non-bloquants : l'utilisateur peut re-cliquer "Enregistrer" pour sauvegarder quand meme.

### Le bouton "Auditer"

Le bouton "Auditer" dans la barre d'outils ouvre un tiroir lateral droit (`#auditDrawer`) avec une analyse complete du catalogue.

### Checks de l'audit complet

`runFullAudit()` execute ces verifications sur **tous** les articles approuves :

| # | Check | Severite | Description |
|---|-------|----------|-------------|
| 1 | Variantes texte client | WARNING | Detecte les articles avec `client_text` presque identiques (Levenshtein 1-3) dans la meme categorie. Utilise une logique d'outlier : dans un groupe d'articles similaires, identifie le texte **minoritaire** comme variante suspecte. Les doublons exacts sont normaux et ne sont pas signales. |
| 2 | Client text manquant | INFO | Articles sans `client_text`. |
| 3 | Pas de prix | CRITICAL | Articles sans prix fixe ni prix compose. |
| 4 | Categorie non classee | WARNING | Articles avec categorie vide ou "Non classe". |
| 5 | Incoherences orthographiques | WARNING | Descriptions similaires (Levenshtein 1-3) dans la meme categorie. |
| 6 | Articles jamais utilises | INFO | Articles avec `usage_count = 0` (jamais inseres dans une soumission). |
| 7 | Articles dormants | INFO | Articles non utilises depuis 60+ jours. |

### Navigation dans les resultats

Les resultats d'audit sont groupes par severite (critical > warning > info), puis par type de check. Chaque section est cliquable pour expand/collapse.

Chaque article dans les resultats est cliquable → ouvre `openEditModal(itemId)` avec une navigation **scopee** au groupe d'audit (fleches prev/next limitees aux articles du meme finding).

---

## J. AI dans le catalogue

### Boutons AI dans la modale d'edition

La modale d'edition contient 4 boutons AI, chacun appelle l'Edge Function `translate` avec une action differente :

#### 1. Texte client (bouton a cote de `client_text`)

- **Action** : `catalogue_client_text`
- **Modele** : Haiku 4.5 (rapide)
- **Input** : Contexte article + textes similaires de la meme categorie
- **Output** : `{ status, text, warnings }`
- **Comportement** : Genere ou ameliore le `client_text` en respectant le style des articles existants

#### 2. Regle de presentation (bouton a cote de `presentation_rule`)

- **Action** : `catalogue_pres_rule`
- **Modele** : Sonnet 4 (precis)
- **Input** : Contexte article + `presentation_rule_human` + sections connues + exemples similaires
- **Output** : `{ status, explication, json: { sections, order, prefix }, warnings }`
- **Comportement** : Convertit le texte humain en JSON structure. Met a jour les deux champs (humain et AI).

#### 3. Regle de calcul (bouton a cote de `calculation_rule_ai`)

- **Action** : `catalogue_calc_rule`
- **Modele** : Sonnet 4 (precis)
- **Input** : Contexte article + `calculation_rule_human` + tous les codes existants + categories materiaux + exemples similaires
- **Output** : `{ status, explication, json: { cascade, constraints, ask }, warnings }`
- **Comportement** : Convertit la regle humaine en JSON avec cascades et contraintes. Valide la syntaxe.

#### 4. Import composantes (bouton dans la section fournisseur)

- **Action** : `import_components`
- **Modele** : Sonnet 4 (vision)
- **Input** : Texte + images (screenshots de prix, factures), categories de depense, fournisseurs connus
- **Output** : `{ status, components: [{supplier_name, supplier_sku, description, expense_category, qty_per_unit, unit_cost}], warnings }`
- **Comportement** : Extrait les composantes d'images/texte via OCR AI. Affiche un recapitulatif editable avant application.

### Parsing des reponses AI

La fonction `parseAiEnvelope(rawText, fallbackField)` gere les reponses :
- JSON valide avec `status` → utilise tel quel
- JSON sans `status` → enveloppe avec `status: 'ok'`
- Texte + JSON melange → extrait le JSON par accolades equilibrees
- Texte pur → enveloppe dans `{ [fallbackField]: text }`

La fonction `fixEnvelopeJsonSplit(envelope, jsonKeys)` gere le cas ou l'AI met le JSON dans le champ `explication` au lieu de `json` :
1. Cherche des blocs ` ```json {...} ``` ` dans l'explication
2. Cherche des accolades equilibrees contenant les cles attendues
3. Separe le texte du JSON

### Assistant catalogue (import drawer)

Le tiroir "AI Assistant" (bouton en haut a droite) ouvre un chat conversationnel pour :
- Importer des articles depuis du texte ou des screenshots
- Creer, modifier, supprimer des articles par conversation
- Rechercher et filtrer le catalogue
- Analyser l'utilisation des articles
- Auditer les noms clients

**Edge Function** : `catalogue-import` (streaming SSE)
**Modele** : Claude Sonnet 4.5
**7 outils** :

| Outil | Auto-execute | Confirmation |
|-------|:----------:|:----------:|
| `search_catalogue` | Oui | — |
| `filter_catalogue` | Oui | — |
| `check_usage` | Oui | — |
| `audit_client_names` | Oui | — |
| `create_catalogue_item` | — | Oui |
| `update_catalogue_item` | — | Oui |
| `delete_catalogue_item` | — | Oui |

Les outils en lecture seule s'executent automatiquement (max 5 boucles). Les outils d'ecriture affichent un recap et demandent confirmation a l'utilisateur.

### Instructions AI par article (`ai_instructions`)

Le champ `instruction` dans `catalogue_items` sert d'instructions pour l'estimateur mais aussi de contexte pour l'AI quand elle genere des regles. Il decrit comment mesurer ou calculer l'article.

### Apprentissage organisationnel (`ai_learnings`)

La table `ai_learnings` stocke des regles apprises au fil du temps. Elles sont injectees dans les prompts systeme de l'Edge Function `translate` :

```
Regles apprises de cette organisation (a respecter) :
1. Toujours utiliser "chene blanc FC" et non "white oak"
2. Les tiroirs tandem box sont par defaut 500mm
...
```

L'outil `save_learning` dans l'assistant calculateur permet d'ajouter de nouvelles regles.

---

## K. Sandbox editeur de regles

### Ce que c'est

La sandbox est un panneau de previsualisation en temps reel qui s'affiche a cote de la modale d'edition quand l'administrateur l'active. Elle simule le comportement des cascades et contraintes sans affecter les vraies soumissions.

### A quoi ca sert

1. **Tester les regles de calcul** : voir quels articles se cascadent, avec quelles quantites
2. **Tester les materiaux par defaut** : voir comment `$default:` se resout
3. **Tester les formules** : entrer des dimensions L/H/P et voir les quantites calculees
4. **Previsualiser les descriptions** : voir comment le texte client s'assemble
5. **Editer en temps reel** : chaque modification dans la modale (prix, regles, client_text) se reflete instantanement dans la sandbox

### Comment l'utiliser

1. Ouvrir un article dans la modale d'edition
2. Cliquer le bouton "Sandbox" (visible uniquement pour les admins)
3. La modale se divise en deux : formulaire a gauche, sandbox a droite
4. La sandbox montre :
   - **Materiaux par defaut** : dropdowns pour chaque groupe (Caisson, Facades, Poignees)
   - **Description** : previsualisation du texte assemble
   - **Dimensions** : champs L/H/P (visibles selon `dims_config`)
   - **Lignes catalogue** : tableau avec article courant + enfants cascades
   - **Sous-total** : prix total calcule

### Ce qui est simule vs ce qui est reel

| Aspect | Simule | Reel |
|--------|--------|------|
| Cascades (`$default:`, formules, conditions) | Oui | Meme logique que le calculateur |
| Contraintes auto_add / auto_add_calculated | Oui | Ajoute des lignes dans la sandbox |
| Contraintes requires_swap / requires_choice | Partiellement | Affiche un avertissement texte (pas de modale interactive) |
| Prix compose | Oui | Meme calcul que le calculateur |
| Materiaux par defaut | Oui | Independants de la soumission (propres a la sandbox) |
| Sauvegarde en base | Non | Aucune ecriture Supabase |
| Lignes dans la soumission | Non | Les lignes sandbox n'existent que dans `sbRows[]` en memoire |

### Reactivite

La sandbox ecoute les changements dans la modale :
- `editClientText`, `editPrice`, `editDescription` → met a jour `sbItemOverrides`
- Inputs du prix compose (minutes, materiaux) → sync dans `sbItemOverrides.labor_minutes` / `material_costs`
- `editCalcRuleAi` (JSON) → reprocesse cascades + contraintes
- Checkboxes dimensions (`editDimL`, `editDimH`, `editDimP`) → met a jour la visibilite des champs

`sbGetItem(itemId)` retourne l'article du catalogue **fusionne** avec les overrides de la sandbox, permettant un apercu en temps reel.

### Variables globales sandbox

```javascript
var sbRows = [];              // Lignes de la sandbox
var sbRowCounter = 0;         // Compteur pour IDs uniques
var sbMaterials = {};         // Materiaux par defaut sandbox
var sbItemOverrides = {};     // Overrides temporaires depuis la modale
var sbActive = false;         // Sandbox activee ou non
var sbDims = { L: 0, H: 0, P: 0 };  // Dimensions de test
```

---

## L. Observations

Anomalies, incoherences ou points d'attention decouverts lors de l'analyse du code.

### Securite

1. **`evalFormula()` utilise `new Function()`** : Bien que la validation regex soit stricte, l'execution dynamique de code cote client reste un vecteur potentiel. Les formules proviennent du JSONB stocke en base, donc modifiables uniquement par les editeurs de catalogue.

2. **Pas de validation serveur des regles JSON** : les champs `calculation_rule_ai` et `presentation_rule` acceptent n'importe quel JSON valide. Il n'y a pas de schema validation cote Supabase.

### Coherence des donnees

3. **`price` et prix compose ne sont pas mutuellement exclusifs en base** : rien n'empeche un article d'avoir a la fois un `price` fixe et des `labor_minutes`. Le code cote client utilise `hasComposedPrice()` pour determiner quel affichage utiliser, mais le prix fixe pourrait etre desynchronise du prix compose.

4. **`supplier_name` et `supplier_sku` sont legacy** : ces colonnes sur `catalogue_items` sont remplacees par la table `catalogue_item_components`. Les deux systemes coexistent.

5. **`image_url` est legacy** : remplace par la table `item_media`. Le champ est toujours lu pour compatibilite.

### Fonctionnalites partielles

6. **`requires_swap` et `requires_choice` dans la sandbox** : ces types de contraintes affichent uniquement un avertissement texte dans la sandbox, sans la modale interactive du calculateur. C'est un choix delibere (la sandbox n'a pas le contexte multi-lignes interactif), mais ca peut surprendre lors des tests.

7. **Le filtrage futur du combobox par `requires_choice`** : le prompt mentionne "quand l'estimateur ajoutera un article plus tard, filtrer/prioriser les options compatibles dans le combobox". Cette fonctionnalite de **filtrage proactif** n'est pas implementee. Les restrictions ne se declenchent que si un article du groupe cible **existe deja** dans la piece.

### Performance

8. **`CATALOGUE_DATA` est charge en entier** : tous les articles approuves sont charges en memoire au demarrage. Pour un catalogue de plusieurs centaines d'articles, c'est correct. Pour plusieurs milliers, un chargement pagine pourrait etre necessaire.

9. **Cache localStorage** : le catalogue est mis en cache dans `localStorage` avec un timestamp. Le cache est invalide si les donnees ont plus d'une heure. Cela signifie qu'un article approuve peut prendre jusqu'a 1 heure pour apparaitre sur un poste client qui a deja visite la page.
