/**
 * Enriched DM test fixtures (#208)
 *
 * Used by: tests/cascade-engine.test.js (GROUPs 31-35)
 * Source: calculateur.html — DM_ENRICHED_GROUPS, getEnrichedDmField, tier 0
 */

// Enriched DM entries for testing
var ENRICHED_DM_ENTRIES = {
    // Caisson with bande_chant and finition sub-fields
    caisson_placage: {
        type: 'Caisson',
        catalogue_item_id: 'ST-0012',
        client_text: 'Placage chêne blanc',
        coupe: 'Rift cut',
        bande_chant: { catalogue_item_id: 'ST-ENR-BC1', client_text: 'Bande chêne blanc' },
        finition: { catalogue_item_id: 'ST-ENR-FIN1', client_text: 'Laque claire mate' }
    },
    // Caisson mélamine — finition should be disabled/absent
    caisson_melamine: {
        type: 'Caisson',
        catalogue_item_id: 'ST-0015',
        client_text: 'Mélamine blanc',
        bande_chant: { catalogue_item_id: 'ST-ENR-BC2', client_text: 'Bande PVC blanc' }
        // No finition — mélamine doesn't need it
    },
    // Façades with all sub-fields
    facade_placage: {
        type: 'Façades',
        catalogue_item_id: 'ST-0018',
        client_text: 'Placage noyer',
        style: 'Shaker',
        coupe: 'Plain sliced',
        bande_chant: { catalogue_item_id: 'ST-ENR-BC3', client_text: 'Bande noyer' },
        finition: { catalogue_item_id: 'ST-ENR-FIN2', client_text: 'Vernis satiné' },
        bois_brut: { catalogue_item_id: 'ST-ENR-BB1', client_text: 'Noyer massif FAS' }
    },
    // Panneaux without enriched fields (legacy)
    panneaux_legacy: {
        type: 'Panneaux',
        catalogue_item_id: 'ST-0020',
        client_text: 'Mélamine grise',
        description: 'Mélamine grise 805'
        // No enriched sub-fields at all
    },
    // Entry with only client_text on sub-field (no catalogue_item_id)
    caisson_text_only: {
        type: 'Caisson',
        catalogue_item_id: 'ST-0012',
        client_text: 'Placage érable',
        bande_chant: { client_text: 'Bande érable naturel', catalogue_item_id: null }
    },
    // Entry with empty sub-field (should be treated as absent)
    caisson_empty_sub: {
        type: 'Caisson',
        catalogue_item_id: 'ST-0012',
        client_text: 'Placage chêne',
        bande_chant: { client_text: '', catalogue_item_id: null }
    }
};

// Catalogue items for enriched DM resolution
var ENRICHED_CATALOGUE = [
    { id: 'ST-ENR-BC1', client_text: 'Bande chêne blanc', description: 'Bande de chant chêne blanc 2mm', category: 'BANDE DE CHANT', item_type: 'material', material_costs: { 'BANDE DE CHANT': 3.50 } },
    { id: 'ST-ENR-BC2', client_text: 'Bande PVC blanc', description: 'Bande de chant PVC blanc 0.5mm', category: 'BANDE DE CHANT', item_type: 'material', material_costs: { 'BANDE DE CHANT': 1.20 } },
    { id: 'ST-ENR-BC3', client_text: 'Bande noyer', description: 'Bande de chant noyer 2mm', category: 'BANDE DE CHANT', item_type: 'material', material_costs: { 'BANDE DE CHANT': 4.80 } },
    { id: 'ST-ENR-FIN1', client_text: 'Laque claire mate', description: 'Finition laque claire mate', category: 'FINITION', item_type: 'material', material_costs: { 'FINITION BOIS': 8.50 } },
    { id: 'ST-ENR-FIN2', client_text: 'Vernis satiné', description: 'Finition vernis satiné', category: 'FINITION', item_type: 'material', material_costs: { 'FINITION BOIS': 7.20 } },
    { id: 'ST-ENR-BB1', client_text: 'Noyer massif FAS', description: 'Bois brut noyer FAS', category: 'BOIS BRUT', item_type: 'material', material_costs: { 'BOIS BRUT': 18.00 } },
    // Items that should NOT match enriched fields (for fallback testing)
    { id: 'ST-ENR-PAN1', client_text: 'Panneau MDF standard', description: 'Panneau MDF 3/4"', category: 'PANNEAU BOIS', item_type: 'material', material_costs: { 'PANNEAU BOIS': 5.20 } },
    // Item with matching client_text but no catalogue_item_id in DM
    { id: 'ST-ENR-BC4', client_text: 'Bande érable naturel', description: 'Bande de chant érable naturel 2mm', category: 'BANDE DE CHANT', item_type: 'material', material_costs: { 'BANDE DE CHANT': 3.80 } }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ENRICHED_DM_ENTRIES: ENRICHED_DM_ENTRIES,
        ENRICHED_CATALOGUE: ENRICHED_CATALOGUE
    };
}
