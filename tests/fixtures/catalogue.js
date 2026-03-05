/**
 * Catalogue fixture data for cascade engine tests.
 * Realistic items based on the Stele cabinetry catalogue.
 *
 * Used by: tests/cascade-engine.test.js
 */

var CATALOGUE_DATA = [
    // ── FABRICATION items ──
    {
        id: 'ST-0001',
        description: 'Caisson base standard',
        client_text: 'caisson de base en mélamine',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 450,
        material_costs: {},
        labor_minutes: { 'Ébénisterie': 120, 'Installation': 30 },
        dims_config: { l: true, h: true, p: true },
        calculation_rule_ai: {
            ask: ['L', 'H', 'P'],
            cascade: [
                { target: '$default:Caisson', qty: '(L*P*2+L*H*2)/144' },
                { target: '$match:BANDE DE CHANT', qty: '(L*2+H*2)/12' },
                { target: '$match:FINITION BOIS', qty: '(L*H)/144' },
                { target: 'ST-0010', qty: '4' }
            ],
            override_children: ['BANDE DE CHANT', 'FINITION BOIS']
        }
    },
    {
        id: 'ST-0002',
        description: 'Caisson haut avec tablettes',
        client_text: 'caisson haut avec tablettes',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 520,
        material_costs: {},
        labor_minutes: { 'Ébénisterie': 150 },
        dims_config: { l: true, h: true, p: true },
        calculation_rule_ai: {
            ask: ['L', 'H', 'N_TABLETTES'],
            cascade: [
                { target: '$default:Caisson', qty: '(L*P*2+L*H*2+n_tablettes*L*P)/144' },
                { target: '$match:BANDE DE CHANT', qty: '(L*2+H*2+n_tablettes*L)/12' }
            ]
            // NO override_children — children can generate their own
        }
    },
    {
        id: 'ST-0003',
        description: 'Caisson sans ask ni dims_config',
        client_text: 'caisson simple',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 300,
        material_costs: {},
        labor_minutes: {},
        calculation_rule_ai: {
            cascade: [
                { target: '$default:Caisson', qty: '1' }
            ]
        }
        // No dims_config, no ask
    },
    {
        id: 'ST-0004',
        description: 'Caisson avec dims_config sans ask',
        client_text: 'caisson dims inferred',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 350,
        material_costs: {},
        labor_minutes: {},
        dims_config: { l: true, h: true },
        calculation_rule_ai: {
            // No ask field — should be inferred from dims_config
            cascade: [
                { target: '$default:Caisson', qty: '(L*H)/144' }
            ]
        }
    },

    // ── MATERIAL items ──
    {
        id: 'ST-0010',
        description: 'Vis de montage 2 pouces',
        client_text: 'vis de montage',
        category: 'Quincaillerie',
        item_type: 'material',
        price: 0.15,
        material_costs: { 'QUINCAILLERIE': 0.15 }
    },
    {
        id: 'ST-0020',
        description: 'Mélamine blanche thermofusionnée 805',
        client_text: 'mélamine blanche thermofusionnée 805',
        category: 'Panneaux mélamine',
        item_type: 'material',
        price: 5.20,
        material_costs: { 'PANNEAU MÉLAMINE': 5.20 }
    },
    {
        id: 'ST-0021',
        description: 'Placage chêne blanc FC',
        client_text: 'placage de chêne blanc FC',
        category: 'Panneaux placage',
        item_type: 'material',
        price: 8.50,
        material_costs: { 'PANNEAU PLACAGE': 8.50 }
    },
    {
        id: 'ST-0022',
        description: 'Placage noyer noir FC',
        client_text: 'placage de noyer noir FC',
        category: 'Panneaux placage',
        item_type: 'material',
        price: 9.00,
        material_costs: { 'PANNEAU PLACAGE': 9.00 }
    },
    {
        id: 'ST-0030',
        description: 'Chants PVC assortis 2mm',
        client_text: 'chants PVC assortis',
        category: 'Bandes de chant',
        item_type: 'material',
        price: 0.45,
        material_costs: { 'BANDE DE CHANT PVC': 0.45 }
    },
    {
        id: 'ST-0031',
        description: 'Bandes de chêne blanc FC massif',
        client_text: 'bandes de chêne blanc FC',
        category: 'Bandes de chant',
        item_type: 'material',
        price: 1.20,
        material_costs: { 'BANDE DE CHANT BOIS': 1.20 }
    },
    {
        id: 'ST-0040',
        description: 'Laque polyuréthane claire',
        client_text: 'laque au polyuréthane clair',
        category: 'Finitions',
        item_type: 'material',
        price: 3.80,
        material_costs: { 'FINITION LAQUE': 3.80 }
    },
    {
        id: 'ST-0041',
        description: 'Vernis huile naturelle',
        client_text: 'vernis huile naturelle',
        category: 'Finitions',
        item_type: 'material',
        price: 4.20,
        material_costs: { 'FINITION VERNIS': 4.20 }
    },
    {
        id: 'ST-0050',
        description: 'Panneau placage érable',
        client_text: 'placage érable canadien',
        category: 'Panneaux placage',
        item_type: 'material',
        price: 7.80,
        material_costs: { 'PANNEAU PLACAGE': { cost: 7.80, qty: 1 } }
    },
    {
        id: 'ST-0060',
        description: 'Tablette simple',
        client_text: 'tablette simple',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 80,
        material_costs: {},
        calculation_rule_ai: null
    },
    {
        id: 'ST-0005',
        description: 'Caisson avec portes et tiroirs',
        client_text: 'caisson portes tiroirs',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 500,
        material_costs: {},
        calculation_rule_ai: {
            ask: ['L', 'H', 'P', 'N_PORTES'],
            cascade: [
                { target: '$default:Facades', qty: 'n_portes',
                  condition: 'n_portes > 0',
                  child_dims: { L: '(L / n_portes) - 0.125', H: 'H - 0.25' } },
                { target: '$default:Caisson', qty: '(L*P*2 + L*H*2) / 144' }
            ]
        }
    },

    // ── FABRICATION item with labor_modifiers (barèmes) ──
    {
        id: 'ST-0006',
        description: 'Caisson base avec barèmes',
        client_text: 'caisson barèmes',
        category: 'Caisson',
        item_type: 'fabrication',
        price: 450,
        labor_minutes: { 'Ébénisterie': 120, 'Machinage': 60 },
        material_costs: { 'PANNEAU MÉLAMINE': 5.20 },
        dims_config: { l: true, h: true, p: true },
        labor_modifiers: {
            modifiers: [
                { condition: 'L > 48', label: 'Grand (> 48 po)', labor_factor: { 'Machinage': 1.5 }, material_factor: { 'PANNEAU MÉLAMINE': 1.20 } },
                { condition: 'L > 36', label: 'Moyen (> 36 po)', labor_factor: { 'Machinage': 1.25 } },
                { condition: 'L <= 36', label: 'Standard', labor_factor: null }
            ]
        },
        calculation_rule_ai: { ask: ['L', 'H', 'P'] }
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATALOGUE_DATA: CATALOGUE_DATA };
}
