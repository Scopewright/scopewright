# Guide utilisateur Scopewright

> Plateforme d'estimation pour ébénisterie sur mesure et cuisines haut de gamme.
> Ce guide couvre toutes les fonctionnalités de la version actuelle.

---

## PARTIE 1 — VUE D'ENSEMBLE

### Qu'est-ce que Scopewright

Scopewright remplace vos classeurs Excel, vos estimations papier et vos logiciels de soumission génériques (Proposify, PandaDoc) par une plateforme spécialisée pour l'ébénisterie sur mesure.

**Ce que Scopewright fait que les autres ne font pas :**

- **Expertise codifiée** — Les connaissances de vos meilleurs estimateurs sont capturées dans les règles de calcul du catalogue. Quand un junior ajoute un caisson, le système génère automatiquement les panneaux, la bande de chant et la finition avec les bonnes quantités.
- **Assistant AI intégré** — Un assistant spécialisé en estimation qui lit vos plans, comprend vos matériaux, propose des articles et génère des descriptions client. Il apprend les règles de votre atelier au fil du temps.
- **Catalogue structuré** — Chaque article a un prix composé (main-d'œuvre + matériaux), des règles de calcul automatiques et un texte de présentation client. Pas de copier-coller entre estimations.
- **Présentation premium** — Les soumissions sont des pages web professionnelles avec images, descriptions formatées et signature électronique. Le client accepte en un clic.

### Premiers pas

#### Connexion

Ouvrez Scopewright dans votre navigateur. Entrez votre adresse courriel et mot de passe. La session reste active environ 30 jours.

#### Le tableau de bord

Après connexion, vous arrivez sur le **tableau de bord** — une grille de 6 modules :

| Module | Description |
|--------|-------------|
| **Catalogue de prix** | Tous vos articles, prix et règles de calcul |
| **Projets** | Vos projets, soumissions et estimations |
| **Contacts** | Clients, architectes, entrepreneurs, fournisseurs |
| **Approbations** | Soumissions et articles en attente d'approbation |
| **Administration** | Permissions, taux horaires, configuration |
| **Assistant vente** | *(Bientôt disponible)* |

Chaque carte affiche des **alertes** quand une action est requise :
- **Approbations** : nombre de soumissions et articles en attente
- **Projets** : soumissions retournées, échéances proches (orange) ou dépassées (rouge)
- **Administration** : catégories catalogue non configurées

Les modules visibles dépendent de votre rôle (voir Partie 8 — Administration).

---

## PARTIE 2 — PROJETS ET SOUMISSIONS

### Créer un projet

1. Ouvrez le module **Projets**
2. Cliquez **+ Nouveau projet**
3. Entrez le **nom du client**
4. Cliquez **Créer un projet**

Le système génère automatiquement :
- Un **code projet** unique (ex: `PRJ-20260305-100042`)
- Un **nom de projet** composé du code + la ville (mis à jour automatiquement quand vous ajoutez la ville)
- Une **première soumission** en brouillon

#### Informations du projet

Cliquez sur le nom du projet ou le bouton d'information pour ouvrir la fiche complète :

- **Client** — Nom du client
- **Adresse, ville, code postal** — Adresse du projet
- **Pipeline commercial** — Statut (Prospect, Qualification, Soumission, Négociation, Gagné, Perdu), source, type (Résidentiel, Commercial, Collaboration), montant estimé, probabilité, responsable, priorité
- **Échéances** — Date de début/fin prévue, date limite interne (estimateur), date limite client (vendeur)

#### Vues du pipeline

La liste des projets offre 3 vues :

- **Cartes** — Vue par défaut, une carte par projet avec statut et montant
- **Table** — Vue tableur avec colonnes triables (★ Suivi, Priorité, Nom, Architecte, Montant, Prob%, Statut, Rabais, Responsable, Type)
- **Soumissions** — Vue centrée sur les soumissions de tous les projets

**Filtres disponibles** : recherche texte, ★ Suivis uniquement, statut, responsable, type de projet, soumissions archivées.

**★ Suivis** : cliquez l'étoile à gauche d'un projet pour le marquer comme suivi. Le filtre « Suivis » n'affiche que vos projets favoris.

### Plans architecturaux

#### Uploader un plan PDF

1. Ouvrez une soumission
2. Cliquez le bouton **Plans** dans la barre d'outils
3. Glissez un fichier PDF ou cliquez pour en sélectionner un
4. Le plan est uploadé avec un **numéro de version** automatique (v1, v2…)

#### Naviguer dans le viewer PDF

Le viewer intégré offre des contrôles complets :

- **◄ ►** — Navigation entre les pages
- **− +** — Zoom (de 25% à 300%)
- **↺** — Réinitialiser le zoom à 100%
- **FIT** — Ajuster automatiquement le zoom pour voir la page entière
- **↻** — Rotation 90°
- **📸 Capturer** — Capturer la page courante comme image pour la lier à un meuble
- **↗ Nouvelle fenêtre** — Ouvrir le plan dans une fenêtre séparée

Le zoom fonctionne aussi avec **Ctrl + molette** de la souris.

#### Capturer une page

Le bouton **📸 Capturer** vous permet de photographier une page du plan et de l'associer à un meuble spécifique. Vous choisissez le meuble de destination dans un menu déroulant, et l'image apparaît dans la section images de ce meuble.

### Créer une soumission

Chaque projet peut contenir **plusieurs soumissions** (ex: version initiale, version révisée, option B).

- La première soumission est créée automatiquement avec le projet
- Pour en ajouter : bouton **+ Nouvelle soumission** (vous donnez un titre)
- Pour dupliquer : menu ••• → **Dupliquer** (copie tout le contenu en brouillon)

Chaque soumission a un **numéro unique** (SOU-XXXXXXXX-XXXXXX) et un **statut** de workflow (voir Partie 7).

---

## PARTIE 3 — LE CALCULATEUR

Le calculateur est le cœur de Scopewright. C'est ici que vous construisez votre estimation meuble par meuble.

### Configurer la pièce

#### Ajouter un meuble

Cliquez **+ Ajouter un meuble** en bas du calculateur. Un nouveau meuble vide apparaît avec un champ pour son nom (ex: « Îlot cuisine », « Vanité salle de bain »).

#### Matériaux par défaut

**C'est l'étape la plus importante.** Avant d'ajouter des articles, configurez les matériaux par défaut de chaque meuble. Ces matériaux sont utilisés par le système pour générer automatiquement les bonnes composantes quand vous ajoutez un article de fabrication.

Cliquez sur **Matériaux par défaut** pour ouvrir le panneau. Les groupes obligatoires sont :

| Groupe | Ce que ça définit | Exemple |
|--------|------------------|---------|
| **Caisson** | Le matériau de base de la structure | Placage de chêne blanc, Mélamine blanche |
| **Façades** | Portes et faces de tiroirs | Placage de noyer, Laque polyuréthane |
| **Panneaux** | Panneaux décoratifs et de côté | Placage de chêne blanc |
| **Tiroirs** | Type de tiroirs et quincaillerie | Tiroir Blum tandembox |
| **Finition** | Traitement de surface | Laque polyuréthane, Vernis |
| **Poignées** | Type de poignées | Poignée tubulaire inox |

Pour chaque groupe :
1. Cliquez **+ Ajouter**
2. Recherchez le matériau dans le catalogue
3. Sélectionnez-le — le système retient le choix

**Copier de…** : si plusieurs meubles utilisent les mêmes matériaux, cliquez « Copier de… » pour copier la configuration d'un autre meuble.

**Indicateur visuel** : une flèche ← animée apparaît à côté de « Matériaux par défaut » si les groupes obligatoires ne sont pas tous configurés. Le bouton **+** pour ajouter des articles est grisé tant que les matériaux ne sont pas complets.

### Plans et annotations

#### Ajouter des images au meuble

Glissez-déposez des images dans la zone d'images du meuble, ou cliquez pour en sélectionner. Les images apparaissent dans une grille sous le nom du meuble. Chaque image peut recevoir des **tags** (types) :

- **Présentation soumission** — Apparaît dans la soumission envoyée au client
- **Référence AI** — Visible par l'assistant AI quand il analyse le meuble
- **Catalogue** — Image de catalogue
- **Dessin** — Dessin technique

#### Annoter les plans

Cliquez sur une image pour l'ouvrir en mode annotation. Vous pouvez placer des **tags** directement sur l'image :

- Cliquez **+** pour ajouter un tag
- Positionnez le tag sur le plan (ex: sur un caisson, une façade, un comptoir)
- Donnez-lui un identifiant (ex: C1, F1, P1, T1)
- Le tag apparaît comme un rectangle avec son code

Les tags sont **rasterisés** sur l'image — quand l'assistant AI regarde le plan, il voit les tags directement sur l'image et peut s'y référer (« Fais-moi le C1 »).

### Ajouter des articles

Cliquez **+ Ajouter un article** en bas d'un meuble. Un menu de recherche s'ouvre avec les articles du catalogue, organisés en deux sections :

1. **FABRICATION** — Articles de fabrication (caissons, comptoirs, panneaux sur mesure). Les articles **★ par défaut** apparaissent en premier.
2. **MATÉRIAUX** — Matériaux et composantes (quincaillerie, planches, accessoires)
3. **Autre** — Proposer un nouvel article ou ajout personnalisé

#### Génération automatique des composantes

Quand vous ajoutez un **article de fabrication** (ex: un caisson), le système génère automatiquement ses composantes en utilisant les matériaux par défaut que vous avez configurés :

Par exemple, ajouter un **Caisson standard** avec L=24", H=36" :
- Crée automatiquement une ligne **Panneau mélamine** avec la bonne surface (pi²)
- Crée automatiquement une ligne **Bande de chant** assortie au matériau du panneau (mélamine → bande PVC mélamine, placage → bande de chant chêne blanc)
- Crée automatiquement une ligne **Finition** correspondant à votre matériau par défaut (si applicable — les mélamine ne reçoivent pas de finition)

Les composantes sont indentées sous l'article parent et leurs quantités sont calculées par les formules de l'article. Les quantités distinguent automatiquement les constantes (ex: "4 vis par caisson") des formules dimensionnelles (ex: "surface L×H/144") — pas de risque de doublement quand vous avez plusieurs unités du même article.

**Cohérence matériau** : quand le système résout le panneau vers mélamine, toutes les composantes associées (bande de chant, finition) sont automatiquement résolues dans le même contexte matériau. Pas besoin de vérifier manuellement la cohérence. Par exemple, mélamine ne reçoit pas de finition laque (le système le sait et n'en crée pas).

**Collapse des composantes** : les composantes sont **masquées par défaut** pour garder le calculateur lisible. Chaque parent affiche un triangle ▶ et un badge **(+3)** indiquant le nombre de composantes cachées. Quand les composantes sont masquées, le **total affiché sur le parent inclut la somme de toutes ses composantes** (en gras) — vous voyez le coût réel de l'article complet d'un coup d'œil. Cliquez le triangle pour expand/collapse : à l'expand, le total revient au montant individuel du parent. Une checkbox dans l'en-tête de la pièce permet de **tout montrer** d'un coup.

#### Dimensions

Les articles de fabrication affichent des champs de dimensions :
- **L** — Largeur (pouces)
- **H** — Hauteur (pouces)
- **P** — Profondeur (pouces)

Pour les caissons, quatre champs supplémentaires apparaissent :
- **Tab.** — Nombre de tablettes
- **Part.** — Nombre de partitions
- **Port.** — Nombre de portes (déclenche la cascade des façades)
- **Tir.** — Nombre de tiroirs (déclenche la cascade des façades de tiroirs)

**Note** : 0 est une valeur valide (caisson sans tablettes, sans portes, etc.). Laissez le champ vide si vous ne connaissez pas encore la valeur — le système attendra avant de générer les composantes.

La quantité est calculée automatiquement selon le type d'unité :
- **pi²** : L × H / 144
- **linéaire** : L / 12
- **unité** : vous entrez la quantité manuellement
- **pmp** : pied mesure de planche

### Utiliser l'assistant AI estimateur

L'assistant Scopewright est un estimateur virtuel qui connaît votre catalogue, vos matériaux et vos règles. Cliquez le **point AI** (●) dans la barre d'outils pour ouvrir le panneau de chat à droite.

#### Boutons rapides

4 actions fréquentes sont accessibles en un clic :
- **Rentabilité** — « Analyse la rentabilité du projet »
- **Résumé** — « Résume cette soumission »
- **Descriptions** — « Optimise toutes les descriptions »
- **Améliorer marge** — « Suggère des articles pour améliorer la marge »

#### Exemples de conversations

**Lire un plan et créer un article :**

> **Vous :** Fais-moi le C1
>
> **Assistant :** D'après le plan annoté, le C1 est un caisson de base de 24" × 36" × 23" avec 2 tablettes. Je propose d'ajouter :
> - **ST-0006** (Caisson standard) — L=24, H=36, P=23, Tab.=2
>
> `[Appliquer]` `[Ignorer]`
>
> **Vous :** *(clic sur Appliquer)*
>
> **Assistant :** C1 ajouté. Le caisson a généré automatiquement ses composantes : panneau mélamine (5.5 pi²), bande de chant (10 pi lin), laque polyuréthane (5.5 pi²). Total : 847.50 $.

**Analyser la rentabilité :**

> **Vous :** Analyse la rentabilité de cette pièce
>
> **Assistant :** **Analyse de rentabilité — Îlot cuisine**
>
> | | Montant |
> |--|---------|
> | Prix de vente | 12,450.00 $ |
> | Coût matériaux | 4,280.00 $ |
> | Coût main-d'œuvre | 3,150.00 $ |
> | **Marge brute** | **5,020.00 $ (40.3%)** |
>
> La marge est dans la cible. Les postes les plus importants sont le bois massif (2,100 $) et la fabrication (45h à 70$/h).

**Simulation what-if :**

> **Vous :** Combien ça coûterait en noyer au lieu de chêne blanc?
>
> **Assistant :** Si on remplace le placage chêne blanc par du noyer sur l'îlot cuisine :
> - Panneaux : 5.2 $/pi² → 8.7 $/pi² (+67%)
> - Bande de chant : proportionnel
> - **Différence estimée : +1,850 $** (de 12,450 $ à 14,300 $)
> - Marge passerait de 40.3% à 36.1%
>
> Voulez-vous que je change les matériaux par défaut?

**Diagnostic en temps réel :**

> **Vous :** Pourquoi j'ai un doublon de bande de chant?
>
> **Assistant :** Je vois dans les logs cascade que la bande de chant a été générée 2 fois :
> 1. Par la règle du caisson C1 (composante automatique)
> 2. Par un ajout manuel antérieur
>
> La ligne manuelle (row-14) n'est pas liée au caisson. Voulez-vous que je supprime le doublon manuel?

L'assistant a accès aux **50 derniers événements** du moteur de composantes automatiques. Il détecte automatiquement quand votre question concerne un problème de génération et inclut les logs pertinents. Pas besoin d'activer un mode debug — demandez simplement "pourquoi le panneau n'est pas généré?" ou "pourquoi la finition est en chêne blanc?".

**Envoyer un screenshot :**

Collez un screenshot directement dans le chat (Ctrl+V) ou glissez-déposez une image. L'assistant peut lire :
- Des plans d'architecte
- Des listes de prix fournisseur
- Des tableaux Excel
- Des notes manuscrites

**Mode simulation :** L'assistant propose toujours les modifications en texte d'abord. Vous voyez ce qu'il veut faire, puis vous cliquez **Appliquer** ou **Ignorer**. Rien ne se fait sans votre confirmation.

**Modifier le catalogue depuis le calculateur :** Si vous avez la permission d'édition du catalogue, l'assistant peut aussi modifier un article du catalogue directement (prix, formules, matériaux). Ces modifications passent toujours par une confirmation explicite et sont tracées dans un journal d'audit.

**Changement de contexte automatique :** Quand vous scrollez d'un meuble à l'autre dans le calculateur, l'assistant comprend automatiquement le changement et adapte ses réponses au meuble visible.

### Descriptions client

Chaque meuble a un champ **Description client** qui apparaît dans la soumission envoyée au client. Deux façons de le remplir :

1. **AI** — Cliquez le point AI (●) à côté du champ. L'assistant génère une description structurée basée sur les articles du meuble :
   - Caisson : matériau, finition
   - Façades : type, matériau
   - Tiroirs : système, quantité
   - Poignées : modèle
   - Détails : particularités
   - Exclusions : ce qui n'est pas inclus

2. **Assemblage** — Cliquez le bouton ⚡ pour assembler automatiquement la description à partir des articles présents.

La description est un champ texte libre — vous pouvez toujours la modifier manuellement.

#### Traduction FR/EN

Dans l'aperçu soumission, le bouton **EN** bascule toute la soumission en anglais. La traduction est faite par AI et couvre :
- Descriptions de chaque meuble
- Clauses et conditions
- Étapes du projet
- Page d'introduction

Le bouton bascule entre **FR** et **EN**. La langue choisie est sauvegardée et utilisée pour le lien envoyé au client.

### Installation

Chaque meuble et chaque ligne a une **checkbox installation** (✓).

- **Checkbox meuble** : coche/décoche toutes les lignes du meuble d'un coup
- **Checkbox ligne** : contrôle individuel par article
- **Checkbox parent** : cocher/décocher un article de fabrication propage automatiquement à toutes ses composantes générées (panneaux, bande de chant, finition, etc.) — récursif sur tous les niveaux

Le prix affiché inclut l'installation quand la case est cochée. Si l'installation est exclue pour une section, la mention « *Installation non incluse pour cette section* » apparaît dans la soumission.

Il y a aussi un **toggle global** au niveau du projet qui contrôle l'installation pour tous les meubles.

**Note technique** : le toggle installation ne recalcule pas les composantes — c'est un flag de facturation uniquement. Aucun risque de duplication ou de modification des articles.

### Rentabilité

Le bouton **Rentabilité** dans la barre d'outils ouvre une vue détaillée :

- **Prix de vente** par meuble
- **Coût matériaux** ventilé par catégorie de dépense (bois, quincaillerie, panneaux…)
- **Coût main-d'œuvre** ventilé par département (fabrication, assemblage, finition…)
- **Marge brute** en dollars et en pourcentage
- **Modificateur %** — Un pourcentage de surcharge appliqué à toutes les sections

### Ajustements par ligne

Pour ajuster le prix, la main-d'œuvre ou les coûts matériaux d'une ligne **sans modifier le catalogue** :

1. **Survolez** la cellule prix d'un article → une icône ⚙ apparaît
2. **Cliquez** sur ⚙ → un panneau s'ouvre avec 3 colonnes :
   - **Cat** — Valeur catalogue (référence, non modifiable)
   - **Auto** — Valeur auto-calculée par les barèmes (si un barème est actif, sinon vide)
   - **Manuel** — Votre override. Laissez vide pour garder la valeur Auto ou Catalogue
3. **Prix de vente** — En haut du panneau. Entrez un prix fixe qui remplace tout le calcul
4. **Appliquer** — Enregistre les ajustements. La ligne affiche un indicateur violet

**Hiérarchie** : pour chaque département, le système prend votre valeur Manuel si elle est définie, sinon la valeur Auto (barème), sinon la valeur Catalogue. Un override Manuel sur "Gestion" ne touche pas aux valeurs Auto des autres départements.

Les ajustements sont **locaux à cette soumission** — ils ne modifient pas l'article dans le catalogue. Si vous changez l'article sélectionné sur la ligne, les ajustements sont automatiquement supprimés.

Le bouton **Réinitialiser** dans le panneau supprime les ajustements manuels (les valeurs Auto restent).

### Barèmes automatiques

Les articles avec des **barèmes** ajustent automatiquement leurs temps de main-d'œuvre et coûts matériaux selon les dimensions. Par exemple :
- Caisson > 36 po → +25% machinage
- Caisson > 48 po → +50% machinage + 20% panneaux

Les barèmes sont définis sur l'article dans le catalogue (section "Barèmes et modificateurs", visible admin uniquement). Quand un barème est actif, une icône ⚙ bleue apparaît à côté du prix, et le panneau d'ajustement affiche les valeurs auto-calculées dans la colonne **Auto**.

Les barèmes se recalculent automatiquement quand vous changez les dimensions. Vous pouvez toujours surcharger avec un override Manuel.

### Filtres et navigation

#### Tags

Chaque ligne peut recevoir un **tag** (4 caractères max, ex: C1, F2, P1). Les tags permettent de :
- Identifier visuellement les articles sur les plans annotés
- Filtrer l'affichage par tag avec les puces en haut du calculateur
- Regrouper les articles par zone du projet

Les tags sont propagés automatiquement : tagger un article de fabrication tague aussi toutes ses composantes.

#### Rabais

Le bouton **+ Rabais** ajoute un rabais en dollars sur le total de la soumission. Le rabais apparaît sur la soumission comme une réduction après le sous-total.

---

## PARTIE 4 — CATALOGUE DE PRIX

### Vue d'ensemble du catalogue

Le catalogue est votre base de données de tous les articles disponibles pour l'estimation. Chaque article a :

- Un **code unique** auto-généré (ST-0001, ST-0002…)
- Une **description** technique interne
- Un **texte client** (ce que le client voit dans la soumission)
- Un **type d'unité** (unité, pi², pmp, linéaire, %)
- Un **prix** (manuel ou composé)
- Des **règles de calcul** optionnelles (composantes automatiques)
- Des **images** et **fiches de vente**
- Un **statut** (approuvé ou en attente)

#### Deux types d'articles

| Type | Utilisation | Exemples |
|------|------------|---------|
| **Fabrication** | Articles fabriqués sur mesure, avec dimensions L/H/P et composantes automatiques | Caisson standard, Comptoir, Panneau sur mesure |
| **Matériau** | Matériaux, quincaillerie, composantes achetées | Panneau mélamine, Charnière, Colle, Bande de chant |

Les articles de fabrication déclenchent la génération automatique de composantes. Les matériaux sont les lignes générées ou ajoutées manuellement.

#### Articles par défaut (★)

Les articles marqués ★ apparaissent en premier dans le menu de recherche du calculateur. Ce sont vos articles les plus utilisés — ceux que les estimateurs sélectionnent 80% du temps.

### Créer un article

Cliquez **+** dans l'en-tête du catalogue. La fiche d'article complète s'ouvre :

#### Informations de base
- **Description** — Le nom technique complet (ex: « Caisson standard mélamine 3/4" »)
- **Catégorie** — La famille de produit (ex: Caisson, Comptoir, Quincaillerie)
- **Type d'unité** — Comment l'article est mesuré : pi², pmp, unité, linéaire, %
- **Instruction** — Notes pour les estimateurs (ex: « Largeur max 48", hauteur max 96" »)

#### Texte client
Le nom tel qu'il apparaît dans la soumission du client (ex: « Placage de chêne blanc »). L'assistant AI peut le générer ou le corriger automatiquement.

#### Prix composé

Le prix peut être **manuel** (un montant fixe) ou **composé** (calculé automatiquement) :

**Main-d'œuvre** — Minutes par département :
| Département | Minutes |
|------------|---------|
| Fabrication | 45 |
| Assemblage | 20 |
| Finition | 15 |

Le coût est calculé : (minutes / 60) × taux horaire du département.

**Matériaux** — Coût par catégorie de dépense :
| Catégorie | Coût |
|-----------|------|
| BOIS MASSIF | 12.50 $ |
| QUINCAILLERIE | 8.00 $ |

Le coût final inclut le facteur de perte (%) configuré par catégorie dans l'administration.

**Perte (%) spécifique** — Si cet article a un facteur de perte différent de sa catégorie, vous pouvez le surcharger ici.

#### Composantes fournisseur

Vous pouvez associer des composantes de fournisseurs à un article :
- Collez un **screenshot** d'une liste de prix fournisseur
- L'assistant AI extrait automatiquement : fournisseur, numéro de pièce, description, quantité, coût unitaire
- Les composantes sont stockées pour référence et traçabilité

#### Médias

Glissez-déposez des images ou PDF. Chaque média peut recevoir des tags :
- **Fiche client** — Utilisé dans les fiches de vente
- **Catalogue** — Image de référence
- **Technique** — Documentation technique
- **Dessin** — Schéma ou plan

#### Sauvegarder

Cliquez **Sauvegarder** en bas de la modale. La modale **reste ouverte** après la sauvegarde — un toast "Sauvegardé ✓" confirme l'enregistrement. Fermez manuellement avec Annuler, le X, ou Escape.

Le bouton **Dupliquer** crée une copie de l'article (nouveau code ST-XXXX, statut "en attente"). Les composantes fournisseur et les médias ne sont pas copiés.

### Règles de cascade (anciennement "Instructions AI")

C'est ici que la puissance de Scopewright se révèle. Chaque article de fabrication peut avoir des **règles de cascade** qui définissent ses composantes automatiques.

#### Comment ça fonctionne

1. Vous écrivez une **explication en langage naturel** décrivant les composantes de l'article :

   > « Un caisson standard comprend des panneaux de mélamine (surface L×H/144 en pi²), de la bande de chant sur tous les chants visibles (périmètre 2×(L+H)/12 en pi linéaires), et une finition selon le matériau par défaut de la pièce (même surface que les panneaux). »

2. Cliquez le **bouton AI** — le système convertit automatiquement votre explication en **règles de calcul structurées** (JSON)

3. Quand un estimateur ajoute cet article dans le calculateur avec des dimensions, les composantes sont générées automatiquement avec les bonnes quantités

#### Types de règles

- **Matériau par défaut** (`$default:`) — Utilise le matériau configuré dans les matériaux par défaut de la pièce (ex: le panneau sera en mélamine si le groupe « Caisson » est configuré en mélamine)
- **Correspondance par catégorie** (`$match:`) — Trouve l'article qui correspond à la catégorie de dépense dans les matériaux configurés (ex: bande de chant assortie au panneau). Le système vérifie automatiquement la cohérence : si le panneau résolu est en mélamine, les composantes incompatibles (ex: finition laque) sont exclues silencieusement
- **Article spécifique** — Ajoute toujours le même article (ex: ST-0042 pour les pieds de meuble)

#### Dimensions calculées des enfants

Les règles cascade peuvent inclure des **formules de dimensions** pour les enfants. Par exemple, une façade de porte peut avoir `L = (L / n_portes) - 0.125` et `H = H - 0.25`. Les dimensions de l'enfant sont recalculées automatiquement quand les dimensions du parent changent.

**Multi-instance** : quand une règle a des formules de dimensions (`child_dims`) et que la quantité est un entier supérieur à 1 (ex: `n_portes = 2`), le système crée **2 lignes façade distinctes** (quantité 1 chacune) plutôt qu'une seule ligne quantité 2. Chaque façade est une pièce physique avec ses propres dimensions. Si `n_portes` passe de 3 à 2, la 3e façade est automatiquement supprimée.

### Barèmes et modificateurs (admin)

Les barèmes ajustent automatiquement les temps de main-d'œuvre et coûts matériaux selon les dimensions de l'article. Cette section est visible uniquement pour les administrateurs dans la modale d'édition du catalogue.

#### Comment ça fonctionne

1. Écrivez une **explication** des ajustements dimensionnels en langage naturel :

   > « Largeur > 36 po → +25% machinage. Largeur > 48 po → +50% machinage et +20% panneaux. »

2. Cliquez le **bouton AI** — le système génère le JSON structuré des barèmes

3. Dans le calculateur, quand l'estimateur entre les dimensions, les ajustements s'appliquent automatiquement

Le premier barème dont la condition est vraie est appliqué (pas de cumul). Les valeurs ajustées apparaissent dans la colonne **Auto** du popover d'override.

### Assistant catalogue

Le catalogue a son propre assistant AI, accessible via le bouton **●** dans l'en-tête. Il peut :

- **Importer en masse** — Collez un screenshot de votre liste de prix Excel ou fournisseur. L'AI crée les articles automatiquement.
- **Auditer** — « Vérifie les incohérences dans le catalogue » → détecte les doublons, les prix aberrants, les articles orphelins
- **Optimiser** — « Améliore les textes clients des articles de cette catégorie »
- **Rechercher** — « Montre-moi tous les articles de quincaillerie au-dessus de 50$ »

#### Audit automatique

Le bouton **Auditer** lance 12 vérifications automatiques :

| Vérification | Ce qu'elle détecte |
|---|---|
| Variantes texte client | « Chêne blanc » vs « Chêne Blanc » vs « chêne blanc » |
| Articles sans texte client | Articles invisibles dans les soumissions |
| Articles sans prix | Prix manquant (critique) |
| Catégories non classées | Catégories non liées à un groupe matériau |
| Orthographe similaire | « Mélamine » vs « Melamine » |
| Jamais utilisés | Articles qui n'ont jamais été dans une soumission |
| Dormants | Pas utilisés depuis 60+ jours |
| Prix aberrants | Prix hors norme pour la catégorie |
| Textes clients similaires | Détection de doublons après normalisation |
| Clés dépense similaires | « PANNEAU BOIS » vs « PANNEAUX BOIS » |

Pour les doublons détectés, un bouton **Uniformiser** permet de corriger en un clic — tous les articles du groupe adoptent le texte le plus fréquent.

### Approbation des articles

Les articles créés par des utilisateurs sans permission d'édition du catalogue sont mis **en attente d'approbation**.

#### Workflow

1. Un estimateur propose un nouvel article → statut **En attente**
2. L'article apparaît dans le module **Approbations** avec un badge orange
3. L'approbateur ouvre la fiche, vérifie les informations
4. L'assistant AI d'approbation peut **analyser automatiquement** l'article :
   - Comparaison avec les articles existants similaires
   - Vérification de la cohérence des prix avec la catégorie
   - Suggestion d'améliorations (texte client, catégorie, prix)
5. L'approbateur clique **Approuver** (l'article est publié) ou **Retourner** (avec commentaire)

Les approbations peuvent aussi se faire **en lot** via le mode sélection : cochez plusieurs articles, puis « Approuver » ou « Rejeter ».

### Apprentissage organisationnel

Quand l'assistant AI fait une erreur ou que vous corrigez son travail, il peut proposer de **sauvegarder une règle** pour ne plus répéter l'erreur :

> **Assistant :** J'ai ajouté de la main-d'œuvre de fabrication sur cet article.
>
> **Vous :** Non, les articles sous-traités n'ont pas de main-d'œuvre interne.
>
> **Assistant :** Compris ! Voulez-vous que je sauvegarde cette règle pour le futur?
> - *« Les articles sous-traités (catégorie Sous-traitance) n'ont pas de minutes de main-d'œuvre interne »*
>
> `[Sauvegarder]` `[Non merci]`

Les règles sauvegardées sont injectées dans tous les assistants AI du système. Elles sont gérables dans l'administration.

Exemples de règles utiles :
- « Les caissons de pharmacie ont une profondeur standard de 5 pouces »
- « Toujours arrondir les quantités de bande de chant au pied linéaire supérieur »
- « Les panneaux de côté ne prennent pas de finition si le caisson est encastré »

---

## PARTIE 5 — CONTACTS ET ENTREPRISES

### Gestion des contacts

Le module **Contacts** organise toutes les personnes et entreprises liées à vos projets. Deux onglets :

- **Contacts** — Personnes individuelles
- **Entreprises** — Sociétés et organisations

#### Types de contacts

Chaque entreprise peut avoir un type :
- Client
- Architecte
- Entrepreneur
- Fournisseur
- Sous-traitant
- Compétiteur
- Designer

#### Fiche contact

Chaque contact contient :
- Prénom, nom
- Courriel, cellulaire
- Adresse
- Méthode de contact préférée (Email, Téléphone, Texto)
- Notes libres
- **Entreprises liées** — avec rôle et coordonnées professionnelles
- **Communications** — historique des échanges (courriels, appels, notes)

### Assistant contacts

L'assistant AI du module contacts est spécialisé dans l'import et la gestion de contacts. Cliquez le **●** pour ouvrir le chat.

#### Import en masse

L'assistant peut extraire des contacts depuis pratiquement n'importe quelle source :

**Depuis un screenshot :**
> **Vous :** *(coller un screenshot de votre carnet d'adresses Outlook)*
>
> **Assistant :** J'ai détecté 8 contacts dans cette capture. Voici ce que je propose de créer :
> - Jean Tremblay — jean@abc.com — Architecte
> - Marie Lavoie — marie@xyz.com — Designer
> - *(…6 autres)*
>
> `[Appliquer 8 contacts]` `[Ignorer]`

**Depuis une carte d'affaires :**
> **Vous :** *(photo d'une carte d'affaires)*
>
> **Assistant :** Contact détecté :
> - **Pierre Gagnon** — Directeur, Construction ABC
> - Tél: 514-555-1234 — pierre@constructionabc.com
> - 123 rue Principale, Montréal
>
> `[Appliquer]` `[Ignorer]`

**Depuis une signature de courriel :**
> **Vous :** Ajoute ce contact : Pierre Gagnon | Construction ABC | 514-555-1234 | pierre@abc.com
>
> **Assistant :** Je crée le contact Pierre Gagnon lié à l'entreprise Construction ABC (je la crée aussi si elle n'existe pas).

**Détection de doublons :** Avant chaque création, l'assistant vérifie si un contact similaire existe déjà et vous prévient.

**Modification :** « Change le courriel de Jean Tremblay pour jean.nouveau@abc.com »

**Audit :** « Quels contacts n'ont pas de courriel? » → l'assistant filtre et affiche la liste.

### Fiche entreprise

Chaque entreprise contient :
- Nom, type, adresse
- Téléphone, courriel, site web
- Notes
- **Contacts liés** — avec rôle dans l'entreprise et coordonnées professionnelles
- **Champs dynamiques** — selon le type d'entreprise (ex: numéro de licence pour un entrepreneur)

---

## PARTIE 6 — PRÉSENTATION CLIENT

### Aperçu soumission

Le bouton **Aperçu** dans la barre d'outils ouvre une prévisualisation de la soumission telle que le client la verra. La présentation est une page web multi-sections :

1. **Page de couverture** — Adresse du projet, client, numéro de soumission, date
2. **Page d'introduction** — Présentation de l'entreprise avec photo, texte personnalisé, coordonnées
3. **Étapes du projet** — Les 8 étapes du processus (conception → contrôle qualité)
4. **Pages des meubles** — Une page par meuble avec :
   - Description client formatée
   - Jusqu'à 6 images (annotées ou brutes)
   - Détail des articles avec prix
   - Sous-total par section
5. **Sommaire des prix** — Total, rabais, note d'installation
6. **Clauses et conditions** — Termes du contrat
7. **Acceptation** — Formulaire de signature électronique

Le bouton **Présentation** ouvre cette vue en plein écran (iframe) pour une démo client.

### Envoyer au client

#### Générer le lien

Après approbation de la soumission (voir Partie 7), le bouton **Envoyer au client** génère un lien unique de présentation. Ce lien :

- Est accessible sans connexion (page publique sécurisée par token)
- Affiche la soumission dans sa version approuvée
- Permet au client d'**accepter et signer électroniquement**

#### Acceptation par le client

Le client ouvre le lien, consulte la soumission, puis en bas de page :
1. Entre son **nom complet**
2. Entre son **courriel**
3. Dessine sa **signature** sur un pad tactile
4. Clique **Accepter la soumission**

L'acceptation est enregistrée avec la signature, la date et l'heure. Un badge vert « Soumission acceptée » apparaît en haut de la soumission.

### Clauses et conditions

Les clauses sont les termes et conditions de votre soumission. Elles sont gérées dans l'aperçu :

- **Bibliothèque de clauses** — Clauses standards réutilisables entre projets
- **Clauses par projet** — Ajoutez des clauses spécifiques à cette soumission
- Chaque clause a un **titre** et un **contenu** en français et en anglais
- Les clauses sont sauvegardées immédiatement quand vous les modifiez

---

## PARTIE 7 — WORKFLOW ET APPROBATION

### Statuts de soumission

Chaque soumission suit un workflow en 6 étapes :

```
Brouillon → En approbation ↔ Retournée → Approuvée → Envoyée au client → Acceptée
```

| Statut | Signification | Actions disponibles |
|--------|--------------|---------------------|
| **Brouillon** | En cours de rédaction | Modifier, Soumettre pour approbation |
| **En approbation** | En attente de révision | Approuver, Retourner (avec commentaire) |
| **Retournée** | Corrections demandées | Modifier, Re-soumettre |
| **Approuvée** | Prête à être envoyée | Envoyer au client |
| **Envoyée au client** | Lien client actif | Attendre l'acceptation, Confirmer manuellement |
| **Acceptée** | Contrat signé | Aucune (verrouillée) |

#### Verrouillage

À partir du statut « Approuvée », la soumission est **verrouillée** — les modifications ne sont plus possibles sans déverrouillage d'urgence (traçable dans les logs).

### Assistant d'approbation

Le module **Approbations** affiche toutes les soumissions en attente. En ouvrant une soumission pour examen, l'approbateur peut :

1. **Voir le détail complet** — Meubles, articles, prix, descriptions, images
2. **Lancer une révision AI** — L'assistant analyse la soumission et vérifie :
   - Cohérence des prix avec le catalogue
   - Marges de rentabilité acceptables
   - Completude des descriptions client
   - Présence de tous les articles nécessaires
3. **Approuver** — La soumission passe à « Approuvée » avec un commentaire optionnel
4. **Retourner** — La soumission retourne à l'estimateur avec un commentaire obligatoire expliquant les corrections demandées

### Bypass traçable

Certains utilisateurs ont la permission d'**envoyer sans approbation** (bypass). Cette action :
- Saute l'étape d'approbation (brouillon → envoyée au client)
- Est tracée dans l'historique avec le nom de l'utilisateur
- Disponible uniquement pour les utilisateurs avec la permission `can_bypass_approval`

Le bouton **Envoyer sans approbation** apparaît en rouge pour signaler que le workflow normal est contourné.

#### Auto-approbation

Les utilisateurs avec la permission `can_approve_quotes` qui soumettent leur propre soumission la voient **auto-approuvée** — elle passe directement de brouillon à approuvée.

---

## PARTIE 8 — ADMINISTRATION

Le module **Administration** est réservé aux administrateurs. Il configure les paramètres globaux du système.

### Rôles et permissions

Scopewright utilise 6 rôles prédéfinis avec 13 permissions combinables :

| Rôle | Accès typique |
|------|--------------|
| **Propriétaire** | Accès complet à tout |
| **Admin** | Configuration, catalogue, permissions |
| **Estimateur** | Créer/modifier projets et soumissions |
| **Approbateur** | Réviser et approuver les soumissions |
| **Proposant** | Suggérer de nouveaux articles (soumis à approbation) |
| **Visualiseur** | Consultation en lecture seule |

La matrice de permissions est une grille de cases à cocher dans l'administration. Chaque rôle peut avoir n'importe quelle combinaison de permissions.

### Taux horaires

Configurez le taux horaire de chaque département de votre atelier :

| Département | Taux horaire |
|------------|-------------|
| Fabrication | 70.00 $ |
| Assemblage | 65.00 $ |
| Finition | 60.00 $ |
| Installation | 55.00 $ |

Ces taux sont utilisés pour calculer le prix composé des articles (minutes × taux).

### Catégories de dépenses

Chaque catégorie de matériau a un **facteur de perte** (%) :

| Catégorie | Perte |
|-----------|-------|
| BOIS MASSIF | 15% |
| QUINCAILLERIE | 0% |
| PANNEAU MÉLAMINE | 10% |

Le facteur de perte est appliqué au coût : `coût × (1 + perte% / 100)`. Il représente les chutes, les erreurs de coupe et le gaspillage normal.

### Prompts AI

L'administration contient un **dropdown de 12+ assistants AI** dont vous pouvez personnaliser les instructions :

| Assistant | Ce qu'il contrôle |
|-----------|------------------|
| Assistant estimateur | Le comportement du chat dans le calculateur |
| Assistant catalogue | L'import et l'audit d'articles |
| Assistant contacts | L'import et la gestion de contacts |
| Correcteur fiches | L'optimisation des textes produits |
| Traduction FR→EN / EN→FR | Le style de traduction |
| Titre présentation client | La génération du texte client |
| Description AI | La génération des descriptions de meubles |
| Import composantes | L'extraction des composantes fournisseur |
| Assistant approbation | La révision automatique des soumissions |
| Règles de cascade | La génération des règles cascade (JSON) |
| Barèmes et modificateurs | La génération des barèmes dimensionnels (JSON) |

Pour chaque assistant, vous pouvez **modifier le prompt** (les instructions). Laissez vide pour utiliser le prompt par défaut. Vos modifications sont sauvegardées et prennent effet immédiatement.

### Présentation — Introduction

Personnalisez la page d'introduction de vos soumissions :
- **Image de couverture** — L'image de fond de la première page
- **3 paragraphes d'introduction** — Le texte de présentation de votre entreprise (FR et EN)
- **Coordonnées** — Adresse atelier, bureau, téléphone, site web

---

## PARTIE 9 — TRUCS ET ASTUCES

### Raccourcis et productivité

- **Ctrl+V dans le chat AI** — Collez un screenshot pour que l'assistant le lise
- **★ Suivis** — Marquez vos projets importants pour les retrouver en un clic
- **Copier les matériaux** — Quand plusieurs meubles utilisent les mêmes matériaux, utilisez « Copier de… » au lieu de les reconfigurer
- **Tags sur les plans** — Taguez vos plans (C1, F2, T3…) avant de demander à l'AI de travailler dessus. L'AI lit les tags directement sur l'image.
- **Dupliquer une soumission** — Pour créer une variante (option B), dupliquez plutôt que de recommencer
- **Raccourci confirmation AI** — Tapez simplement « oui », « go » ou « confirme » au lieu de cliquer le bouton Appliquer

### Quand utiliser l'AI vs faire manuellement

| Situation | Recommandation |
|-----------|---------------|
| Ajouter un article standard | **AI** — « Ajoute un caisson C1 de 24×36×23 » |
| Ajouter un article inhabituel | **Manuel** — Cherchez dans le dropdown, vérifiez les paramètres |
| Vérifier la rentabilité | **AI** — « Analyse la rentabilité » |
| Ajuster un prix manuellement | **Manuel** — Modifiez directement dans la ligne |
| Générer les descriptions | **AI** — Cliquez le dot (•) sur chaque meuble → panneau proposition (Remplacer tout / Insérer sélection / Ignorer) |
| Import de contacts | **AI** — Collez un screenshot, l'AI fait le reste |
| Diagnostiquer un problème | **AI** — « Pourquoi le panneau n'est pas généré? » |
| Corriger un prix catalogue | **AI** — « Change le prix de ST-0042 à 85$ » (si permission) |
| Ajuster le prix d'une ligne | **AI** — « Ajuste les minutes de la ligne 0 à 60 min ébénisterie » ou **Manuel** — Bouton ⚙ sur la ligne |
| Changer un matériau par défaut | **Manuel** — Panneau matériaux par défaut |

**Principe fondamental :** L'AI aide et accélère, mais l'estimateur décide. L'AI propose, vous confirmez. Chaque modification passe par votre validation.

### Les règles d'or

1. **Toujours configurer les matériaux par défaut en premier** — C'est la base de tout. Sans matériaux configurés, le système ne peut pas générer les composantes automatiquement. Le bouton d'ajout d'articles est bloqué tant que les groupes obligatoires ne sont pas remplis.

2. **Toujours annoter les plans avant de demander à l'AI** — L'assistant lit les tags visuels (C1, F2, P3) sur les images annotées. Sans annotations, il ne peut pas associer les éléments du plan aux articles.

3. **Vérifier les composantes du premier article** — Quand vous ajoutez le premier article de fabrication dans un meuble, vérifiez que les composantes générées sont correctes (bon matériau, bonnes quantités). Si tout est bon, les suivants seront aussi corrects.

4. **Un meuble = une zone cohérente** — Regroupez les articles par zone logique (l'îlot, le garde-manger, la vanité), pas par type d'article. Les matériaux par défaut s'appliquent au meuble entier.

5. **Sauvegarder les règles AI** — Quand vous corrigez l'assistant, acceptez de sauvegarder la règle. Ça évite de répéter la même correction pour chaque projet.

---

*Guide Scopewright — Mars 2026*
