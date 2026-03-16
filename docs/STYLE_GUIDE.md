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
- Green: #22C55E - Vendu, Envoyée, checkmarks pipeline, ET métriques financières positives (profit, marges OK). Un seul vert dans toute l'app.
- Orange: #F59E0B - En attente
- Red: #EF4444 - Perdu
- Purple: #8B5CF6 - En révision
- Gray: #9CA3AF - Brouillon

Jamais utilisées pour décorer l'interface. Uniquement pour les statuts et métriques.

### Couleurs rentabilité (modal)
- Barre répartition : Matériaux #0B1220, Salaires #374151, Frais fixes #9CA3AF, Profit #22C55E
- KPI Profit OK (≥ 15%) : fond #F0FDF4, bordure #BBF7D0, montant/% #22C55E
- KPI Profit warning (< 8%) : fond #FFFBEB, bordure #FDE68A, montant #B45309, % #D97706
- Bannière avertissement : fond #FFFBEB, bordure gauche #F59E0B, texte #92400E
- Barres MO : remplissage #0B1220, fond vide #F1F5F9
- Valeurs marges OK (≥ 15%) : #22C55E (badges: fond #F0FDF4, texte #16A34A)
- Valeurs marges warning (8-14.9%) : #D97706
- Valeurs marges danger (< 8%) : #DC2626

Interdit dans ce modal : violet saturé (#A78BFA), vert vif (#86EFAC), teal (#0D9488)

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

### Champs numériques discrets (pattern QTY multiplicateur)

Pour les champs numériques secondaires qui ne doivent pas attirer l'attention :

- **Valeur par défaut (=1)** : couleur `#D1D5DB` (gris très pâle), bordure transparente, fond transparent
- **Valeur active (>1)** : couleur `var(--sw-navy)`, `font-weight: 600` (classe `.qty-mult-active`)
- **Focus** : bordure `var(--sw-border)`, couleur navy
- Taille : 32px wide, font-size 11px, text-align center
- Pas de spinners natifs (webkit + moz appearance none)
- Transition 150ms sur color et border-color

Principe : l'information est disponible mais ne crée pas de bruit visuel quand elle est à sa valeur par défaut.

### Checkboxes (colonne installation)

Checkboxes custom CSS — jamais de checkbox native noire.

- **Décochée** : bordure `#E5E7EB`, fond blanc, quasi invisible
- **Cochée** : fond `#EFF6FF`, checkmark `#93C5FD` (CSS `::after` border trick), bordure `#BFDBFE`
- **Hover** : bordure passe à `#BFDBFE`
- Taille : 14×14px, border-radius 3px
- Transition : 150ms ease
- `appearance: none` pour supprimer le rendu natif

Principe : la checkbox ne doit **jamais** attirer l'oeil. L'état coché est une info secondaire, pas un call-to-action.

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

## 14. Panneau Matériaux par Défaut (DM)

Le panneau DM utilise un thème navy sombre distinct du reste de l'application.

**Container** :
- Fond : `#0B1220` (navy)
- Border-radius : `4px 4px 0 0` (enchaîné sur la grille)
- Pas de gap entre le panneau et le `.calc-header` en dessous

**Header** :
- Label : `rgba(255,255,255,0.5)`, 11px, uppercase, `letter-spacing: 0.08em`
- Badge compteur : `background: rgba(255,255,255,0.1)`, `color: rgba(255,255,255,0.6)`, pill 10px
- Boutons (Copier de, Enregistrer tout) : `color: rgba(255,255,255,0.3)`, border `0.5px solid rgba(255,255,255,0.15)`, 3px radius

**Lignes DM** :
- Séparateur : `border-top: 0.5px solid rgba(255,255,255,0.07)`
- Label type : `rgba(255,255,255,0.35)`, 12px, min-width 72px
- Valeur matériau : `rgba(255,255,255,0.85)`, 13px, input underline only
- Bouton × : `rgba(255,255,255,0.15)` → hover `rgba(255,255,255,0.6)`

**Sous-champs enrichis** :
- Layout : `flex-wrap`, indent 100px gauche
- Label : `rgba(255,255,255,0.25)`, 10px, `letter-spacing: 0.06em`
- Valeur : `rgba(255,255,255,0.5)`, 12px, underline `0.5px solid rgba(255,255,255,0.12)`
- Focus : `rgba(255,255,255,0.85)`, underline `rgba(255,255,255,0.4)`

**Bookmark SVG** (icône composante) :
- Repos : stroke `rgba(255,255,255,0.2)`
- Hover : stroke `rgba(255,255,255,0.6)`
- Composante enregistrée : filled `rgba(255,255,255,0.7)` **persistant** (`.dm-bookmark-btn.saved`) — vérifié au rendu, pas d'animation temporaire. Le label principal de la ligne affiche le nom composante (`buildComposanteName`) au lieu du `client_text`
- **Détachement** : modification manuelle d'un sous-champ enrichi → bookmark repasse en stroke, `composante_id` supprimé, label revient au `client_text`

**Dropdown composantes** :
- Background transparent, text `rgba(255,255,255,0.6)`, border `0.5px solid rgba(255,255,255,0.15)`
- Options : `background: #0B1220`

**Autocomplete / suggestions (dans le panneau DM)** :
- Background : `#131c2e` (navy plus clair)
- Border : `0.5px solid rgba(255,255,255,0.15)`
- Items : `color: rgba(255,255,255,0.7)`, hover `background: rgba(255,255,255,0.07)` + `color: rgba(255,255,255,0.95)`
- Catégories / secondaire : `rgba(255,255,255,0.35)`
- Scoped via `.room-dm-section .dm-autocomplete` — n'affecte pas les autocomplete hors DM
- `min-width: max-content; white-space: nowrap` — empêche le wrap du texte dans les suggestions

**Overflow** : `.furniture-group` utilise `overflow: visible` (pas `hidden`) pour permettre aux dropdowns et autocomplete du panneau DM de déborder visuellement. `.rdm-enriched` utilise `overflow: visible` quand expanded et `overflow: hidden` quand collapsed — les dropdowns dans les sous-champs enrichis ne sont pas clippés

**Palette des opacités navy** : 0.07 (séparateurs), 0.1 (badges), 0.12 (underlines), 0.15 (bordures/boutons), 0.2 (icônes repos), 0.25 (labels légers/ajout), 0.3 (boutons secondaires), 0.35 (labels type), 0.4 (focus), 0.5 (labels/valeurs), 0.6 (badges/hover), 0.7 (filled/active), 0.85 (texte principal)

---

## 15. Animations

- Durée : 150ms à 200ms
- Easing : ease-out
- Usage : hover bouton, dropdown, modal
- Jamais : animation flashy, transition longue

---

## 16. Règle fondamentale

Si un pattern UI existe déjà dans l'app, le réutiliser à l'identique.
Ne jamais réinventer un composant qui existe.
En cas de doute, chercher d'abord dans le code existant.

Si un élément visuel attire trop l'attention, il est probablement mal conçu.
Scopewright doit rester calme visuellement.

---

## 17. Inspirations

Attio — Référence principale pour l'interface interne : tags compacts, vues multiples, densité d'information sans surcharge, node graph pour visualisation cascades (#124)

Linear, Stripe Dashboard, Notion, Vercel, Airtable, Raycast

Pas : Webflow, Dribbble style, dashboards flashy

---

## 18. Directive CC obligatoire

Avant tout travail UI (nouveaux composants, modifications de style, nouveaux écrans) :
1. Lire ce fichier en entier
2. Identifier le pattern existant le plus proche
3. Réutiliser ce pattern
4. Si aucun pattern n'existe, proposer avant d'implémenter
5. Valider que chaque décision visuelle respecte ce guide
