/**
 * Room DM configurations and categoryGroupMapping for cascade engine tests.
 *
 * Used by: tests/cascade-engine.test.js
 */

var ROOM_DM = {
    // Room 1: mélamine caisson + placage façades + laque finition
    'room-1': [
        { type: 'Caisson', catalogue_item_id: 'ST-0020', client_text: 'mélamine blanche thermofusionnée 805', description: 'Mélamine blanche' },
        { type: 'Façades', catalogue_item_id: 'ST-0021', client_text: 'placage de chêne blanc FC', description: 'Placage chêne blanc' },
        { type: 'Finition', catalogue_item_id: 'ST-0040', client_text: 'laque au polyuréthane clair', description: 'Laque polyuréthane' }
    ],
    // Room 2: placage caisson only (single DM)
    'room-2': [
        { type: 'Caisson', catalogue_item_id: 'ST-0021', client_text: 'placage de chêne blanc FC', description: 'Placage chêne blanc' }
    ],
    // Room 3: multiple DMs of same type (needs disambiguation)
    'room-3': [
        { type: 'Caisson', catalogue_item_id: 'ST-0020', client_text: 'mélamine blanche thermofusionnée 805', description: 'Mélamine blanche' },
        { type: 'Caisson', catalogue_item_id: 'ST-0021', client_text: 'placage de chêne blanc FC', description: 'Placage chêne blanc' }
    ],
    // Room 4: empty DM
    'room-4': [],
    // Room 5: DM with client_text but no catalogue_item_id
    'room-5': [
        { type: 'Caisson', catalogue_item_id: null, client_text: 'mélamine blanche thermofusionnée 805', description: '' }
    ]
};

/**
 * Maps catalogue categories to material groups.
 * Structure: { "catalogue_category": ["material_group_1", "material_group_2"] }
 * Inverse of what getAllowedCategoriesForGroup returns.
 */
var CATEGORY_GROUP_MAPPING = {
    'Panneaux mélamine': ['Caisson', 'Panneaux'],
    'Panneaux placage': ['Caisson', 'Façades', 'Panneaux'],
    'Quincaillerie': ['Tiroirs', 'Poignées'],
    'Finitions': ['Finition'],
    'Bandes de chant': ['Caisson', 'Façades', 'Panneaux']
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ROOM_DM: ROOM_DM,
        CATEGORY_GROUP_MAPPING: CATEGORY_GROUP_MAPPING
    };
}
