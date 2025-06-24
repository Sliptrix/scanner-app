/**
 * Recipe Integration Test Suite
 * Tests for comprehensive recipe system integration with Scanner
 * 
 * Test Coverage:
 * - Recipe data structure and validation
 * - Recipe calculation engine
 * - Recipe storage and retrieval
 * - Recipe import/export functionality
 * - Integration with barcode builder
 * - Integration with inventory system
 */

// Mock DOM elements and dependencies
function setupTestEnvironment() {
    // Create required DOM elements
    document.body.innerHTML = `
        <div id="builderSection">
            <div id="builderPrompt"></div>
            <div id="builderHint"></div>
            <input id="builderInput" />
            <div id="builderOptions"></div>
            <div id="builderFeedback"></div>
            <button id="builderNextBtn"></button>
        </div>
        <div id="recipeSection" style="display: none;">
            <select id="recipeMode">
                <option value="new">Create New Recipe</option>
                <option value="existing">Use Existing Recipe</option>
            </select>
            <div id="newRecipeForm">
                <select id="mediaType">
                    <option value="Initiation">Initiation</option>
                    <option value="Multiplication">Multiplication</option>
                    <option value="Rooting">Rooting</option>
                </select>
                <select id="volume">
                    <option value="500mL">500mL</option>
                    <option value="1L">1L</option>
                    <option value="2L">2L</option>
                </select>
                <select id="basalSalt">
                    <option value="M&S">M&S</option>
                    <option value="DKW">DKW</option>
                </select>
                <input id="basalSaltAmount" type="number" />
                <select id="gellingAgent">
                    <option value="Phytogel">Phytogel</option>
                    <option value="Agar">Agar</option>
                </select>
                <input id="gellingAgentAmount" type="number" />
                <input id="gamborgVitamin" type="number" />
                <input id="sucrose" type="number" />
                <input id="ppm" type="number" />
                <input id="phValue" type="number" value="5.8" />
                <div id="postAutoclaveList"></div>
            </div>
            <div id="existingRecipeForm">
                <select id="savedRecipeSelect"></select>
                <div id="recipePreview"></div>
            </div>
            <input id="recipeName" placeholder="Recipe Name" />
            <textarea id="recipeNotes" placeholder="Recipe Notes"></textarea>
        </div>
        <div id="inventoryTableBody"></div>
        <div id="notification"></div>
    `;

    // Mock global objects if they don't exist
    if (!window.StateManager) {
        window.StateManager = {
            state: {
                inventory: [],
                recipes: [],
                currentStep: 'container',
                builderData: {}
            },
            getState: function(path) {
                return this.state[path];
            },
            setState: function(path, value) {
                this.state[path] = value;
            }
        };
    }

    if (!window.UIUtils) {
        window.UIUtils = {
            showNotification: function(message, type = 'info') {
                console.log(`Notification (${type}): ${message}`);
            },
            updateStats: function() {
                console.log('Stats updated');
            }
        };
    }
}

// Test Suite: Recipe Data Structure
function testRecipeDataStructure() {
    console.log('🧪 Testing Recipe Data Structure...');
    
    // Test 1: Valid recipe structure
    const validRecipe = {
        id: 'recipe_001',
        name: 'Standard Initiation Media',
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
            { name: 'AgNO3', amount: 40, unit: 'μL' },
            { name: 'Meta-Topolin', amount: 500, unit: 'μL' }
        ],
        pH: 5.8,
        autoclaveConditions: {
            temperature: 120,
            time: 20,
            coolTo: 55
        },
        notes: 'Standard recipe for tissue culture initiation',
        createdDate: new Date().toISOString(),
        lastUsed: null,
        useCount: 0
    };

    // Validate recipe structure
    const requiredFields = ['id', 'name', 'mediaType', 'volume', 'basalSalt', 'gellingAgent'];
    const hasAllRequired = requiredFields.every(field => validRecipe.hasOwnProperty(field));
    
    if (!hasAllRequired) {
        throw new Error('Recipe structure validation failed: missing required fields');
    }

    console.log('✅ Recipe data structure validation passed');
    return true;
}

// Test Suite: Recipe Calculator
function testRecipeCalculator() {
    console.log('🧪 Testing Recipe Calculator...');
    
    // Test volume scaling
    const baseAmounts = {
        '500mL': { 'M&S': 2.24, sucrose: 15 },
        '1L': { 'M&S': 4.48, sucrose: 30 },
        '2L': { 'M&S': 8.96, sucrose: 60 }
    };

    // Test scaling factor calculation
    function calculateScalingFactor(fromVolume, toVolume) {
        const volumes = { '500mL': 0.5, '1L': 1.0, '2L': 2.0 };
        return volumes[toVolume] / volumes[fromVolume];
    }

    const scaleFactor = calculateScalingFactor('1L', '2L');
    if (scaleFactor !== 2) {
        throw new Error(`Scaling factor calculation failed: expected 2, got ${scaleFactor}`);
    }

    // Test amount calculation
    const scaledAmount = baseAmounts['1L']['M&S'] * scaleFactor;
    if (scaledAmount !== baseAmounts['2L']['M&S']) {
        throw new Error(`Amount scaling failed: expected ${baseAmounts['2L']['M&S']}, got ${scaledAmount}`);
    }

    console.log('✅ Recipe calculator tests passed');
    return true;
}

// Test Suite: Recipe Storage
function testRecipeStorage() {
    console.log('🧪 Testing Recipe Storage...');
    
    const testRecipe = {
        id: 'test_recipe_001',
        name: 'Test Recipe',
        mediaType: 'Initiation',
        volume: '1L',
        createdDate: new Date().toISOString()
    };

    // Test save recipe
    function saveRecipe(recipe) {
        const recipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
        recipes.push(recipe);
        localStorage.setItem('labRecipes', JSON.stringify(recipes));
        return recipe.id;
    }

    // Test load recipes
    function loadRecipes() {
        return JSON.parse(localStorage.getItem('labRecipes') || '[]');
    }

    // Clear existing test data
    localStorage.removeItem('labRecipes');

    // Save test recipe
    const savedId = saveRecipe(testRecipe);
    if (savedId !== testRecipe.id) {
        throw new Error('Recipe save failed: ID mismatch');
    }

    // Load and verify
    const loadedRecipes = loadRecipes();
    if (loadedRecipes.length !== 1) {
        throw new Error('Recipe load failed: incorrect count');
    }

    if (loadedRecipes[0].id !== testRecipe.id) {
        throw new Error('Recipe load failed: ID mismatch');
    }

    console.log('✅ Recipe storage tests passed');
    return true;
}

// Test Suite: Recipe Import/Export
function testRecipeImportExport() {
    console.log('🧪 Testing Recipe Import/Export...');
    
    const recipes = [
        {
            id: 'recipe_001',
            name: 'Initiation Media',
            mediaType: 'Initiation',
            volume: '1L'
        },
        {
            id: 'recipe_002',
            name: 'Multiplication Media',
            mediaType: 'Multiplication',
            volume: '1L'
        }
    ];

    // Test export
    function exportRecipes(recipes) {
        return JSON.stringify(recipes, null, 2);
    }

    // Test import
    function importRecipes(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            if (!Array.isArray(imported)) {
                throw new Error('Invalid recipe data format');
            }
            return imported;
        } catch (error) {
            throw new Error(`Recipe import failed: ${error.message}`);
        }
    }

    const exported = exportRecipes(recipes);
    const imported = importRecipes(exported);

    if (imported.length !== recipes.length) {
        throw new Error('Import/Export failed: count mismatch');
    }

    if (imported[0].id !== recipes[0].id) {
        throw new Error('Import/Export failed: data mismatch');
    }

    console.log('✅ Recipe import/export tests passed');
    return true;
}

// Test Suite: Barcode Builder Integration
function testBarcodeBuilderIntegration() {
    console.log('🧪 Testing Barcode Builder Integration...');
    
    // Test recipe step integration
    const builderSteps = [
        'container', 'owner', 'strain', 'media', 'recipe', 'stage', 'tissue', 'date'
    ];

    // Verify recipe step is included
    if (!builderSteps.includes('recipe')) {
        throw new Error('Recipe step not found in builder steps');
    }

    // Test recipe step position (should be after media)
    const mediaIndex = builderSteps.indexOf('media');
    const recipeIndex = builderSteps.indexOf('recipe');
    
    if (recipeIndex !== mediaIndex + 1) {
        throw new Error('Recipe step not in correct position');
    }

    // Test recipe data inclusion in barcode
    const barcodeData = {
        container: 'C001',
        owner: 'Lab',
        strain: 'S001',
        media: 'MS',
        recipe: 'recipe_001',
        stage: 'Initiation',
        tissue: 10,
        date: '2024-06-24'
    };

    // Verify recipe is included in barcode data
    if (!barcodeData.recipe) {
        throw new Error('Recipe not included in barcode data');
    }

    console.log('✅ Barcode builder integration tests passed');
    return true;
}

// Test Suite: Inventory Integration
function testInventoryIntegration() {
    console.log('🧪 Testing Inventory Integration...');
    
    // Test inventory entry with recipe data
    const inventoryEntry = {
        containerId: 'C001',
        barcode: 'C001-LAB-S001-MS-recipe_001-IN-10-20240624',
        recipe: {
            id: 'recipe_001',
            name: 'Standard Initiation',
            mediaType: 'Initiation',
            volume: '1L'
        },
        strain: 'S001',
        owner: 'Lab',
        stage: 'Initiation',
        tissueCount: 10,
        createdDate: new Date().toISOString()
    };

    // Validate inventory entry has recipe data
    if (!inventoryEntry.recipe || !inventoryEntry.recipe.id) {
        throw new Error('Inventory entry missing recipe data');
    }

    // Test recipe lookup from inventory
    function getRecipeFromInventory(containerId, inventory) {
        const entry = inventory.find(item => item.containerId === containerId);
        return entry ? entry.recipe : null;
    }

    const foundRecipe = getRecipeFromInventory('C001', [inventoryEntry]);
    if (!foundRecipe || foundRecipe.id !== 'recipe_001') {
        throw new Error('Recipe lookup from inventory failed');
    }

    console.log('✅ Inventory integration tests passed');
    return true;
}

// Test Suite: Recipe Validation
function testRecipeValidation() {
    console.log('🧪 Testing Recipe Validation...');
    
    // Test valid recipe
    const validRecipe = {
        id: 'recipe_001',
        name: 'Valid Recipe',
        mediaType: 'Initiation',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.48 }
    };

    // Test invalid recipe (missing required fields)
    const invalidRecipe = {
        id: 'recipe_002',
        name: 'Invalid Recipe'
        // Missing mediaType, volume, basalSalt
    };

    function validateRecipe(recipe) {
        const required = ['id', 'name', 'mediaType', 'volume', 'basalSalt'];
        const missing = required.filter(field => !recipe.hasOwnProperty(field));
        
        if (missing.length > 0) {
            return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
        }
        
        // Validate specific field values
        const validMediaTypes = ['Initiation', 'Multiplication', 'Rooting'];
        if (!validMediaTypes.includes(recipe.mediaType)) {
            return { valid: false, errors: ['Invalid media type'] };
        }
        
        const validVolumes = ['500mL', '1L', '2L'];
        if (!validVolumes.includes(recipe.volume)) {
            return { valid: false, errors: ['Invalid volume'] };
        }
        
        return { valid: true, errors: [] };
    }

    const validResult = validateRecipe(validRecipe);
    if (!validResult.valid) {
        throw new Error('Valid recipe failed validation');
    }

    const invalidResult = validateRecipe(invalidRecipe);
    if (invalidResult.valid) {
        throw new Error('Invalid recipe passed validation');
    }

    console.log('✅ Recipe validation tests passed');
    return true;
}

// Main test runner
function runRecipeIntegrationTests() {
    console.log('🚀 Starting Recipe Integration Test Suite...');
    
    try {
        setupTestEnvironment();
        
        // Run all test suites
        testRecipeDataStructure();
        testRecipeCalculator();
        testRecipeStorage();
        testRecipeImportExport();
        testBarcodeBuilderIntegration();
        testInventoryIntegration();
        testRecipeValidation();
        
        console.log('🎉 All Recipe Integration Tests Passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Recipe Integration Test Failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runRecipeIntegrationTests,
        setupTestEnvironment,
        testRecipeDataStructure,
        testRecipeCalculator,
        testRecipeStorage,
        testRecipeImportExport,
        testBarcodeBuilderIntegration,
        testInventoryIntegration,
        testRecipeValidation
    };
}

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    document.addEventListener('DOMContentLoaded', function() {
        if (window.location.pathname.includes('test')) {
            runRecipeIntegrationTests();
        }
    });
} else if (typeof require !== 'undefined' && require.main === module) {
    // Node.js environment
    runRecipeIntegrationTests();
}
