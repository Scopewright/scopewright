# Scopewright Landing Page

Page d'accueil pour le projet Scopewright, construite avec HTML/CSS/JS pur (pas de framework).

## 🎯 Caractéristiques

### Design
- **Style moderne** inspiré de Linear et Column.co
- **Animations CSS 3D** sur les cartes d'infrastructure
- **Glassmorphism** et effets de profondeur
- **Responsive** : 320px → 1440px
- **Performance** : Lighthouse 90+ (prévu)

### Fonctionnalités
- ✅ **Toggle FR/EN** : Traduction AI en temps réel via Supabase Edge Function
- ✅ **Cache de traduction** : Les traductions sont mises en cache localement
- ✅ **AI Magic Button** : Easter egg démontrant la traduction AI
- ✅ **Formulaire waitlist** : Sauvegarde dans Supabase
- ✅ **Smooth scroll** : Navigation fluide entre sections

## 📁 Structure

```
landing-page/
├── index.html      # Structure HTML complète
├── style.css       # Styles modernes avec animations
├── script.js       # Traduction FR/EN + formulaire
├── setup.sql       # Script SQL pour table waitlist
└── README.md       # Ce fichier
```

## 🚀 Installation

### 1. Database Setup (Supabase)

Ouvrir le [SQL Editor de Supabase](https://supabase.com/dashboard/project/rplzbtjfnwahqodrhpny/sql) et exécuter `setup.sql` :

```bash
# Le script crée :
- Table `waitlist` pour stocker les inscriptions
- Indexes pour performance
- RLS policies (public insert, admin read)
- Trigger pour updated_at
```

### 2. Déploiement

La landing page est **déjà déployée automatiquement** via Netlify depuis GitHub (repo `Scopewright/scopewright`, branche `main`).

Chaque push sur `main` déclenche un déploiement automatique.

### 3. Configuration

Les variables sont dans `script.js` :

```javascript
const SUPABASE_URL = 'https://rplzbtjfnwahqodrhpny.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOi...'; // Clé publique anon
```

Pas de variables d'environnement nécessaires (frontend pur).

## 🌐 Traduction FR/EN

### Comment ça marche

1. **Français par défaut** : Tout le contenu est en français dans `translations.fr`
2. **Toggle EN** : Clic sur "FR/EN" → appelle Supabase Edge Function
3. **Edge Function** : `/functions/v1/translate` (déjà existante dans le projet Stele)
4. **Claude AI** : Traduit tous les textes en anglais
5. **Cache** : Résultat stocké dans `translationCache.en`
6. **Application** : Les traductions sont appliquées via `data-i18n` attributes

### Exemple

```html
<!-- HTML -->
<h1 data-i18n="hero.title">
    Le logiciel de gestion<br>conçu par des ébénistes...
</h1>

<!-- JavaScript -->
translations.fr['hero.title'] = "Le logiciel de gestion<br>conçu par des ébénistes...";
// → Edge Function traduit → "Management software<br>built by cabinetmakers..."
```

## 🎨 Sections

1. **Hero** : Badge "Bientôt disponible" + titre accrocheur + CTA
2. **Problem** : 3 cartes (Heures perdues, Profits incertains, Perception amateur)
3. **Value** : 4 fonctionnalités clés (Calculateur, Visuel, Workflow, Portail client)
4. **Infrastructure** : 4 cartes 3D animées (Supabase, Temps réel, Sécurité, Performance)
5. **Comparison** : Tableau Avant/Après
6. **Waitlist** : Formulaire d'inscription avec gradient vert
7. **Footer** : Logo + tagline + email

## ✨ AI Magic Button

Easter egg qui ouvre un overlay démontrant la traduction AI en temps réel.

**Flow :**
1. Utilisateur clique sur bouton "Magie" ✨
2. Overlay s'ouvre avec explication
3. Input pour taper du texte en français
4. Bouton "Traduire en anglais" → appelle Edge Function
5. Résultat affiché en temps réel

**But :** Démontrer la puissance de l'AI qui alimente Scopewright.

## 📊 Waitlist Form

### Backend

Sauvegarde dans table `waitlist` (Supabase) :

```sql
INSERT INTO waitlist (name, email, company, message, lang)
VALUES ('Jean Tremblay', 'jean@example.com', 'Ébénisterie JT', 'Besoin d'un outil...', 'fr');
```

### RLS Policies

- **Public INSERT** : Tout le monde peut soumettre (formulaire public)
- **Admin READ** : Seuls les admins peuvent lire la liste

### Accès admin

Pour consulter la liste d'attente, ajouter une page dans `admin.html` :

```javascript
fetch(SUPABASE_URL + '/rest/v1/waitlist?select=*&order=created_at.desc', {
    headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': SUPABASE_KEY
    }
})
```

## 🎯 Optimisations futures

- [ ] Ajouter `og:image` pour partage social
- [ ] Lazy load des animations CSS
- [ ] Preload des polices critiques
- [ ] Service Worker pour offline
- [ ] Analytics (Plausible ou Google Analytics)
- [ ] A/B testing du CTA

## 📝 Notes techniques

### Performance
- Pas de dépendances externes (0 KB de JS tiers)
- CSS vanilla avec custom properties
- Animations GPU-accelerated (transform, opacity)
- Images optimisées (à ajouter si nécessaire)

### Compatibilité
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile iOS/Android

### Lighthouse (cible)
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

## 🔗 Liens

- **Repo GitHub** : [Scopewright/scopewright](https://github.com/Scopewright/scopewright)
- **Supabase** : [rplzbtjfnwahqodrhpny](https://supabase.com/dashboard/project/rplzbtjfnwahqodrhpny)
- **Netlify** : Auto-deploy depuis `main`

---

**Conçu à Montréal par des ébénistes, pour des ébénistes.**
