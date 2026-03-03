# Journal des décisions architecturales — Scopewright

> Chaque entrée documente une décision technique significative, son contexte, les alternatives rejetées et les conséquences.
>
> **Dernière mise à jour** : 2026-03-03

---

## DEC-001 — DM identifié par client_text au lieu de catalogue_item_id

**Date** : 2026-03-02

**Contexte** : Le système DM (matériaux par défaut) identifiait un matériau par son `catalogue_item_id` (ex: `ST-0012`). Problème : plusieurs articles techniques peuvent représenter le même matériau client (ex: "Placage chêne blanc" existe en 4mm, 6mm, 8mm — trois codes ST différents). Changer l'épaisseur obligeait à reconfigurer tous les DM de toutes les pièces.

**Décision** : `client_text` est l'identifiant primaire du DM. Le `catalogue_item_id` reste stocké comme représentant technique, mais la résolution cascade passe par `client_text` → filtre par catégorie autorisée → choix technique si multiples articles.

**Alternatives considérées** :
- **Garder `catalogue_item_id` comme clé** : simple, mais impose de reconfigurer chaque pièce quand l'article technique change. Fragile quand le catalogue évolue.
- **Créer une table intermédiaire `materials`** : propre en théorie, mais ajoute une couche d'indirection, des migrations, et complexifie le CRUD DM pour un gain marginal à ce stade.
- **Grouper par catégorie catalogue** : trop large — une catégorie comme "Panneaux" contient des matériaux très différents (mélamine, placage, contreplaqué).

**Conséquences** :
- Le dropdown DM déduplique par `client_text` (un seul "Placage chêne blanc" même si 3 articles techniques)
- La résolution cascade a 2 étapes : Modale 1 (choix matériau client) → Modale 2 (choix article technique)
- Migration legacy nécessaire au chargement (`openSubmission` dérive `client_text` depuis `catalogue_item_id` pour les anciens DM)
- Si deux matériaux différents ont le même `client_text` (ex: erreur de saisie), ils seront confondus → l'audit catalogue Check 11 détecte ce cas

---

## DEC-002 — Catégorie de dépense dynamique (hint + similarité par mots)

**Date** : 2026-03-03

**Contexte** : Les règles `$match:PANNEAU BOIS` filtraient les candidats par la clé littérale `material_costs["PANNEAU BOIS"]`. Problème : quand le DM est mélamine (article avec `material_costs["PANNEAU MÉLAMINE"]`), aucun candidat n'est trouvé car la clé ne matche pas littéralement.

**Décision** : La catégorie dans la règle `$match:` est un **hint**, pas un filtre littéral. `resolveMatchTarget` dérive les catégories effectives (`effectiveExpCats`) depuis les clés `material_costs` du DM choisi, en utilisant la similarité par mots (au moins un mot en commun). Ex: `"PANNEAU BOIS"` et `"PANNEAU MÉLAMINE"` partagent `"PANNEAU"` → les deux sont candidats.

**Alternatives considérées** :
- **Lister toutes les catégories équivalentes dans la règle** (`$match:PANNEAU BOIS|PANNEAU MÉLAMINE|...`) : verbeux, fragile quand on ajoute de nouvelles catégories de dépense, et impose de mettre à jour toutes les règles cascade existantes.
- **Mapper les catégories de dépense dans `app_config`** (ex: `"PANNEAU BOIS" → ["PANNEAU MÉLAMINE", "PANNEAU PLACAGE"]`) : ajout de config, maintenance manuelle, et risque d'oubli quand une nouvelle catégorie est créée.
- **Ignorer la catégorie et matcher uniquement par mots-clés** : trop de faux positifs — un article "quincaillerie" avec le mot "chêne" dans la description serait candidat.

**Conséquences** :
- Les règles AI sont génériques (`$match:PANNEAU BOIS`) et fonctionnent pour tous les matériaux de la famille "PANNEAU"
- L'ajout d'une nouvelle catégorie de dépense (ex: `"PANNEAU CONTREPLAQUÉ"`) fonctionne automatiquement sans modifier les règles existantes
- Risque de faux positifs si des catégories non liées partagent un mot (ex: `"BOIS BRUT"` et `"PANNEAU BOIS"` partagent `"BOIS"`) — atténué par le scoring Levenshtein sur les mots-clés du parent
- `findExistingChildForDynamicRule` utilise la même logique de similarité pour préserver les enfants existants au reload

---

## DEC-003 — materialCtx propagé localement vs cache global

**Date** : 2026-03-03

**Contexte** : Quand un parent FAB a plusieurs DM du même type (ex: 2 "Caisson" différents), la cascade doit choisir lequel utiliser pour les enfants et petits-enfants. Deux approches possibles : un cache global (`dmChoiceCache`) partagé entre toutes les cascades, ou un contexte local propagé dans l'arbre cascade.

**Décision** : `materialCtx` est un objet `{ chosenClientText }` passé comme 4e paramètre de `executeCascade`, copié (pas référence) à chaque niveau de récursion. Pré-peuplé depuis le DM de la catégorie du parent FAB racine.

**Alternatives considérées** :
- **Cache global uniquement (`dmChoiceCache`)** : déjà en place, mais ne distingue pas les contextes entre différents parents FAB. Si une pièce a un meuble placage et un meuble mélamine, le cache du premier influence le second.
- **Stocker le contexte sur le parent row DOM** (`dataset.materialCtx`) : persiste entre les cascades mais fragile aux reloads DOM et encombre l'élément HTML.
- **Résoudre à chaque niveau indépendamment** : fonctionnel mais génère des modales répétitives (l'utilisateur doit re-choisir le matériau à chaque profondeur).

**Conséquences** :
- Chaque arbre cascade a son propre contexte matériau, indépendant des autres parents
- `materialCtx` disambiguë seulement — il ne surcharge jamais un DM unique explicite
- Le changement manuel d'un enfant cascade met à jour `_pendingMaterialCtx[parentRowId]` et re-cascade avec le nouveau contexte
- Le contexte n'est pas persisté en DB — il est recalculé à chaque exécution de cascade

---

## DEC-004 — override_children géré par le FAB vs cascade automatique

**Date** : 2026-02-28

**Contexte** : Un FAB parent (ex: "Îlot de cuisine") peut avoir des règles cascade pour "BANDE DE CHANT" et "FINITION BOIS". Son enfant matériau (ex: "Panneau placage") a aussi des cascades pour les mêmes catégories. Sans intervention, les deux niveaux créeraient des doublons (2× bande de chant, 2× finition).

**Décision** : Le FAB parent déclare `override_children: ["BANDE DE CHANT", "FINITION BOIS"]` dans sa règle. Les descendants dont les règles `$match:` ciblent ces catégories les sautent. L'item qui déclare l'override traite toujours ses propres règles — seuls les descendants vérifient `parentOverrides`.

**Alternatives considérées** :
- **Déduplication automatique par catégorie** : détecter les doublons après résolution et supprimer les redondants. Complexe, imprévisible (lequel garder ?), et impossible de distinguer les doublons intentionnels des accidentels.
- **Override bidirectionnel** (enfant peut aussi overrider le parent) : trop complexe à raisonner, et l'arbre cascade est top-down par design.
- **Pas d'override — responsabilité de l'auteur des règles** : simple côté code, mais fragile — chaque nouvelle combinaison FAB/matériau doit être testée manuellement pour éviter les doublons.

**Conséquences** :
- L'auteur des règles catalogue doit explicitement déclarer les overrides
- Les overrides sont propagés via `mergedOverrides` à tous les descendants (pas seulement les enfants directs)
- Si un FAB enfant a aussi des cascades pour une catégorie overridée, elles sont silencieusement sautées (log console)

---

## DEC-005 — Save immédiat dans executeCascade vs debounce global

**Date** : 2026-03-03

**Contexte** : `debouncedSaveItem` utilise un timer global unique (500ms). Quand `executeCascade` crée 3+ enfants rapidement (< 500ms), chaque appel `updateRow` → `debouncedSaveItem` annule le timer précédent. Résultat : seul le dernier enfant a son `catalogue_item_id` persisté. Les autres redeviennent des lignes vides au rechargement.

**Décision** : `executeCascade` appelle `updateItem()` directement après chaque création ou modification d'enfant cascade (nouveau ou existant), sans passer par le debounce. Le debounce continue de fonctionner pour les modifications manuelles utilisateur.

**Alternatives considérées** :
- **Debounce par row (un timer par ligne)** : résoudrait le problème de base mais augmente la complexité (N timers actifs), et le debounce serait quand même inutile pour les cascades qui doivent persister immédiatement.
- **Batch insert/update en fin de cascade** : optimal en termes de requêtes réseau (1 requête au lieu de N), mais nécessite de collecter toutes les modifications, gérer les erreurs partielles, et rewrite significatif du flow.
- **Augmenter le délai debounce** : ne résout pas le problème fondamental — le timer est unique, pas per-row.

**Conséquences** :
- Chaque enfant cascade génère un PATCH HTTP immédiat (pas de batching)
- Un FAB avec 8 règles cascade génère ~16 requêtes (8 createItem + 8 updateItem)
- Le debounce global reste en place pour les modifications utilisateur
- Les flags `itemChanged`/`qtyChanged` sont capturés AVANT modification DOM pour éviter les faux négatifs

---

## DEC-006 — Guard dimensions : L/H/P > 0, n_tablettes/n_partitions acceptent 0

**Date** : 2026-03-03

**Contexte** : Le guard `ask` dans `executeCascade` bloque la cascade tant que les variables déclarées ne sont pas remplies. Initialement, toutes les variables étaient vérifiées avec `> 0`. Problème : un caisson avec 0 tablettes et 0 partitions est légitime, mais le guard le bloquait.

**Décision** : Séparer les seuils par type de variable. `L`/`H`/`P`/`QTY` doivent être `> 0` (dimensions physiques obligatoirement positives). `n_tablettes`/`n_partitions` doivent seulement être `!= null` (définis, 0 est une valeur valide).

**Alternatives considérées** :
- **Tout vérifier `!= null`** : permettrait L=0 ou H=0, ce qui n'a pas de sens physique et produirait des quantités cascade à 0 (ex: `L * H / 144 = 0`).
- **Vérifier `>= 0` pour tout** : même problème que ci-dessus pour les dimensions physiques.
- **Ne pas bloquer, laisser les formules gérer** : produirait des lignes cascade avec qty=0, visibles et confuses pour l'utilisateur.

**Conséquences** :
- Les caissons avec 0 tablettes/partitions déclenchent correctement leur cascade
- Les formules utilisant `n_tablettes` (ex: `n_tablettes + 1`) fonctionnent avec la valeur 0
- Le mapping des noms est explicite : `"N_TABLETTES"`, `"TABLETTES"` → même variable

---

## DEC-007 — Phase 1/Phase 2 séparation du refactor DM

**Date** : 2026-03-01 (Phase 1), 2026-03-02 (Phase 2)

**Contexte** : Le passage de `catalogue_item_id` à `client_text` comme identifiant DM primaire est un changement structurel qui touche la résolution cascade, les modales de choix, la migration legacy, et l'UI du dropdown. Faire tout en un seul commit est risqué.

**Décision** : Séparer en deux phases. Phase 1 : le dropdown DM déduplique par `client_text` et stocke le `client_text` sur l'entrée DM, mais la résolution cascade utilise encore `catalogue_item_id`. Phase 2 : la résolution cascade passe par `client_text` d'abord, avec 2 modales, migration legacy, et `getAllowedCategoriesForGroup`.

**Alternatives considérées** :
- **Big bang** (tout en un commit) : plus rapide à écrire, mais impossible à debugger si la cascade casse — on ne sait pas si c'est le dropdown, la résolution, la migration, ou les modales.
- **3+ phases** (plus granulaire) : overhead de planification et de tests intermédiaires pour un gain marginal en isolation.

**Conséquences** :
- Phase 1 a été validée en production avant Phase 2
- La structure DM `{ type, catalogue_item_id, client_text, description }` est le format final — pas de migration supplémentaire prévue
- Les anciens DM sans `client_text` sont migrés automatiquement au chargement

---

## DEC-008 — Pas de refactor prématuré (monolithe acceptable à MVP)

**Date** : 2026-02-10

**Contexte** : `calculateur.html` fait ~18 600 lignes avec ~470 fonctions dans un scope global. L'audit architectural (ARCH-01) le signale comme critique. Faut-il modulariser avant de continuer le développement ?

**Décision** : Non. Le monolithe est acceptable au stade MVP. Les règles d'architecture (seuil 2000 lignes JS, nouveau domaine = nouveau fichier, fonctions partagées dans `shared/`) préviennent l'aggravation. L'extraction se fera quand un nouveau système justifie son propre fichier, pas comme refactor rétroactif.

**Alternatives considérées** :
- **Modulariser maintenant** (ES modules, fichiers séparés par namespace) : plusieurs jours de travail sans nouvelle feature, risque de régressions sur un moteur cascade en évolution rapide, et pas de tests automatisés pour valider.
- **Framework JS** (React, Vue) : overkill pour une app interne avec < 10 utilisateurs, et imposerait une réécriture complète.

**Conséquences** :
- Le fichier continuera de grossir — les namespaces `window.*` (App, UI, Db, Cascade, etc.) aident à organiser
- Les fonctions partagées sont extraites dans `shared/` (auth, utils, pricing) — ~830 lignes de duplication supprimées
- `steleConfirm`/`steleAlert` reste dupliqué (signatures différentes par fichier) — extraction future planifiée
- Le seuil de 2000 lignes JS par fichier n'est pas encore atteint pour les fichiers secondaires

---

## DEC-009 — Prompt AI catalogue : hint générique ($match:PANNEAU BOIS) vs spécifique

**Date** : 2026-03-03

**Contexte** : Quand l'AI génère des règles cascade pour un article de fabrication, elle doit choisir le target pour les matériaux. Deux options : un code spécifique (`"ST-0012"`) ou un hint générique (`"$match:PANNEAU BOIS"`).

**Décision** : L'AI utilise `$match:CATÉGORIE_DÉPENSE` comme hint générique. La catégorie de dépense dans le hint correspond à la famille de matériau attendue (PANNEAU BOIS, BANDE DE CHANT, FINITION BOIS, etc.), et la résolution dynamique (DEC-002) se charge de trouver le bon article selon le DM configuré.

**Alternatives considérées** :
- **Code direct (`"ST-0012"`)** : simple mais lie l'article de fabrication à un matériau spécifique. Chaque combinaison FAB × matériau nécessiterait une règle différente.
- **`$default:GroupeDM`** : fonctionne bien quand le groupe DM est connu, mais certains matériaux (bande de chant, finition) n'ont pas de groupe DM dédié — ils sont dérivés du matériau principal.
- **`$match:` avec catégorie catalogue** au lieu de catégorie de dépense : les catégories catalogue sont trop larges (ex: "Panneaux" inclut mélamine + placage + contreplaqué).

**Conséquences** :
- Les prompts AI de génération de règles doivent inclure la liste des catégories de dépense valides
- L'ajout d'un nouveau type de matériau (ex: bambou) nécessite seulement d'ajouter la catégorie de dépense et les articles — les règles existantes fonctionnent via word-similarity
- Le hint dans la règle (`$match:PANNEAU BOIS`) sert de documentation pour l'humain qui lit la règle

---

## DEC-010 — Pas de blocage rétroactif DM requis sur pièces legacy

**Date** : 2026-03-01

**Contexte** : La validation DM obligatoires (`DM_REQUIRED_GROUPS`) bloque l'ajout d'articles si les groupes requis ne sont pas remplis. Problème : les pièces créées avant cette feature n'ont pas de DM configurés. Bloquer rétroactivement empêcherait toute modification de ces pièces.

**Décision** : Le blocage DM ne s'applique qu'aux **nouveaux ajouts** d'articles. Les exceptions explicites sont : chargement d'articles existants (legacy), cascades (créent des enfants automatiquement), et bulk load. Le bouton "+" est grisé (`.dm-blocked`) uniquement pour les nouvelles pièces sans DM complets.

**Alternatives considérées** :
- **Forcer la migration** : à l'ouverture de chaque pièce legacy, ouvrir le panneau DM et bloquer jusqu'à configuration. Interruptif et frustrant pour les estimateurs qui veulent juste consulter une ancienne soumission.
- **Migration automatique par défaut** : assigner des DM par défaut à toutes les pièces legacy. Risqué — le choix de matériaux par défaut n'est pas universel et pourrait fausser les soumissions existantes.
- **Pas de blocage du tout** : les pièces sans DM génèrent des cascades incomplètes et des toasts d'erreur à répétition.

**Conséquences** :
- Les anciennes pièces continuent de fonctionner sans DM — les cascades échouent gracieusement avec des toasts
- Les nouvelles pièces guident l'utilisateur vers la configuration DM avant d'ajouter des articles
- L'indicateur `.dm-needs-config` (flèche pulse) est visible sur les pièces legacy avec des articles mais sans DM
- `getMissingRequiredDm` vérifie `client_text || catalogue_item_id` pour supporter les deux formats
