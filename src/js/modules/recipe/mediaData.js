/**
 * Recipe Media Data Configuration
 * Extracted and adapted from Media Maker project
 * Contains all base recipes, ingredient amounts, and formulation data
 */

// Base amounts for different volumes and ingredients (numeric values only)
window.BASE_AMOUNTS = {
    '500mL': {
        'M&S': 2.24,
        'DKW': 2.66,
        'gamborgVitamin': 0.5,
        'sucrose': 15,
        'ppm': 0.5,
        'phytogel': 1.5,
        'agar': 4,
        'metaTopolin': 250,
        'gibberellic': 50,
        'iba': 1.5,
        'naa': 1,
        'agno3': 20,
        'sodiumMetacylitate': 3
    },
    '1L': {
        'M&S': 4.48,
        'DKW': 5.32,
        'gamborgVitamin': 1,
        'sucrose': 30,
        'ppm': 1,
        'phytogel': 3,
        'agar': 8,
        'metaTopolin': 500,
        'gibberellic': 100,
        'iba': 3,
        'naa': 2,
        'agno3': 40,
        'sodiumMetacylitate': 6
    },
    '2L': {
        'M&S': 8.96,
        'DKW': 10.64,
        'gamborgVitamin': 2,
        'sucrose': 60,
        'ppm': 2,
        'phytogel': 6,
        'agar': 16,
        'metaTopolin': 1000,
        'gibberellic': 200,
        'iba': 6,
        'naa': 4,
        'agno3': 80,
        'sodiumMetacylitate': 12
    }
};

// Post-autoclave additions for each media type (numeric values with separate units)
window.POST_AUTOCLAVE_DEFAULTS = {
    'Initiation': [
        { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
        { name: 'Meta-Topolin', amount: 500, key: 'metaTopolin', unit: 'μL' }
    ],
    'Multiplication': [
        { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
        { name: 'Meta-Topolin', amount: 500, key: 'metaTopolin', unit: 'μL' },
        { name: 'Gibberellic Acid', amount: 100, key: 'gibberellic', unit: 'μL' }
    ],
    'Rooting': [
        { name: 'IBA', amount: 3, key: 'iba', unit: 'μL', range: '(2-5μL)' },
        { name: 'NAA', amount: 2, key: 'naa', unit: 'μL' },
        { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
        { name: 'Sodium Metacylitate', amount: 6, key: 'sodiumMetacylitate', unit: 'mL' }
    ]
};

// Default autoclave conditions
window.AUTOCLAVE_DEFAULTS = {
    temperature: 120,
    time: 20,
    coolTo: 55
};

// Default pH range
window.PH_DEFAULTS = {
    value: 5.8,
    range: '(5.7-6.0)'
};

// PPM concentration range
window.PPM_RANGE = '(500μL - 2mL)';

// Quick reference data for the reference card
window.QUICK_REFERENCE = {
    'Base': 'M&S (4.48g) or DKW (5.32g)',
    'Vitamins': 'Gamborg (1g)',
    'Gelling': 'Agar (8g) or Phytogel (3g)',
    'Initiation': '+AgNO3 (40μL), Meta-Topolin (500μL)',
    'Multiplication': '+AgNO3 (40μL), Meta-Topolin (500μL), GA (100μL)',
    'Rooting': '+IBA (2-5μL), NAA (2μL), AgNO3 (40μL), Sodium Metacylitate (6mL)'
};

// Validation ranges for safety checks
window.VALIDATION_RANGES = {
    pH: { min: 5.0, max: 7.0, recommended: { min: 5.7, max: 6.0 } },
    autoclaveTemp: { min: 115, max: 125, recommended: 120 },
    autoclaveTime: { min: 15, max: 30, recommended: 20 }
};

// Unit mappings for ingredients
window.INGREDIENT_UNITS = {
    'M&S': 'g',
    'DKW': 'g',
    'gamborgVitamin': 'g',
    'sucrose': 'g',
    'ppm': 'mL',
    'phytogel': 'g',
    'agar': 'g',
    'metaTopolin': 'μL',
    'gibberellic': 'μL',
    'iba': 'μL',
    'naa': 'μL',
    'agno3': 'μL',
    'sodiumMetacylitate': 'mL',
    'pH': '',
    'autoclaveTemp': '°C',
    'autoclaveTime': 'mins',
    'coolTemp': '°C'
};

// Media type configurations
window.MEDIA_TYPES = ['Initiation', 'Multiplication', 'Rooting'];
window.VOLUME_OPTIONS = ['500mL', '1L', '2L'];
window.BASAL_SALT_OPTIONS = ['M&S', 'DKW'];
window.GELLING_AGENT_OPTIONS = ['Phytogel', 'Agar'];

// Recipe data structure template
window.RECIPE_TEMPLATE = {
    id: '',
    name: '',
    mediaType: 'Initiation',
    volume: '1L',
    basalSalt: {
        type: 'M&S',
        amount: 0
    },
    gellingAgent: {
        type: 'Phytogel',
        amount: 0
    },
    preAutoclave: {
        gamborgVitamin: 0,
        sucrose: 0,
        ppm: 0
    },
    postAutoclave: [],
    pH: 5.8,
    autoclaveConditions: {
        temperature: 120,
        time: 20,
        coolTo: 55
    },
    notes: '',
    createdDate: null,
    lastUsed: null,
    useCount: 0,
    tags: [],
    isTemplate: false
};

// Default recipe templates for common media types
window.DEFAULT_RECIPES = {
    'Initiation_1L_MS': {
        id: 'default_initiation_1l_ms',
        name: 'Standard Initiation (1L M&S)',
        mediaType: 'Initiation',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.48 },
        gellingAgent: { type: 'Phytogel', amount: 3 },
        preAutoclave: {
            gamborgVitamin: 1,
            sucrose: 30,
            ppm: 1
        },
        postAutoclave: [
            { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
            { name: 'Meta-Topolin', amount: 500, key: 'metaTopolin', unit: 'μL' }
        ],
        pH: 5.8,
        autoclaveConditions: {
            temperature: 120,
            time: 20,
            coolTo: 55
        },
        notes: '',
        createdDate: null,
        lastUsed: null,
        useCount: 0,
        tags: ['default', 'initiation', 'standard'],
        isTemplate: true
    },
    'Multiplication_1L_MS': {
        id: 'default_multiplication_1l_ms',
        name: 'Standard Multiplication (1L M&S)',
        mediaType: 'Multiplication',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.48 },
        gellingAgent: { type: 'Phytogel', amount: 3 },
        preAutoclave: {
            gamborgVitamin: 1,
            sucrose: 30,
            ppm: 1
        },
        postAutoclave: [
            { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
            { name: 'Meta-Topolin', amount: 500, key: 'metaTopolin', unit: 'μL' },
            { name: 'Gibberellic Acid', amount: 100, key: 'gibberellic', unit: 'μL' }
        ],
        pH: 5.8,
        autoclaveConditions: {
            temperature: 120,
            time: 20,
            coolTo: 55
        },
        notes: '',
        createdDate: null,
        lastUsed: null,
        useCount: 0,
        tags: ['default', 'multiplication', 'standard'],
        isTemplate: true
    },
    'Rooting_1L_MS': {
        id: 'default_rooting_1l_ms',
        name: 'Standard Rooting (1L M&S)',
        mediaType: 'Rooting',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.48 },
        gellingAgent: { type: 'Phytogel', amount: 3 },
        preAutoclave: {
            gamborgVitamin: 1,
            sucrose: 30,
            ppm: 1
        },
        postAutoclave: [
            { name: 'IBA', amount: 3, key: 'iba', unit: 'μL', range: '(2-5μL)' },
            { name: 'NAA', amount: 2, key: 'naa', unit: 'μL' },
            { name: 'AgNO3', amount: 40, key: 'agno3', unit: 'μL' },
            { name: 'Sodium Metacylitate', amount: 6, key: 'sodiumMetacylitate', unit: 'mL' }
        ],
        pH: 5.8,
        autoclaveConditions: {
            temperature: 120,
            time: 20,
            coolTo: 55
        },
        notes: '',
        createdDate: null,
        lastUsed: null,
        useCount: 0,
        tags: ['default', 'rooting', 'standard'],
        isTemplate: true
    }
};

// All constants are now available as global window properties
