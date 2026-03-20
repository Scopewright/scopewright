/**
 * shared/coupe.js — Coupe de placage : détection essence, facteurs par type
 *
 * Fonctions exportées (window.*) :
 *   _detectEssence(clientText) → string|null
 *   getCoupeFacteur(coupeLabel, articleClientText) → number
 *   _isPlacageCategory(catName) → boolean
 *   _getCoupeFacteurForRow(row, articleClientText) → number
 *   _applyCoupeFactor(materialCosts, coupeFactor) → object
 *
 * Globals requises :
 *   COUPE_TYPES — array (loaded from app_config.coupe_types)
 *   roomDM — object (room-level default materials, from calculateur.html)
 *
 * Utilisé par : calculateur.html (getRowTotal, updateRow, computeRentabilityData)
 */

/** Detect wood species from article client_text (#219) */
function _detectEssence(clientText) {
    if (!clientText) return null;
    var text = clientText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var map = [
        { code: 'chene_blanc',  keywords: ['chene blanc', 'white oak'] },
        { code: 'chene_rouge',  keywords: ['chene rouge', 'red oak'] },
        { code: 'noyer',        keywords: ['noyer', 'walnut'] },
        { code: 'erable',       keywords: ['erable', 'maple'] },
        { code: 'merisier',     keywords: ['merisier', 'yellow birch'] },
        { code: 'frene',        keywords: ['frene', 'ash'] },
        { code: 'cerisier',     keywords: ['cerisier', 'cherry'] },
        { code: 'pin_noueux',   keywords: ['pin noueux', 'knotty pine'] },
        { code: 'acajou',       keywords: ['acajou', 'mahogany'] }
    ];
    for (var i = 0; i < map.length; i++) {
        for (var j = 0; j < map[i].keywords.length; j++) {
            if (text.indexOf(map[i].keywords[j]) !== -1) return map[i].code;
        }
    }
    return null;
}

/** Get coupe factor — per-essence if available, else facteur_defaut, else facteur (#219) */
function getCoupeFacteur(coupeLabel, articleClientText) {
    if (!coupeLabel || !COUPE_TYPES || !COUPE_TYPES.length) return 1.0;
    var found = COUPE_TYPES.find(function(c) { return c.label === coupeLabel; });
    if (!found) return 1.0;
    var essence = _detectEssence(articleClientText);
    if (essence && found.facteurs && found.facteurs[essence] != null) {
        return found.facteurs[essence];
    }
    return found.facteur_defaut || found.facteur || 1.0;
}

/** Check if a material cost category is placage/panneau-related (coupe factor applies) */
function _isPlacageCategory(catName) {
    if (!catName) return false;
    var lower = catName.toLowerCase();
    // Exclude bande de chant, finition, bois brut
    if (lower.indexOf('bande') !== -1 || lower.indexOf('brut') !== -1 || lower.indexOf('finition') !== -1) return false;
    return lower.indexOf('placage') !== -1 || lower.indexOf('panneau') !== -1;
}

/** Get the coupe factor for a row from its room's DM entries */
function _getCoupeFacteurForRow(row, articleClientText) {
    var group = row ? row.closest('.furniture-group') : null;
    if (!group) return 1.0;
    var dm = roomDM[group.id];
    if (!dm || !dm.length) return 1.0;
    for (var i = 0; i < dm.length; i++) {
        if (dm[i].coupe) return getCoupeFacteur(dm[i].coupe, articleClientText);
    }
    return 1.0;
}

/** Apply coupe factor to a material_costs object (modifies in place) */
function _applyCoupeFactor(materialCosts, coupeFactor) {
    if (!materialCosts || coupeFactor === 1.0) return materialCosts;
    Object.keys(materialCosts).forEach(function(cat) {
        if (_isPlacageCategory(cat)) {
            var v = materialCosts[cat];
            if (typeof v === 'number') {
                materialCosts[cat] = Math.round(v * coupeFactor * 100) / 100;
            } else if (v && v.cost != null) {
                materialCosts[cat] = Object.assign({}, v, { cost: Math.round(v.cost * coupeFactor * 100) / 100 });
            }
        }
    });
    return materialCosts;
}
