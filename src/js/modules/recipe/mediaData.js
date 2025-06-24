/**
 * Recipe Media Data Configuration
 * Extracted and adapted from Media Maker project
 * Contains all base recipes, ingredient amounts, and formulation data
 */

// Base amounts for different volumes and ingredients (numeric values only)
export const BASE_AMOUNTS = {
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
export const POST_AUTOCLAVE_DEFAULTS = {
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
export const AUTOCLAVE_DEFAULTS = {
    temperature: 120,
    time: 20,
    coolTo: 55
};

// Default pH range
export const PH_DEFAULTS = {
    value: 5.8,
    range: '(5.7-6.0)'
};

// PPM concentration range
export const PPM_RANGE = '(500μL - 2mL)';

// Quick reference data for the reference card
export const QUICK_REFERENCE = {
    'Base': 'M&S (4.48g) or DKW (5.32g)',
    'Vitamins': 'Gamborg (1g)',
    'Gelling': 'Agar (8g) or Phytogel (3g)',
    'Initiation': '+AgNO3 (40μL), Meta-Topolin (500μL)',
    'Multiplication': '+AgNO3 (40μL), Meta-Topolin (500μL), GA (100μL)',
    'Rooting': '+IBA (2-5μL), NAA (2μL), AgNO3 (40μL), Sodium Metacylitate (6mL)'
};

// Validation ranges for safety checks
export const VALIDATION_RANGES = {
    pH: { min: 5.0, max: 7.0, recommended: { min: 5.7, max: 6.0 } },
    autoclaveTemp: { min: 115, max: 125, recommended: 120 },
    autoclaveTime: { min: 15, max: 30, recommended: 20 }
};

// Unit mappings for ingredients
export const INGREDIENT_UNITS = {
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
export const MEDIA_TYPES = ['Initiation', 'Multiplication', 'Rooting'];
export const VOLUME_OPTIONS = ['500mL', '1L', '2L'];
export const BASAL_SALT_OPTIONS = ['M&S', 'DKW'];
export const GELLING_AGENT_OPTIONS = ['Phytogel', 'Agar'];

// Recipe data structure template
export const RECIPE_TEMPLATE = {
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
export const DEFAULT_RECIPES = {
    'Initiation_1L_MS': {
        ...RECIPE_TEMPLATE,
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
        isTemplate: true,
        tags: ['default', 'initiation', 'standard']
    },
    'Multiplication_1L_MS': {
        ...RECIPE_TEMPLATE,
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
        isTemplate: true,
        tags: ['default', 'multiplication', 'standard']
    },
    'Rooting_1L_MS': {
        ...RECIPE_TEMPLATE,
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
        isTemplate: true,
        tags: ['default', 'rooting', 'standard']
    }
};

// Export all constants for easy importing
export default {
    BASE_AMOUNTS,
    POST_AUTOCLAVE_DEFAULTS,
    AUTOCLAVE_DEFAULTS,
    PH_DEFAULTS,
    PPM_RANGE,
    QUICK_REFERENCE,
    VALIDATION_RANGES,
    INGREDIENT_UNITS,
    MEDIA_TYPES,
    VOLUME_OPTIONS,
    BASAL_SALT_OPTIONS,
    GELLING_AGENT_OPTIONS,
    RECIPE_TEMPLATE,
    DEFAULT_RECIPES
};
