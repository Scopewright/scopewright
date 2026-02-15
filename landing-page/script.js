/* ═══════════════════════════════════════════════════════════════
   SCOPEWRIGHT LANDING PAGE — JavaScript
   Translation, Magic Button, Waitlist Form
   ═══════════════════════════════════════════════════════════════ */

// ── Configuration ──
const SUPABASE_URL = 'https://rplzbtjfnwahqodrhpny.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xBKuloaTJl5ebWtZvmiHIw_s7Jyyl3t';

// ── State ──
let currentLang = 'fr';
let translationCache = {};

// ── Translations Object ──
const translations = {
    fr: {
        'hero.badge': 'Bientôt disponible',
        'hero.title': 'Le logiciel de gestion<br>conçu par des ébénistes,<br>pour des ébénistes',
        'hero.subtitle': 'Scopewright transforme votre processus de soumission en avantage concurrentiel. Créez des soumissions professionnelles en quelques clics, pas en quelques heures.',
        'hero.cta': 'Rejoindre la liste d\'attente',
        'hero.magic': 'Magie',

        'problem.label': 'Le problème',
        'problem.title': 'Les soumissions vous ralentissent.<br>Elles ne devraient pas.',
        'problem.time.title': 'Des heures perdues',
        'problem.time.desc': 'Vous passez plus de temps à créer des soumissions qu\'à construire. Entre Excel, Word et vos notes papier, chaque projet devient un casse-tête administratif.',
        'problem.profit.title': 'Profits incertains',
        'problem.profit.desc': 'Sans vue d\'ensemble sur vos coûts réels (temps + matériaux), vous laissez de l\'argent sur la table ou vous sous-évaluez vos projets.',
        'problem.trust.title': 'Perception amateur',
        'problem.trust.desc': 'Des PDF génériques et des estimés brouillons ne reflètent pas la qualité de votre travail. Vos clients méritent mieux.',

        'value.label': 'La solution',
        'value.title': 'Soumissions professionnelles.<br>En quelques clics.',
        'value.calculator.title': 'Calculateur intelligent',
        'value.calculator.desc': 'Catalogue de prix intégré avec temps de fabrication et coûts matériaux. Le système calcule automatiquement vos marges réelles.',
        'value.visual.title': 'Présentations visuelles',
        'value.visual.desc': 'Ajoutez photos, plans et rendus. Créez des soumissions qui vendent votre vision, pas juste des chiffres.',
        'value.workflow.title': 'Workflow complet',
        'value.workflow.desc': 'De l\'estimé initial à la facture finale. Approbations internes, révisions client, versions — tout est centralisé.',
        'value.client.title': 'Portail client',
        'value.client.desc': 'Vos clients consultent et approuvent leurs soumissions en ligne. Plus besoin d\'envoyer 10 emails avec des pièces jointes.',

        'infra.label': 'Infrastructure',
        'infra.title': 'Construit sur du solide',
        'infra.intro': 'Pas de gadgets. Pas de fonctionnalités superflues. Juste les outils dont vous avez besoin, bâtis avec la même rigueur que vous mettez dans vos projets.',
        'infra.supabase': 'Base de données PostgreSQL sécurisée',
        'infra.realtime': 'Synchronisation instantanée',
        'infra.security': 'Chiffrement de bout en bout',
        'infra.performance': 'CDN global, chargement instantané',

        'comparison.label': 'Avant / Après',
        'comparison.title': 'La différence Scopewright',
        'comparison.before': 'Avant',
        'comparison.after': 'Avec Scopewright',
        'comparison.time.label': 'Temps par soumission',
        'comparison.tools.label': 'Outils nécessaires',
        'comparison.tools.after': 'Un seul endroit',
        'comparison.revisions.label': 'Gestion des révisions',
        'comparison.revisions.before': 'Manuelle, chaotique',
        'comparison.revisions.after': 'Automatique, versionnée',
        'comparison.margins.label': 'Visibilité sur les marges',
        'comparison.margins.before': 'Approximative',
        'comparison.margins.after': 'Précise au dollar près',
        'comparison.presentation.label': 'Présentation client',
        'comparison.presentation.after': 'Portail web interactif',

        'waitlist.title': 'Rejoignez les pionniers',
        'waitlist.desc': 'Scopewright est actuellement en développement actif avec des ébénistes québécois. Inscrivez-vous pour un accès anticipé et aidez à façonner l\'outil parfait pour votre métier.',
        'waitlist.form.name': 'Votre nom *',
        'waitlist.form.email': 'Votre courriel *',
        'waitlist.form.company': 'Nom de votre entreprise',
        'waitlist.form.message': 'Parlez-nous de vos besoins (optionnel)',
        'waitlist.form.submit': 'Rejoindre la liste d\'attente',

        'footer.tagline': 'Conçu à Montréal par des ébénistes, pour des ébénistes.',

        'magic.title': 'Magie de traduction AI',
        'magic.desc': 'Vous regardez une vraie démo de traduction par intelligence artificielle. Chaque texte de cette page a été traduit en temps réel par Claude, l\'assistant AI qui alimente Scopewright.',
        'magic.demo.label': 'Essayez :',
        'magic.demo.placeholder': 'Tapez quelque chose en français...',
        'magic.demo.button': 'Traduire en anglais',
        'magic.note': 'Cette même technologie traduit automatiquement vos soumissions pour vos clients anglophones.'
    }
};

// ── Translation Engine ──

// Call Supabase Edge Function for AI translation
async function callEdgeFunction(texts, action) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/translate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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

// Extract all French texts to translate
function extractTextsToTranslate() {
    const elements = getTranslatableElements();
    const textsMap = {};

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-placeholder');
        if (key) {
            const frText = translations.fr[key];
            if (frText && !textsMap[key]) {
                textsMap[key] = frText;
            }
        }
    });

    return textsMap;
}

// Apply translations to page
function applyTranslations(translationsMap, lang) {
    const elements = getTranslatableElements();

    elements.forEach(el => {
        const contentKey = el.getAttribute('data-i18n');
        const placeholderKey = el.getAttribute('data-i18n-placeholder');

        if (contentKey) {
            const text = lang === 'fr' ? translations.fr[contentKey] : translationsMap[contentKey];
            if (text) {
                el.innerHTML = text;
            }
        }

        if (placeholderKey) {
            const text = lang === 'fr' ? translations.fr[placeholderKey] : translationsMap[placeholderKey];
            if (text) {
                el.placeholder = text;
            }
        }
    });
}

// Toggle language
async function toggleLanguage() {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';

    // Update UI
    document.getElementById('langActive').textContent = newLang.toUpperCase();
    document.getElementById('langInactive').textContent = currentLang.toUpperCase();

    if (newLang === 'fr') {
        // Switch back to French (no API call needed)
        applyTranslations({}, 'fr');
        currentLang = 'fr';
        return;
    }

    // Check cache
    if (translationCache.en) {
        applyTranslations(translationCache.en, 'en');
        currentLang = 'en';
        return;
    }

    // Translate to English
    try {
        const textsToTranslate = extractTextsToTranslate();
        const textsArray = Object.values(textsToTranslate);
        const keysArray = Object.keys(textsToTranslate);

        // Call Edge Function
        const translatedTexts = await callEdgeFunction(textsArray, 'fr_to_en');

        // Map results back to keys
        const translationsMap = {};
        keysArray.forEach((key, index) => {
            const originalText = textsArray[index];
            translationsMap[key] = translatedTexts[originalText] || originalText;
        });

        // Cache and apply
        translationCache.en = translationsMap;
        applyTranslations(translationsMap, 'en');
        currentLang = 'en';

    } catch (error) {
        console.error('Translation error:', error);
        alert('Translation failed. Please try again.');
    }
}

// ── Magic Button & Overlay ──

function openMagicOverlay() {
    document.getElementById('magicOverlay').classList.add('active');
}

function closeMagicOverlay() {
    document.getElementById('magicOverlay').classList.remove('active');
}

async function translateMagicDemo() {
    const input = document.getElementById('magicInput');
    const result = document.getElementById('magicResult');
    const button = document.getElementById('magicTranslate');
    const text = input.value.trim();

    if (!text) {
        alert('Veuillez entrer du texte à traduire.');
        return;
    }

    // Show loading
    result.classList.add('visible', 'loading');
    result.textContent = 'Traduction en cours...';
    button.disabled = true;

    try {
        const translations = await callEdgeFunction([text], 'fr_to_en');
        const translated = translations[text] || text;

        // Show result
        result.classList.remove('loading');
        result.textContent = translated;

    } catch (error) {
        console.error('Translation error:', error);
        result.classList.remove('loading');
        result.textContent = 'Erreur de traduction. Veuillez réessayer.';
    } finally {
        button.disabled = false;
    }
}

// ── Waitlist Form ──

async function handleWaitlistSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('formName').value.trim();
    const email = document.getElementById('formEmail').value.trim();
    const company = document.getElementById('formCompany').value.trim();
    const message = document.getElementById('formMessage').value.trim();

    const submitBtn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const feedback = document.getElementById('formFeedback');

    // Validate
    if (!name || !email) {
        showFeedback(feedback, 'Veuillez remplir tous les champs requis.', 'error');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showFeedback(feedback, 'Veuillez entrer une adresse courriel valide.', 'error');
        return;
    }

    // Show loading
    submitBtn.disabled = true;
    submitText.textContent = currentLang === 'fr' ? 'Envoi en cours...' : 'Submitting...';

    try {
        // Save to Supabase (waitlist table)
        const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                name,
                email,
                company,
                message,
                lang: currentLang,
                created_at: new Date().toISOString()
            })
        });

        if (response.ok || response.status === 201) {
            showFeedback(
                feedback,
                currentLang === 'fr'
                    ? '✓ Merci ! Vous êtes maintenant sur la liste d\'attente.'
                    : '✓ Thank you! You\'re now on the waitlist.',
                'success'
            );
            document.getElementById('waitlistForm').reset();
        } else {
            throw new Error('Server error');
        }

    } catch (error) {
        console.error('Waitlist submission error:', error);
        showFeedback(
            feedback,
            currentLang === 'fr'
                ? 'Une erreur est survenue. Veuillez réessayer.'
                : 'An error occurred. Please try again.',
            'error'
        );
    } finally {
        submitBtn.disabled = false;
        submitText.textContent = currentLang === 'fr'
            ? 'Rejoindre la liste d\'attente'
            : 'Join the waitlist';
    }
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
    document.getElementById('magicOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'magicOverlay') closeMagicOverlay();
    });

    // Magic demo translate
    document.getElementById('magicTranslate').addEventListener('click', translateMagicDemo);
    document.getElementById('magicInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') translateMagicDemo();
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

// ── Scroll animations (optional enhancement) ──
window.addEventListener('scroll', () => {
    const nav = document.querySelector('.nav');
    if (window.scrollY > 20) {
        nav.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.08)';
    } else {
        nav.style.boxShadow = 'none';
    }
});
