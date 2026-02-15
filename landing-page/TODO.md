# Landing Page Scopewright — Checklist de déploiement

## ✅ Complété

- [x] Structure HTML complète (index.html)
- [x] Design CSS moderne avec animations (style.css)
- [x] JavaScript avec traduction FR/EN (script.js)
- [x] Documentation README
- [x] Script SQL pour table waitlist
- [x] Fichiers poussés sur GitHub

## 📋 À faire (par Hubert)

### 1. Setup Supabase Database

#### Créer la table `waitlist`

1. Ouvrir [Supabase SQL Editor](https://supabase.com/dashboard/project/rplzbtjfnwahqodrhpny/sql)
2. Cliquer sur "New query"
3. Copier tout le contenu de `landing-page/setup.sql`
4. Coller dans l'éditeur
5. Cliquer "Run" (ou Ctrl+Enter)
6. Vérifier que la table apparaît dans "Table Editor"

#### Vérifier les permissions

La table devrait avoir ces policies RLS :
- ✓ `Allow public insert on waitlist` (anon peut INSERT)
- ✓ `Admin can read waitlist` (admins peuvent SELECT)

### 2. Tester localement

#### Ouvrir la page localement

```bash
cd "C:\Users\Hubert\Desktop\VENTE STELE\AI TEST\landing-page"
# Option 1: Ouvrir index.html directement dans un navigateur
# Option 2: Utiliser un serveur local
python -m http.server 8000
# Puis ouvrir http://localhost:8000
```

#### Tests à faire

- [ ] Navigation entre sections (scroll smooth)
- [ ] Toggle FR/EN fonctionne
- [ ] Bouton "Magie" ✨ ouvre l'overlay
- [ ] Demo de traduction dans l'overlay
- [ ] Formulaire waitlist se soumet (vérifier dans Supabase)
- [ ] Responsive sur mobile (DevTools)

### 3. Déploiement Netlify

La landing page devrait déjà être déployée automatiquement via Netlify puisque :
- Le repo GitHub est connecté à Netlify
- Auto-deploy depuis la branche `main`
- Les fichiers `landing-page/*` sont maintenant dans le repo

#### Vérifier le déploiement

1. Aller sur [Netlify Dashboard](https://app.netlify.com)
2. Trouver le site Scopewright
3. Vérifier que le dernier déploiement inclut le dossier `landing-page/`

#### Configurer la route

Si la landing page doit être accessible à une URL spécifique :

**Option A** : Racine du site
- Déplacer `landing-page/index.html` → `landing.html` (à la racine)
- Configurer Netlify pour servir `landing.html` comme page d'accueil

**Option B** : Sous-dossier
- Laisser tel quel
- Accéder via `https://votre-site.netlify.app/landing-page/`

**Option C** : Domaine séparé
- Configurer un nouveau site Netlify pointant vers `/landing-page`
- Lier un domaine custom (ex: `scopewright.com`)

### 4. SEO & Metadata

Ajouter dans `<head>` de `index.html` :

```html
<!-- Open Graph -->
<meta property="og:title" content="Scopewright — Logiciel de gestion pour ébénistes">
<meta property="og:description" content="Le seul logiciel de gestion conçu par des ébénistes, pour des ébénistes.">
<meta property="og:image" content="https://votre-site.com/og-image.png">
<meta property="og:url" content="https://scopewright.com">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Scopewright — Logiciel de gestion pour ébénistes">
<meta name="twitter:description" content="Transformez votre processus de soumission en avantage concurrentiel.">
<meta name="twitter:image" content="https://votre-site.com/twitter-image.png">

<!-- Favicon -->
<link rel="icon" type="image/png" href="/favicon.png">
```

### 5. Analytics (optionnel)

Ajouter un tracker analytics avant `</body>` :

**Option Plausible (privacy-friendly)** :
```html
<script defer data-domain="scopewright.com" src="https://plausible.io/js/script.js"></script>
```

**Option Google Analytics** :
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 6. Consulter la waitlist

Pour voir les inscriptions dans l'admin panel :

1. Ajouter une section dans `admin.html`
2. Fetcher les données :

```javascript
const response = await authenticatedFetch(
    SUPABASE_URL + '/rest/v1/waitlist?select=*&order=created_at.desc',
    {}
);
const waitlist = await response.json();
// Afficher dans un tableau
```

## 🎯 Prochaines fonctionnalités

- [ ] Ajouter des images/screenshots de l'app
- [ ] Section témoignages (quotes d'ébénistes beta)
- [ ] FAQ section
- [ ] Pricing (si applicable)
- [ ] Blog/changelog
- [ ] Email automation (Mailchimp/SendGrid) pour nurture

## 📊 Performance

Après déploiement, tester avec :
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) (Chrome DevTools)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [GTmetrix](https://gtmetrix.com/)

**Objectifs** :
- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 90+

---

**Questions ou problèmes ?** Revenir vers Claude avec les détails.
