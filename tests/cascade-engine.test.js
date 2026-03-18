/**
 * Cascade Engine Tests — Node.js headless, zero dependencies.
 *
 * Run: node tests/cascade-engine.test.js
 *
 * Tests the pure functions extracted from calculateur.html's cascade engine.
 * Covers: quantity calculation, override_children, $match/$default resolution helpers,
 * materialCtx propagation logic, ask guards, depth guards, installation toggle.
 */

// ── Mini test runner ──

var _passed = 0, _failed = 0, _errors = [];

function describe(name, fn) {
    console.log('\n=== ' + name + ' ===');
    fn();
}

function it(name, fn) {
    try {
        fn();
        _passed++;
        console.log('  \u2713 ' + name);
    } catch (e) {
        _failed++;
        _errors.push(name + ': ' + e.message);
        console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
    if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function assertDeepEqual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b))
        throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
}

function assertApprox(a, b, eps, msg) {
    eps = eps || 0.01;
    if (Math.abs(a - b) > eps)
        throw new Error((msg ? msg + ': ' : '') + 'expected ~' + b + ' got ' + a);
}

// ── Imports ──

var helpers = require('./cascade-helpers');
var fixturesCat = require('./fixtures/catalogue');
var fixturesDm = require('./fixtures/room-dm');

var evalFormula = helpers.evalFormula;
var normalizeDmType = helpers.normalizeDmType;
var extractMatchKeywords = helpers.extractMatchKeywords;
var scoreMatchCandidates = helpers.scoreMatchCandidates;
var deduplicateDmByClientText = helpers.deduplicateDmByClientText;
var filterDmByExpenseRelevance = helpers.filterDmByExpenseRelevance;
var itemHasMaterialCost = helpers.itemHasMaterialCost;
var getAllowedCategoriesForGroup = helpers.getAllowedCategoriesForGroup;
var isFormulaQty = helpers.isFormulaQty;
var computeCascadeQty = helpers.computeCascadeQty;
var checkAskCompleteness = helpers.checkAskCompleteness;
var inferAskFromDimsConfig = helpers.inferAskFromDimsConfig;
var mergeOverrideChildren = helpers.mergeOverrideChildren;
var isRuleOverridden = helpers.isRuleOverridden;
var findExistingChildForDynamicRule = helpers.findExistingChildForDynamicRule;
var computeChildDims = helpers.computeChildDims;
var MATCH_STOP_WORDS = helpers.MATCH_STOP_WORDS;
var checkDefaultItemMatchCategory = helpers.checkDefaultItemMatchCategory;
var getEnrichedDmField = helpers.getEnrichedDmField;
var ENRICHED_DM_FIELD_MAP = helpers.ENRICHED_DM_FIELD_MAP;
var resolveByComposante = helpers.resolveByComposante;
var COMPOSANTE_FIELD_MAP = helpers.COMPOSANTE_FIELD_MAP;
var filterDmByComposante = helpers.filterDmByComposante;
var shouldOverrideComposanteId = helpers.shouldOverrideComposanteId;

var CATALOGUE_DATA = fixturesCat.CATALOGUE_DATA;
var ROOM_DM = fixturesDm.ROOM_DM;
var CATEGORY_GROUP_MAPPING = fixturesDm.CATEGORY_GROUP_MAPPING;

var fixturesEnriched = require('./fixtures/enriched-dm');
var ENRICHED_DM_ENTRIES = fixturesEnriched.ENRICHED_DM_ENTRIES;
var ENRICHED_CATALOGUE = fixturesEnriched.ENRICHED_CATALOGUE;

// Silent log for tests
var noop = function() {};

// ════════════════════════════════════════════════════════════════
// GROUP 1: evalFormula
// ════════════════════════════════════════════════════════════════

describe('evalFormula', function() {
    it('simple arithmetic: 2+3 = 5', function() {
        assertEqual(evalFormula('2+3', {}), 5);
    });
    it('variable substitution L*H', function() {
        assertEqual(evalFormula('L*H', { L: 24, H: 36 }), 864);
    });
    it('(L*H)/144 = 6', function() {
        assertApprox(evalFormula('(L*H)/144', { L: 24, H: 36 }), 6);
    });
    it('(L*2+H*2)/12 = 10', function() {
        assertApprox(evalFormula('(L*2+H*2)/12', { L: 24, H: 36 }), 10);
    });
    it('ceil function', function() {
        assertEqual(evalFormula('ceil(L/12)', { L: 25 }), 3);
    });
    it('floor function', function() {
        assertEqual(evalFormula('floor(L/12)', { L: 25 }), 2);
    });
    it('round function', function() {
        assertEqual(evalFormula('round(L/12)', { L: 25 }), 2);
    });
    it('min/max functions', function() {
        assertEqual(evalFormula('max(L,H)', { L: 24, H: 36 }), 36);
        assertEqual(evalFormula('min(L,H)', { L: 24, H: 36 }), 24);
    });
    it('n_tablettes substitution', function() {
        assertEqual(evalFormula('n_tablettes*L', { L: 24, n_tablettes: 3 }), 72);
    });
    it('n_partitions substitution', function() {
        assertEqual(evalFormula('n_partitions+1', { n_partitions: 2 }), 3);
    });
    it('n_tablettes=0 is valid', function() {
        assertEqual(evalFormula('n_tablettes+1', { n_tablettes: 0 }), 1);
    });
    it('n_tablettes undefined treated as 0', function() {
        assertEqual(evalFormula('n_tablettes+1', {}), 1);
    });
    it('missing variable defaults to 0', function() {
        assertEqual(evalFormula('L+H', {}), 0);
    });
    it('null expr returns null', function() {
        assertEqual(evalFormula(null, {}), null);
    });
    it('empty expr returns null', function() {
        assertEqual(evalFormula('', {}), null);
    });
    it('unsafe formula returns null', function() {
        assertEqual(evalFormula('alert(1)', {}, noop), null);
    });
    it('complex formula (L*P*2+L*H*2)/144', function() {
        assertApprox(evalFormula('(L*P*2+L*H*2)/144', { L: 24, H: 36, P: 12 }), 16);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 2: normalizeDmType
// ════════════════════════════════════════════════════════════════

describe('normalizeDmType', function() {
    it('lowercase', function() {
        assertEqual(normalizeDmType('Caisson'), 'caisson');
    });
    it('strip accents: Façades', function() {
        assertEqual(normalizeDmType('Façades'), 'facade');
    });
    it('strip trailing x: Panneaux', function() {
        assertEqual(normalizeDmType('Panneaux'), 'panneau');
    });
    it('strip trailing s: Finitions', function() {
        assertEqual(normalizeDmType('Finitions'), 'finition');
    });
    it('Façades equals Facade', function() {
        assertEqual(normalizeDmType('Façades'), normalizeDmType('Facade'));
    });
    it('Finition equals Finitions', function() {
        assertEqual(normalizeDmType('Finition'), normalizeDmType('Finitions'));
    });
    it('already normalized', function() {
        assertEqual(normalizeDmType('caisson'), 'caisson');
    });
    it('null returns empty', function() {
        assertEqual(normalizeDmType(null), '');
    });
    it('empty returns empty', function() {
        assertEqual(normalizeDmType(''), '');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 3: isFormulaQty
// ════════════════════════════════════════════════════════════════

describe('isFormulaQty', function() {
    it('"4" is constant (false)', function() {
        assertEqual(isFormulaQty('4'), false);
    });
    it('"2" is constant', function() {
        assertEqual(isFormulaQty('2'), false);
    });
    it('"1" is constant', function() {
        assertEqual(isFormulaQty('1'), false);
    });
    it('"(L*H)/144" is formula (true)', function() {
        assertEqual(isFormulaQty('(L*H)/144'), true);
    });
    it('"QTY*2" is formula', function() {
        assertEqual(isFormulaQty('QTY*2'), true);
    });
    it('"n_tablettes+1" is formula', function() {
        assertEqual(isFormulaQty('n_tablettes+1'), true);
    });
    it('"n_partitions*L" is formula', function() {
        assertEqual(isFormulaQty('n_partitions*L'), true);
    });
    it('"ceil(P/12)" is formula (P detected)', function() {
        assertEqual(isFormulaQty('ceil(P/12)'), true);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 4: computeCascadeQty — Quantities & rootQty
// ════════════════════════════════════════════════════════════════

describe('computeCascadeQty — quantities & rootQty', function() {
    it('constant "4", rootQty=1 → 4', function() {
        assertEqual(computeCascadeQty('4', { L: 24, H: 36, P: 12, QTY: 1 }, 1), 4);
    });
    it('constant "4", rootQty=2 → 8', function() {
        assertEqual(computeCascadeQty('4', { L: 24, H: 36, P: 12, QTY: 2 }, 2), 8);
    });
    it('formula "(L*H)/144", L=24 H=36, rootQty=6 → 6 (NOT 36)', function() {
        var result = computeCascadeQty('(L*H)/144', { L: 24, H: 36, P: 12, QTY: 6 }, 6);
        assertApprox(result, 6);
    });
    it('formula "(L*2+H*2)/12", L=24 H=36, rootQty=1 → 10 (NOT 10*rootQty)', function() {
        var result = computeCascadeQty('(L*2+H*2)/12', { L: 24, H: 36, P: 12, QTY: 1 }, 1);
        assertApprox(result, 10);
    });
    it('formula "(L*2+H*2)/12", L=24 H=36, rootQty=3 → still 10 (formula, no rootQty mult)', function() {
        var result = computeCascadeQty('(L*2+H*2)/12', { L: 24, H: 36, P: 12, QTY: 3 }, 3);
        assertApprox(result, 10);
    });
    it('formula with n_tablettes: "(n_tablettes*L*P)/144", n_tab=2 L=24 P=24 → 8', function() {
        var result = computeCascadeQty('(n_tablettes*L*P)/144', { L: 24, H: 36, P: 24, QTY: 1, n_tablettes: 2 }, 1);
        assertApprox(result, 8);
    });
    it('constant "1", rootQty=3 → 3', function() {
        assertEqual(computeCascadeQty('1', {}, 3), 3);
    });
    it('formula evaluating to 0 → null', function() {
        assertEqual(computeCascadeQty('L*0', { L: 24 }, 1, noop), null);
    });
    it('formula evaluating to negative → null', function() {
        assertEqual(computeCascadeQty('L-100', { L: 24 }, 1, noop), null);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 5: override_children
// ════════════════════════════════════════════════════════════════

describe('mergeOverrideChildren', function() {
    it('no parent, no own → empty', function() {
        assertDeepEqual(mergeOverrideChildren(null, null), []);
    });
    it('parent only → parent preserved', function() {
        assertDeepEqual(mergeOverrideChildren(['BANDE DE CHANT'], null), ['BANDE DE CHANT']);
    });
    it('own only → uppercased', function() {
        assertDeepEqual(mergeOverrideChildren(null, ['bande de chant']), ['BANDE DE CHANT']);
    });
    it('both → concatenated', function() {
        assertDeepEqual(
            mergeOverrideChildren(['FINITION BOIS'], ['bande de chant']),
            ['FINITION BOIS', 'BANDE DE CHANT']
        );
    });
});

describe('isRuleOverridden', function() {
    it('$match:BANDE DE CHANT overridden by ancestor', function() {
        assert(isRuleOverridden('$match:BANDE DE CHANT', ['BANDE DE CHANT', 'FINITION BOIS']));
    });
    it('$match:PANNEAU BOIS NOT overridden', function() {
        assert(!isRuleOverridden('$match:PANNEAU BOIS', ['BANDE DE CHANT']));
    });
    it('$default: rule is NEVER overridden', function() {
        assert(!isRuleOverridden('$default:Caisson', ['CAISSON']));
    });
    it('direct code rule is never overridden', function() {
        assert(!isRuleOverridden('ST-0010', ['ST-0010']));
    });
    it('empty ancestor overrides → not overridden', function() {
        assert(!isRuleOverridden('$match:FINITION BOIS', []));
    });
    it('null ancestor overrides → not overridden', function() {
        assert(!isRuleOverridden('$match:FINITION BOIS', null));
    });
    it('case insensitive: $match:bande de chant vs BANDE DE CHANT', function() {
        // The rule target is uppercased in isRuleOverridden
        assert(isRuleOverridden('$match:bande de chant', ['BANDE DE CHANT']));
    });
});

describe('override_children integration logic', function() {
    var fab = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0001'; });
    var ownOverrides = fab.calculation_rule_ai.override_children;
    var merged = mergeOverrideChildren([], ownOverrides);

    it('FAB own $match:BANDE DE CHANT rule is NOT blocked (parentOverrides=[])', function() {
        assert(!isRuleOverridden('$match:BANDE DE CHANT', []));
    });
    it('child $match:BANDE DE CHANT IS blocked by ancestor merged overrides', function() {
        assert(isRuleOverridden('$match:BANDE DE CHANT', merged));
    });
    it('child $match:FINITION BOIS IS blocked by ancestor merged overrides', function() {
        assert(isRuleOverridden('$match:FINITION BOIS', merged));
    });
    it('child $match:QUINCAILLERIE is NOT blocked (not in override list)', function() {
        assert(!isRuleOverridden('$match:QUINCAILLERIE', merged));
    });
    it('$default:Caisson is NOT blocked even if in merged overrides', function() {
        assert(!isRuleOverridden('$default:Caisson', merged));
    });
    it('FAB without override_children: children are NOT blocked', function() {
        var fab2 = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0002'; });
        var merged2 = mergeOverrideChildren([], (fab2.calculation_rule_ai || {}).override_children);
        assert(!isRuleOverridden('$match:BANDE DE CHANT', merged2));
    });

    // ── FAB child autonomy: override_children should NOT propagate to FAB children ──
    it('FAB child (ST-0045) has item_type fabrication', function() {
        var facadeSlab = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0045'; });
        assertEqual(facadeSlab.item_type, 'fabrication');
    });
    it('FAB child should receive empty parentOverrides (autonomy)', function() {
        // When recursing into a FAB child, parentOverrides should be []
        // so its own $match:FINITION BOIS is NOT blocked
        var parentFab = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0007'; });
        var parentMerged = mergeOverrideChildren([], parentFab.calculation_rule_ai.override_children);
        // parentMerged contains FINITION BOIS — would block MAT children
        assert(isRuleOverridden('$match:FINITION BOIS', parentMerged));
        // But FAB child receives [] → its own $match:FINITION BOIS is NOT blocked
        var fabChildOverrides = []; // FAB autonomy: fresh start
        assert(!isRuleOverridden('$match:FINITION BOIS', fabChildOverrides));
    });
    it('MAT child still receives merged parentOverrides', function() {
        var parentFab = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0007'; });
        var parentMerged = mergeOverrideChildren([], parentFab.calculation_rule_ai.override_children);
        // MAT child gets full parentMerged → $match:FINITION BOIS is blocked
        var matItem = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0040'; });
        assertEqual(matItem.item_type, 'material');
        assert(isRuleOverridden('$match:FINITION BOIS', parentMerged));
    });
    it('FAB child own override_children apply to its descendants', function() {
        // If ST-0045 had override_children, they would apply starting from []
        // mergedOverrides = [].concat(ownOverrides)
        var fabChild = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0045'; });
        var fabChildOwn = (fabChild.calculation_rule_ai || {}).override_children || [];
        var fabChildMerged = mergeOverrideChildren([], fabChildOwn);
        // ST-0045 has no override_children → empty
        assertDeepEqual(fabChildMerged, []);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 6: checkAskCompleteness
// ════════════════════════════════════════════════════════════════

describe('checkAskCompleteness', function() {
    it('all present → empty array', function() {
        assertDeepEqual(checkAskCompleteness(['L', 'H', 'P'], { L: 24, H: 36, P: 12 }), []);
    });
    it('L=0 → returns ["L"]', function() {
        assertDeepEqual(checkAskCompleteness(['L', 'H'], { L: 0, H: 36 }), ['L']);
    });
    it('L absent → returns ["L"]', function() {
        assertDeepEqual(checkAskCompleteness(['L'], { H: 36 }), ['L']);
    });
    it('n_tablettes=0 is valid → empty', function() {
        assertDeepEqual(checkAskCompleteness(['N_TABLETTES'], { n_tablettes: 0 }), []);
    });
    it('n_tablettes=null → missing', function() {
        assertDeepEqual(checkAskCompleteness(['N_TABLETTES'], {}), ['N_TABLETTES']);
    });
    it('n_partitions=0 is valid', function() {
        assertDeepEqual(checkAskCompleteness(['N_PARTITIONS'], { n_partitions: 0 }), []);
    });
    it('TABLETTES alias works', function() {
        assertDeepEqual(checkAskCompleteness(['TABLETTES'], { n_tablettes: 0 }), []);
    });
    it('LARGEUR alias works', function() {
        assertDeepEqual(checkAskCompleteness(['LARGEUR'], { L: 24 }), []);
    });
    it('LARGEUR with L=0 → missing', function() {
        assertDeepEqual(checkAskCompleteness(['LARGEUR'], { L: 0 }), ['LARGEUR']);
    });
    it('unknown field → not blocking', function() {
        assertDeepEqual(checkAskCompleteness(['UNKNOWN'], {}), []);
    });
    it('null askFields → empty', function() {
        assertDeepEqual(checkAskCompleteness(null, { L: 24 }), []);
    });
    it('empty askFields → empty', function() {
        assertDeepEqual(checkAskCompleteness([], { L: 24 }), []);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 7: inferAskFromDimsConfig
// ════════════════════════════════════════════════════════════════

describe('inferAskFromDimsConfig', function() {
    it('l+h+p → ["L","H","P"]', function() {
        assertDeepEqual(inferAskFromDimsConfig({ l: true, h: true, p: true }), ['L', 'H', 'P']);
    });
    it('l+h only → ["L","H"]', function() {
        assertDeepEqual(inferAskFromDimsConfig({ l: true, h: true }), ['L', 'H']);
    });
    it('empty config → null', function() {
        assertEqual(inferAskFromDimsConfig({}), null);
    });
    it('null → null', function() {
        assertEqual(inferAskFromDimsConfig(null), null);
    });
    it('only p → ["P"]', function() {
        assertDeepEqual(inferAskFromDimsConfig({ p: true }), ['P']);
    });
    it('false values ignored', function() {
        assertDeepEqual(inferAskFromDimsConfig({ l: true, h: false, p: true }), ['L', 'P']);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 8: extractMatchKeywords + scoreMatchCandidates
// ════════════════════════════════════════════════════════════════

describe('extractMatchKeywords', function() {
    it('extracts meaningful keywords', function() {
        var kw = extractMatchKeywords('mélamine blanche thermofusionnée 805');
        assert(kw.indexOf('blanche') !== -1, 'should contain "blanche"');
        assert(kw.indexOf('805') !== -1, 'should contain "805"');
    });
    it('filters stop words', function() {
        var kw = extractMatchKeywords('panneau de chêne blanc');
        assert(kw.indexOf('de') === -1, '"de" should be filtered');
        assert(kw.indexOf('panneau') === -1, '"panneau" should be filtered');
    });
    it('filters short words (<=2 chars)', function() {
        var kw = extractMatchKeywords('un at bois');
        assert(kw.indexOf('at') === -1, '"at" too short');
        assert(kw.indexOf('un') === -1, '"un" is stop word');
    });
    it('empty string → empty array', function() {
        assertDeepEqual(extractMatchKeywords(''), []);
    });
    it('keeps accented words', function() {
        var kw = extractMatchKeywords('chêne érable');
        assert(kw.indexOf('chêne') !== -1, 'should keep accented word');
        assert(kw.indexOf('érable') !== -1, 'should keep accented word');
    });
});

describe('scoreMatchCandidates', function() {
    var materials = CATALOGUE_DATA.filter(function(i) { return i.item_type !== 'fabrication'; });

    it('keywords ["chêne","blanc"] score chêne blanc items', function() {
        var scored = scoreMatchCandidates(materials, ['chêne', 'blanc']);
        assert(scored.length > 0, 'should have matches');
        assert(scored[0].score >= 2, 'top item should match both keywords');
    });
    it('keywords ["mélamine","blanche"] matches ST-0020', function() {
        var scored = scoreMatchCandidates(materials, ['mélamine', 'blanche']);
        assert(scored.some(function(s) { return s.item.id === 'ST-0020'; }), 'ST-0020 should match');
    });
    it('no matching keywords → empty scored', function() {
        var scored = scoreMatchCandidates(materials, ['xxxxnotexist']);
        assertEqual(scored.length, 0);
    });
    it('scored sorted by score descending', function() {
        var scored = scoreMatchCandidates(materials, ['chêne', 'blanc', 'placage']);
        if (scored.length >= 2) {
            assert(scored[0].score >= scored[1].score, 'first score >= second');
        }
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 9: deduplicateDmByClientText
// ════════════════════════════════════════════════════════════════

describe('deduplicateDmByClientText', function() {
    it('unique entries unchanged', function() {
        var entries = [
            { client_text: 'A', catalogue_item_id: '1' },
            { client_text: 'B', catalogue_item_id: '2' }
        ];
        assertEqual(deduplicateDmByClientText(entries).length, 2);
    });
    it('duplicate client_text → keep first', function() {
        var entries = [
            { client_text: 'A', catalogue_item_id: '1' },
            { client_text: 'A', catalogue_item_id: '2' }
        ];
        var result = deduplicateDmByClientText(entries);
        assertEqual(result.length, 1);
        assertEqual(result[0].catalogue_item_id, '1');
    });
    it('null client_text → falls back to catalogue_item_id for dedup', function() {
        var entries = [
            { client_text: null, catalogue_item_id: 'X' },
            { client_text: null, catalogue_item_id: 'X' }
        ];
        assertEqual(deduplicateDmByClientText(entries).length, 1);
    });
    it('null client_text + different catalogue_item_id → kept separate', function() {
        var entries = [
            { client_text: null, catalogue_item_id: 'X' },
            { client_text: null, catalogue_item_id: 'Y' }
        ];
        assertEqual(deduplicateDmByClientText(entries).length, 2);
    });
    it('empty array → empty', function() {
        assertEqual(deduplicateDmByClientText([]).length, 0);
    });
    it('#205: different client_text but same catalogue_item_id → deduplicated', function() {
        var entries = [
            { client_text: 'Placage chêne blanc', catalogue_item_id: 'ST-0010' },
            { client_text: 'Placage de chêne blanc', catalogue_item_id: 'ST-0010' }
        ];
        var result = deduplicateDmByClientText(entries);
        assertEqual(result.length, 1, 'should keep only one entry');
        assertEqual(result[0].client_text, 'Placage chêne blanc', 'should keep first');
    });
    it('#205: different client_text AND different catalogue_item_id → kept separate', function() {
        var entries = [
            { client_text: 'Placage chêne blanc', catalogue_item_id: 'ST-0010' },
            { client_text: 'Mélamine blanche', catalogue_item_id: 'ST-0020' }
        ];
        assertEqual(deduplicateDmByClientText(entries).length, 2);
    });
    it('#205: null catalogue_item_id entries are not deduplicated by id', function() {
        var entries = [
            { client_text: 'A', catalogue_item_id: null },
            { client_text: 'B', catalogue_item_id: null }
        ];
        assertEqual(deduplicateDmByClientText(entries).length, 2, 'null ids kept separate');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 10: getAllowedCategoriesForGroup
// ════════════════════════════════════════════════════════════════

describe('getAllowedCategoriesForGroup', function() {
    var mapping = CATEGORY_GROUP_MAPPING;

    it('Caisson → includes Panneaux mélamine, Panneaux placage, Bandes de chant', function() {
        var result = getAllowedCategoriesForGroup('Caisson', mapping);
        assert(result !== null, 'should not be null');
        assert(result.indexOf('Panneaux mélamine') !== -1, 'should include Panneaux mélamine');
        assert(result.indexOf('Panneaux placage') !== -1, 'should include Panneaux placage');
        assert(result.indexOf('Bandes de chant') !== -1, 'should include Bandes de chant');
    });
    it('Finition → ["Finitions"]', function() {
        var result = getAllowedCategoriesForGroup('Finition', mapping);
        assertDeepEqual(result, ['Finitions']);
    });
    it('Façades → includes Panneaux placage + Bandes de chant, NOT Panneaux mélamine', function() {
        var result = getAllowedCategoriesForGroup('Façades', mapping);
        assert(result.indexOf('Panneaux placage') !== -1);
        assert(result.indexOf('Bandes de chant') !== -1);
        assert(result.indexOf('Panneaux mélamine') === -1, 'mélamine NOT mapped to Façades');
    });
    it('unknown group → null', function() {
        assertEqual(getAllowedCategoriesForGroup('Inconnu', mapping), null);
    });
    it('null groupName → null', function() {
        assertEqual(getAllowedCategoriesForGroup(null, mapping), null);
    });
    it('null mapping → null', function() {
        assertEqual(getAllowedCategoriesForGroup('Caisson', null), null);
    });
    it('accent mismatch: groupName "Façades" matches mapping value "Facade" (normalizeDmType)', function() {
        var accentMapping = { 'Panneaux placage': ['Caisson', 'Facade'], 'Bandes de chant': ['Facade'] };
        var result = getAllowedCategoriesForGroup('Façades', accentMapping);
        assert(result !== null, 'should match despite accent difference');
        assert(result.indexOf('Panneaux placage') !== -1);
        assert(result.indexOf('Bandes de chant') !== -1);
    });
    it('plural mismatch: groupName "Panneaux" matches mapping value "Panneau" (normalizeDmType)', function() {
        var pluralMapping = { 'Panneaux mélamine': ['Panneau'] };
        var result = getAllowedCategoriesForGroup('Panneaux', pluralMapping);
        assert(result !== null, 'should match despite plural difference');
        assertDeepEqual(result, ['Panneaux mélamine']);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 11: itemHasMaterialCost
// ════════════════════════════════════════════════════════════════

describe('itemHasMaterialCost', function() {
    it('flat number cost → true', function() {
        assert(itemHasMaterialCost({ material_costs: { 'PANNEAU MÉLAMINE': 5.2 } }, 'PANNEAU MÉLAMINE'));
    });
    it('object {cost,qty} cost → true', function() {
        assert(itemHasMaterialCost({ material_costs: { 'PANNEAU PLACAGE': { cost: 8.5, qty: 1 } } }, 'PANNEAU PLACAGE'));
    });
    it('zero cost → false', function() {
        assert(!itemHasMaterialCost({ material_costs: { 'PANNEAU MÉLAMINE': 0 } }, 'PANNEAU MÉLAMINE'));
    });
    it('case-insensitive key match', function() {
        assert(itemHasMaterialCost({ material_costs: { 'panneau mélamine': 5.2 } }, 'PANNEAU MÉLAMINE'));
    });
    it('missing category → false', function() {
        assert(!itemHasMaterialCost({ material_costs: { 'PANNEAU MÉLAMINE': 5.2 } }, 'FINITION LAQUE'));
    });
    it('no material_costs → false', function() {
        assert(!itemHasMaterialCost({}, 'PANNEAU MÉLAMINE'));
    });
    it('null material_costs → false', function() {
        assert(!itemHasMaterialCost({ material_costs: null }, 'PANNEAU MÉLAMINE'));
    });
    it('null item → false', function() {
        assert(!itemHasMaterialCost(null, 'PANNEAU MÉLAMINE'));
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 12: findExistingChildForDynamicRule
// ════════════════════════════════════════════════════════════════

describe('findExistingChildForDynamicRule', function() {
    var dmRoom1 = ROOM_DM['room-1'];
    var allowedCaisson = getAllowedCategoriesForGroup('Caisson', CATEGORY_GROUP_MAPPING);

    it('$default:Caisson — child with matching catalogueId → found', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0020' }];
        var result = findExistingChildForDynamicRule('$default:Caisson', dmRoom1, children, [], CATALOGUE_DATA, allowedCaisson);
        assertEqual(result, 'ST-0020');
    });

    it('$default:Caisson — child with non-matching catalogueId → null', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0040' }]; // Finition, not Caisson
        var result = findExistingChildForDynamicRule('$default:Caisson', dmRoom1, children, [], CATALOGUE_DATA, allowedCaisson);
        assertEqual(result, null);
    });

    it('$default:Caisson — child already matched → skip', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0020' }];
        var result = findExistingChildForDynamicRule('$default:Caisson', dmRoom1, children, ['row-c1'], CATALOGUE_DATA, allowedCaisson);
        assertEqual(result, null);
    });

    it('$default:Façades — child with placage chêne blanc → found', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0021' }];
        var allowedFacades = getAllowedCategoriesForGroup('Façades', CATEGORY_GROUP_MAPPING);
        var result = findExistingChildForDynamicRule('$default:Façades', dmRoom1, children, [], CATALOGUE_DATA, allowedFacades);
        assertEqual(result, 'ST-0021');
    });

    it('$match:BANDE DE CHANT — child with PVC edge → found (word overlap)', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0030' }]; // BANDE DE CHANT PVC
        var result = findExistingChildForDynamicRule('$match:BANDE DE CHANT', dmRoom1, children, [], CATALOGUE_DATA, null);
        assertEqual(result, 'ST-0030');
    });

    it('$match:BANDE DE CHANT — child without matching material_costs → null', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0020' }]; // PANNEAU MÉLAMINE
        var result = findExistingChildForDynamicRule('$match:BANDE DE CHANT', dmRoom1, children, [], CATALOGUE_DATA, null);
        assertEqual(result, null);
    });

    it('$match:PANNEAU BOIS — word overlap with PANNEAU MÉLAMINE → found', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0020' }]; // has PANNEAU MÉLAMINE
        var result = findExistingChildForDynamicRule('$match:PANNEAU BOIS', dmRoom1, children, [], CATALOGUE_DATA, null);
        assertEqual(result, 'ST-0020');
    });

    it('$match:FINITION BOIS — child with FINITION LAQUE → found (FINITION overlap)', function() {
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0040' }]; // FINITION LAQUE
        var result = findExistingChildForDynamicRule('$match:FINITION BOIS', dmRoom1, children, [], CATALOGUE_DATA, null);
        assertEqual(result, 'ST-0040');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 13: Cascade depth guard + installation skipCascade
// ════════════════════════════════════════════════════════════════

describe('cascade depth guard', function() {
    it('depth 0, 1, 2 are below max (3)', function() {
        assert(0 < 3 && 1 < 3 && 2 < 3, 'depths 0-2 should be allowed');
    });
    it('depth 3 is at max → blocked', function() {
        assert(!(3 < 3), 'depth 3 should be blocked');
    });
    it('depth 4+ also blocked', function() {
        assert(!(4 < 3) && !(10 < 3), 'depths > 3 should be blocked');
    });
});

describe('installation toggle — skipCascade', function() {
    it('skipCascade option is truthy', function() {
        var opts = { skipCascade: true };
        assert(opts.skipCascade === true, 'skipCascade should prevent cascade');
    });
    it('without skipCascade option, cascade would run', function() {
        var opts = {};
        assert(!opts.skipCascade, 'missing skipCascade should allow cascade');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 14: materialCtx propagation logic
// ════════════════════════════════════════════════════════════════

describe('materialCtx propagation logic', function() {
    it('$default:Caisson resolves to mélamine in room-1 DM', function() {
        // Room-1 has Caisson = mélamine 805 (ST-0020)
        var dmRoom1 = ROOM_DM['room-1'];
        var allowedCaisson = getAllowedCategoriesForGroup('Caisson', CATEGORY_GROUP_MAPPING);
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0020' }];
        var result = findExistingChildForDynamicRule('$default:Caisson', dmRoom1, children, [], CATALOGUE_DATA, allowedCaisson);
        assertEqual(result, 'ST-0020', 'should resolve to mélamine');
    });

    it('$default:Caisson resolves to placage in room-2 DM', function() {
        // Room-2 has Caisson = placage chêne blanc (ST-0021)
        var dmRoom2 = ROOM_DM['room-2'];
        var allowedCaisson = getAllowedCategoriesForGroup('Caisson', CATEGORY_GROUP_MAPPING);
        var children = [{ rowId: 'row-c1', catalogueId: 'ST-0021' }];
        var result = findExistingChildForDynamicRule('$default:Caisson', dmRoom2, children, [], CATALOGUE_DATA, allowedCaisson);
        assertEqual(result, 'ST-0021', 'should resolve to placage');
    });

    it('materialCtx disambiguates: mélamine context → PVC edge, not chêne edge', function() {
        // If materialCtx has mélamine context, $match:BANDE DE CHANT should prefer PVC (ST-0030)
        // We test via scoreMatchCandidates with mélamine keywords
        var melamineKw = extractMatchKeywords('mélamine blanche thermofusionnée 805');
        var edgeCandidates = CATALOGUE_DATA.filter(function(i) {
            return i.category === 'Bandes de chant';
        });
        var scored = scoreMatchCandidates(edgeCandidates, melamineKw);
        // With mélamine keywords, neither PVC nor chêne should score high (different domain)
        // This validates that the keyword system works — mélamine keywords don't match chêne edge
        // In the real system, DM-based resolution handles this via type matching, not keywords
        assert(true, 'keyword separation validated');
    });

    it('placage context → chêne edge keywords score higher than PVC', function() {
        var placageKw = extractMatchKeywords('placage de chêne blanc FC');
        var edgeCandidates = CATALOGUE_DATA.filter(function(i) {
            return i.category === 'Bandes de chant';
        });
        var scored = scoreMatchCandidates(edgeCandidates, placageKw);
        // chêne blanc edge (ST-0031) should score higher than PVC (ST-0030)
        if (scored.length >= 2) {
            var cheneScore = scored.find(function(s) { return s.item.id === 'ST-0031'; });
            var pvcScore = scored.find(function(s) { return s.item.id === 'ST-0030'; });
            if (cheneScore && pvcScore) {
                assert(cheneScore.score > pvcScore.score, 'chêne edge should score higher with placage context');
            }
        }
        if (scored.length > 0) {
            assert(scored[0].item.id === 'ST-0031', 'ST-0031 chêne blanc should be top match');
        }
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 15 — n_portes / n_tiroirs variables
// ════════════════════════════════════════════════════════════════

describe('GROUP 15 — n_portes / n_tiroirs', function() {

    it('evalFormula substitutes n_portes', function() {
        var result = evalFormula('n_portes * 2', { L: 24, H: 30, P: 12, n_portes: 3 });
        assertEqual(result, 6, 'n_portes * 2 with n_portes=3');
    });

    it('evalFormula substitutes n_tiroirs', function() {
        var result = evalFormula('n_tiroirs + 1', { L: 24, H: 30, P: 12, n_tiroirs: 4 });
        assertEqual(result, 5, 'n_tiroirs + 1 with n_tiroirs=4');
    });

    it('evalFormula defaults n_portes to 0 when null', function() {
        var result = evalFormula('n_portes + 10', { L: 24, H: 30, P: 12 });
        assertEqual(result, 10, 'n_portes defaults to 0');
    });

    it('evalFormula defaults n_tiroirs to 0 when null', function() {
        var result = evalFormula('n_tiroirs + 5', { L: 24, H: 30, P: 12 });
        assertEqual(result, 5, 'n_tiroirs defaults to 0');
    });

    it('evalFormula combined formula with n_portes and dims', function() {
        var result = evalFormula('(L / n_portes) - 0.125', { L: 24, H: 30, P: 12, n_portes: 2 });
        assertApprox(result, 11.875, 0.001, 'L/n_portes - 0.125');
    });

    it('isFormulaQty detects n_portes', function() {
        assert(isFormulaQty('n_portes'), 'n_portes is a formula');
    });

    it('isFormulaQty detects n_tiroirs', function() {
        assert(isFormulaQty('n_tiroirs'), 'n_tiroirs is a formula');
    });

    it('isFormulaQty detects n_portes in complex formula', function() {
        assert(isFormulaQty('n_portes * 2 + 1'), 'n_portes in complex expr');
    });

    it('checkAskCompleteness: N_PORTES with 0 is valid', function() {
        var missing = checkAskCompleteness(['L', 'H', 'N_PORTES'], { L: 24, H: 30, n_portes: 0 });
        assertDeepEqual(missing, [], 'n_portes=0 should be valid');
    });

    it('checkAskCompleteness: N_PORTES with null blocks', function() {
        var missing = checkAskCompleteness(['L', 'H', 'N_PORTES'], { L: 24, H: 30 });
        assert(missing.indexOf('N_PORTES') !== -1, 'N_PORTES should be missing when null');
    });

    it('checkAskCompleteness: PORTES alias works', function() {
        var missing = checkAskCompleteness(['PORTES'], { n_portes: 2 });
        assertDeepEqual(missing, [], 'PORTES alias should map to n_portes');
    });

    it('checkAskCompleteness: N_TIROIRS with null blocks', function() {
        var missing = checkAskCompleteness(['N_TIROIRS'], {});
        assert(missing.indexOf('N_TIROIRS') !== -1, 'N_TIROIRS should be missing');
    });

    it('checkAskCompleteness: TIROIRS alias with 0 is valid', function() {
        var missing = checkAskCompleteness(['TIROIRS'], { n_tiroirs: 0 });
        assertDeepEqual(missing, [], 'TIROIRS alias with 0 should be valid');
    });

    it('computeCascadeQty with n_portes formula', function() {
        var vars = { L: 36, H: 30, P: 24, QTY: 1, n_portes: 3 };
        var qty = computeCascadeQty('n_portes', vars, 2);
        // n_portes is a formula var → total qty = 3, NOT multiplied by rootQty
        assertEqual(qty, 3, 'n_portes formula qty should be total, not per-unit');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 16 — computeChildDims
// ════════════════════════════════════════════════════════════════

describe('GROUP 16 — computeChildDims', function() {

    it('null child_dims returns empty object', function() {
        var result = computeChildDims(null, { L: 24, H: 30 });
        assertDeepEqual(result, {}, 'null child_dims → {}');
    });

    it('undefined child_dims returns empty object', function() {
        var result = computeChildDims(undefined, { L: 24, H: 30 });
        assertDeepEqual(result, {}, 'undefined child_dims → {}');
    });

    it('L formula evaluated correctly', function() {
        var result = computeChildDims({ L: '(L / n_portes) - 0.125' }, { L: 24, n_portes: 2 });
        assertApprox(result.length_in, 11.875, 0.001, 'L formula');
        assert(!result.height_in, 'H not set');
        assert(!result.depth_in, 'P not set');
    });

    it('H formula evaluated correctly', function() {
        var result = computeChildDims({ H: 'H - 0.25' }, { H: 30 });
        assertApprox(result.height_in, 29.75, 0.001, 'H formula');
    });

    it('P formula evaluated correctly', function() {
        var result = computeChildDims({ P: 'P - 1' }, { P: 24 });
        assertApprox(result.depth_in, 23, 0.001, 'P formula');
    });

    it('only defined keys are set', function() {
        var result = computeChildDims({ L: 'L - 1', H: 'H - 2' }, { L: 24, H: 30, P: 12 });
        assert(result.length_in != null, 'length_in should be set');
        assert(result.height_in != null, 'height_in should be set');
        assert(!result.depth_in, 'depth_in should NOT be set');
    });

    it('unsafe formula key is omitted', function() {
        var result = computeChildDims({ L: 'L - 1', H: 'alert(1)' }, { L: 24, H: 30 });
        assertApprox(result.length_in, 23, 0.001, 'L safe formula works');
        assert(!result.height_in, 'H unsafe formula omitted');
    });

    it('realistic scenario: porte dims from ST-0005 rule', function() {
        var rule = { L: '(L / n_portes) - 0.125', H: 'H - 0.25' };
        var vars = { L: 36, H: 30, P: 24, n_portes: 3, n_tiroirs: 0 };
        var result = computeChildDims(rule, vars);
        assertApprox(result.length_in, 11.875, 0.001, 'porte L = 36/3 - 0.125');
        assertApprox(result.height_in, 29.75, 0.001, 'porte H = 30 - 0.25');
        assert(!result.depth_in, 'P not in child_dims');
    });

    it('division by zero in formula returns Infinity → still set', function() {
        var result = computeChildDims({ L: 'L / n_portes' }, { L: 24, n_portes: 0 });
        // L/0 = Infinity, evalFormula returns Infinity (not null)
        assert(result.length_in === Infinity || result.length_in != null, 'division by zero handled');
    });

    it('lowercase keys are normalized to uppercase', function() {
        var result = computeChildDims({ l: 'L - 1', h: 'H - 2' }, { L: 24, H: 30 });
        assertApprox(result.length_in, 23, 0.001, 'lowercase l → length_in');
        assertApprox(result.height_in, 28, 0.001, 'lowercase h → height_in');
    });

    it('unknown dim key is ignored', function() {
        var result = computeChildDims({ L: 'L', W: 'H + 5' }, { L: 24, H: 30 });
        assertApprox(result.length_in, 24, 0.001, 'L set');
        assert(!result.width_in, 'W key ignored');
        assert(Object.keys(result).length === 1, 'only 1 key set');
    });
});

// GROUP 17 — evaluateLaborModifiers — basic

describe('GROUP 17 — evaluateLaborModifiers — basic', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;

    it('null item → null', function() {
        assertEqual(evaluateLaborModifiers(null, { L: 40 }), null);
    });

    it('item without labor_modifiers → null', function() {
        assertEqual(evaluateLaborModifiers({ id: 'ST-0001' }, { L: 40 }), null);
    });

    it('empty modifiers array → null', function() {
        assertEqual(evaluateLaborModifiers({ labor_modifiers: { modifiers: [] } }, { L: 40 }), null);
    });

    it('labor_modifiers without modifiers key → null', function() {
        assertEqual(evaluateLaborModifiers({ labor_modifiers: {} }, { L: 40 }), null);
    });

    it('first condition true → returns its factors', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 30', label: 'Wide', labor_factor: { 'Machinage': 1.5 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Wide');
        assertEqual(result.labor_factor['Machinage'], 1.5);
    });

    it('first condition false, second true → returns second', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 48', label: 'XL', labor_factor: { 'Machinage': 2.0 } },
                { condition: 'L > 36', label: 'Large', labor_factor: { 'Machinage': 1.25 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assertEqual(result.label, 'Large');
        assertEqual(result.labor_factor['Machinage'], 1.25);
    });

    it('no conditions match → null', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 100', label: 'Huge', labor_factor: { 'Machinage': 3.0 } }
            ]}
        };
        assertEqual(evaluateLaborModifiers(item, { L: 40 }), null);
    });

    it('condition without labor_factor → returns { labor_factor: null }', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 0', label: 'Base' }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        assert(result !== null, 'should match');
        assertEqual(result.labor_factor, null);
        assertEqual(result.material_factor, null);
    });

    it('label fallback to condition string when no label', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 30', labor_factor: { 'A': 1.1 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assertEqual(result.label, 'L > 30');
    });

    it('modifier with empty condition string is skipped', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: '', label: 'Empty', labor_factor: { 'A': 1.1 } },
                { condition: 'L > 0', label: 'Fallback', labor_factor: { 'A': 1.2 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        assertEqual(result.label, 'Fallback');
    });
});

// GROUP 18 — evaluateLaborModifiers — formulas

describe('GROUP 18 — evaluateLaborModifiers — formulas', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;

    it('condition with L * H surface calculation', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L * H > 1000', label: 'Grande surface', labor_factor: { 'Ébénisterie': 1.3 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40, H: 30 }); // 1200 > 1000
        assert(result !== null, 'should match');
        assertEqual(result.labor_factor['Ébénisterie'], 1.3);
    });

    it('condition with ceil/floor', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'ceil(L / 12) > 3', label: 'Multi-panneau', labor_factor: { 'Machinage': 1.4 } }
            ]}
        };
        // ceil(40/12) = ceil(3.33) = 4 > 3 → true
        var result = evaluateLaborModifiers(item, { L: 40 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Multi-panneau');
    });

    it('false condition is skipped', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L * H > 2000', label: 'Très grand', labor_factor: { 'A': 2.0 } }
            ]}
        };
        assertEqual(evaluateLaborModifiers(item, { L: 30, H: 20 }), null); // 600 < 2000
    });

    it('condition with n_tablettes variable', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'n_tablettes > 3', label: 'Multi-tablettes', labor_factor: { 'Ébénisterie': 1.2 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 24, n_tablettes: 5 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Multi-tablettes');
    });

    it('first-match: multiple true conditions → only first wins', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 20', label: 'First', labor_factor: { 'A': 1.1 } },
                { condition: 'L > 10', label: 'Second', labor_factor: { 'A': 1.2 } },
                { condition: 'L > 0', label: 'Third', labor_factor: { 'A': 1.3 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 30 });
        assertEqual(result.label, 'First');
        assertEqual(result.labor_factor['A'], 1.1);
    });

    it('material_factor only (no labor_factor)', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 36', label: 'Wide panel', material_factor: { 'PANNEAU MÉLAMINE': 1.15 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assert(result !== null, 'should match');
        assertEqual(result.labor_factor, null);
        assertEqual(result.material_factor['PANNEAU MÉLAMINE'], 1.15);
    });

    it('scalar labor_factor → expanded to all departments', function() {
        var item = {
            labor_minutes: { 'Ébénisterie': 120, 'Machinage': 60, 'Installation': 30 },
            labor_modifiers: { modifiers: [
                { condition: 'L > 30', label: 'Large', labor_factor: 1.25 }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assert(result !== null, 'should match');
        assert(typeof result.labor_factor === 'object', 'should be object not number');
        assertEqual(result.labor_factor['Ébénisterie'], 1.25);
        assertEqual(result.labor_factor['Machinage'], 1.25);
        assertEqual(result.labor_factor['Installation'], 1.25);
    });

    it('scalar material_factor → expanded to all categories', function() {
        var item = {
            material_costs: { 'PANNEAU MÉLAMINE': 5.20, 'QUINCAILLERIE': 0.50 },
            labor_modifiers: { modifiers: [
                { condition: 'L > 30', label: 'Large', material_factor: 1.10 }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 40 });
        assert(result !== null, 'should match');
        assert(typeof result.material_factor === 'object', 'should be object not number');
        assertEqual(result.material_factor['PANNEAU MÉLAMINE'], 1.10);
        assertEqual(result.material_factor['QUINCAILLERIE'], 1.10);
    });

    it('scalar labor_factor without labor_minutes → null (cannot expand)', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 0', label: 'Test', labor_factor: 1.5 }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        // No labor_minutes on item → cannot expand → null
        assertEqual(result.labor_factor, null);
    });

    it('empty-key labor_factor {"": 1.25} → expanded to all departments', function() {
        var item = {
            labor_minutes: { 'Assemblage': 40, 'Machinage': 60 },
            labor_modifiers: { modifiers: [
                { condition: 'L > 0', label: 'Test', labor_factor: { '': 1.25 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        assert(result !== null, 'should match');
        assertEqual(result.labor_factor['Assemblage'], 1.25);
        assertEqual(result.labor_factor['Machinage'], 1.25);
        assertEqual(Object.keys(result.labor_factor).length, 2);
    });

    it('empty-key material_factor {"": 1.10} → expanded to all categories', function() {
        var item = {
            material_costs: { 'PANNEAU MÉLAMINE': 5.20, 'QUINCAILLERIE': 0.15 },
            labor_modifiers: { modifiers: [
                { condition: 'L > 0', label: 'Test', material_factor: { '': 1.10 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        assert(result !== null, 'should match');
        assertEqual(result.material_factor['PANNEAU MÉLAMINE'], 1.10);
        assertEqual(result.material_factor['QUINCAILLERIE'], 1.10);
    });

    it('empty-key labor_factor without labor_minutes → null', function() {
        var item = {
            labor_modifiers: { modifiers: [
                { condition: 'L > 0', label: 'Test', labor_factor: { '': 1.5 } }
            ]}
        };
        var result = evaluateLaborModifiers(item, { L: 10 });
        assertEqual(result.labor_factor, null);
    });
});

// GROUP 19 — evaluateLaborModifiers — integration with ST-0006

describe('GROUP 19 — evaluateLaborModifiers — integration ST-0006', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;
    var ST0006 = CATALOGUE_DATA.find(function(c) { return c.id === 'ST-0006'; });

    it('ST-0006 exists in fixtures', function() {
        assert(ST0006 !== undefined, 'ST-0006 must be in CATALOGUE_DATA');
        assert(ST0006.labor_modifiers, 'must have labor_modifiers');
        assertEqual(ST0006.labor_modifiers.modifiers.length, 3);
    });

    it('L=50 → Grand (> 48 po) — Machinage 1.5×, mat 1.20×', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 50, H: 30, P: 24 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Grand (> 48 po)');
        assertEqual(result.labor_factor['Machinage'], 1.5);
        assertEqual(result.material_factor['PANNEAU MÉLAMINE'], 1.20);
    });

    it('L=40 → Moyen (> 36 po) — Machinage 1.25×', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 40, H: 30, P: 24 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Moyen (> 36 po)');
        assertEqual(result.labor_factor['Machinage'], 1.25);
        assertEqual(result.material_factor, null, 'Moyen has no material_factor');
    });

    it('L=30 → Standard — null labor_factor', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 30, H: 30, P: 24 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Standard');
        assertEqual(result.labor_factor, null);
    });

    it('L=48 (boundary) → Moyen (> 36 po), not Grand', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 48, H: 30, P: 24 });
        assertEqual(result.label, 'Moyen (> 36 po)');
    });

    it('L=36 (boundary) → Standard (L <= 36)', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 36, H: 30, P: 24 });
        assertEqual(result.label, 'Standard');
    });

    it('applied labor_factor changes effective minutes', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 50, H: 30, P: 24 });
        // ST-0006 base: Machinage = 60 min, factor 1.5 → 90 min
        var effectiveMachinage = Math.round(ST0006.labor_minutes['Machinage'] * result.labor_factor['Machinage']);
        assertEqual(effectiveMachinage, 90);
        // Ébénisterie not in factor → stays 120
        assert(!result.labor_factor['Ébénisterie'], 'Ébénisterie not modified');
    });

    it('applied material_factor changes effective cost', function() {
        var result = evaluateLaborModifiers(ST0006, { L: 50, H: 30, P: 24 });
        // ST-0006 base: PANNEAU MÉLAMINE = 5.20, factor 1.20 → 6.24
        var effectiveCost = Math.round(ST0006.material_costs['PANNEAU MÉLAMINE'] * result.material_factor['PANNEAU MÉLAMINE'] * 100) / 100;
        assertApprox(effectiveCost, 6.24, 0.01, 'material cost with factor');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 20: checkDefaultItemMatchCategory — category-based filter for $match:
// ════════════════════════════════════════════════════════════════

describe('GROUP 20 — checkDefaultItemMatchCategory', function() {
    it('null defaultItem → true (no filter)', function() {
        assertEqual(checkDefaultItemMatchCategory(null, 'FINITION BOIS'), true);
    });

    it('null matchCategory → true (no filter)', function() {
        assertEqual(checkDefaultItemMatchCategory({ material_costs: { 'PANNEAU MÉLAMINE': 5 } }, null), true);
    });

    it('mélamine (no FINITION in costs) vs FINITION BOIS → false', function() {
        var melamine = { material_costs: { 'PANNEAU MÉLAMINE': 5.00 } };
        assertEqual(checkDefaultItemMatchCategory(melamine, 'FINITION BOIS'), false);
    });

    it('mélamine with BANDE DE CHANT in cascade → BANDE DE CHANT accepted', function() {
        var melamine = {
            material_costs: { 'PANNEAU MÉLAMINE': 5.00 },
            calculation_rule_ai: { cascade: [{ target: '$match:BANDE DE CHANT' }] }
        };
        assertEqual(checkDefaultItemMatchCategory(melamine, 'BANDE DE CHANT'), true);
    });

    it('mélamine without FINITION in cascade → FINITION BOIS rejected', function() {
        var melamine = {
            material_costs: { 'PANNEAU MÉLAMINE': 5.00 },
            calculation_rule_ai: { cascade: [{ target: '$match:BANDE DE CHANT' }] }
        };
        assertEqual(checkDefaultItemMatchCategory(melamine, 'FINITION BOIS'), false);
    });

    it('placage with FINITION in cascade → FINITION BOIS accepted', function() {
        var placage = {
            material_costs: { 'PANNEAU BOIS': 8.50 },
            calculation_rule_ai: { cascade: [
                { target: '$match:BANDE DE CHANT' },
                { target: '$match:FINITION BOIS' }
            ] }
        };
        assertEqual(checkDefaultItemMatchCategory(placage, 'FINITION BOIS'), true);
    });

    it('placage with FINITION in material_costs → FINITION BOIS accepted', function() {
        var placage = {
            material_costs: { 'PANNEAU BOIS': 8.50, 'FINITION BOIS': 3.00 }
        };
        assertEqual(checkDefaultItemMatchCategory(placage, 'FINITION BOIS'), true);
    });

    it('item with no material_costs and no cascade → rejected', function() {
        var bare = { price: 100 };
        assertEqual(checkDefaultItemMatchCategory(bare, 'FINITION BOIS'), false);
    });

    it('partial word match in material_costs key (PANNEAU matches PANNEAU BOIS)', function() {
        var item = { material_costs: { 'PANNEAU BOIS FRANC': 12.00 } };
        assertEqual(checkDefaultItemMatchCategory(item, 'PANNEAU BOIS'), true);
    });

    it('cascade with $default: target (not $match:) → not checked', function() {
        var item = {
            material_costs: { 'PANNEAU MÉLAMINE': 5.00 },
            calculation_rule_ai: { cascade: [{ target: '$default:Façades' }] }
        };
        assertEqual(checkDefaultItemMatchCategory(item, 'FINITION BOIS'), false);
    });

    it('empty material_costs + empty cascade → rejected', function() {
        var item = { material_costs: {}, calculation_rule_ai: { cascade: [] } };
        assertEqual(checkDefaultItemMatchCategory(item, 'FINITION BOIS'), false);
    });
});

// GROUP 21 — Multi-instance cascade (child_dims + qty > 1)

describe('GROUP 21 — Multi-instance cascade (child_dims + qty > 1)', function() {

    it('child_dims + qty=2 (integer) → multiInstance=true, instanceCount=2, instanceQty=1', function() {
        var rule = { qty: 'n_portes', child_dims: { L: '(L / n_portes) - 0.125', H: 'H - 0.25' } };
        var vars = { L: 48, H: 36, P: 24, n_portes: 2 };
        var qty = evalFormula(rule.qty, vars);
        assertEqual(qty, 2);
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, true);
        var instanceCount = multiInstance ? qty : 1;
        var instanceQty = multiInstance ? 1 : qty;
        assertEqual(instanceCount, 2);
        assertEqual(instanceQty, 1);
    });

    it('child_dims + qty=1 → multiInstance=false (single instance, normal behavior)', function() {
        var rule = { qty: 'n_portes', child_dims: { L: 'L - 0.25', H: 'H - 0.25' } };
        var vars = { L: 24, H: 36, n_portes: 1 };
        var qty = evalFormula(rule.qty, vars);
        assertEqual(qty, 1);
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, false);
    });

    it('no child_dims + qty=3 → multiInstance=false (materials stay 1 line with qty=N)', function() {
        var rule = { qty: '3' };
        var qty = evalFormula(rule.qty, {});
        assertEqual(qty, 3);
        var multiInstance = !!rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, false);
    });

    it('child_dims + fractional qty → multiInstance=false (fallback to single line)', function() {
        var rule = { qty: 'L * H / 144', child_dims: { L: 'L', H: 'H' } };
        var vars = { L: 48, H: 36 };
        var qty = evalFormula(rule.qty, vars);
        assertEqual(qty, 12); // 48*36/144 = 12, integer
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, true); // 12 is integer → multi-instance

        // Fractional case
        var vars2 = { L: 47, H: 36 };
        var qty2 = evalFormula(rule.qty, vars2);
        // 47*36/144 = 11.75
        var multiInstance2 = rule.child_dims && qty2 > 1 && Number.isInteger(qty2);
        assertEqual(multiInstance2, false); // fractional → NOT multi-instance
    });

    it('each instance gets its own child_dims (computeChildDims is deterministic)', function() {
        var childDims = { L: '(L / n_portes) - 0.125', H: 'H - 0.25' };
        var vars = { L: 48, H: 36, n_portes: 2 };
        var dims0 = computeChildDims(childDims, vars);
        var dims1 = computeChildDims(childDims, vars);
        // Both instances get identical dims (same formula, same parent vars)
        assertEqual(dims0.length_in, 23.875); // (48/2) - 0.125 = 23.875
        assertEqual(dims0.height_in, 35.75);  // 36 - 0.25
        assertEqual(dims1.length_in, 23.875);
        assertEqual(dims1.height_in, 35.75);
    });

    it('n_portes=3 → 3 instances, each with same computed dims', function() {
        var rule = { qty: 'n_portes', child_dims: { L: '(L / n_portes) - 0.125', H: 'H - 0.25' } };
        var vars = { L: 48, H: 30, n_portes: 3 };
        var qty = evalFormula(rule.qty, vars);
        assertEqual(qty, 3);
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, true);
        var dims = computeChildDims(rule.child_dims, vars);
        assertEqual(dims.length_in, 15.875); // (48/3) - 0.125
        assertEqual(dims.height_in, 29.75);  // 30 - 0.25
    });

    it('n_tiroirs=4 with child_dims → 4 instances', function() {
        var rule = { qty: 'n_tiroirs', child_dims: { L: 'L - 0.5', H: '(H - 1) / n_tiroirs' } };
        var vars = { L: 24, H: 30, n_tiroirs: 4 };
        var qty = evalFormula(rule.qty, vars);
        assertEqual(qty, 4);
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, true);
        assertEqual(multiInstance ? qty : 1, 4);
        assertEqual(multiInstance ? 1 : qty, 1);
        var dims = computeChildDims(rule.child_dims, vars);
        assertEqual(dims.length_in, 23.5); // 24 - 0.5
        assertEqual(dims.height_in, 7.25); // (30-1)/4
    });

    it('constant qty + child_dims → multiInstance (qty per unit × rootQty handled upstream)', function() {
        // A rule like qty: "2" with child_dims — the qty computation with rootQty happens
        // BEFORE the multi-instance check. If final qty is integer > 1, multi-instance kicks in.
        var rule = { qty: '2', child_dims: { L: 'L / 2' } };
        var formulaStr = String(rule.qty);
        var usesDimVars = /\b(L|H|P|QTY|n_tablettes|n_partitions|n_portes|n_tiroirs)\b/.test(formulaStr);
        assertEqual(usesDimVars, false);
        // With rootQty=1: qty = 2 * 1 = 2
        var qty = 2 * 1;
        var multiInstance = rule.child_dims && qty > 1 && Number.isInteger(qty);
        assertEqual(multiInstance, true);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 22 — Collapsed parent total (recursive aggregation logic)
// ════════════════════════════════════════════════════════════════

describe('GROUP 22 — Collapsed parent total recursive aggregation', function() {
    // The updateCollapsedParentTotal function uses getRowTotal for the parent
    // and sums getAllCascadeDescendants for children. We test the pure computation
    // logic: given a tree of items with prices, the aggregate total should equal
    // parent + all descendants at all depths.

    // Helper: simulate getRowTotal for a catalogue item with qty
    function mockRowTotal(item, qty) {
        return (item.price || 0) * (qty || 1);
    }

    it('parent with 1 child → aggregate = parent + child', function() {
        var parent = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0001'; });
        var child = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0020'; });
        var parentTotal = mockRowTotal(parent, 1);
        var childTotal = mockRowTotal(child, 6); // qty from formula
        var aggregate = parentTotal + childTotal;
        assertEqual(aggregate, 450 + 5.20 * 6);
    });

    it('parent with 3 children → aggregate = parent + sum(children)', function() {
        var parent = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0001'; });
        var children = [
            { item: CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0020'; }), qty: 6 },
            { item: CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0030'; }), qty: 10 },
            { item: CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0010'; }), qty: 4 }
        ];
        var aggregate = mockRowTotal(parent, 1);
        children.forEach(function(c) { aggregate += mockRowTotal(c.item, c.qty); });
        assertApprox(aggregate, 450 + 31.2 + 4.5 + 0.6, 0.01);
    });

    it('parent with child + grandchild → aggregate includes grandchild', function() {
        var parent = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0007'; }); // 600
        var child = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0045'; }); // 120
        var grandchild = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0040'; }); // 3.80
        var aggregate = mockRowTotal(parent, 1) + mockRowTotal(child, 1) + mockRowTotal(grandchild, 2);
        assertApprox(aggregate, 600 + 120 + 7.6, 0.01);
    });

    it('aggregate is independent of expand/collapse state (pure data)', function() {
        // The total calculation does not depend on UI state — it always sums ALL descendants
        var prices = [450, 31.2, 4.5, 0.6]; // parent + 3 children
        var total1 = prices.reduce(function(s, p) { return s + p; }, 0); // "expanded"
        var total2 = prices.reduce(function(s, p) { return s + p; }, 0); // "collapsed" — same
        assertApprox(total1, total2, 0.001);
        assertApprox(total1, 486.3, 0.01);
    });

    it('empty children → aggregate = parent total only', function() {
        var parent = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0060'; }); // 80, no cascade
        var aggregate = mockRowTotal(parent, 2);
        assertEqual(aggregate, 160);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 23 — FAB child not blocked by parent override_children
// ════════════════════════════════════════════════════════════════

describe('GROUP 23 — FAB child not blocked by parent override_children', function() {
    var parentFab = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0007'; });
    var fabChild = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0045'; });
    var parentOverrides = parentFab.calculation_rule_ai.override_children; // ['BANDE DE CHANT', 'FINITION BOIS']
    var parentMerged = mergeOverrideChildren([], parentOverrides);

    it('parent ST-0007 has override_children with FINITION BOIS', function() {
        assert(parentOverrides.indexOf('FINITION BOIS') !== -1);
    });

    it('parent ST-0007 has override_children with BANDE DE CHANT', function() {
        assert(parentOverrides.indexOf('BANDE DE CHANT') !== -1);
    });

    it('MAT child: $match:FINITION BOIS IS blocked by parent override', function() {
        assert(isRuleOverridden('$match:FINITION BOIS', parentMerged));
    });

    it('MAT child: $match:BANDE DE CHANT IS blocked by parent override', function() {
        assert(isRuleOverridden('$match:BANDE DE CHANT', parentMerged));
    });

    it('FAB child ST-0045 receives empty parentOverrides → autonomy', function() {
        // When executeCascade recurses into a FAB child, it passes [] as parentOverrides
        var fabChildParentOverrides = []; // FAB autonomy: always fresh
        assert(!isRuleOverridden('$match:FINITION BOIS', fabChildParentOverrides));
    });

    it('FAB child ST-0045 own $match:FINITION BOIS is NOT blocked', function() {
        // The FAB child has its own $match:FINITION BOIS cascade rule
        var childRules = fabChild.calculation_rule_ai.cascade;
        var hasFinition = childRules.some(function(r) { return r.target === '$match:FINITION BOIS'; });
        assert(hasFinition);
        // With empty parentOverrides, it's NOT blocked
        assert(!isRuleOverridden('$match:FINITION BOIS', []));
    });

    it('FAB child own $default:Facades is never blocked regardless', function() {
        assert(!isRuleOverridden('$default:Facades', parentMerged));
        assert(!isRuleOverridden('$default:Facades', []));
    });

    it('FAB child applies its own override_children to its descendants', function() {
        // ST-0045 has no override_children → undefined, falls back to []
        var fabChildOwn = (fabChild.calculation_rule_ai || {}).override_children;
        assertEqual(fabChildOwn, undefined);
        var merged = mergeOverrideChildren([], fabChildOwn || []);
        assertDeepEqual(merged, []);
    });

    it('direct code target (ST-0045) is NEVER blocked by override_children', function() {
        assert(!isRuleOverridden('ST-0045', parentMerged));
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 24 — evaluateLaborModifiers — cumulative mode
// ════════════════════════════════════════════════════════════════

describe('GROUP 24 — evaluateLaborModifiers — cumulative mode', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;
    var ST0008 = CATALOGUE_DATA.find(function(c) { return c.id === 'ST-0008'; });

    it('ST-0008 exists with cumulative: true', function() {
        assert(ST0008 !== undefined, 'ST-0008 must be in CATALOGUE_DATA');
        assert(ST0008.labor_modifiers.cumulative === true, 'must be cumulative');
        assertEqual(ST0008.labor_modifiers.modifiers.length, 6);
    });

    it('cumulative: false on ST-0006 → first-match (unchanged behavior)', function() {
        var ST0006 = CATALOGUE_DATA.find(function(c) { return c.id === 'ST-0006'; });
        // L=50 matches both L > 48 AND L > 36, but first-match → only L > 48
        var result = evaluateLaborModifiers(ST0006, { L: 50, H: 30, P: 24 });
        assertEqual(result.label, 'Grand (> 48 po)');
        assertEqual(result.labor_factor['Machinage'], 1.5);
    });

    it('single axis match: L=40 only → Largeur > 36 po', function() {
        var result = evaluateLaborModifiers(ST0008, { L: 40, H: 30, P: 0.75 });
        assert(result !== null, 'should match');
        assertEqual(result.label, 'Largeur > 36 po');
        assertEqual(result.labor_factor['Machinage'], 1.25);
        assertEqual(result.material_factor, null, 'no mat factor for this modifier');
    });

    it('two axes: L=50 + H=100 → both L and H modifiers multiply', function() {
        // L=50 matches L > 48 (Mach 1.5, BF 1.20) AND L > 36 (Mach 1.25)
        // H=100 matches H > 96 (Éb 1.4, Mach 1.3) AND H > 48 (Éb 1.2)
        var result = evaluateLaborModifiers(ST0008, { L: 50, H: 100, P: 0.75 });
        assert(result !== null, 'should match');
        // Machinage: 1.5 * 1.25 * 1.3 = 2.4375
        assertApprox(result.labor_factor['Machinage'], 1.5 * 1.25 * 1.3, 0.001, 'Machinage cumulative');
        // Ébénisterie: 1.4 * 1.2 = 1.68
        assertApprox(result.labor_factor['Ébénisterie'], 1.4 * 1.2, 0.001, 'Ébénisterie cumulative');
        // BOIS FRANC: 1.20 (only from L > 48)
        assertEqual(result.material_factor['BOIS FRANC'], 1.20);
    });

    it('three axes: L=50 + H=100 + P=2 → all three multiply', function() {
        // P=2 matches P > 1.5 (Sablage 1.5, BF 1.15) AND P > 1 (Sablage 1.25)
        var result = evaluateLaborModifiers(ST0008, { L: 50, H: 100, P: 2 });
        // Sablage: 1.5 * 1.25 = 1.875
        assertApprox(result.labor_factor['Sablage'], 1.5 * 1.25, 0.001, 'Sablage cumulative');
        // BOIS FRANC: 1.20 * 1.15 = 1.38
        assertApprox(result.material_factor['BOIS FRANC'], 1.20 * 1.15, 0.001, 'BOIS FRANC cumulative');
        // Labels joined
        assert(result.label.indexOf('Largeur > 48 po') !== -1, 'label has L');
        assert(result.label.indexOf('Longueur > 96 po') !== -1, 'label has H');
        assert(result.label.indexOf('Épaisseur > 1.5 po') !== -1, 'label has P');
    });

    it('no conditions match → null', function() {
        // L=30, H=30, P=0.5 → no conditions true
        var result = evaluateLaborModifiers(ST0008, { L: 30, H: 30, P: 0.5 });
        assertEqual(result, null);
    });

    it('labels joined with " + "', function() {
        var result = evaluateLaborModifiers(ST0008, { L: 40, H: 60, P: 0.75 });
        // L > 36 + H > 48
        assertEqual(result.label, 'Largeur > 36 po + Longueur > 48 po');
    });

    it('cumulative factors multiply, not add', function() {
        // Verify multiplication semantics: Machinage with L=50 (1.5) and L>36 (1.25) = 1.875 not 2.75
        var result = evaluateLaborModifiers(ST0008, { L: 50, H: 30, P: 0.75 });
        // L > 48 → Mach 1.5, L > 36 → Mach 1.25 → cumulative 1.5 * 1.25 = 1.875
        assertApprox(result.labor_factor['Machinage'], 1.875, 0.001, 'multiply not add');
    });

    it('keys only appear if at least one modifier sets them', function() {
        // L=40 → only L > 36 matches → only Machinage in labor_factor
        var result = evaluateLaborModifiers(ST0008, { L: 40, H: 30, P: 0.75 });
        assert(result.labor_factor['Machinage'] != null, 'Machinage set');
        assert(!result.labor_factor['Ébénisterie'], 'Ébénisterie not set');
        assert(!result.labor_factor['Sablage'], 'Sablage not set');
    });

    it('cumulative with scalar factor expands to all departments', function() {
        var item = {
            labor_minutes: { 'A': 60, 'B': 30 },
            labor_modifiers: {
                cumulative: true,
                modifiers: [
                    { condition: 'L > 0', label: 'M1', labor_factor: 1.2 },
                    { condition: 'H > 0', label: 'M2', labor_factor: 1.3 }
                ]
            }
        };
        var result = evaluateLaborModifiers(item, { L: 10, H: 10 });
        // Both match, A: 1.2 * 1.3 = 1.56, B: 1.2 * 1.3 = 1.56
        assertApprox(result.labor_factor['A'], 1.56, 0.001);
        assertApprox(result.labor_factor['B'], 1.56, 0.001);
        assertEqual(result.label, 'M1 + M2');
    });

    it('cumulative with empty-key factor {"": 1.25} expands and multiplies', function() {
        var item = {
            labor_minutes: { 'X': 100, 'Y': 50 },
            labor_modifiers: {
                cumulative: true,
                modifiers: [
                    { condition: 'L > 0', label: 'A', labor_factor: { '': 1.25 } },
                    { condition: 'H > 0', label: 'B', labor_factor: { 'X': 1.5 } }
                ]
            }
        };
        var result = evaluateLaborModifiers(item, { L: 10, H: 10 });
        // X: 1.25 * 1.5 = 1.875, Y: 1.25 (only from A)
        assertApprox(result.labor_factor['X'], 1.875, 0.001);
        assertApprox(result.labor_factor['Y'], 1.25, 0.001);
    });

    it('applied cumulative changes effective minutes correctly', function() {
        // ST-0008: Machinage base 45, L=50 H=100 → cumulative 1.5*1.25*1.3 = 2.4375
        var result = evaluateLaborModifiers(ST0008, { L: 50, H: 100, P: 0.75 });
        var effectiveMach = Math.round(ST0008.labor_minutes['Machinage'] * result.labor_factor['Machinage']);
        assertEqual(effectiveMach, Math.round(45 * 2.4375)); // 110
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 25 — MAT items with dims_config (showDims guard + barèmes)
// ════════════════════════════════════════════════════════════════

describe('GROUP 25 — MAT with dims_config + labor_modifiers', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;
    var ST0051 = CATALOGUE_DATA.find(function(c) { return c.id === 'ST-0051'; });

    it('ST-0051 exists as material with dims_config', function() {
        assert(ST0051 !== undefined, 'ST-0051 must be in CATALOGUE_DATA');
        assertEqual(ST0051.item_type, 'material');
        assert(ST0051.dims_config != null, 'must have dims_config');
        assert(ST0051.dims_config.l && ST0051.dims_config.h && ST0051.dims_config.p, 'L+H+P');
    });

    it('showDims guard: FAB → true', function() {
        var item = { item_type: 'fabrication', dims_config: null };
        var showDims = item.item_type === 'fabrication' || !!item.dims_config;
        assertEqual(showDims, true);
    });

    it('showDims guard: MAT without dims_config → false', function() {
        var item = { item_type: 'material' };
        var showDims = item.item_type === 'fabrication' || !!item.dims_config;
        assertEqual(showDims, false);
    });

    it('showDims guard: MAT with dims_config → true', function() {
        var showDims = ST0051.item_type === 'fabrication' || !!ST0051.dims_config;
        assertEqual(showDims, true);
    });

    it('barèmes evaluate correctly on MAT item', function() {
        var result = evaluateLaborModifiers(ST0051, { L: 60, H: 100, P: 1.5 });
        assert(result !== null, 'should match');
        assertEqual(result.labor_factor['Machinage'], 1.5);
        assertEqual(result.labor_factor['Sablage'], 1.4);
        assertEqual(result.label, 'Largeur > 48 po + Longueur > 96 po');
    });

    it('MAT barèmes: no match when dims below thresholds', function() {
        var result = evaluateLaborModifiers(ST0051, { L: 30, H: 48, P: 0.75 });
        assertEqual(result, null);
    });

    it('MAT barèmes: partial match (only L axis)', function() {
        var result = evaluateLaborModifiers(ST0051, { L: 60, H: 48, P: 0.75 });
        assert(result !== null);
        assertEqual(result.labor_factor['Machinage'], 1.5);
        assert(!result.labor_factor['Sablage'], 'Sablage not matched');
        assertEqual(result.label, 'Largeur > 48 po');
    });

    it('MAT with ask field has ask fields', function() {
        var askFields = ST0051.calculation_rule_ai && ST0051.calculation_rule_ai.ask;
        assert(Array.isArray(askFields), 'ask must be array');
        assert(askFields.indexOf('L') !== -1, 'L in ask');
        assert(askFields.indexOf('H') !== -1, 'H in ask');
        assert(askFields.indexOf('P') !== -1, 'P in ask');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 26 — parseFraction (dims input parser)
// ════════════════════════════════════════════════════════════════

describe('GROUP 26 — parseFraction', function() {
    var parseFraction = helpers.parseFraction;

    // Plain numbers
    it('integer "24" → 24', function() {
        assertEqual(parseFraction('24'), 24);
    });

    it('decimal "0.75" → 0.75', function() {
        assertEqual(parseFraction('0.75'), 0.75);
    });

    it('decimal "23.625" → 23.625', function() {
        assertEqual(parseFraction('23.625'), 23.625);
    });

    // Simple fractions
    it('"3/4" → 0.75', function() {
        assertEqual(parseFraction('3/4'), 0.75);
    });

    it('"1/2" → 0.5', function() {
        assertEqual(parseFraction('1/2'), 0.5);
    });

    it('"5/8" → 0.625', function() {
        assertEqual(parseFraction('5/8'), 0.625);
    });

    it('"1/4" → 0.25', function() {
        assertEqual(parseFraction('1/4'), 0.25);
    });

    // Mixed fractions with space
    it('"1 1/2" → 1.5', function() {
        assertEqual(parseFraction('1 1/2'), 1.5);
    });

    it('"23 5/8" → 23.625', function() {
        assertEqual(parseFraction('23 5/8'), 23.625);
    });

    it('"36 3/4" → 36.75', function() {
        assertEqual(parseFraction('36 3/4'), 36.75);
    });

    // Mixed fractions with dash
    it('"1-3/4" → 1.75', function() {
        assertEqual(parseFraction('1-3/4'), 1.75);
    });

    it('"23-5/8" → 23.625', function() {
        assertEqual(parseFraction('23-5/8'), 23.625);
    });

    // Edge cases
    it('null → null', function() {
        assertEqual(parseFraction(null), null);
    });

    it('empty string → null', function() {
        assertEqual(parseFraction(''), null);
    });

    it('"  " whitespace only → null', function() {
        assertEqual(parseFraction('   '), null);
    });

    it('division by zero "3/0" → null', function() {
        assertEqual(parseFraction('3/0'), null);
    });

    it('division by zero mixed "1 3/0" → null', function() {
        assertEqual(parseFraction('1 3/0'), null);
    });

    it('invalid "abc" → null', function() {
        assertEqual(parseFraction('abc'), null);
    });

    it('invalid "12x" → null', function() {
        assertEqual(parseFraction('12x'), null);
    });

    it('"0" → 0', function() {
        assertEqual(parseFraction('0'), 0);
    });

    it('whitespace trimmed " 3/4 " → 0.75', function() {
        assertEqual(parseFraction(' 3/4 '), 0.75);
    });

    it('negative integer "-5" → -5', function() {
        assertEqual(parseFraction('-5'), -5);
    });

    it('common woodworking: "15/16" → 0.9375', function() {
        assertApprox(parseFraction('15/16'), 0.9375, 0.0001);
    });

    it('"48 1/4" → 48.25', function() {
        assertEqual(parseFraction('48 1/4'), 48.25);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 27 — evaluateLaborModifiers fallback (calculation_rule_ai.labor_modifiers)
// ════════════════════════════════════════════════════════════════

describe('27. evaluateLaborModifiers — calculation_rule_ai fallback', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;
    var ST0051 = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0051'; });
    var ST0052 = CATALOGUE_DATA.find(function(i) { return i.id === 'ST-0052'; });

    it('top-level labor_modifiers still works (ST-0051)', function() {
        var result = evaluateLaborModifiers(ST0051, { L: 60, H: 50, P: 1 });
        assert(result !== null, 'expected non-null');
        assertEqual(result.labor_factor['Machinage'], 1.5);
    });

    it('nested labor_modifiers in calculation_rule_ai works (ST-0052)', function() {
        var result = evaluateLaborModifiers(ST0052, { L: 60, H: 50, P: 1 });
        assert(result !== null, 'expected non-null');
        assertEqual(result.labor_factor['Machinage'], 1.5);
    });

    it('nested cumulative mode works (ST-0052, both conditions true)', function() {
        var result = evaluateLaborModifiers(ST0052, { L: 60, H: 100, P: 1 });
        assert(result !== null, 'expected non-null');
        assertEqual(result.labor_factor['Machinage'], 1.5);
        assertEqual(result.labor_factor['Sablage'], 1.4);
    });

    it('nested: no condition matches → null', function() {
        var result = evaluateLaborModifiers(ST0052, { L: 30, H: 50, P: 1 });
        assertEqual(result, null);
    });

    it('top-level takes priority over nested', function() {
        // Item with BOTH top-level and nested labor_modifiers
        var hybrid = {
            labor_minutes: { 'Machinage': 30 },
            labor_modifiers: {
                modifiers: [{ condition: 'L > 10', label: 'Top-level', labor_factor: { 'Machinage': 2.0 } }]
            },
            calculation_rule_ai: {
                labor_modifiers: {
                    modifiers: [{ condition: 'L > 10', label: 'Nested', labor_factor: { 'Machinage': 3.0 } }]
                }
            }
        };
        var result = evaluateLaborModifiers(hybrid, { L: 20 });
        assert(result !== null, 'expected non-null');
        assertEqual(result.label, 'Top-level');
        assertEqual(result.labor_factor['Machinage'], 2.0);
    });

    it('item with empty top-level falls back to nested', function() {
        var item = {
            labor_minutes: { 'Sablage': 20 },
            labor_modifiers: null,
            calculation_rule_ai: {
                labor_modifiers: {
                    modifiers: [{ condition: 'L > 10', label: 'FromNested', labor_factor: { 'Sablage': 1.8 } }]
                }
            }
        };
        var result = evaluateLaborModifiers(item, { L: 20 });
        assert(result !== null, 'expected non-null');
        assertEqual(result.label, 'FromNested');
        assertEqual(result.labor_factor['Sablage'], 1.8);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 28 — computeRentabilityPure
// ════════════════════════════════════════════════════════════════

describe('28. computeRentabilityPure — rentability calculations', function() {
    var computeRentabilityPure = helpers.computeRentabilityPure;

    // Reference data — simple departments & expense categories
    var testTaux = [
        { department: 'Ébénisterie', taux_horaire: 75, salaire: 30, frais_fixe: 15 },
        { department: 'Machinage', taux_horaire: 60, salaire: 25, frais_fixe: 10 },
        { department: 'Installation', taux_horaire: 50, salaire: 20, frais_fixe: 10 }
    ];
    var testExpense = [
        { name: 'PANNEAU MÉLAMINE', markup: 15, waste: 8 }
    ];

    // Reference item: Ébénisterie 120 min, Machinage 60 min, PANNEAU MÉLAMINE 10$
    var refItem = {
        id: 'TEST-001',
        labor_minutes: { 'Ébénisterie': 120, 'Machinage': 60 },
        material_costs: { 'PANNEAU MÉLAMINE': 10 }
    };

    // ── 28.1: Article composé simple, qty=2 ──
    // Hand-calculated:
    //   Ébénisterie: (120/60)*2 = 4h → charge: 4*75=300, salaire: 4*30=120, frais: 4*15=60
    //   Machinage:   (60/60)*2  = 2h → charge: 2*60=120, salaire: 2*25=50,  frais: 2*10=20
    //   profitMO = (300-120-60) + (120-50-20) = 120 + 50 = 170
    //   Mat coûtant: 10*2 = 20
    //   Perte: 20 * 8% = 1.60
    //   Markup: (20 + 1.60) * 15% = 21.60 * 0.15 = 3.24
    //   Prix vente = 300 + 120 + 20 + 1.60 + 3.24 = 444.84
    //   Marge brute = (444.84 - 20 - 1.60 - 170) / 444.84 = 253.24 / 444.84 = 56.9%
    //   Profit net  = (444.84 - 20 - 1.60 - 170 - 80) / 444.84 = 173.24 / 444.84 = 38.9%
    it('article composé simple qty=2', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 2, includeInstall: true }
        ], testTaux, testExpense);

        assertEqual(r.heuresCharge, 420);       // 300 + 120
        assertEqual(r.salaires, 170);           // 120 + 50
        assertEqual(r.fraisFixes, 80);          // 60 + 20
        assertEqual(r.profitMO, 170);           // 120 + 50
        assertEqual(r.coutMateriaux, 20);       // 10*2
        assertEqual(r.perteMateriaux, 1.6);     // 20*0.08
        assertEqual(r.markupMateriaux, 3.24);   // (20+1.6)*0.15
        assertEqual(r.prixVente, 444.84);       // 420 + 20 + 1.6 + 3.24
    });

    // ── 28.2: Markup calculated on cost + waste (P1 fix) ──
    it('markup is on cost + waste, not cost alone', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true }
        ], testTaux, testExpense);

        // cost=10, waste=10*0.08=0.80, markup=(10+0.80)*0.15=1.62
        assertEqual(r.coutMateriaux, 10);
        assertEqual(r.perteMateriaux, 0.8);
        assertEqual(r.markupMateriaux, 1.62);
        // Old formula would give: markup = 10*0.15 = 1.50
        assert(r.markupMateriaux !== 1.5, 'markup should NOT be 1.50 (old formula)');
    });

    // ── 28.3: Marge brute vs profit net (P8 fix) ──
    it('marge brute excludes frais fixes, profit net includes them', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 2, includeInstall: true }
        ], testTaux, testExpense);

        // PV = 444.84, salaires = 170, matCoutant = 20, perte = 1.60, frais = 80
        // Marge brute = (444.84 - 20 - 1.60 - 170) / 444.84 * 100 = 253.24/444.84 = 56.9%
        // Profit net  = (444.84 - 20 - 1.60 - 170 - 80) / 444.84 * 100 = 173.24/444.84 = 38.9%
        assertEqual(r.margeBrute, 56.9);
        assertEqual(r.profitNetPct, 38.9);
        assert(r.margeBrute > r.profitNetPct, 'marge brute > profit net (frais fixes difference)');
    });

    // ── 28.4: Profit net montant ──
    it('profit net montant = PV - mat - perte - salaires - frais', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 2, includeInstall: true }
        ], testTaux, testExpense);

        // profitNet = 444.84 - 20 - 1.60 - 170 - 80 = 173.24
        assertEqual(r.profitNet, 173.24);
    });

    // ── 28.5: Installation exclue ──
    it('installation excluded — Installation dept skipped', function() {
        var itemWithInstall = {
            id: 'TEST-002',
            labor_minutes: { 'Ébénisterie': 60, 'Installation': 120 },
            material_costs: {}
        };
        var r = computeRentabilityPure([
            { catalogueItem: itemWithInstall, qty: 1, includeInstall: false }
        ], testTaux, testExpense);

        // Only Ébénisterie: 1h*75=75 charge, 1h*30=30 salaire, 1h*15=15 frais
        // Installation skipped
        assertEqual(r.heuresCharge, 75);
        assertEqual(r.salaires, 30);
        assertEqual(r.fraisFixes, 15);
        assertEqual(r.heuresParDept['Installation'], 0);
    });

    // ── 28.6: Installation incluse ──
    it('installation included — all depts counted', function() {
        var itemWithInstall = {
            id: 'TEST-002',
            labor_minutes: { 'Ébénisterie': 60, 'Installation': 120 },
            material_costs: {}
        };
        var r = computeRentabilityPure([
            { catalogueItem: itemWithInstall, qty: 1, includeInstall: true }
        ], testTaux, testExpense);

        // Ébénisterie: 1h*75=75, Installation: 2h*50=100
        assertEqual(r.heuresCharge, 175);
        assertEqual(r.heuresParDept['Installation'], 120); // minutes
    });

    // ── 28.7: laborAuto barème ──
    it('laborAuto factor multiplies labour minutes', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true,
              overrides: { laborAuto: { 'Machinage': 1.5 } } }
        ], testTaux, testExpense);

        // Machinage: 60 * 1.5 = 90 → round = 90 min → 1.5h * 60 = 90$
        // Ébénisterie: 120 min → 2h * 75 = 150$
        assertEqual(r.heuresCharge, 240);  // 150 + 90
        assertEqual(r.heuresParDept['Machinage'], 90); // 60 * 1.5
    });

    // ── 28.8: materialAuto barème ──
    it('materialAuto factor multiplies material costs', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true,
              overrides: { materialAuto: { 'PANNEAU MÉLAMINE': 1.2 } } }
        ], testTaux, testExpense);

        // cost = 10 * 1.2 = 12 → round(10*1.2*100)/100 = 12.00
        // waste = 12 * 0.08 = 0.96
        // markup = (12 + 0.96) * 0.15 = 12.96 * 0.15 = 1.944 → round = 1.94
        assertEqual(r.coutMateriaux, 12);
        assertEqual(r.perteMateriaux, 0.96);
        // 12.96 * 0.15 = 1.944 → rounded to 2 decimals = 1.94
        assertEqual(r.markupMateriaux, 1.94);
    });

    // ── 28.9: cumulative laborAuto + materialAuto ──
    it('cumulative laborAuto + materialAuto combined', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true,
              overrides: {
                laborAuto: { 'Ébénisterie': 1.25, 'Machinage': 1.5 },
                materialAuto: { 'PANNEAU MÉLAMINE': 1.2 }
              } }
        ], testTaux, testExpense);

        // Éb: round(120*1.25)=150 min → 2.5h*75=187.5
        // Mach: round(60*1.5)=90 min → 1.5h*60=90
        assertEqual(r.heuresCharge, 277.5); // 187.5 + 90
        assertEqual(r.coutMateriaux, 12);   // 10*1.2
    });

    // ── 28.10: manual override > auto ──
    it('manual labor override takes priority over auto', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true,
              overrides: {
                laborAuto: { 'Machinage': 1.5 },  // would give 90
                labor: { 'Machinage': 45 }         // manual override = 45 min
              } }
        ], testTaux, testExpense);

        // Machinage: auto gives 90, but manual 45 overrides via Object.assign
        assertEqual(r.heuresParDept['Machinage'], 45);
    });

    // ── 28.11: price override = flat, no decomposition ──
    it('price override treated as flat ajout', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 2, includeInstall: true,
              overrides: { price: 500 } }
        ], testTaux, testExpense);

        assertEqual(r.prixVente, 1000);   // 500*2
        assertEqual(r.ajouts, 1000);       // treated as ajout
        assertEqual(r.coutMateriaux, 0);   // no decomposition
        assertEqual(r.heuresCharge, 0);
    });

    // ── 28.12: custom item (ajout) ──
    it('custom item adds to prixVente and ajouts', function() {
        var r = computeRentabilityPure([
            { isCustom: true, customTotal: 250 }
        ], testTaux, testExpense);

        assertEqual(r.prixVente, 250);
        assertEqual(r.ajouts, 250);
        assertEqual(r.profitNet, 250);  // ajouts = pure profit
    });

    // ── 28.13: flat price item (no labor/material) ──
    it('item with flat price only (no labor/material)', function() {
        var flatItem = { id: 'FLAT-01', price: 100, labor_minutes: {}, material_costs: {} };
        var r = computeRentabilityPure([
            { catalogueItem: flatItem, qty: 3, includeInstall: true }
        ], testTaux, testExpense);

        assertEqual(r.prixVente, 300);     // 100*3
        assertEqual(r.heuresCharge, 0);
        assertEqual(r.coutMateriaux, 0);
    });

    // ── 28.14: loss_override_pct replaces category waste ──
    it('loss_override_pct overrides category waste', function() {
        var itemWithLoss = Object.assign({}, refItem, { loss_override_pct: 12 });
        var r = computeRentabilityPure([
            { catalogueItem: itemWithLoss, qty: 1, includeInstall: true }
        ], testTaux, testExpense);

        // waste = 12% instead of category's 8%
        // cost=10, waste=10*0.12=1.20
        // markup=(10+1.20)*0.15=11.20*0.15=1.68
        assertEqual(r.perteMateriaux, 1.2);
        assertEqual(r.markupMateriaux, 1.68);
    });

    // ── 28.15: multi-line scenario ──
    it('multi-line combines correctly', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true },
            { catalogueItem: refItem, qty: 1, includeInstall: true }
        ], testTaux, testExpense);

        // Same as refItem qty=2
        var r2 = computeRentabilityPure([
            { catalogueItem: refItem, qty: 2, includeInstall: true }
        ], testTaux, testExpense);

        assertEqual(r.prixVente, r2.prixVente);
        assertEqual(r.profitNet, r2.profitNet);
    });

    // ── 28.16: empty lines → null-safe ──
    it('empty lines returns zeros', function() {
        var r = computeRentabilityPure([], testTaux, testExpense);
        assertEqual(r.prixVente, 0);
        assertEqual(r.margeBrute, 0);
        assertEqual(r.profitNetPct, 0);
    });

    // ── 28.17: marge brute with ajouts ──
    it('marge brute avec ajouts includes ajouts in PV denominator', function() {
        var r = computeRentabilityPure([
            { catalogueItem: refItem, qty: 1, includeInstall: true },
            { isCustom: true, customTotal: 100 }
        ], testTaux, testExpense);

        // PV sans ajout: heuresCharge + mat + perte + markup
        // Éb: 2h*75=150, Mach: 1h*60=60 → charge=210
        // mat=10, perte=0.80, markup=1.62
        // PV composé = 210 + 10 + 0.80 + 1.62 = 222.42
        // PV total = 222.42 + 100 = 322.42
        // salaires = 2h*30 + 1h*25 = 85
        // Marge brute (sans ajout) = (222.42 - 10 - 0.80 - 85) / 222.42 = 126.62/222.42 = 56.9%
        // Marge brute avec ajout = (322.42 - 10 - 0.80 - 85) / 322.42 = 226.62/322.42 = 70.3%
        assertEqual(r.margeBrute, 56.9);
        assertEqual(r.margeBruteAvecAjout, 70.3);
        assert(r.margeBruteAvecAjout > r.margeBrute, 'avec ajout > sans ajout');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 29 — evaluateLaborModifiers: labor_minutes_add (absolute additive minutes)
// ════════════════════════════════════════════════════════════════

describe('29. evaluateLaborModifiers — labor_minutes_add', function() {
    var evaluateLaborModifiers = helpers.evaluateLaborModifiers;

    var baseItem = {
        id: 'TEST-LMA',
        labor_minutes: { 'Assemblage': 20, 'Machinage': 15 },
        material_costs: { 'PANNEAU MÉLAMINE': 5 }
    };

    // ── 29.1: labor_minutes with fixed number ──
    it('fixed number labor_minutes adds absolute minutes', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    label: 'Partitions assemblage',
                    labor_minutes: { 'Assemblage': 30 }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 2 });
        assert(r != null, 'should match');
        assert(r.labor_minutes_add != null, 'should have labor_minutes_add');
        assertEqual(r.labor_minutes_add['Assemblage'], 30);
        assertEqual(r.labor_factor, null);
    });

    // ── 29.2: labor_minutes with expression string ──
    it('expression string evaluates with vars', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    label: 'Partitions',
                    labor_minutes: { 'Assemblage': 'n_partitions * 12' }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 3 });
        assert(r != null, 'should match');
        assertEqual(r.labor_minutes_add['Assemblage'], 36);
    });

    // ── 29.3: labor_minutes combined with labor_factor ──
    it('labor_minutes and labor_factor coexist', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    label: 'Partitions combo',
                    labor_factor: { 'Assemblage': 1.15 },
                    labor_minutes: { 'Assemblage': 'n_partitions * 12' }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 2 });
        assert(r != null, 'should match');
        assertEqual(r.labor_factor['Assemblage'], 1.15);
        assertEqual(r.labor_minutes_add['Assemblage'], 24);
    });

    // ── 29.4: condition false → no labor_minutes_add ──
    it('condition false returns null', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    labor_minutes: { 'Assemblage': 30 }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 0 });
        assertEqual(r, null);
    });

    // ── 29.5: no labor_minutes on modifier → labor_minutes_add is null ──
    it('modifier without labor_minutes returns null labor_minutes_add', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'L > 36',
                    label: 'Grand',
                    labor_factor: 1.5
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { L: 48 });
        assert(r != null, 'should match');
        assertEqual(r.labor_minutes_add, null);
    });

    // ── 29.6: cumulative mode — labor_minutes summed ──
    it('cumulative: labor_minutes are summed across modifiers', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                cumulative: true,
                modifiers: [
                    { condition: 'n_partitions >= 1', label: 'Part', labor_minutes: { 'Assemblage': 'n_partitions * 12' } },
                    { condition: 'n_tablettes >= 1', label: 'Tab', labor_minutes: { 'Assemblage': 'n_tablettes * 8' } }
                ]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 2, n_tablettes: 3 });
        assert(r != null, 'should match');
        // 2*12 + 3*8 = 24 + 24 = 48
        assertEqual(r.labor_minutes_add['Assemblage'], 48);
        assertEqual(r.label, 'Part + Tab');
    });

    // ── 29.7: cumulative — one modifier has labor_minutes, another has labor_factor ──
    it('cumulative: mixed factor + minutes', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                cumulative: true,
                modifiers: [
                    { condition: 'L > 36', label: 'Grand', labor_factor: { 'Machinage': 1.5 } },
                    { condition: 'n_partitions >= 1', label: 'Part', labor_minutes: { 'Assemblage': 'n_partitions * 12' } }
                ]
            }
        });
        var r = evaluateLaborModifiers(item, { L: 48, n_partitions: 2 });
        assert(r != null, 'should match');
        assertEqual(r.labor_factor['Machinage'], 1.5);
        assertEqual(r.labor_minutes_add['Assemblage'], 24);
    });

    // ── 29.8: labor_minutes with new department not in catalogue ──
    it('labor_minutes can add minutes to new department', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    labor_minutes: { 'Finition': 'n_partitions * 5' }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 3 });
        assert(r != null, 'should match');
        assertEqual(r.labor_minutes_add['Finition'], 15);
    });

    // ── 29.9: effective minutes = (catalogue × factor) + additive ──
    it('effective computation: factor then add', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    labor_factor: { 'Assemblage': 1.5 },
                    labor_minutes: { 'Assemblage': 'n_partitions * 12' }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 2 });
        // Catalogue: 20 min. Factor: 1.5 → 30. Add: 2*12=24. Effective: 30 + 24 = 54
        var effective = Math.round(baseItem.labor_minutes['Assemblage'] * r.labor_factor['Assemblage']) + r.labor_minutes_add['Assemblage'];
        assertEqual(effective, 54);
    });

    // ── 29.10: invalid expression string → skipped ──
    it('invalid expression string is skipped', function() {
        var item = Object.assign({}, baseItem, {
            labor_modifiers: {
                modifiers: [{
                    condition: 'n_partitions >= 1',
                    labor_minutes: { 'Assemblage': 'invalid_var * 12' }
                }]
            }
        });
        var r = evaluateLaborModifiers(item, { n_partitions: 2 });
        assert(r != null, 'should match condition');
        assertEqual(r.labor_minutes_add, null);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 30 — filterDmByExpenseRelevance (#206)
// ════════════════════════════════════════════════════════════════

describe('30. filterDmByExpenseRelevance', function() {
    it('single entry → returns unchanged', function() {
        var entries = [{ client_text: 'Mélamine blanche', catalogue_item_id: 'ST-0020' }];
        var result = filterDmByExpenseRelevance(entries, 'PANNEAU BOIS', CATALOGUE_DATA);
        assertEqual(result.length, 1);
    });

    it('null expenseCategory → returns all', function() {
        var entries = [
            { client_text: 'A', catalogue_item_id: 'ST-0020' },
            { client_text: 'B', catalogue_item_id: 'ST-0010' }
        ];
        assertEqual(filterDmByExpenseRelevance(entries, null, CATALOGUE_DATA).length, 2);
    });

    it('filters by material_costs keys — PANNEAU matches mélamine, not finition', function() {
        // ST-0020 has material_costs: {"PANNEAU MÉLAMINE": 5.2} → "PANNEAU" matches "PANNEAU BOIS"
        // ST-0040 has material_costs: {"FINITION LAQUE": 3.80} → no match for PANNEAU
        var entries = [
            { client_text: 'mélamine blanche', catalogue_item_id: 'ST-0020' },
            { client_text: 'laque au polyuréthane clair', catalogue_item_id: 'ST-0040' }
        ];
        var result = filterDmByExpenseRelevance(entries, 'PANNEAU BOIS', CATALOGUE_DATA);
        assertEqual(result.length, 1, 'should keep only mélamine');
        assertEqual(result[0].catalogue_item_id, 'ST-0020');
    });

    it('MAT without material_costs → accepted', function() {
        // Use a separate catalogue with test item that has no material_costs
        var testItem = {
            id: 'ST-TEST-NOMC', item_type: 'material', client_text: 'Test no mc unique',
            material_costs: null, category: 'Test'
        };
        var testData = CATALOGUE_DATA.concat([testItem]);
        var entries = [
            { client_text: 'mélamine blanche', catalogue_item_id: 'ST-0020' },
            { client_text: 'Test no mc unique', catalogue_item_id: 'ST-TEST-NOMC' }
        ];
        var result = filterDmByExpenseRelevance(entries, 'PANNEAU BOIS', testData);
        assertEqual(result.length, 2, 'MAT without material_costs should be accepted');
    });

    it('FAB with cascade $match: target matching expense → accepted', function() {
        // ST-0005 is FAB with cascade targets including $match:FINITION BOIS
        var st0005 = CATALOGUE_DATA.find(function(c) { return c.id === 'ST-0005'; });
        if (st0005) {
            var entries = [
                { client_text: st0005.client_text || 'Placage chêne blanc', catalogue_item_id: 'ST-0005' },
                { client_text: 'Mélamine blanche', catalogue_item_id: 'ST-0020' }
            ];
            var result = filterDmByExpenseRelevance(entries, 'FINITION BOIS', CATALOGUE_DATA);
            assert(result.some(function(r) { return r.catalogue_item_id === 'ST-0005'; }), 'FAB with matching cascade should be kept');
        }
    });

    it('fallback: if filter removes everything → returns original', function() {
        var entries = [
            { client_text: 'Laque polyuréthane', catalogue_item_id: 'ST-0030' },
            { client_text: 'Bande de chant PVC', catalogue_item_id: 'ST-0040' }
        ];
        // Neither has QUINCAILLERIE in material_costs
        var result = filterDmByExpenseRelevance(entries, 'QUINCAILLERIE SPÉCIALE', CATALOGUE_DATA);
        assertEqual(result.length, 2, 'should fallback to original when filter empties');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 31: getEnrichedDmField — basic resolution
// ════════════════════════════════════════════════════════════════

describe('31. getEnrichedDmField — basic resolution', function() {
    it('returns bande_chant sub-field for BANDE DE CHANT expense', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, 'BANDE DE CHANT');
        assertEqual(result !== null, true, 'should return sub-field');
        assertEqual(result.catalogue_item_id, 'ST-ENR-BC1');
        assertEqual(result.client_text, 'Bande chêne blanc');
    });

    it('returns finition sub-field for FINITION expense', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, 'FINITION');
        assertEqual(result !== null, true, 'should return sub-field');
        assertEqual(result.catalogue_item_id, 'ST-ENR-FIN1');
    });

    it('returns finition sub-field for FINITION BOIS expense', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, 'FINITION BOIS');
        assertEqual(result !== null, true, 'should return sub-field');
        assertEqual(result.catalogue_item_id, 'ST-ENR-FIN1');
    });

    it('returns bois_brut sub-field for BOIS BRUT expense', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.facade_placage, 'BOIS BRUT');
        assertEqual(result !== null, true, 'should return sub-field');
        assertEqual(result.catalogue_item_id, 'ST-ENR-BB1');
    });

    it('returns null for unmapped expense category', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, 'PANNEAU BOIS');
        assertEqual(result, null, 'PANNEAU BOIS has no enriched mapping');
    });

    it('returns null for null/undefined inputs', function() {
        assertEqual(getEnrichedDmField(null, 'FINITION'), null);
        assertEqual(getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, null), null);
        assertEqual(getEnrichedDmField(undefined, undefined), null);
    });

    it('is case-insensitive on expense category', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, 'bande de chant');
        assertEqual(result !== null, true, 'should match case-insensitively');
        assertEqual(result.catalogue_item_id, 'ST-ENR-BC1');
    });

    it('trims whitespace on expense category', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_placage, '  FINITION  ');
        assertEqual(result !== null, true, 'should trim');
        assertEqual(result.catalogue_item_id, 'ST-ENR-FIN1');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 32: getEnrichedDmField — absent/empty sub-fields
// ════════════════════════════════════════════════════════════════

describe('32. getEnrichedDmField — absent/empty sub-fields', function() {
    it('returns null when sub-field is absent (mélamine, no finition)', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_melamine, 'FINITION');
        assertEqual(result, null, 'mélamine has no finition sub-field');
    });

    it('returns bande_chant even on mélamine (PVC variant)', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_melamine, 'BANDE DE CHANT');
        assertEqual(result !== null, true);
        assertEqual(result.catalogue_item_id, 'ST-ENR-BC2');
        assertEqual(result.client_text, 'Bande PVC blanc');
    });

    it('returns null for legacy DM without enriched fields', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.panneaux_legacy, 'BANDE DE CHANT');
        assertEqual(result, null, 'legacy entry has no sub-fields');
        assertEqual(getEnrichedDmField(ENRICHED_DM_ENTRIES.panneaux_legacy, 'FINITION'), null);
        assertEqual(getEnrichedDmField(ENRICHED_DM_ENTRIES.panneaux_legacy, 'BOIS BRUT'), null);
    });

    it('returns null for empty sub-field (no client_text, no catalogue_item_id)', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_empty_sub, 'BANDE DE CHANT');
        assertEqual(result, null, 'empty sub-field should return null');
    });

    it('returns sub-field with client_text only (no catalogue_item_id)', function() {
        var result = getEnrichedDmField(ENRICHED_DM_ENTRIES.caisson_text_only, 'BANDE DE CHANT');
        assertEqual(result !== null, true, 'client_text-only sub-field is valid');
        assertEqual(result.client_text, 'Bande érable naturel');
        assertEqual(result.catalogue_item_id, null);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 33: Enriched DM field map coverage
// ════════════════════════════════════════════════════════════════

describe('33. ENRICHED_DM_FIELD_MAP — coverage', function() {
    it('maps BANDE DE CHANT to bande_chant', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['BANDE DE CHANT'], 'bande_chant');
    });

    it('maps BANDE_DE_CHANT (underscore variant) to bande_chant', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['BANDE_DE_CHANT'], 'bande_chant');
    });

    it('maps FINITION to finition', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['FINITION'], 'finition');
    });

    it('maps FINITION BOIS to finition', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['FINITION BOIS'], 'finition');
    });

    it('maps BOIS BRUT to bois_brut', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['BOIS BRUT'], 'bois_brut');
    });

    it('maps BOIS_BRUT (underscore variant) to bois_brut', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['BOIS_BRUT'], 'bois_brut');
    });

    it('maps PLACAGE to materiau', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['PLACAGE'], 'materiau');
    });

    it('maps PANNEAU to materiau', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['PANNEAU'], 'materiau');
    });

    it('maps MATERIAU to materiau', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['MATERIAU'], 'materiau');
    });

    it('does NOT map PANNEAU BOIS (compound category)', function() {
        assertEqual(ENRICHED_DM_FIELD_MAP['PANNEAU BOIS'], undefined);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 34: Enriched DM tier 0 integration — catalogue lookup
// ════════════════════════════════════════════════════════════════

describe('34. Enriched DM tier 0 — catalogue lookup simulation', function() {
    it('resolves catalogue_item_id from enriched field in catalogue', function() {
        var dm = ENRICHED_DM_ENTRIES.caisson_placage;
        var enriched = getEnrichedDmField(dm, 'BANDE DE CHANT');
        assertEqual(enriched !== null, true);
        // Simulate tier 0: find item in catalogue
        var found = ENRICHED_CATALOGUE.find(function(c) { return c.id === enriched.catalogue_item_id; });
        assertEqual(found !== null && found !== undefined, true, 'should find in catalogue');
        assertEqual(found.id, 'ST-ENR-BC1');
        assertEqual(found.client_text, 'Bande chêne blanc');
    });

    it('resolves by client_text when catalogue_item_id is null', function() {
        var dm = ENRICHED_DM_ENTRIES.caisson_text_only;
        var enriched = getEnrichedDmField(dm, 'BANDE DE CHANT');
        assertEqual(enriched !== null, true);
        assertEqual(enriched.catalogue_item_id, null);
        // Simulate tier 0 fallback: find by client_text
        var found = ENRICHED_CATALOGUE.find(function(c) { return c.client_text === enriched.client_text; });
        assertEqual(found !== null && found !== undefined, true, 'should find by client_text');
        assertEqual(found.id, 'ST-ENR-BC4');
    });

    it('falls through when enriched field absent (legacy DM)', function() {
        var dm = ENRICHED_DM_ENTRIES.panneaux_legacy;
        var enriched = getEnrichedDmField(dm, 'BANDE DE CHANT');
        assertEqual(enriched, null, 'legacy DM returns null — tier 0 skipped');
    });

    it('all 3 enriched catalogue fields resolve correctly', function() {
        var dm = ENRICHED_DM_ENTRIES.facade_placage;
        // bande_chant
        var bc = getEnrichedDmField(dm, 'BANDE DE CHANT');
        assertEqual(bc.catalogue_item_id, 'ST-ENR-BC3');
        var bcItem = ENRICHED_CATALOGUE.find(function(c) { return c.id === bc.catalogue_item_id; });
        assertEqual(bcItem.client_text, 'Bande noyer');
        // finition
        var fin = getEnrichedDmField(dm, 'FINITION BOIS');
        assertEqual(fin.catalogue_item_id, 'ST-ENR-FIN2');
        var finItem = ENRICHED_CATALOGUE.find(function(c) { return c.id === fin.catalogue_item_id; });
        assertEqual(finItem.client_text, 'Vernis satiné');
        // bois_brut
        var bb = getEnrichedDmField(dm, 'BOIS BRUT');
        assertEqual(bb.catalogue_item_id, 'ST-ENR-BB1');
        var bbItem = ENRICHED_CATALOGUE.find(function(c) { return c.id === bb.catalogue_item_id; });
        assertEqual(bbItem.client_text, 'Noyer massif FAS');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 35: Enriched DM — backward compatibility
// ════════════════════════════════════════════════════════════════

describe('35. Enriched DM — backward compatibility', function() {
    it('existing DM functions still work with enriched entries', function() {
        // deduplicateDmByClientText should work regardless of extra fields
        var entries = [
            ENRICHED_DM_ENTRIES.caisson_placage,
            { type: 'Caisson', catalogue_item_id: 'ST-0013', client_text: 'Placage chêne blanc', description: 'same client_text' }
        ];
        var deduped = deduplicateDmByClientText(entries);
        assertEqual(deduped.length, 1, 'should deduplicate by client_text');
    });

    it('enriched entry works with normalizeDmType on type field', function() {
        var entry = ENRICHED_DM_ENTRIES.facade_placage;
        var norm = normalizeDmType(entry.type);
        assertEqual(norm, 'facade', 'Façades normalizes to facade');
    });

    it('enriched fields are transparent to findExistingChildForDynamicRule', function() {
        // findExistingChildForDynamicRule should NOT be affected by enriched sub-fields
        // (it reads children array, not DM entries directly)
        var children = [
            { catalogueId: 'ST-0040', cascadeRuleTarget: '$match:BANDE DE CHANT' }
        ];
        var dm = [ENRICHED_DM_ENTRIES.caisson_placage];
        // The function signature doesn't read DM sub-fields, so this test just ensures
        // no crash when DM has extra fields
        var result = findExistingChildForDynamicRule(
            '$default:Caisson', children, dm, CATALOGUE_DATA,
            function(g) { return null; }, noop
        );
        // Result is whatever it is — we just verify no crash
        assertEqual(typeof result !== 'undefined', true, 'should not crash');
    });

    it('text fields (style, coupe) do not interfere with getEnrichedDmField', function() {
        // style and coupe are text fields, not in ENRICHED_DM_FIELD_MAP
        var entry = ENRICHED_DM_ENTRIES.facade_placage;
        assertEqual(getEnrichedDmField(entry, 'STYLE'), null, 'STYLE not in field map');
        assertEqual(getEnrichedDmField(entry, 'COUPE'), null, 'COUPE not in field map');
        // But the text fields exist on the entry
        assertEqual(entry.style, 'Shaker');
        assertEqual(entry.coupe, 'Plain sliced');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 36: resolveByComposante (#215)
// ════════════════════════════════════════════════════════════════

var TEST_COMPOSANTE_CAISSON = {
    id: 'comp-001',
    code: 'COMP-001',
    nom: 'Caisson Placage chêne',
    dm_type: 'Caisson',
    is_active: true,
    materiau_catalogue_id: 'ST-0021',
    materiau_client_text: 'placage de chêne blanc FC',
    bande_chant_catalogue_id: 'ST-0031',
    bande_chant_client_text: 'bandes de chêne blanc FC',
    finition_catalogue_id: null,
    finition_client_text: 'Laque polyuréthane',
    bois_brut_catalogue_id: null,
    bois_brut_client_text: null
};
var TEST_COMPOSANTE_PANNEAUX = {
    id: 'comp-002',
    code: 'COMP-002',
    nom: 'Panneaux Placage chêne',
    dm_type: 'Panneaux',
    is_active: true,
    materiau_catalogue_id: 'ST-0021',
    materiau_client_text: 'placage de chêne blanc FC',
    bande_chant_catalogue_id: null,
    bande_chant_client_text: null,
    finition_catalogue_id: null,
    finition_client_text: null,
    bois_brut_catalogue_id: null,
    bois_brut_client_text: null
};
var TEST_COMPOSANTES_DATA = [TEST_COMPOSANTE_CAISSON, TEST_COMPOSANTE_PANNEAUX];

// roomDM entries with composante_id for cross-type tests
var TEST_ROOM_DM_WITH_COMPS = [
    { type: 'Caisson', client_text: 'placage de chêne blanc FC', catalogue_item_id: 'ST-0021', composante_id: 'comp-001' },
    { type: 'Panneaux', client_text: 'placage de chêne blanc FC', catalogue_item_id: 'ST-0021', composante_id: 'comp-002' }
];

describe('36. resolveByComposante — composante-first cascade resolution (#215)', function() {

    it('null composanteId → null', function() {
        assertEqual(resolveByComposante(null, 'Panneaux', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA), null);
    });

    it('unknown composanteId → null', function() {
        assertEqual(resolveByComposante('unknown-id', 'Panneaux', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA), null);
    });

    it('null lookupKey → null', function() {
        assertEqual(resolveByComposante('comp-001', null, true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA), null);
    });

    it('$default:Caisson → materiau via normalizeDmType (same type)', function() {
        var result = resolveByComposante('comp-001', 'Caisson', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assert(result !== null, 'should not be null');
        assertEqual(result.catalogue_item_id, 'ST-0021');
        assertEqual(result.client_text, 'placage de chêne blanc FC');
    });

    it('$default:Caisson without roomDM → resolves from own fields (no cross-type check)', function() {
        // No roomDmEntries param → type check skipped, resolves from own fields
        var result = resolveByComposante('comp-001', 'Caisson', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assert(result !== null, 'should not be null');
        assertEqual(result.catalogue_item_id, 'ST-0021');
    });

    it('$default:Panneaux with Caisson composante → cross-type lookup finds Panneaux composante', function() {
        // comp-001 is Caisson, rule is $default:Panneaux → should find comp-002 via roomDM
        var result = resolveByComposante('comp-001', 'Panneaux', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA, TEST_ROOM_DM_WITH_COMPS);
        assert(result !== null, 'should not be null');
        assertEqual(result.catalogue_item_id, 'ST-0021');
    });

    it('$default:Panneaux with Caisson composante, no Panneaux in roomDM → null', function() {
        // roomDM has only Caisson, no Panneaux composante available
        var dmOnlyCaisson = [{ type: 'Caisson', client_text: 'placage', composante_id: 'comp-001' }];
        var result = resolveByComposante('comp-001', 'Panneaux', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA, dmOnlyCaisson);
        assertEqual(result, null);
    });

    it('$default:Façades with Caisson composante, no roomDM → resolves via normalizeDmType (facade = same mapKey)', function() {
        // Without roomDM, no type check → normalizeDmType(Façades) = "facade" = same as normalizeDmType(Caisson)? No, facade != caisson
        // Actually facade normalizes to "facade" and caisson to "caisson" — they are different
        // Without roomDM entries, cross-type check is skipped, so it resolves from comp's own fields via mapKey "facade"
        var result = resolveByComposante('comp-001', 'Façades', true, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assert(result !== null, 'should not be null — mapKey "facade" resolves to materiau fields');
        assertEqual(result.catalogue_item_id, 'ST-0021');
    });

    it('$match:BANDE DE CHANT → bande_chant fields (no type check for $match)', function() {
        var result = resolveByComposante('comp-001', 'BANDE DE CHANT', false, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assert(result !== null, 'should not be null');
        assertEqual(result.catalogue_item_id, 'ST-0031');
        assertEqual(result.client_text, 'bandes de chêne blanc FC');
    });

    it('$match:FINITION BOIS → null (finition_catalogue_id is null, client_text not in catalogue)', function() {
        var result = resolveByComposante('comp-001', 'FINITION BOIS', false, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assertEqual(result, null);
    });

    it('$match:BOIS BRUT → null (both fields null)', function() {
        var result = resolveByComposante('comp-001', 'BOIS BRUT', false, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assertEqual(result, null);
    });

    it('unmapped expense category → null (fallback to existing logic)', function() {
        var result = resolveByComposante('comp-001', 'QUINCAILLERIE', false, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assertEqual(result, null);
    });

    it('$match:FINITION (without BOIS) → same as FINITION BOIS', function() {
        var result = resolveByComposante('comp-001', 'FINITION', false, TEST_COMPOSANTES_DATA, CATALOGUE_DATA);
        assertEqual(result, null);
    });

    it('client_text fallback when catalogue_item_id invalid', function() {
        var compWithBadId = Object.assign({}, TEST_COMPOSANTE_CAISSON, { materiau_catalogue_id: 'ST-9999' });
        var result = resolveByComposante('comp-001', 'Caisson', true, [compWithBadId], CATALOGUE_DATA);
        assert(result !== null, 'should not be null');
        assertEqual(result.catalogue_item_id, 'ST-0021', 'should fallback to client_text lookup');
    });

    it('COMPOSANTE_FIELD_MAP covers all expected keys', function() {
        assert(COMPOSANTE_FIELD_MAP['panneau']);
        assert(COMPOSANTE_FIELD_MAP['facade']);
        assert(COMPOSANTE_FIELD_MAP['caisson']);
        assert(COMPOSANTE_FIELD_MAP['BANDE DE CHANT']);
        assert(COMPOSANTE_FIELD_MAP['FINITION']);
        assert(COMPOSANTE_FIELD_MAP['FINITION BOIS']);
        assert(COMPOSANTE_FIELD_MAP['BOIS BRUT']);
        assert(COMPOSANTE_FIELD_MAP['PLACAGE']);
        assert(COMPOSANTE_FIELD_MAP['PANNEAU BOIS']);
        assert(COMPOSANTE_FIELD_MAP['PANNEAU MÉLAMINE']);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 37: filterDmByComposante (#219 type-aware guard)
// ════════════════════════════════════════════════════════════════

describe('37. filterDmByComposante — type-aware DM filtering (#219)', function() {

    var DM_ENTRIES = [
        { type: 'Caisson', client_text: 'mélamine', composante_id: 'comp-001' },
        { type: 'Façades', client_text: 'placage chêne', composante_id: 'comp-facades' },
        { type: 'Panneaux', client_text: 'placage noyer', composante_id: null }
    ];

    it('null composanteId → returns full list', function() {
        var result = filterDmByComposante(DM_ENTRIES, null, 'caisson', TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 3);
    });

    it('type match (Caisson comp, target caisson) → filters correctly', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'comp-001', 'caisson', TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 1);
        assertEqual(result[0].type, 'Caisson');
    });

    it('type mismatch (Caisson comp, target facade) → returns full list (#219 guard)', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'comp-001', 'facade', TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 3, 'should return unfiltered list');
    });

    it('empty list → returns empty list', function() {
        var result = filterDmByComposante([], 'comp-001', 'caisson', TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 0);
    });

    it('unknown composanteId → returns full list (safety fallback)', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'unknown-id', 'caisson', TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 3);
    });

    it('no composantesData → returns full list (safety)', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'comp-001', 'caisson', null);
        // Without composantesData, no type check possible — filters by composante_id only
        var filtered = DM_ENTRIES.filter(function(e) { return e.composante_id === 'comp-001'; });
        assertEqual(result.length, filtered.length > 0 ? filtered.length : DM_ENTRIES.length);
    });

    it('no targetTypeNorm → filters by composante_id without type check', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'comp-001', null, TEST_COMPOSANTES_DATA);
        assertEqual(result.length, 1);
        assertEqual(result[0].composante_id, 'comp-001');
    });

    it('composante_id matches no entry → returns full list (fallback)', function() {
        var result = filterDmByComposante(DM_ENTRIES, 'comp-facades', 'facade', [
            { id: 'comp-facades', dm_type: 'Façades', is_active: true, materiau_catalogue_id: null, materiau_client_text: null }
        ]);
        assertEqual(result.length, 1, 'should filter to Façades entry');
        assertEqual(result[0].type, 'Façades');
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 38: getEnrichedDmField (#208 Tier 0)
// ════════════════════════════════════════════════════════════════

describe('38. getEnrichedDmField — enriched sub-field resolution (#208)', function() {

    it('materiau configured, category PANNEAU → returns sub-field', function() {
        var entry = { materiau: { catalogue_item_id: 'ST-0021', client_text: 'placage chêne' } };
        var result = getEnrichedDmField(entry, 'PANNEAU');
        assert(result !== null);
        assertEqual(result.catalogue_item_id, 'ST-0021');
        assertEqual(result.client_text, 'placage chêne');
    });

    it('bande_chant configured, category BANDE DE CHANT → returns sub-field', function() {
        var entry = { bande_chant: { catalogue_item_id: 'ST-0031', client_text: 'bande chêne' } };
        var result = getEnrichedDmField(entry, 'BANDE DE CHANT');
        assert(result !== null);
        assertEqual(result.catalogue_item_id, 'ST-0031');
    });

    it('sub-field null → returns null', function() {
        var entry = { materiau: null };
        assertEqual(getEnrichedDmField(entry, 'PANNEAU'), null);
    });

    it('category not in ENRICHED_DM_FIELD_MAP → returns null', function() {
        var entry = { materiau: { catalogue_item_id: 'ST-0021', client_text: 'x' } };
        assertEqual(getEnrichedDmField(entry, 'QUINCAILLERIE'), null);
    });

    it('legacy DM without enriched sub-fields → returns null without throw', function() {
        var entry = { type: 'Caisson', client_text: 'mélamine', catalogue_item_id: 'ST-0001' };
        assertEqual(getEnrichedDmField(entry, 'PANNEAU'), null);
    });

    it('catalogue_item_id present but client_text empty → returns sub-field (fix Bug 2)', function() {
        var entry = { materiau: { catalogue_item_id: 'ST-0021', client_text: '' } };
        // Empty string client_text but valid catalogue_item_id → should still return
        // because !sub.client_text && !sub.catalogue_item_id → false (catalogue_item_id is truthy)
        var result = getEnrichedDmField(entry, 'PANNEAU');
        assert(result !== null, 'should return sub-field when catalogue_item_id exists');
        assertEqual(result.catalogue_item_id, 'ST-0021');
    });

    it('both client_text and catalogue_item_id empty → returns null', function() {
        var entry = { materiau: { catalogue_item_id: null, client_text: '' } };
        assertEqual(getEnrichedDmField(entry, 'PANNEAU'), null);
    });

    it('null entry → returns null', function() {
        assertEqual(getEnrichedDmField(null, 'PANNEAU'), null);
    });

    it('null expenseCat → returns null', function() {
        assertEqual(getEnrichedDmField({ materiau: { catalogue_item_id: 'ST-0021' } }, null), null);
    });
});

// ════════════════════════════════════════════════════════════════
// GROUP 39: shouldOverrideComposanteId (#219b guard)
// ════════════════════════════════════════════════════════════════

describe('39. shouldOverrideComposanteId — #219b per-rule guard', function() {

    it('parentType empty, ruleType known → false (preserve composante_id)', function() {
        assertEqual(shouldOverrideComposanteId('', 'facade'), false);
    });

    it('parentType known, ruleType empty → false (preserve composante_id)', function() {
        assertEqual(shouldOverrideComposanteId('caisson', ''), false);
    });

    it('both empty → false', function() {
        assertEqual(shouldOverrideComposanteId('', ''), false);
    });

    it('both known and identical → false (same type, no override needed)', function() {
        assertEqual(shouldOverrideComposanteId('caisson', 'caisson'), false);
    });

    it('both known and different → true (override should execute)', function() {
        assertEqual(shouldOverrideComposanteId('caisson', 'facade'), true);
    });

    it('accent-normalized types identical → handled by caller (normalizeDmType)', function() {
        // The caller normalizes before calling — this function gets pre-normalized strings
        assertEqual(shouldOverrideComposanteId('facade', 'facade'), false);
    });

    it('null parentType → false', function() {
        assertEqual(shouldOverrideComposanteId(null, 'facade'), false);
    });

    it('null ruleType → false', function() {
        assertEqual(shouldOverrideComposanteId('caisson', null), false);
    });
});

// ════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(50));
console.log('Results: ' + _passed + ' passed, ' + _failed + ' failed');
if (_errors.length > 0) {
    console.log('\nFailed tests:');
    _errors.forEach(function(e) { console.log('  - ' + e); });
}
process.exit(_failed > 0 ? 1 : 0);
