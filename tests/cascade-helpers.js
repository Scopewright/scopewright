/**
 * Cascade engine helper functions — extracted copies for testing.
 *
 * These are COPIES of pure functions from calculateur.html (lines 2278-4110).
 * Functions are parameterized to accept dependencies as arguments instead of globals.
 *
 * If the logic changes in calculateur.html, update these copies manually.
 *
 * Used by: tests/cascade-engine.test.js
 * Source: calculateur.html
 */

// ── Stop words for $match: keyword extraction (calculateur.html lines 2787-2790) ──

var MATCH_STOP_WORDS = ['de', 'du', 'des', 'le', 'la', 'les', 'en', 'avec', 'pour', 'et',
    'un', 'une', 'sur', 'par', 'au', 'aux',
    'caisson', 'meuble', 'panneau', 'panneaux', 'façade', 'façades',
    'mm', 'po', 'pce', 'pcs'];

// ── evalFormula (calculateur.html lines 2837-2855) ──
// Safe formula evaluator for cascade quantity/condition rules.
// Supports variables: L, H, P, QTY, n_tablettes, n_partitions
// Supports functions: ceil, floor, round, min, max

function evalFormula(expr, vars, log) {
    log = log || function() {};
    if (!expr) return null;
    var safe = String(expr)
        .replace(/\bn_tablettes\b/g, (vars.n_tablettes != null) ? Number(vars.n_tablettes) : 0)
        .replace(/\bn_partitions\b/g, (vars.n_partitions != null) ? Number(vars.n_partitions) : 0)
        .replace(/\bn_portes\b/g, (vars.n_portes != null) ? Number(vars.n_portes) : 0)
        .replace(/\bn_tiroirs\b/g, (vars.n_tiroirs != null) ? Number(vars.n_tiroirs) : 0);
    safe = safe.replace(/\b(L|H|P|QTY)\b/g, function(m) {
        return (vars[m] != null) ? Number(vars[m]) : 0;
    });
    safe = safe.replace(/\bceil\b/g, 'Math.ceil')
               .replace(/\bfloor\b/g, 'Math.floor')
               .replace(/\bround\b/g, 'Math.round')
               .replace(/\bmin\b/g, 'Math.min')
               .replace(/\bmax\b/g, 'Math.max');
    var check = safe.replace(/Math\.\w+/g, '').replace(/[\d\s+\-*/.(),><=!&|]/g, '');
    if (check.length > 0) { log('warn', 'Formule non sécuritaire: ' + expr + ' → ' + check); return null; }
    try { return new Function('return ' + safe)(); }
    catch (e) { log('error', 'Erreur formule: ' + expr, e.message); return null; }
}

// ── normalizeDmType (calculateur.html lines 2858-2862) ──
// Normalizes a DM type name for fuzzy matching: lowercase, strip accents, strip plural s/x.

function normalizeDmType(str) {
    return (str || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[sx]$/, '');
}

// ── extractMatchKeywords (calculateur.html lines 2792-2796) ──
// Extracts meaningful keywords from client_text, filtering stop words and short words.

function extractMatchKeywords(clientText, stopWords) {
    stopWords = stopWords || MATCH_STOP_WORDS;
    return (clientText || '').toLowerCase()
        .replace(/[^a-zàâäéèêëïîôùûüÿç0-9\s-]/g, '')
        .split(/\s+/)
        .filter(function(w) { return w.length > 2 && stopWords.indexOf(w) === -1; });
}

// ── scoreMatchCandidates (calculateur.html lines 3273-3281) ──
// Scores catalogue items by keyword hits in client_text/description. Returns sorted array.

function scoreMatchCandidates(candidates, keywords) {
    var scored = candidates.map(function(item) {
        var itemText = (item.client_text || item.description || '').toLowerCase();
        var hits = keywords.filter(function(kw) { return itemText.indexOf(kw) !== -1; });
        return { item: item, score: hits.length };
    }).filter(function(s) { return s.score > 0; });
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored;
}

// ── deduplicateDmByClientText (calculateur.html lines 3289-3300) ──
// Deduplicates DM entries by client_text, keeping the first representative.

function deduplicateDmByClientText(entries) {
    var seen = {};
    var result = [];
    for (var i = 0; i < entries.length; i++) {
        var key = entries[i].client_text || entries[i].catalogue_item_id || '';
        if (!seen[key]) {
            seen[key] = true;
            result.push(entries[i]);
        }
    }
    return result;
}

// ── itemHasMaterialCost (calculateur.html lines 2999-3009) ──
// Checks if a catalogue item has material_costs in a given expense category (case-insensitive).

function itemHasMaterialCost(item, expenseCategoryUpper) {
    if (!item || !item.material_costs || typeof item.material_costs !== 'object') return false;
    var keys = Object.keys(item.material_costs);
    for (var i = 0; i < keys.length; i++) {
        if (keys[i].toUpperCase() === expenseCategoryUpper) {
            var val = item.material_costs[keys[i]];
            return typeof val === 'number' ? val > 0 : (val && val.cost > 0);
        }
    }
    return false;
}

// ── getAllowedCategoriesForGroup (calculateur.html lines 2278-2291) ──
// Inverts categoryGroupMapping to find catalogue categories allowed for a material group.
// Returns array of category strings, or null if no mapping exists (null = no filter).

function getAllowedCategoriesForGroup(groupName, categoryGroupMapping) {
    if (!groupName || !categoryGroupMapping) return null;
    var allowed = [];
    var keys = Object.keys(categoryGroupMapping);
    for (var i = 0; i < keys.length; i++) {
        var groups = categoryGroupMapping[keys[i]];
        if (Array.isArray(groups) && groups.indexOf(groupName) !== -1) {
            allowed.push(keys[i]);
        }
    }
    return allowed.length > 0 ? allowed : null;
}

// ── isFormulaQty (extracted from calculateur.html line 4107) ──
// Detects whether a cascade rule qty is a formula (contains dimension variables) or a constant.

function isFormulaQty(formulaStr) {
    return /\b(L|H|P|QTY|n_tablettes|n_partitions|n_portes|n_tiroirs)\b/.test(String(formulaStr));
}

// ── computeCascadeQty (extracted from calculateur.html lines 4100-4110) ──
// Computes cascade child quantity:
//   - Formula (contains dimension vars): result = evaluated total, NOT multiplied by rootQty
//   - Constant: result = value × rootQty
// Returns null if formula evaluates to 0 or negative.

function computeCascadeQty(ruleQty, vars, rootQty, log) {
    var qtyPerUnit = evalFormula(ruleQty, vars, log);
    if (qtyPerUnit === null || qtyPerUnit <= 0) return null;
    var usesDimVars = isFormulaQty(ruleQty);
    return usesDimVars
        ? Math.round(qtyPerUnit * 100) / 100
        : Math.round(qtyPerUnit * rootQty * 100) / 100;
}

// ── checkAskCompleteness (extracted from calculateur.html lines 3944-3960) ──
// Returns array of missing field names (empty = all complete).
// L/H/P/QTY must be > 0. n_tablettes/n_partitions must be != null (0 is valid).

function checkAskCompleteness(askFields, vars) {
    if (!askFields || !Array.isArray(askFields) || askFields.length === 0) return [];
    return askFields.filter(function(field) {
        var normalized = field.trim().toUpperCase();
        if (normalized === 'L' || normalized === 'LARGEUR') return !vars.L || vars.L <= 0;
        if (normalized === 'H' || normalized === 'HAUTEUR') return !vars.H || vars.H <= 0;
        if (normalized === 'P' || normalized === 'PROFONDEUR') return !vars.P || vars.P <= 0;
        if (normalized === 'QTY' || normalized === 'QUANTITE' || normalized === 'QUANTITÉ') return !vars.QTY || vars.QTY <= 0;
        if (normalized === 'N_TABLETTES' || normalized === 'TABLETTES') return vars.n_tablettes == null;
        if (normalized === 'N_PARTITIONS' || normalized === 'PARTITIONS') return vars.n_partitions == null;
        if (normalized === 'N_PORTES' || normalized === 'PORTES') return vars.n_portes == null;
        if (normalized === 'N_TIROIRS' || normalized === 'TIROIRS') return vars.n_tiroirs == null;
        return false;
    });
}

// ── inferAskFromDimsConfig (extracted from calculateur.html lines 3936-3942) ──
// Infers ask fields from dims_config when ask is not explicitly declared.

function inferAskFromDimsConfig(dimsConfig) {
    if (!dimsConfig) return null;
    var inferred = [];
    if (dimsConfig.l) inferred.push('L');
    if (dimsConfig.h) inferred.push('H');
    if (dimsConfig.p) inferred.push('P');
    return inferred.length > 0 ? inferred : null;
}

// ── mergeOverrideChildren (extracted from calculateur.html line 3895) ──
// Merges parent overrides with item's own override_children (uppercased).

function mergeOverrideChildren(parentOverrides, ownOverrides) {
    return (parentOverrides || []).concat(
        (ownOverrides || []).map(function(o) { return o.toUpperCase(); })
    );
}

// ── isRuleOverridden (extracted from calculateur.html lines 4049-4056) ──
// Checks if a cascade rule is blocked by ancestor overrides.
// Only $match: rules can be overridden — $default: and direct codes are never blocked.

function isRuleOverridden(ruleTarget, ancestorOverrides) {
    if (!ancestorOverrides || ancestorOverrides.length === 0) return false;
    if (!ruleTarget || !ruleTarget.startsWith('$match:')) return false;
    var ruleExpCat = ruleTarget.substring(7).toUpperCase();
    return ancestorOverrides.indexOf(ruleExpCat) !== -1;
}

// ── findExistingChildForDynamicRule (calculateur.html lines 2869-2941) ──
// Parameterized version: globals replaced with explicit parameters.
// - dmEntries: result of getDefaultMaterialsForGroup(groupId)
// - catalogueData: CATALOGUE_DATA array
// - allowedCats: result of getAllowedCategoriesForGroup(groupName, mapping), or null

function findExistingChildForDynamicRule(ruleTarget, dmEntries, activeChildren, alreadyMatched, catalogueData, allowedCats, log) {
    log = log || function() {};
    if (ruleTarget.startsWith('$default:')) {
        var groupName = ruleTarget.substring(9);
        var validIds = {};
        var dmClientTexts = [];
        var groupNameNorm = normalizeDmType(groupName);
        for (var i = 0; i < dmEntries.length; i++) {
            if (normalizeDmType(dmEntries[i].type) === groupNameNorm) {
                if (dmEntries[i].client_text) {
                    dmClientTexts.push(dmEntries[i].client_text);
                    catalogueData.forEach(function(c) {
                        if (c.client_text === dmEntries[i].client_text &&
                            (!allowedCats || allowedCats.indexOf(c.category) !== -1)) {
                            validIds[c.id] = true;
                        }
                    });
                }
                if (dmEntries[i].catalogue_item_id) {
                    validIds[dmEntries[i].catalogue_item_id] = true;
                }
            }
        }
        // Exact match: child's catalogueId is in validIds
        for (var j = 0; j < activeChildren.length; j++) {
            var c = activeChildren[j];
            if (alreadyMatched.indexOf(c.rowId) === -1 && c.catalogueId && validIds[c.catalogueId]) {
                return c.catalogueId;
            }
        }
        // Fallback: match by DM client_text WITHOUT category filter
        for (var j2 = 0; j2 < activeChildren.length; j2++) {
            var c2 = activeChildren[j2];
            if (alreadyMatched.indexOf(c2.rowId) === -1 && c2.catalogueId) {
                var childItem = catalogueData.find(function(ci) { return ci.id === c2.catalogueId; });
                if (childItem && childItem.client_text && dmClientTexts.indexOf(childItem.client_text) !== -1) {
                    log('info', 'findExisting: fallback client_text match for ' + c2.catalogueId);
                    return c2.catalogueId;
                }
            }
        }
        return null;
    }
    if (ruleTarget.startsWith('$match:')) {
        var expCat = ruleTarget.substring(7).toUpperCase();
        var expWords = expCat.split(/\s+/);
        for (var k = 0; k < activeChildren.length; k++) {
            var ch = activeChildren[k];
            if (alreadyMatched.indexOf(ch.rowId) === -1 && ch.catalogueId) {
                var catItem = catalogueData.find(function(it) { return it.id === ch.catalogueId; });
                if (catItem && catItem.material_costs) {
                    var mcKeys = Object.keys(catItem.material_costs);
                    for (var mk = 0; mk < mcKeys.length; mk++) {
                        var keyUpper = mcKeys[mk].toUpperCase();
                        var val = catItem.material_costs[mcKeys[mk]];
                        var hasValue = typeof val === 'number' ? val > 0 : (val && val.cost > 0);
                        if (!hasValue) continue;
                        var keyWords = keyUpper.split(/\s+/);
                        var hasCommon = keyWords.some(function(kw) { return expWords.indexOf(kw) !== -1; });
                        if (hasCommon) return ch.catalogueId;
                    }
                }
            }
        }
        return null;
    }
    return null;
}

// ── computeChildDims (pure version of applyChildDims from calculateur.html) ──
// Evaluates child_dims formulas and returns {length_in, height_in, depth_in}.
// Returns empty object if no child_dims or no valid formulas.

function computeChildDims(childDims, vars, log) {
    log = log || function() {};
    if (!childDims || typeof childDims !== 'object') return {};
    var result = {};
    var dimMap = { L: 'length_in', H: 'height_in', P: 'depth_in' };
    var keys = Object.keys(childDims);
    for (var i = 0; i < keys.length; i++) {
        var dim = keys[i].toUpperCase();
        if (!dimMap[dim]) continue;
        var val = evalFormula(childDims[keys[i]], vars, log);
        if (val === null) continue;
        val = Math.round(val * 1000) / 1000;
        result[dimMap[dim]] = val;
    }
    return result;
}

// ── evaluateLaborModifiers (calculateur.html ~line 3242 — labor_modifiers system) ──
// Evaluates labor_modifiers for a catalogue item given current dims.
// Returns { labor_factor, material_factor, label } or null.
// Two modes: first-match (default) or cumulative (labor_modifiers.cumulative: true).

function evaluateLaborModifiers(item, vars, log) {
    log = log || function() {};
    if (!item) return null;
    var lm = item.labor_modifiers || (item.calculation_rule_ai && item.calculation_rule_ai.labor_modifiers) || null;
    if (!lm) return null;
    var mods = lm.modifiers;
    if (!Array.isArray(mods) || mods.length === 0) return null;
    var isCumulative = !!lm.cumulative;

    // Normalize a factor: scalar/empty-key → per-key object
    function normFactor(raw, refObj) {
        if (!raw && raw !== 0) return null;
        if (typeof raw === 'number') {
            if (refObj && Object.keys(refObj).length > 0) {
                var out = {};
                Object.keys(refObj).forEach(function(k) { out[k] = raw; });
                return out;
            }
            return null;
        }
        if (typeof raw === 'object' && raw[''] != null) {
            var val = raw[''];
            if (refObj && Object.keys(refObj).length > 0) {
                var out2 = {};
                Object.keys(refObj).forEach(function(k) { out2[k] = val; });
                return out2;
            }
            return null;
        }
        return raw;
    }

    // Evaluate labor_minutes entries: numbers pass through, strings evaluated via evalFormula
    function evalMinutes(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var result = {};
        var hasAny = false;
        Object.keys(raw).forEach(function(dept) {
            var v = raw[dept];
            if (typeof v === 'number') {
                result[dept] = v;
                hasAny = true;
            } else if (typeof v === 'string') {
                var evaluated = evalFormula(v, vars, log);
                if (evaluated != null) {
                    result[dept] = Math.round(evaluated);
                    hasAny = true;
                }
            }
        });
        return hasAny ? result : null;
    }

    if (!isCumulative) {
        // First-match: return first modifier whose condition is truthy
        for (var i = 0; i < mods.length; i++) {
            var m = mods[i];
            if (!m.condition) continue;
            if (evalFormula(m.condition, vars, log)) {
                return {
                    labor_factor: normFactor(m.labor_factor, item.labor_minutes),
                    material_factor: normFactor(m.material_factor, item.material_costs),
                    labor_minutes_add: evalMinutes(m.labor_minutes),
                    label: m.label || m.condition
                };
            }
        }
        return null;
    }

    // Cumulative: collect all matching modifiers, multiply factors, sum minutes
    var mergedLf = null;
    var mergedMf = null;
    var mergedLma = null;
    var labels = [];
    for (var j = 0; j < mods.length; j++) {
        var mc = mods[j];
        if (!mc.condition) continue;
        if (!evalFormula(mc.condition, vars, log)) continue;
        labels.push(mc.label || mc.condition);
        var lf = normFactor(mc.labor_factor, item.labor_minutes);
        if (lf) {
            if (!mergedLf) { mergedLf = {}; }
            Object.keys(lf).forEach(function(k) {
                mergedLf[k] = (mergedLf[k] || 1) * lf[k];
            });
        }
        var mf = normFactor(mc.material_factor, item.material_costs);
        if (mf) {
            if (!mergedMf) { mergedMf = {}; }
            Object.keys(mf).forEach(function(k) {
                mergedMf[k] = (mergedMf[k] || 1) * mf[k];
            });
        }
        var lma = evalMinutes(mc.labor_minutes);
        if (lma) {
            if (!mergedLma) { mergedLma = {}; }
            Object.keys(lma).forEach(function(k) {
                mergedLma[k] = (mergedLma[k] || 0) + lma[k];
            });
        }
    }
    if (!mergedLf && !mergedMf && !mergedLma) return null;
    return { labor_factor: mergedLf, material_factor: mergedMf, labor_minutes_add: mergedLma, label: labels.join(' + ') };
}

// ── checkMaterialCtxOverlap (calculateur.html — inline in executeCascade) ──
// Checks keyword overlap between materialCtx.chosenClientText and a resolved item's client_text.
// Returns true if there is at least 1 common word (length > 2), false if 0 common words.
// Category-based filter: checks if the $default-resolved item has a relationship
// with the $match category (via material_costs keys or cascade rules).
// Used to filter out $match: resolutions irrelevant to the sibling $default: material.
// e.g. mélamine (no FINITION in costs/cascades) → reject FINITION BOIS
//      placage (has FINITION in cascades) → accept FINITION BOIS

function checkDefaultItemMatchCategory(defaultItem, matchCategory) {
    if (!defaultItem || !matchCategory) return true; // no filter if missing
    var matchCat = matchCategory.toUpperCase();
    var matchWords = matchCat.split(/\s+/).filter(function(w) { return w.length > 2; });
    if (matchWords.length === 0) return true;
    var hasRelation = false;
    // Check 1: material_costs keys contain a word from the $match category
    if (defaultItem.material_costs) {
        var mcKeys = Object.keys(defaultItem.material_costs).map(function(k) { return k.toUpperCase(); });
        hasRelation = matchWords.some(function(mw) {
            return mcKeys.some(function(mk) { return mk.indexOf(mw) !== -1; });
        });
    }
    // Check 2: cascade rules target the same category
    if (!hasRelation && defaultItem.calculation_rule_ai && defaultItem.calculation_rule_ai.cascade) {
        hasRelation = defaultItem.calculation_rule_ai.cascade.some(function(r) {
            if (!r.target || !r.target.startsWith('$match:')) return false;
            var rCat = r.target.substring(7).toUpperCase();
            return matchWords.some(function(mw) { return rCat.indexOf(mw) !== -1; });
        });
    }
    return hasRelation;
}

// ── parseFraction (calculateur.html ~line 3044) ──
// Parse fractional input to decimal. Formats: "3/4", "1 1/2", "23 5/8", "1-3/4".

function parseFraction(str) {
    if (str == null) return null;
    var s = String(str).trim();
    if (!s) return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    var m = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (m) {
        var d = parseInt(m[2], 10);
        return d === 0 ? null : parseInt(m[1], 10) / d;
    }
    m = s.match(/^(-?\d+)[\s\-]+(\d+)\s*\/\s*(\d+)$/);
    if (m) {
        var whole = parseInt(m[1], 10);
        var num = parseInt(m[2], 10);
        var den = parseInt(m[3], 10);
        if (den === 0) return null;
        return whole + (whole < 0 ? -1 : 1) * num / den;
    }
    return null;
}

// ── computeRentabilityPure (synchronized with calculateur.html computeRentabilityData ~line 1177) ──
// Pure function — no DOM dependencies. Takes an array of line descriptors.
// Each line: { catalogueItem, qty, includeInstall, overrides, isCustom, customTotal }
// Returns same shape as computeRentabilityData.

function computeRentabilityPure(lines, tauxHoraires, expenseCategories) {
    var deptMinutes = {};
    var totalMatCoutant = 0, totalMatMarkup = 0, totalMatWaste = 0;
    var totalHeuresCharge = 0, totalSalaires = 0, totalFraisFixes = 0, totalProfitMO = 0;
    var totalPrixVente = 0;
    var totalAjout = 0;

    tauxHoraires.forEach(function(t) { deptMinutes[t.department] = 0; });

    lines.forEach(function(line) {
        var item = line.catalogueItem;
        var qty = line.qty || 0;
        var includeInstall = line.includeInstall !== false;
        var ov = line.overrides || {};

        // Custom item (ajout) — flat total, no decomposition
        if (line.isCustom) {
            var ct = line.customTotal || 0;
            totalPrixVente += ct;
            totalAjout += ct;
            return;
        }

        if (!item) return;

        // Price override = flat amount
        if (ov.price != null) {
            totalPrixVente += ov.price * qty;
            totalAjout += ov.price * qty;
            return;
        }

        // Build effective values: catalogue → auto factors → manual override
        var laborMinutes = Object.assign({}, item.labor_minutes || {});
        if (ov.laborAuto) {
            Object.keys(ov.laborAuto).forEach(function(dept) {
                if (laborMinutes[dept] != null) laborMinutes[dept] = Math.round(laborMinutes[dept] * ov.laborAuto[dept]);
            });
        }
        if (ov.labor) Object.assign(laborMinutes, ov.labor);
        var materialCosts = Object.assign({}, item.material_costs || {});
        if (ov.materialAuto) {
            Object.keys(ov.materialAuto).forEach(function(cat) {
                var v = materialCosts[cat];
                if (v != null) {
                    if (typeof v === 'number') materialCosts[cat] = Math.round(v * ov.materialAuto[cat] * 100) / 100;
                    else if (v && v.cost != null) materialCosts[cat] = Object.assign({}, v, { cost: Math.round(v.cost * ov.materialAuto[cat] * 100) / 100 });
                }
            });
        }
        if (ov.material) Object.assign(materialCosts, ov.material);

        // Labor
        tauxHoraires.forEach(function(t) {
            var dept = t.department;
            var mins = (laborMinutes[dept] || 0) * qty;
            if (!includeInstall && dept === 'Installation') return;
            deptMinutes[dept] = (deptMinutes[dept] || 0) + mins;
            var hours = mins / 60;
            totalHeuresCharge += hours * (t.taux_horaire || 0);
            totalSalaires += hours * (t.salaire || 0);
            totalFraisFixes += hours * (t.frais_fixe || 0);
            totalProfitMO += hours * ((t.taux_horaire || 0) - (t.salaire || 0) - (t.frais_fixe || 0));
        });

        // Materials — markup on (cost + waste)
        expenseCategories.forEach(function(c) {
            var cost = (materialCosts[c.name] || 0) * qty;
            totalMatCoutant += cost;
            var wasteRate = item.loss_override_pct != null ? item.loss_override_pct : (c.waste || 0);
            var wastePart = cost * (wasteRate / 100);
            totalMatWaste += wastePart;
            totalMatMarkup += (cost + wastePart) * ((c.markup || 0) / 100);
        });

        // Fallback: no composed data → use flat price
        var hasComposed = false;
        tauxHoraires.forEach(function(t) {
            if ((item.labor_minutes || {})[t.department] > 0) hasComposed = true;
        });
        expenseCategories.forEach(function(c) {
            if ((item.material_costs || {})[c.name] > 0) hasComposed = true;
        });
        if (!hasComposed) {
            totalPrixVente += (item.price || 0) * qty;
        }
    });

    totalPrixVente += totalHeuresCharge + totalMatCoutant + totalMatWaste + totalMatMarkup;

    var prixVenteSansAjout = totalPrixVente - totalAjout;
    var margeBrute = prixVenteSansAjout > 0
        ? ((prixVenteSansAjout - totalMatCoutant - totalMatWaste - totalSalaires) / prixVenteSansAjout * 100) : 0;
    var profitNetPct = prixVenteSansAjout > 0
        ? ((prixVenteSansAjout - totalMatCoutant - totalMatWaste - totalSalaires - totalFraisFixes) / prixVenteSansAjout * 100) : 0;
    var profitNetMontant = prixVenteSansAjout - totalMatCoutant - totalMatWaste - totalSalaires - totalFraisFixes;
    var margeBruteAvecAjout = totalPrixVente > 0
        ? ((totalPrixVente - totalMatCoutant - totalMatWaste - totalSalaires) / totalPrixVente * 100) : 0;
    var profitNetAvecAjoutPct = totalPrixVente > 0
        ? ((totalPrixVente - totalMatCoutant - totalMatWaste - totalSalaires - totalFraisFixes) / totalPrixVente * 100) : 0;
    var profitNetAvecAjoutMontant = totalPrixVente - totalMatCoutant - totalMatWaste - totalSalaires - totalFraisFixes;

    return {
        prixVente: Math.round(totalPrixVente * 100) / 100,
        coutMateriaux: Math.round(totalMatCoutant * 100) / 100,
        perteMateriaux: Math.round(totalMatWaste * 100) / 100,
        markupMateriaux: Math.round(totalMatMarkup * 100) / 100,
        heuresCharge: Math.round(totalHeuresCharge * 100) / 100,
        salaires: Math.round(totalSalaires * 100) / 100,
        fraisFixes: Math.round(totalFraisFixes * 100) / 100,
        profitMO: Math.round(totalProfitMO * 100) / 100,
        profitNet: Math.round(profitNetAvecAjoutMontant * 100) / 100,
        ajouts: Math.round(totalAjout * 100) / 100,
        margeBrute: Math.round(margeBrute * 10) / 10,
        margeBruteAvecAjout: Math.round(margeBruteAvecAjout * 10) / 10,
        profitNetPct: Math.round(profitNetPct * 10) / 10,
        profitNetAvecAjoutPct: Math.round(profitNetAvecAjoutPct * 10) / 10,
        margeVisee: 38,
        heuresParDept: deptMinutes
    };
}

// ── Module exports ──

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MATCH_STOP_WORDS: MATCH_STOP_WORDS,
        evalFormula: evalFormula,
        normalizeDmType: normalizeDmType,
        extractMatchKeywords: extractMatchKeywords,
        scoreMatchCandidates: scoreMatchCandidates,
        deduplicateDmByClientText: deduplicateDmByClientText,
        itemHasMaterialCost: itemHasMaterialCost,
        getAllowedCategoriesForGroup: getAllowedCategoriesForGroup,
        isFormulaQty: isFormulaQty,
        computeCascadeQty: computeCascadeQty,
        checkAskCompleteness: checkAskCompleteness,
        inferAskFromDimsConfig: inferAskFromDimsConfig,
        mergeOverrideChildren: mergeOverrideChildren,
        isRuleOverridden: isRuleOverridden,
        findExistingChildForDynamicRule: findExistingChildForDynamicRule,
        computeChildDims: computeChildDims,
        evaluateLaborModifiers: evaluateLaborModifiers,
        checkDefaultItemMatchCategory: checkDefaultItemMatchCategory,
        parseFraction: parseFraction,
        computeRentabilityPure: computeRentabilityPure
    };
}
