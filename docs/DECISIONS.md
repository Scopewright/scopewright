# Journal des décisions architecturales — Scopewright

> Chaque entrée documente une décision technique significative, son contexte, les alternatives rejetées et les conséquences.
>
> **Dernière mise à jour** : 2026-03-05

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

---

## DEC-011 — Quantités cascade : constante vs formule (rootQty)

**Date** : 2026-03-05

**Contexte** : `executeCascade` multipliait toujours la quantité enfant par `rootQty` (quantité du FAB parent). Pour les formules dimensionnelles (`L * H / 144`), ce résultat est déjà total (ex: 6 caissons de 24"×36" → formule évalue la surface d'un seul panneau × dimensions, pas × 6). Pour les constantes (`"2"` vis par caisson), la multiplication est correcte.

**Décision** : Détecter par regex `/\b(L|H|P|QTY|n_tablettes|n_partitions)\b/` si `rule.qty` contient des variables dimensionnelles. Si oui → le résultat est total, pas de multiplication par `rootQty`. Si non (constante pure) → multiplier par `rootQty`.

**Alternatives considérées** :
- **Toujours multiplier, ajuster les formules** : obligerait les auteurs de règles à diviser par QTY dans chaque formule dimensionnelle — contre-intuitif et fragile.
- **Champ explicite `multiply_by_qty: true/false`** sur chaque règle : plus explicite, mais casse toutes les règles existantes et ajoute de la complexité pour les auteurs.
- **Évaluer deux fois (avec et sans rootQty) et choisir le résultat cohérent** : heuristique fragile, impossible de deviner l'intention de l'auteur.

**Conséquences** :
- Les formules existantes (`L * H / 144`, `(L + H) * 2 / 12`) fonctionnent sans modification
- Les constantes existantes (`"2"`, `"4"`) continuent d'être multipliées par la quantité parent
- Si un auteur veut une constante totale (pas par unité), il peut utiliser `QTY * 0 + 8` (hack) — cas rare
- La regex couvre toutes les variables connues du moteur cascade

---

## DEC-012 — `$default:` propage materialCtx aux `$match:` frères

**Date** : 2026-03-05

**Contexte** : Un FAB avec `$default:Caisson` + `$match:BANDE DE CHANT` + `$match:FINITION BOIS`. Le `$default:` résout vers mélamine, mais les `$match:` frères scoraient dans le contexte chêne blanc (matériau pré-peuplé depuis le DM, pas depuis le résultat de la résolution).

**Décision** : Après chaque résolution `$default:` réussie, `resolveCascadeTarget` propage le `client_text` de l'article catalogue résolu dans `materialCtx.chosenClientText`. Trois points de sortie : cache hit, candidat unique, modale technique. Le `materialCtx` étant passé par référence dans la boucle des règles, les `$match:` suivantes voient le contexte mis à jour.

**Alternatives considérées** :
- **Séparer le contexte par type de résolution** (un `defaultCtx` + un `matchCtx`) : plus propre en théorie, mais le `materialCtx` sert déjà les deux et la mutation par référence est simple et lisible.
- **Stocker le résultat `$default:` dans un objet séparé** (`_lastDefaultResolution`) et le consulter dans `resolveMatchTarget` : ajoute un état global mutable supplémentaire, plus fragile que la propagation locale par référence.
- **Forcer l'ordre des règles** (`$default:` d'abord, `$match:` ensuite) via tri dans `executeCascade` : contraignant pour les auteurs de règles et ne résoudrait pas le cas multi-`$default:`.

**Conséquences** :
- Les `$match:` frères d'un `$default:` scorent dans le contexte du matériau effectivement résolu
- Un FAB mélamine obtient ses bandes de chant et finitions mélamine (pas chêne blanc)
- Le DM unique explicite reste prioritaire (si un seul DM "Finition" existe, `materialCtx` ne le surcharge pas)
- Le `materialCtx` peut être écrasé par chaque `$default:` successif — l'ordre des règles dans le JSON a un impact (dernière résolution gagne)

---

## DEC-013 — skipCascade pour le toggle installation

**Date** : 2026-03-05

**Contexte** : Cocher/décocher l'installation d'un meuble appelait `updateRow` → `scheduleCascade` → re-exécution cascade → duplication des enfants. L'installation est un flag de facturation, pas une variable dimensionnelle.

**Décision** : `updateRow(rowId, opts)` accepte `opts.skipCascade`. `toggleInstallation` (meuble) et `toggleRowInstallation` (ligne) passent `{ skipCascade: true }`. En plus, `propagateInstallationToCascadeChildren(parentRowId, checked)` propage récursivement le toggle aux enfants cascade.

**Alternatives considérées** :
- **Filtrer dans `scheduleCascade`** (ignorer si seul le flag installation a changé) : nécessite de comparer l'état avant/après, complexe et fragile (d'autres champs pourraient changer en même temps).
- **Ne pas appeler `updateRow` du tout** (modifier seulement la checkbox et sauver en DB) : rompt le flux normal de sauvegarde et obligerait à dupliquer la logique de `updateRow`.

**Conséquences** :
- Le toggle installation ne déclenche plus de cascade
- Les enfants cascade héritent automatiquement le toggle de leur parent FAB
- La propagation est récursive (3 niveaux) via `findCascadeChildren`
- Le paramètre `opts.skipCascade` est disponible pour d'autres cas futurs similaires

---

## DEC-014 — Anti-lignes vides (3 gardes)

**Date** : 2026-03-05

**Contexte** : Des lignes sans article catalogue persistaient en DB — créées par clic accidentel sur "+" puis clic ailleurs, ou par des bugs de chargement. Ces lignes fantômes polluaient les soumissions et faussaient les totaux.

**Décision** : 3 gardes complémentaires : (a) `debouncedSaveItem` skip si aucun article sélectionné, (b) `addRow` attache un listener `blur` one-shot → `removeRow` après 2s si toujours vide, (c) `openSubmission` filtre les items sans `catalogue_item_id` ni `item_type=custom` avant rendu.

**Alternatives considérées** :
- **Contrainte NOT NULL sur `catalogue_item_id` en DB** : empêcherait les articles personnalisés (`custom`) qui n'ont pas de `catalogue_item_id`.
- **Un seul garde au save** : insuffisant car les lignes fantômes apparaissent visuellement et créent de la confusion avant même le save.
- **Suppression automatique côté serveur** (cron/trigger) : latence, complexité, et les lignes polluent l'UI entre-temps.

**Conséquences** :
- Les clics accidentels sur "+" sont nettoyés en 2s si l'utilisateur ne sélectionne rien
- Les saves ne créent plus de lignes vides en DB
- Le chargement filtre les reliquats historiques — la DB n'est pas nettoyée rétroactivement mais l'UI est propre

---

## DEC-015 — Sanitisation tool_use/tool_result (défense en profondeur)

**Date** : 2026-03-05

**Contexte** : L'API Anthropic retourne erreur 400 si un message `tool_use` n'a pas de `tool_result` correspondant. Trois sources d'orphelins identifiées : dismiss sans injection, nouveau message utilisateur pendant pending tools, follow-up tool_use dans la réponse post-exécution.

**Décision** : `sanitizeConversationToolUse(messages)` est une défense en profondeur appliquée avant chaque appel API. Elle détecte les `tool_use` orphelins et injecte des `tool_result` synthétiques `{"skipped":true}`. En parallèle, les 3 sources amont sont corrigées individuellement.

**Alternatives considérées** :
- **Corriger uniquement les sources amont** : résout les cas connus, mais toute future modification du flow pourrait créer de nouveaux orphelins. La défense en profondeur est un filet de sécurité.
- **Vider l'historique conversation quand un orphelin est détecté** : perte de contexte, mauvaise UX.
- **Filtrer les messages tool_use orphelins** (au lieu d'injecter des tool_result) : viole le protocole API qui exige des paires.

**Conséquences** :
- Le sanitizer ajoute un overhead O(n) par appel API — négligeable pour des conversations de taille normale
- Les tool_result synthétiques `{"skipped":true}` sont visibles par l'AI dans le contexte — elle peut voir qu'un outil a été ignoré
- La correction amont reste importante pour éviter d'accumuler des entrées inutiles dans la conversation

---

## DEC-016 — Rate limit 429/529 auto-retry (1 seul retry, 15s)

**Date** : 2026-03-05

**Contexte** : Les erreurs 429 (rate limit) et 529 (overloaded) de l'API Anthropic étaient affichées brutes à l'utilisateur. L'erreur est transitoire — un retry après quelques secondes réussit généralement.

**Décision** : `callAiAssistant` intercepte les 429/529, affiche "Un instant, le serveur est occupé…", attend 15s, retire le message temporaire, et retry une seule fois. Si le retry échoue, message d'erreur propre (jamais le texte brut de l'API).

**Alternatives considérées** :
- **Retry exponentiel** (3+ tentatives) : les 429 Anthropic ont un `retry-after` de 60s+ — multiple retries bloqueraient l'UI trop longtemps. Un seul retry avec 15s est un bon compromis.
- **Retry côté serveur** (Edge Function) : plus propre architecturalement, mais allonge le timeout Edge Function et ne permet pas de feedback UI au client pendant l'attente.
- **Queue de messages** : overkill pour un scénario rare (< 1% des appels).

**Conséquences** :
- L'utilisateur voit un message temporaire au lieu d'un JSON brut d'erreur
- Maximum 15s de latence supplémentaire sur les 429/529
- Si le problème persiste après retry, l'utilisateur voit un message clair l'invitant à réessayer

---

## DEC-017 — Cascade debug logs (buffer circulaire + inclusion conditionnelle)

**Date** : 2026-03-05

**Contexte** : Le diagnostic des problèmes cascade nécessitait de reproduire le bug avec la console ouverte. Les logs étaient dans `console.log`, perdus au rechargement, et pas accessibles par l'AI.

**Décision** : `cascadeDebugLog` — buffer mémoire circulaire de 200 entrées capturant tous les `cascadeLog(level, msg, data)`. Deux fonctions de détection indépendantes : `detectCascadeDiagnostic(text)` (mots-clés cascade) inclut les 50 derniers logs dans le contexte AI, `detectCalculationContext(text)` (mots-clés calcul) inclut les `calculationRules`. Cible : ≤20K tokens normal, ≤30K diagnostic.

**Alternatives considérées** :
- **Toujours inclure les logs** : gonfle le contexte AI de ~3K tokens pour chaque message, même quand l'utilisateur parle de prix ou de descriptions.
- **Logs persistés en DB** : overhead réseau à chaque cascade, et la plupart des logs ne sont jamais consultés. Le buffer mémoire est suffisant pour le diagnostic en session.
- **Un seul switch "mode debug"** : oblige l'utilisateur à anticiper le problème et activer manuellement le mode.

**Conséquences** :
- Les logs sont disponibles sans action de l'utilisateur — il suffit de demander "pourquoi le panneau n'est pas généré?"
- Le buffer circulaire ne consomme pas de mémoire croissante
- Les détections sont indépendantes — on peut avoir les règles de calcul sans les logs cascade et vice-versa

---

## DEC-018 — Images annotées rasterisées pour l'AI

**Date** : 2026-03-05

**Contexte** : Les annotations (tags C1, F2, P3 sur les plans) étaient stockées en JSONB côté DB mais l'image envoyée à l'AI était l'image brute sans les tags. L'AI ne pouvait pas "voir" les annotations visuellement.

**Décision** : `rasterizeAnnotatedImage()` dessine l'image + les tags (rectangles navy + texte blanc) dans un canvas, upload le résultat en JPEG 0.92 dans `annotated/{mediaId}.jpg`, et stocke l'URL dans `room_media.annotated_url`. L'AI reçoit l'image annotée quand disponible, sinon l'image brute.

**Alternatives considérées** :
- **Envoyer les annotations en texte** (positions + labels) : l'AI ne peut pas associer visuellement un tag à une zone du plan — elle a besoin de voir le tag sur l'image.
- **Dessiner les annotations côté serveur** (Edge Function) : ajoute une dépendance canvas serveur (puppeteer/sharp), latence, et complexité de déploiement.
- **SVG overlay** : pas supporté par l'API vision Anthropic (image bitmap requise).

**Conséquences** :
- Chaque sauvegarde d'annotations génère un upload JPEG supplémentaire (~200-500KB)
- L'AI voit les tags exactement comme l'utilisateur les voit
- Les annotations textuelles (positions en coordonnées) sont aussi incluses dans `collectRoomDetail` pour redondance

---

## DEC-019 — Tool `update_catalogue_item` avec audit trail

**Date** : 2026-03-05

**Contexte** : L'AI assistant dans le calculateur pouvait proposer des modifications d'articles catalogue (prix, formules, matériaux), mais ne pouvait pas les appliquer. L'estimateur devait aller manuellement dans le catalogue.

**Décision** : Tool `update_catalogue_item` dans l'Edge Function `ai-assistant`. Whitelist stricte de champs modifiables (price, labor_minutes, material_costs, calculation_rule_ai, instruction, loss_override_pct). Permission `canEditCatalogue` requise. Snapshot avant/après dans `catalogue_change_log`. **Jamais auto-exécuté** — toujours boutons de confirmation "Appliquer / Ignorer".

**Alternatives considérées** :
- **Auto-exécution** (comme les autres outils) : trop risqué — une modification catalogue affecte toutes les soumissions futures. La confirmation obligatoire est un garde-fou nécessaire.
- **Redirection vers le catalogue** (ouvrir la modale d'édition) : interrompt le flow de l'estimateur qui travaille dans le calculateur.
- **Pas de tool, uniquement des suggestions texte** : l'estimateur doit copier-coller manuellement les valeurs, friction élevée, erreurs de saisie.

**Conséquences** :
- L'estimateur peut corriger un prix ou une formule sans quitter le calculateur
- Chaque modification est auditée dans `catalogue_change_log` (who, when, before, after)
- La confirmation obligatoire prévient les modifications accidentelles
- `CATALOGUE_DATA` en mémoire est mis à jour après application (pas de rechargement requis)

## DEC-020 — Override par ligne (prix, MO, matériaux) sans modifier le catalogue

**Date** : 2026-03-05

**Contexte** : Le prix de chaque ligne est calculé directement depuis le catalogue (`computeComposedPrice`). L'estimateur ne peut pas ajuster une ligne sans modifier l'article catalogue lui-même — ce qui affecte TOUTES les soumissions.

**Décision** : 3 colonnes JSONB/NUMERIC sur `room_items` (`labor_override`, `material_override`, `price_override`). Override local par soumission. `price_override` remplace entièrement le prix composé. `labor_override`/`material_override` fusionnent avec les valeurs catalogue via `Object.assign` puis recalculent. Mémoire JS : `_rowOverrides[rowId]`. UI : bouton ⚙ dans la cellule prix + popover. Indicateur visuel `.has-override`. Tool AI `update_submission_line` (jamais auto-exécuté).

**Alternatives considérées** :
- **Modifier `shared/pricing.js`** : ajouter un paramètre `overrides` à `computeComposedPrice`. Plus propre mais modifie la signature d'une fonction partagée (3 fichiers). Le pattern merged-item (Object.assign) est plus conservateur.
- **Colonne `unit_price_override` seule** : pas de décomposition MO/matériaux, rentabilité impossible à calculer avec overrides partiels.
- **Modal séparée** : trop lourd pour un ajustement rapide. Le popover inline est plus fluide.

**Conséquences** :
- L'estimateur peut ajuster une ligne en 3 clics sans quitter le calculateur
- La rentabilité reflète les overrides (MO + matériaux fusionnés, ou flat pour price override)
- `unit_price` en DB reflète le prix effectif (avec overrides) pour compatibilité `quote.html`
- Le changement d'article catalogue reset automatiquement les overrides
- Les cascade children n'ont pas de bouton override (ajustements post-cascade uniquement)

## DEC-021 — Barèmes automatiques (labor_modifiers) séparés des règles cascade

**Date** : 2026-03-06

**Contexte** : Les ajustements dimensionnels (ex: caisson > 36 po → +15 min machinage) étaient faits manuellement via le popover d'override. L'estimateur devait se rappeler les barèmes par cœur.

**Décision** : Système `labor_modifiers` séparé de `calculation_rule_ai`. Section dédiée dans la modale catalogue (admin only). Structure JSON avec `condition` (expression evalFormula) + `labor_factor`/`material_factor` (multiplicateurs). First-match (premier modificateur vrai gagne). Évalué inline dans `updateRow()` à chaque changement dims. 3 formats acceptés (objet par département, scalaire, clé vide). Popover 3 colonnes (Cat/Auto/Manuel). Hiérarchie per-département : manual > auto-factored > catalogue.

**Alternatives considérées** :
- **Intégrer dans `calculation_rule_ai`** : surchargerait les règles cascade avec des données de pricing. Mélange de responsabilités — les barèmes sont du pricing, les cascades sont de la composition.
- **Formules dans `labor_minutes` directement** : pas de séparation base/ajustement. Impossible de voir l'ajustement séparé de la base.
- **Barèmes cumulatifs** : plus complexe initialement. Ajouté ensuite via `"cumulative": true` (DEC-023) pour les cas où les axes sont indépendants.

**Conséquences** :
- L'estimateur voit automatiquement les ajustements sans intervention
- Les barèmes sont documentés sur chaque article (pas dans la tête des estimateurs)
- L'override manuel reste possible et gagne sur l'auto
- AI peut générer les barèmes depuis une description en langage naturel

## DEC-022 — Collapse enfants cascade (masqués par défaut)

**Date** : 2026-03-06

**Contexte** : 3 caissons génèrent 20+ lignes cascade, rendant le calculateur difficile à lire. L'estimateur ne s'intéresse aux composantes que ponctuellement.

**Décision** : Enfants masqués par défaut (`display: none`). Triangle ▶ sur le parent pour expand/collapse. Badge `(+N)` quand collapsé. Checkbox globale par pièce. État en mémoire uniquement (pas persisté en DB — reset au chargement). CSS `.show-all-cascade` sur le groupe pour la checkbox globale.

**Alternatives considérées** :
- **Persistance en DB** : ajoute de la complexité pour une préférence visuelle transitoire. Le reset au chargement est acceptable.
- **Collapse global** (une seule checkbox pour toute la soumission) : l'estimateur peut vouloir voir les composantes d'un meuble mais pas d'un autre.
- **Groupement visuel sans collapse** (indentation + bordure seulement) : l'état actuel avant ce fix — trop de lignes.

**Conséquences** :
- Le calculateur est visuellement propre par défaut (3 lignes au lieu de 20)
- Les calculs, saves, et propagation installation fonctionnent sur les enfants masqués
- L'estimateur peut inspecter les composantes à la demande

## DEC-023 — Mode cumulatif pour les barèmes

**Date** : 2026-03-06

**Contexte** : First-match couvre la majorité des cas (paliers de largeur). Mais certains articles ont des ajustements sur des axes indépendants (ex: largeur ET hauteur ET nombre de tablettes). Chaque axe devrait multiplier indépendamment.

**Décision** : `"cumulative": true` au niveau racine du JSON `labor_modifiers`. Tous les modificateurs dont la condition est vraie sont appliqués — les facteurs sont **multipliés** entre eux (pas additionnés). Le mode par défaut reste first-match pour la compatibilité.

**Conséquences** :
- Flexibilité accrue sans casser les barèmes existants
- Les facteurs indépendants se composent naturellement (1.25 × 1.10 = 1.375)

## DEC-024 — Cascade suppressed (mémoire de suppression)

**Date** : 2026-03-06

**Contexte** : L'utilisateur supprime un enfant cascade non pertinent (ex: bande de chant sur un meuble sans chant visible). La cascade le regénère à chaque changement de dimensions.

**Décision** : `cascadeSuppressed[parentRowId]` en mémoire + `room_items.cascade_suppressed` JSONB en DB. La cascade skip les targets supprimés. Reset quand l'article parent change. Bouton ⊘ pour restaurer.

**Conséquences** :
- L'estimateur contrôle la composition finale
- Pas de regénération indésirable
- Le reset au changement d'article est intuitif (nouveau meuble = nouvelles composantes)

## DEC-025 — Enfants cascade manuels (locked)

**Date** : 2026-03-06

**Contexte** : L'estimateur veut ajouter un composant sous un parent FAB qui n'est pas dans les règles cascade automatiques (ex: quincaillerie spéciale).

**Décision** : `addRow(groupId, { parentRowId })` crée un enfant `cascade-child` + `cascade-locked`. Persisté avec `parent_item_id` + `cascade_locked: true` en DB. Le moteur ne touche jamais les enfants locked.

**Conséquences** :
- Flexibilité pour les cas spéciaux sans modifier les règles catalogue
- Coexistence naturelle avec les enfants automatiques

## DEC-026 — Description AI en panneau proposition (pas d'écriture directe)

**Date** : 2026-03-08

**Contexte** : Le dot (•) AI sur les descriptions écrivait directement dans le champ, sans possibilité de prévisualiser ou sélectionner partiellement. L'estimateur devait annuler manuellement si le résultat ne convenait pas.

**Décision** : Panneau inline `.ai-desc-proposal` avec 3 boutons : Remplacer tout / Insérer la sélection (contextuel, apparaît uniquement quand du texte est sélectionné dans la proposition) / Ignorer.

**Alternatives considérées** :
- **Diff côte-à-côte** (avant/après) : trop lourd pour des descriptions courtes, complexité CSS disproportionnée.
- **Inline diff** (mots ajoutés/supprimés colorés) : la description est du HTML formaté, le diff serait illisible.

**Conséquences** :
- L'estimateur contrôle ce qui est appliqué
- Possibilité de sélectionner un fragment pertinent seulement
- Le champ n'est modifié qu'après action explicite

## DEC-027 — Extraction shared/presentation-client.js (#126)

**Date** : 2026-03-08

**Contexte** : `calculateur.html` à ~21 700 lignes dépasse largement le seuil de maintenabilité. Les fonctions de présentation client (descriptions, clauses, snapshot, status) forment un domaine cohérent et relativement autonome.

**Décision** : Extraction de 30 fonctions (~728 lignes) dans `shared/presentation-client.js`. Les fonctions accèdent aux globales calculateur via le scope lexical partagé entre `<script>` tags (pas de modules ES). Architecture Rule 6 ajoutée : toute nouvelle feature doit évaluer si elle peut vivre dans un fichier séparé.

**Conséquences** :
- ~670 lignes retirées de calculateur.html
- Le fichier partagé reste fortement couplé (30+ globales requises)
- Précédent établi pour les extractions futures (AI, cascade, pipeline)

## DEC-028 — Rentabilité : seuils tri-state indépendants

**Date** : 2026-03-08

**Contexte** : Le profit net et la marge brute ont des plages normales très différentes. Un seuil unique (ex: 38%) ne convient pas aux deux métriques.

**Décision** : Seuils séparés — Profit net : vert ≥15%, orange 8-14.9%, rouge <8%. Marge brute : vert ≥35%, orange 25-34.9%, rouge <25%. Bannière AI : seuil fixe marge brute < 35%.

**Conséquences** :
- Chaque métrique est évaluée dans son propre contexte
- L'estimateur voit immédiatement si une métrique est critique sans interpréter un seuil unique
