/* ═══════════════════════════════════════════════════════════════
   SCOPEWRIGHT LANDING PAGE — JavaScript
   Translation, Magic Button, Waitlist Form (Frontend Only)
   ═══════════════════════════════════════════════════════════════ */

// ── Configuration ──
const SUPABASE_URL = 'https://rplzbtjfnwahqodrhpny.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbHpidGpmbndhaHFvZHJocG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDU2MDEsImV4cCI6MjA4NjIyMTYwMX0.OQAZhc029PbRDSe1b02NDAuOUE8yn-_h3QqSnUDpLeU';

// ── State ──
let currentLang = 'en';
let translationCache = {};

// ── Translations Object ──
const translations = {
    en: {
        'nav.features': 'Features',
        'nav.why': 'Why now',
        'nav.contact': 'Contact',
        'nav.login': 'Log in',
        'nav.cta': 'Join the private list',

        'hero.title': 'Stop estimating like it\'s 2005.',
        'hero.subtitle': 'Scopewright cuts an 8-hour estimate down to 3. No errors. No missed items. No friction.',
        'hero.small': 'The first intelligent estimation platform built exclusively for high-end cabinetry and millwork shops.',
        'hero.cta': 'Join the private list',
        'hero.magic': 'AI Magic Button',
        'hero.helper': 'Private beta access is limited to a small number of selected shops.',

        'problem.title': 'Estimation is your invisible bottleneck.',
        'problem.card1.title': 'Time drain',
        'problem.card1.desc': '4\u20138 hours per complex bid.',
        'problem.card2.title': 'Invisible errors',
        'problem.card2.desc': 'Missed hardware, inconsistent scope, margin mistakes.',
        'problem.card3.title': 'Growth blocked',
        'problem.card3.desc': 'More projects = more chaos.',

        'value.title': 'Structure. Clarity. Control.',
        'value.body': 'Scopewright is built from 20 years of real-world architectural millwork experience. It\'s not generic software built by outsiders. It\'s an estimation system designed for shops doing $5\u201315M in revenue.',

        'infra.layer1': 'Intelligence artificielle',
        'infra.layer1.desc': 'Assistant, optimiseur, reviewer',
        'infra.layer2': 'Moteur d\'estimation',
        'infra.layer2.desc': 'Catalogue, calculateur, workflow',
        'infra.layer3': 'Infrastructure',
        'infra.layer3.desc': 'Base de donn\u00e9es, stockage, permissions',

        'comparison.before': 'Before',
        'comparison.after': 'With Scopewright',
        'comparison.before.1': '8 hours',
        'comparison.before.2': 'Fragile spreadsheets',
        'comparison.before.3': 'Margins hidden until it\'s too late',
        'comparison.before.4': 'Manual process',
        'comparison.after.1': '3 hours',
        'comparison.after.2': 'Structured price catalog',
        'comparison.after.3': 'Real-time profitability',
        'comparison.after.4': 'Conversational assistant (private beta)',

        'waitlist.title': 'We\'re building the first release.',
        'waitlist.body': 'We\'re selecting a limited number of shops for early access.',
        'form.email': 'Email',
        'form.shop': 'Shop name (optional)',
        'form.submit': 'Join',
        'form.success': 'You\'re on the list. We\'ll reach out when private beta spots open.',

        'footer.tagline': 'Estimation infrastructure for premium millwork shops.',
        'footer.privacy': 'Privacy',
        'footer.contact': 'Contact',

        'magic.title': 'Looking for the magic button?',
        'magic.line1': 'It doesn\'t exist.',
        'magic.line2': 'Estimating is judgment.',
        'magic.line3': 'AI assists. It doesn\'t replace.',
        'magic.line4': 'Scopewright reduces friction. It doesn\'t remove responsibility.',
        'magic.back': 'Back to reality',
        'magic.show': 'Show me how it really works'
    },
    fr: {
        'nav.features': 'Fonctionnalit\u00e9s',
        'nav.why': 'Pourquoi maintenant',
        'nav.contact': 'Contact',
        'nav.login': 'Connexion',
        'nav.cta': 'Rejoindre la liste priv\u00e9e',

        'hero.title': 'Arr\u00eatez d\'estimer comme en 2005.',
        'hero.subtitle': 'Scopewright r\u00e9duit une estimation de 8 heures \u00e0 3. Z\u00e9ro erreur. Z\u00e9ro oubli. Z\u00e9ro friction.',
        'hero.small': 'La premi\u00e8re plateforme d\'estimation intelligente con\u00e7ue exclusivement pour les ateliers d\'\u00e9b\u00e9nisterie et de menuiserie haut de gamme.',
        'hero.cta': 'Rejoindre la liste priv\u00e9e',
        'hero.magic': 'Bouton magique IA',
        'hero.helper': 'L\'acc\u00e8s \u00e0 la b\u00eata priv\u00e9e est limit\u00e9 \u00e0 un petit nombre d\'ateliers s\u00e9lectionn\u00e9s.',

        'problem.title': 'L\'estimation est votre goulot d\'\u00e9tranglement invisible.',
        'problem.card1.title': 'Perte de temps',
        'problem.card1.desc': '4 \u00e0 8 heures par soumission complexe.',
        'problem.card2.title': 'Erreurs invisibles',
        'problem.card2.desc': 'Quincaillerie oubli\u00e9e, port\u00e9e incoh\u00e9rente, erreurs de marge.',
        'problem.card3.title': 'Croissance bloqu\u00e9e',
        'problem.card3.desc': 'Plus de projets = plus de chaos.',

        'value.title': 'Structure. Clart\u00e9. Contr\u00f4le.',
        'value.body': 'Scopewright est b\u00e2ti sur 20 ans d\'exp\u00e9rience terrain en menuiserie architecturale. Ce n\'est pas un logiciel g\u00e9n\u00e9rique cr\u00e9\u00e9 par des gens de l\'ext\u00e9rieur. C\'est un syst\u00e8me d\'estimation con\u00e7u pour les ateliers de 5 \u00e0 15\u00a0M$ de revenus.',

        'infra.layer1': 'Intelligence artificielle',
        'infra.layer1.desc': 'Assistant, optimiseur, r\u00e9viseur',
        'infra.layer2': 'Moteur d\'estimation',
        'infra.layer2.desc': 'Catalogue, calculateur, workflow',
        'infra.layer3': 'Infrastructure',
        'infra.layer3.desc': 'Base de donn\u00e9es, stockage, permissions',

        'comparison.before': 'Avant',
        'comparison.after': 'Avec Scopewright',
        'comparison.before.1': '8 heures',
        'comparison.before.2': 'Feuilles Excel fragiles',
        'comparison.before.3': 'Marges cach\u00e9es jusqu\'\u00e0 ce qu\'il soit trop tard',
        'comparison.before.4': 'Processus manuel',
        'comparison.after.1': '3 heures',
        'comparison.after.2': 'Catalogue de prix structur\u00e9',
        'comparison.after.3': 'Rentabilit\u00e9 en temps r\u00e9el',
        'comparison.after.4': 'Assistant conversationnel (b\u00eata priv\u00e9e)',

        'waitlist.title': 'Nous construisons la premi\u00e8re version.',
        'waitlist.body': 'Nous s\u00e9lectionnons un nombre limit\u00e9 d\'ateliers pour un acc\u00e8s anticip\u00e9.',
        'form.email': 'Courriel',
        'form.shop': 'Nom de l\'atelier (optionnel)',
        'form.submit': 'Rejoindre',
        'form.success': 'Vous \u00eates sur la liste. Nous vous contacterons lorsque des places seront disponibles.',

        'footer.tagline': 'Infrastructure d\'estimation pour ateliers de menuiserie haut de gamme.',
        'footer.privacy': 'Confidentialit\u00e9',
        'footer.contact': 'Contact',

        'magic.title': 'Vous cherchez le bouton magique?',
        'magic.line1': 'Il n\'existe pas.',
        'magic.line2': 'Estimer, c\'est un jugement.',
        'magic.line3': 'L\'IA assiste. Elle ne remplace pas.',
        'magic.line4': 'Scopewright r\u00e9duit la friction. Il n\'\u00e9limine pas la responsabilit\u00e9.',
        'magic.back': 'Retour \u00e0 la r\u00e9alit\u00e9',
        'magic.show': 'Montrez-moi comment \u00e7a fonctionne vraiment'
    }
};

// ── Translation Engine ──

// Call Supabase Edge Function for AI translation
async function callEdgeFunction(texts, action) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ texts, action })
    });

    if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.translations;
}

// Get all translatable elements
function getTranslatableElements() {
    return document.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
}

// Extract all English texts to translate to French
function extractTextsToTranslate() {
    const textsMap = {};
    const elements = getTranslatableElements();

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-placeholder');
        if (key) {
            const enText = translations.en[key];
            if (enText && !textsMap[key]) {
                textsMap[key] = enText;
            }
        }
    });

    return textsMap;
}

// Apply translations to page
function applyTranslations(langMap) {
    const elements = getTranslatableElements();

    elements.forEach(el => {
        const contentKey = el.getAttribute('data-i18n');
        const placeholderKey = el.getAttribute('data-i18n-placeholder');

        if (contentKey && langMap[contentKey]) {
            el.textContent = langMap[contentKey];
        }

        if (placeholderKey && langMap[placeholderKey]) {
            el.placeholder = langMap[placeholderKey];
        }
    });
}

// Toggle language
function toggleLanguage() {
    const newLang = currentLang === 'en' ? 'fr' : 'en';

    // Update UI
    document.getElementById('langActive').textContent = newLang.toUpperCase();
    document.getElementById('langInactive').textContent = currentLang.toUpperCase();

    applyTranslations(translations[newLang], newLang);
    currentLang = newLang;
}

// ── Magic Button & Overlay ──

function openMagicOverlay() {
    document.getElementById('magicOverlay').classList.add('active');
}

function closeMagicOverlay() {
    document.getElementById('magicOverlay').classList.remove('active');
}

function showHowItWorks() {
    closeMagicOverlay();
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

// ── Waitlist Form (Frontend Only) ──

async function handleWaitlistSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('formEmail').value.trim();
    const shop = document.getElementById('formShop').value.trim();
    const revenue = document.getElementById('formRevenue').value;
    const tool = document.getElementById('formTool').value;

    const feedback = document.getElementById('formFeedback');

    // Validate
    if (!email) {
        showFeedback(feedback, 'Please enter your email.', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showFeedback(feedback, 'Please enter a valid email.', 'error');
        return;
    }

    // Simulate submission (frontend only)
    console.log('Waitlist submission (frontend only):', {
        email,
        shop,
        revenue,
        tool,
        timestamp: new Date().toISOString()
    });

    // Show success message
    const successMsg = currentLang === 'en'
        ? translations.en['form.success']
        : 'Vous êtes sur la liste. Nous vous contacterons quand des places seront disponibles.';

    showFeedback(feedback, '✓ ' + successMsg, 'success');

    // Reset form
    document.getElementById('waitlistForm').reset();
}

function showFeedback(element, message, type) {
    element.textContent = message;
    element.className = `form-feedback visible ${type}`;
    setTimeout(() => {
        element.classList.remove('visible');
    }, 5000);
}

// ── Event Listeners ──

document.addEventListener('DOMContentLoaded', () => {
    // Language toggle
    document.getElementById('langToggle').addEventListener('click', toggleLanguage);

    // Magic button
    document.getElementById('magicBtn').addEventListener('click', openMagicOverlay);
    document.getElementById('magicClose').addEventListener('click', closeMagicOverlay);
    document.getElementById('magicBack').addEventListener('click', closeMagicOverlay);
    document.getElementById('magicShow').addEventListener('click', showHowItWorks);

    // Close overlay on outside click
    document.getElementById('magicOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'magicOverlay') closeMagicOverlay();
    });

    // Waitlist form
    document.getElementById('waitlistForm').addEventListener('submit', handleWaitlistSubmit);

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});
