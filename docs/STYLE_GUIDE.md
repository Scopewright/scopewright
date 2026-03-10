# Scopewright — Style Guide UI

## 1. Philosophie visuelle

Scopewright adopte une esthétique inspirée des outils professionnels modernes (Linear, Stripe Dashboard).

Principes :
- Interface sobre et fonctionnelle
- Hiérarchie visuelle très claire
- Peu de couleurs
- Accent sur la typographie et l'espacement
- Cartes très légères
- Interface très calme visuellement

À éviter :
- Couleurs saturées
- Ombres lourdes
- Gradients
- Icônes décoratives
- Effets inutiles

L'interface doit toujours paraître stable, sérieuse et professionnelle.

---

## 2. Palette de couleurs

### Couleur primaire
- Primary: #0B1220
- Utilisée pour : boutons principaux, icônes principales, titres importants, barres de navigation

### Couleurs neutres
- Background: #FFFFFF
- Card: #F8FAFC
- Border: #E5E7EB
- Muted text: #6B7280
- Primary text: #111827

Règles :
- Pas de fond gris foncé
- Les cartes restent presque blanches
- Les bordures sont très légères

### Couleurs d'état
- Blue: #3B82F6 - A soumissionner
- Green: #22C55E - Vendu
- Orange: #F59E0B - En attente
- Red: #EF4444 - Perdu
- Purple: #8B5CF6 - En révision
- Gray: #9CA3AF - Brouillon

Jamais utilisées pour décorer l'interface. Uniquement pour les statuts.

### Couleurs rentabilité (modal)
- Barre répartition : Matériaux #0B1220, Salaires #374151, Frais fixes #9CA3AF, Profit #0D9488
- KPI Profit OK (≥ 15%) : fond #F0FDFA, bordure #99F6E4, montant/% #0D9488
- KPI Profit warning (< 8%) : fond #FFFBEB, bordure #FDE68A, montant #B45309, % #D97706
- Bannière avertissement : fond #FFFBEB, bordure gauche #F59E0B, texte #92400E
- Barres MO : remplissage #0B1220, fond vide #F1F5F9
- Valeurs marges OK (≥ 15%) : #0D9488
- Valeurs marges warning (8-14.9%) : #D97706
- Valeurs marges danger (< 8%) : #DC2626

Interdit dans ce modal : violet saturé (#A78BFA), vert vif (#86EFAC, #22C55E, #15803D)

---

## 3. Typographie

Police : Inter
Fallback : system-ui, -apple-system, Segoe UI

### Hiérarchie
- H1 : 28px / 600 / #111827
- H2 : 20px / 600 / #111827
- H3 : 16px / 600 / #111827
- Texte normal : 14px / #374151
- Texte secondaire : 13px / #6B7280

---

## 4. Espacement

Grille 8px.

Valeurs : 4px, 8px, 16px, 24px, 32px, 48px, 64px

- Padding carte : 24px
- Gap sections : 32px
- Gap boutons : 12px

---

## 5. Boutons

### Principal
- background: #0B1220
- color: white
- border-radius: 8px
- padding: 10px 16px
- font-weight: 500
- Hover : background #111827

### Secondaire
- background: white
- border: 1px solid #E5E7EB
- color: #111827

### Ghost
- background: transparent
- color: #374151

---

## 6. Cartes

- background: white
- border: 1px solid #E5E7EB
- border-radius: 12px
- padding: 24px
- box-shadow: 0 1px 2px rgba(0,0,0,0.04)

Jamais de shadow lourde. Jamais de gradient.

---

## 7. Tables

### Header
- background: #F9FAFB
- font-weight: 600
- font-size: 12px
- text-transform: uppercase
- letter-spacing: 0.02em

### Row
- border-bottom: 1px solid #F1F5F9
- Hover : background #F8FAFC

---

## 8. Tags / badges

- border-radius: 999px
- padding: 4px 10px
- font-size: 12px
- font-weight: 500

---

## 9. Layout global

- max-width: 1200px
- margin: auto
- padding: 32px

---

## 10. Modals

- background: white
- border-radius: 12px
- padding: 32px
- border: 1px solid #E5E7EB
- Overlay : rgba(0,0,0,0.35)

---

## 11. Inputs et textareas

- border: 1px solid #E5E7EB
- border-radius: 8px
- padding: 10px 12px
- font-size: 14px
- Focus : border-color #0B1220, outline none
- Pas de scrollbar custom, pas de flèches haut/bas
- Comportement scroll natif standard

---

## 12. Icônes

- Style : outline, simple, minimal
- Librairie : Lucide ou Heroicons
- Taille : 16px, 20px, 24px
- Jamais filled dans des disques colorés ou noirs
- Jamais décoratives

---

## 13. Pattern heartbeat / dot AI

Le point animé (heartbeat) indique qu'une action AI est en cours.

- Couleur : #3B82F6 (blue)
- Position : coin supérieur droit de la textarea concernée
- Animation : pulse subtil
- Apparaît pendant le chargement AI uniquement
- Disparaît quand le résultat est déposé
- Confirmation succès : texte vert inline sous la textarea ("JSON généré ✓")

Ce pattern est utilisé dans :
- Modal article catalogue - bouton explication
- Admin catégories de dépense - boutons template
- Tout futur bouton AI sur une textarea

---

## 14. Animations

- Durée : 150ms à 200ms
- Easing : ease-out
- Usage : hover bouton, dropdown, modal
- Jamais : animation flashy, transition longue

---

## 15. Règle fondamentale

Si un pattern UI existe déjà dans l'app, le réutiliser à l'identique.
Ne jamais réinventer un composant qui existe.
En cas de doute, chercher d'abord dans le code existant.

Si un élément visuel attire trop l'attention, il est probablement mal conçu.
Scopewright doit rester calme visuellement.

---

## 16. Inspirations

Attio — Référence principale pour l'interface interne : tags compacts, vues multiples, densité d'information sans surcharge, node graph pour visualisation cascades (#124)

Linear, Stripe Dashboard, Notion, Vercel, Airtable, Raycast

Pas : Webflow, Dribbble style, dashboards flashy

---

## 17. Directive CC obligatoire

Avant tout travail UI (nouveaux composants, modifications de style, nouveaux écrans) :
1. Lire ce fichier en entier
2. Identifier le pattern existant le plus proche
3. Réutiliser ce pattern
4. Si aucun pattern n'existe, proposer avant d'implémenter
5. Valider que chaque décision visuelle respecte ce guide
