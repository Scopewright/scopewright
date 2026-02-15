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
        'nav.howitworks': 'How it works',
        'nav.contact': 'Contact',
        'nav.login': 'Log in',
        'nav.cta': 'Join the private beta',

        'hero.title': 'Stop estimating like it\'s 2005.',
        'hero.subtitle': 'Turn 8 hours into 3. Fewer mistakes. Less friction.',
        'hero.small': 'Estimation infrastructure built specifically for high-end cabinetry and millwork shops.',
        'hero.cta': 'Join the private beta',
        'hero.magic': 'AI Magic Button',
        'hero.helper': 'Early access is limited to selected professional shops.',

        'problem.title': 'Estimating is your hidden bottleneck.',
        'problem.card1.title': 'Time drain',
        'problem.card1.desc': '4 to 8 hours per complex quote.',
        'problem.card2.title': 'Invisible errors',
        'problem.card2.desc': 'Missed hardware. Scope gaps. Margin miscalculations.',
        'problem.card3.title': 'Growth blocked',
        'problem.card3.desc': 'More projects should not mean more chaos.',

        'value.title': 'Structure. Clarity. Control.',
        'value.body1': 'Built on 20 years of architectural millwork experience.',
        'value.body2': 'Designed for serious cabinetry and millwork shops, whether you are scaling or established.',

        'steps.title': 'From raw plans to signed contract.',
        'steps.1.title': 'Upload the plans',
        'steps.1.desc': 'Upload your architectural drawings. Large sets welcome.',
        'steps.2.title': 'Capture and analyze',
        'steps.2.desc': 'Capture sections room by room. The system reads dimensions and specifications.',
        'steps.3.title': 'Build with AI assistance',
        'steps.3.desc': 'Create your estimate in conversation. Suggestions appear in real time.',
        'steps.4.title': 'Validate margins',
        'steps.4.desc': 'Review profitability before sending.',
        'steps.5.title': 'Present professionally',
        'steps.5.desc': 'Send a clean interactive proposal. Track engagement.',
        'steps.6.title': 'Sign and lock',
        'steps.6.desc': 'Client signs online. Done. Traceable.',

        'comparison.before': 'Traditional workflow',
        'comparison.after': 'With Scopewright',
        'comparison.before.1': '8 hours per estimate',
        'comparison.before.2': 'Fragile spreadsheets',
        'comparison.before.3': 'Margins discovered too late',
        'comparison.before.4': 'Manual process',
        'comparison.after.1': '3 hours average',
        'comparison.after.2': 'Structured pricing system',
        'comparison.after.3': 'Real-time margin visibility',
        'comparison.after.4': 'AI-assisted estimation',

        'ai.title': 'AI that assists. Not replaces.',
        'ai.line1': 'There is no one-click automatic estimating.',
        'ai.line2': 'Scopewright supports your judgment.',
        'ai.line3': 'It removes repetition. It reduces friction.',
        'ai.line4': 'Real leverage. Not magic.',

        'waitlist.title': 'We are building the first production version.',
        'waitlist.body': 'We are selecting a limited number of serious shops for early access.',
        'form.email': 'Email',
        'form.shop': 'Shop name (optional)',
        'form.submit': 'Request early access',
        'form.success': 'You\'re on the list. We\'ll reach out when early access spots open.',

        'footer.tagline': 'Estimation infrastructure for premium cabinetry and millwork shops.',
        'footer.privacy': 'Privacy',
        'footer.contact': 'Contact',

        'magic.title': 'AI that assists. Not replaces.',
        'magic.line1': 'There is no one-click automatic estimating.',
        'magic.line2': 'Scopewright supports your judgment.',
        'magic.line3': 'It removes repetition. It reduces friction.',
        'magic.line4': 'Real leverage. Not magic.',
        'magic.back': 'Back to reality',
        'magic.show': 'Show me how it really works'
    },
    fr: {
        'nav.features': 'Fonctionnalit\u00e9s',
        'nav.howitworks': 'Comment \u00e7a fonctionne',
        'nav.contact': 'Contact',
        'nav.login': 'Connexion',
        'nav.cta': 'Rejoindre la b\u00eata priv\u00e9e',

        'hero.title': 'Arr\u00eatez d\'estimer comme en 2005.',
        'hero.subtitle': '8 heures r\u00e9duites \u00e0 3. Moins d\'erreurs. Moins de friction.',
        'hero.small': 'Infrastructure d\'estimation con\u00e7ue sp\u00e9cifiquement pour les ateliers d\'\u00e9b\u00e9nisterie et de menuiserie haut de gamme.',
        'hero.cta': 'Rejoindre la b\u00eata priv\u00e9e',
        'hero.magic': 'Bouton magique IA',
        'hero.helper': 'L\'acc\u00e8s anticip\u00e9 est limit\u00e9 aux ateliers professionnels s\u00e9lectionn\u00e9s.',

        'problem.title': 'L\'estimation est votre goulot d\'\u00e9tranglement cach\u00e9.',
        'problem.card1.title': 'Perte de temps',
        'problem.card1.desc': '4 \u00e0 8 heures par soumission complexe.',
        'problem.card2.title': 'Erreurs invisibles',
        'problem.card2.desc': 'Quincaillerie oubli\u00e9e. Lacunes dans la port\u00e9e. Erreurs de marge.',
        'problem.card3.title': 'Croissance bloqu\u00e9e',
        'problem.card3.desc': 'Plus de projets ne devrait pas signifier plus de chaos.',

        'value.title': 'Structure. Clart\u00e9. Contr\u00f4le.',
        'value.body1': 'B\u00e2ti sur 20 ans d\'exp\u00e9rience en menuiserie architecturale.',
        'value.body2': 'Con\u00e7u pour les ateliers d\'\u00e9b\u00e9nisterie et de menuiserie s\u00e9rieux, que vous soyez en croissance ou \u00e9tablis.',

        'steps.title': 'Des plans bruts au contrat sign\u00e9.',
        'steps.1.title': 'T\u00e9l\u00e9verser les plans',
        'steps.1.desc': 'T\u00e9l\u00e9versez vos dessins architecturaux. Les grands ensembles sont les bienvenus.',
        'steps.2.title': 'Capturer et analyser',
        'steps.2.desc': 'Capturez les sections pi\u00e8ce par pi\u00e8ce. Le syst\u00e8me lit les dimensions et les sp\u00e9cifications.',
        'steps.3.title': 'Construire avec l\'IA',
        'steps.3.desc': 'Cr\u00e9ez votre estimation en conversation. Les suggestions apparaissent en temps r\u00e9el.',
        'steps.4.title': 'Valider les marges',
        'steps.4.desc': 'R\u00e9visez la rentabilit\u00e9 avant l\'envoi.',
        'steps.5.title': 'Pr\u00e9senter professionnellement',
        'steps.5.desc': 'Envoyez une proposition interactive et soign\u00e9e. Suivez l\'engagement.',
        'steps.6.title': 'Signer et verrouiller',
        'steps.6.desc': 'Le client signe en ligne. Termin\u00e9. Tra\u00e7able.',

        'comparison.before': 'Flux de travail traditionnel',
        'comparison.after': 'Avec Scopewright',
        'comparison.before.1': '8 heures par estimation',
        'comparison.before.2': 'Feuilles Excel fragiles',
        'comparison.before.3': 'Marges d\u00e9couvertes trop tard',
        'comparison.before.4': 'Processus manuel',
        'comparison.after.1': '3 heures en moyenne',
        'comparison.after.2': 'Syst\u00e8me de prix structur\u00e9',
        'comparison.after.3': 'Visibilit\u00e9 des marges en temps r\u00e9el',
        'comparison.after.4': 'Estimation assist\u00e9e par IA',

        'ai.title': 'L\'IA qui assiste. Pas qui remplace.',
        'ai.line1': 'Il n\'y a pas d\'estimation automatique en un clic.',
        'ai.line2': 'Scopewright soutient votre jugement.',
        'ai.line3': '\u00c7a \u00e9limine la r\u00e9p\u00e9tition. \u00c7a r\u00e9duit la friction.',
        'ai.line4': 'Un vrai levier. Pas de la magie.',

        'waitlist.title': 'Nous construisons la premi\u00e8re version de production.',
        'waitlist.body': 'Nous s\u00e9lectionnons un nombre limit\u00e9 d\'ateliers s\u00e9rieux pour un acc\u00e8s anticip\u00e9.',
        'form.email': 'Courriel',
        'form.shop': 'Nom de l\'atelier (optionnel)',
        'form.submit': 'Demander l\'acc\u00e8s anticip\u00e9',
        'form.success': 'Vous \u00eates sur la liste. Nous vous contacterons lorsque des places seront disponibles.',

        'footer.tagline': 'Infrastructure d\'estimation pour ateliers d\'\u00e9b\u00e9nisterie et de menuiserie haut de gamme.',
        'footer.privacy': 'Confidentialit\u00e9',
        'footer.contact': 'Contact',

        'magic.title': 'L\'IA qui assiste. Pas qui remplace.',
        'magic.line1': 'Il n\'y a pas d\'estimation automatique en un clic.',
        'magic.line2': 'Scopewright soutient votre jugement.',
        'magic.line3': '\u00c7a \u00e9limine la r\u00e9p\u00e9tition. \u00c7a r\u00e9duit la friction.',
        'magic.line4': 'Un vrai levier. Pas de la magie.',
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
    document.getElementById('howitworks').scrollIntoView({ behavior: 'smooth' });
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
