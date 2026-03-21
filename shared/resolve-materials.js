/**
 * shared/resolve-materials.js — Résolution matériaux pour le système resolved_materials
 *
 * Fonctions exportées (window.*) :
 *   resolveMaterialsFromComposante(composante, expenseCategories) → { "uuid-cat": "ST-XXXX", ... }
 *   resolveMaterialsFromDmEntry(dmEntry, expenseCategories) → { "uuid-cat": "ST-XXXX", ... }
 *   fillResolvedMaterials(rowId, groupId) → { "uuid-cat": "ST-XXXX", ... }
 *   clearResolvedMaterials(rowId, changedTypes) → void
 *   ENRICHED_DM_FIELD_MAP — mapping expense category → DM sub-field name
 *
 * Globals requises :
 *   COMPOSANTES_DATA — array composantes (from calculateur/catalogue)
 *   COMPOSANTE_TYPES — array types (from composante_types table)
 *   CATALOGUE_DATA — array articles catalogue
 *   roomDM — object { groupId: [dmEntries] }
 *   dmChoiceCache — object { key: value } (cascade choice cache)
 *   expenseCategories — array { id, name, markup, waste, ... }
 *   normalizeDmType(str) — normalize function (from calculateur.html)
 *   _getCategoryDmType(category) — derive DM type from catalogue category
 *   _getEnrichedConfig(typeOrId) — get DM_ENRICHED_GROUPS config
 *   itemMap — { rowId: supabaseUUID }
 *
 * Utilisé par : calculateur.html (executeCascade, recalculateDmCascades)
 */

// ═══════════════════════════════════════════════════════════════
// ENRICHED_DM_FIELD_MAP — source de vérité unique
// Maps expense category names (uppercase) → DM sub-field names
// ═══════════════════════════════════════════════════════════════

var ENRICHED_DM_FIELD_MAP = {
    'BANDE DE CHANT': 'bande_chant',
    'BANDE_DE_CHANT': 'bande_chant',
    'BANDES DE CHANT': 'bande_chant',
    'FINITION': 'finition',
    'FINITION BOIS': 'finition',
    'FINITIONS': 'finition',
    'BOIS BRUT': 'bois_brut',
    'BOIS_BRUT': 'bois_brut',
    'PLACAGE': 'materiau',
    'PANNEAU': 'materiau',
    'PANNEAU BOIS': 'materiau',
    'PANNEAU MÉLAMINE': 'materiau',
    'PANNEAUX': 'materiau',
    'MATERIAU': 'materiau',
    'MATÉRIAU': 'materiau'
};

// ═══════════════════════════════════════════════════════════════
// COMPOSANTE_SUBFIELD_MAP — maps composante DB fields to expense categories
// Used by resolveMaterialsFromComposante to read the right column
// ═══════════════════════════════════════════════════════════════

var COMPOSANTE_SUBFIELD_MAP = {
    // DM sub-field → composante column pair
    'materiau':     { id: 'materiau_catalogue_id',    text: 'materiau_client_text' },
    'style':        { id: 'style_catalogue_id',       text: 'style_client_text' },
    'bande_chant':  { id: 'bande_chant_catalogue_id', text: 'bande_chant_client_text' },
    'finition':     { id: 'finition_catalogue_id',    text: 'finition_client_text' },
    'bois_brut':    { id: 'bois_brut_catalogue_id',   text: 'bois_brut_client_text' }
};

// ═══════════════════════════════════════════════════════════════
// resolveMaterialsFromComposante
// Pure function — no DOM, no async
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve materials from a saved composante.
 * Maps each expense category (by UUID) to a catalogue_item_id
 * by reading the composante's sub-fields.
 *
 * @param {object} composante — composante record from COMPOSANTES_DATA
 * @param {array} expCats — expense_categories with { id, name, ... }
 * @returns {object} { "uuid-cat-1": "ST-0012", "uuid-cat-2": "ST-0048", ... }
 */
function resolveMaterialsFromComposante(composante, expCats, dmType) {
    if (!composante || !expCats || !expCats.length) return {};
    var result = {};

    // Pass 1: FAB detection — scan sub-fields for fabrication articles
    // Store under "$default:TypeDM" key (e.g. "$default:Facades")
    var _subFields = ['style', 'materiau', 'bande_chant', 'finition', 'bois_brut'];
    for (var _fi = 0; _fi < _subFields.length; _fi++) {
        var _sf = _subFields[_fi];
        var _cfMap = COMPOSANTE_SUBFIELD_MAP[_sf];
        if (!_cfMap) continue;
        var _cfId = composante[_cfMap.id] || null;
        if (!_cfId || !window.CATALOGUE_DATA) continue;
        var _cfItem = CATALOGUE_DATA.find(function(c) { return c.id === _cfId; });
        if (_cfItem && (_cfItem.item_type === 'fabrication' || (_cfItem.item_type !== 'materiau' && _cfItem.calculation_rule_ai))) {
            var _defKey = '$default:' + (dmType || 'Unknown');
            result[_defKey] = _cfId;
            break; // first FAB wins
        }
    }

    // Pass 2: MAT resolution — map expense categories to catalogue items
    for (var i = 0; i < expCats.length; i++) {
        var cat = expCats[i];
        if (!cat.id || !cat.name) continue;
        var dmField = ENRICHED_DM_FIELD_MAP[cat.name.toUpperCase().trim()];
        if (!dmField) { result[cat.id] = null; continue; }
        var compField = COMPOSANTE_SUBFIELD_MAP[dmField];
        if (!compField) { result[cat.id] = null; continue; }
        var catId = composante[compField.id] || null;
        // Validate in CATALOGUE_DATA
        if (catId && window.CATALOGUE_DATA) {
            var exists = CATALOGUE_DATA.some(function(c) { return c.id === catId; });
            if (!exists) catId = null;
        }
        // Skip if this ID was already used as FAB in pass 1
        if (catId && result['$default:' + (dmType || '')] === catId) { result[cat.id] = null; continue; }
        // Fallback: client_text lookup
        if (!catId && composante[compField.text] && window.CATALOGUE_DATA) {
            var _ctLookup = composante[compField.text];
            var _ctMatches = CATALOGUE_DATA.filter(function(c) { return c.client_text === _ctLookup; });
            if (_ctMatches.length === 1) catId = _ctMatches[0].id;
        }
        result[cat.id] = catId;
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════
// resolveMaterialsFromDmEntry
// Fallback when no composante is linked — reads DM sub-fields directly
// Pure function — no DOM, no async
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve materials from a DM entry's enriched sub-fields.
 * Used when no composante is linked to the DM (composante_id is null).
 *
 * @param {object} dmEntry — DM entry { type, materiau, bande_chant, finition, bois_brut, style, ... }
 * @param {array} expCats — expense_categories with { id, name, ... }
 * @returns {object} { "uuid-cat-1": "ST-0012", ... }
 */
function resolveMaterialsFromDmEntry(dmEntry, expCats) {
    if (!dmEntry || !expCats || !expCats.length) return {};
    var result = {};
    var dmType = dmEntry.type || '';

    // Pass 1: FAB detection — scan enriched sub-fields for fabrication articles
    var _dmSubFields = ['style', 'materiau', 'bande_chant', 'finition', 'bois_brut'];
    for (var _dfi = 0; _dfi < _dmSubFields.length; _dfi++) {
        var _dsf = _dmSubFields[_dfi];
        var _dSub = dmEntry[_dsf];
        if (!_dSub) continue;
        if (typeof _dSub === 'string' && _dSub.charAt(0) === '{') {
            try { _dSub = JSON.parse(_dSub); } catch(e) { continue; }
        }
        if (typeof _dSub === 'string') continue;
        var _dCatId = _dSub.catalogue_item_id;
        if (!_dCatId || !window.CATALOGUE_DATA) continue;
        var _dItem = CATALOGUE_DATA.find(function(c) { return c.id === _dCatId; });
        if (_dItem && (_dItem.item_type === 'fabrication' || (_dItem.item_type !== 'materiau' && _dItem.calculation_rule_ai))) {
            result['$default:' + dmType] = _dCatId;
            break;
        }
    }

    // Pass 2: MAT resolution
    for (var i = 0; i < expCats.length; i++) {
        var cat = expCats[i];
        if (!cat.id || !cat.name) continue;
        var dmField = ENRICHED_DM_FIELD_MAP[cat.name.toUpperCase().trim()];
        if (!dmField) { result[cat.id] = null; continue; }
        // Read sub-field from DM entry
        var sub = dmEntry[dmField];
        if (!sub) { result[cat.id] = null; continue; }
        // Parse JSON string if stored as string
        if (typeof sub === 'string' && sub.charAt(0) === '{') {
            try { sub = JSON.parse(sub); } catch(e) { result[cat.id] = null; continue; }
        }
        if (typeof sub === 'string') {
            // Plain string (legacy) — try lookup by client_text
            if (window.CATALOGUE_DATA) {
                var _legacyMatches = CATALOGUE_DATA.filter(function(c) { return c.client_text === sub; });
                result[cat.id] = _legacyMatches.length === 1 ? _legacyMatches[0].id : null;
            } else {
                result[cat.id] = null;
            }
            continue;
        }
        var catId = sub.catalogue_item_id || null;
        // Validate in CATALOGUE_DATA
        if (catId && window.CATALOGUE_DATA) {
            var exists = CATALOGUE_DATA.some(function(c) { return c.id === catId; });
            if (!exists) catId = null;
        }
        // Fallback: if no catalogue_item_id but client_text → lookup
        if (!catId && sub.client_text && window.CATALOGUE_DATA) {
            var _dmCtMatches = CATALOGUE_DATA.filter(function(c) { return c.client_text === sub.client_text; });
            if (_dmCtMatches.length === 1) catId = _dmCtMatches[0].id;
        }
        result[cat.id] = catId;
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════
// fillResolvedMaterials
// Orchestrates resolution for a FAB row
// ═══════════════════════════════════════════════════════════════

/**
 * Find the composante for a FAB row and resolve all materials.
 *
 * Flow:
 * 1. Read the FAB's composante_type_id → determine DM type
 * 2. Find matching DM entry in roomDM[groupId]
 * 3. If DM has composante_id → resolveMaterialsFromComposante
 * 4. If no composante_id → resolveMaterialsFromDmEntry (fallback)
 * 5. Return the resolved_materials JSONB
 *
 * @param {string} rowId — DOM row ID of the FAB
 * @param {string} groupId — DOM group ID (furniture group)
 * @returns {object} resolved_materials { "uuid-cat": "ST-XXXX", ... }
 */
function fillResolvedMaterials(rowId, groupId) {
    // Get the FAB's catalogue item
    var row = document.getElementById(rowId);
    if (!row) return {};
    var select = row.querySelector('.item-select');
    if (!select || !select.value) return {};
    var catItem = (window.CATALOGUE_DATA || []).find(function(c) { return c.id === select.value; });
    if (!catItem) return {};

    // Get expense categories (with UUIDs)
    var expCats = window.expenseCategories || [];
    if (!expCats.length) return {};

    // Determine the FAB's DM type
    var fabDmType = null;
    if (catItem.composante_type_id && window.COMPOSANTE_TYPES) {
        var ct = COMPOSANTE_TYPES.find(function(t) { return t.id === catItem.composante_type_id; });
        if (ct) fabDmType = ct.label;
    }
    if (!fabDmType && typeof _getCategoryDmType === 'function') {
        fabDmType = _getCategoryDmType(catItem.category);
    }
    if (!fabDmType) return {};

    // Find matching DM entries for this type
    var dm = (window.roomDM && window.roomDM[groupId]) || [];
    var fabDmTypeNorm = (typeof normalizeDmType === 'function') ? normalizeDmType(fabDmType) : fabDmType.toLowerCase();
    var dmEntries = dm.filter(function(d) {
        if (!d.type) return false;
        // UUID comparison first
        if (catItem.composante_type_id && d.type_id) return d.type_id === catItem.composante_type_id;
        // Fallback string
        var dNorm = (typeof normalizeDmType === 'function') ? normalizeDmType(d.type) : d.type.toLowerCase();
        return dNorm === fabDmTypeNorm;
    });

    if (dmEntries.length === 0) return {};

    // Pick the DM entry — if 2+, use the first (composante choice modal is handled elsewhere)
    var chosenEntry = dmEntries[0];

    // Resolve from composante if linked
    if (chosenEntry.composante_id) {
        var comp = (window.COMPOSANTES_DATA || []).find(function(c) { return c.id === chosenEntry.composante_id; });
        if (comp) {
            return resolveMaterialsFromComposante(comp, expCats, chosenEntry.type || fabDmType);
        }
    }

    // Fallback: resolve from DM entry sub-fields directly
    var result = resolveMaterialsFromDmEntry(chosenEntry, expCats);

    // Extra fallback: if DM entry has top-level catalogue_item_id (no enriched sub-fields),
    // use it for the 'materiau' expense categories that are still null
    if (chosenEntry.catalogue_item_id && window.CATALOGUE_DATA) {
        var _topItem = CATALOGUE_DATA.find(function(c) { return c.id === chosenEntry.catalogue_item_id; });
        if (_topItem) {
            for (var _fi = 0; _fi < expCats.length; _fi++) {
                var _fCat = expCats[_fi];
                if (!_fCat.id || result[_fCat.id]) continue; // already resolved
                var _fField = ENRICHED_DM_FIELD_MAP[(_fCat.name || '').toUpperCase().trim()];
                if (_fField === 'materiau') {
                    result[_fCat.id] = chosenEntry.catalogue_item_id;
                }
            }
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// clearResolvedMaterials
// Clears resolved materials for specific changed DM types
// ═══════════════════════════════════════════════════════════════

/**
 * Clear resolved_materials entries for expense categories
 * related to the changed DM types.
 *
 * @param {string} rowId — DOM row ID of the FAB
 * @param {array} changedTypes — array of DM type strings (e.g. ["Façades", "Caisson"])
 * @returns {object} the cleared resolved_materials (for re-filling)
 */
function clearResolvedMaterials(rowId, changedTypes) {
    var row = document.getElementById(rowId);
    if (!row || !row.dataset.resolvedMaterials) return {};

    var resolved;
    try { resolved = JSON.parse(row.dataset.resolvedMaterials); }
    catch(e) { resolved = {}; }

    if (!changedTypes || !changedTypes.length) {
        // Clear everything
        return {};
    }

    // Find which DM sub-fields are affected by the changed types
    var affectedFields = [];
    for (var i = 0; i < changedTypes.length; i++) {
        var config = (typeof _getEnrichedConfig === 'function') ? _getEnrichedConfig(changedTypes[i]) : null;
        if (config && config.fields) {
            config.fields.forEach(function(f) {
                if (affectedFields.indexOf(f) === -1) affectedFields.push(f);
            });
        }
    }

    // Find which expense category UUIDs map to affected fields
    var expCats = window.expenseCategories || [];
    var clearedIds = [];
    for (var j = 0; j < expCats.length; j++) {
        var cat = expCats[j];
        if (!cat.id || !cat.name) continue;
        var dmField = ENRICHED_DM_FIELD_MAP[cat.name.toUpperCase().trim()];
        if (dmField && affectedFields.indexOf(dmField) !== -1) {
            clearedIds.push(cat.id);
        }
    }

    // Clear only the affected entries
    for (var k = 0; k < clearedIds.length; k++) {
        resolved[clearedIds[k]] = null;
    }

    return resolved;
}
