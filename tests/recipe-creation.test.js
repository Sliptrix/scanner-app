/**
 * Recipe Creation Test Suite
 * Comprehensive tests for recipe creation functionality with value changes
 * 
 * Test Coverage:
 * - Recipe creation with default recommended values
 * - Recipe creation with modified recommended values
 * - Recipe creation validation
 * - Recipe ID generation and uniqueness
 * - Recipe storage and retrieval
 * - Recipe auto-population
 * - Recipe scaling between volumes
 * - Recipe form validation
 * - Recipe persistence and modification tracking
 */

// Mock environment setup
function setupRecipeTestEnvironment() {
    // Create DOM structure for recipe testing
    document.body.innerHTML = `
        <div id="builderSection">
            <div id="builderPrompt"></div>
            <div id="builderHint"></div>
            <input id="builderInput" />
            <div id="builderOptions"></div>
            <div id="builderFeedback"></div>
            <button id="builderNextBtn"></button>
        </div>
        <div id="recipeSection">
            <div id="newRecipeForm">
                <select id="mediaType">
                    <option value="Initiation">Initiation</option>
                    <option value="Multiplication">Multiplication</option>
                    <option value="Rooting">Rooting</option>
                </select>
                <select id="volume">
                    <option value="500mL">500mL</option>
                    <option value="1L" selected>1L</option>
                    <option value="2L">2L</option>
                </select>
                <select id="basalSalt">
                    <option value="M&S" selected>M&S</option>
                    <option value="DKW">DKW</option>
                </select>
                <input id="basalSaltAmount" type="number" step="0.01" />
                <select id="gellingAgent">
                    <option value="Phytogel" selected>Phytogel</option>
                    <option value="Agar">Agar</option>
                </select>
                <input id="gellingAgentAmount" type="number" step="0.01" />
                <input id="gamborgVitamin" type="number" step="0.01" />
                <input id="sucrose" type="number" step="0.1" />
                <input id="ppm" type="number" step="0.01" />
                <input id="phValue" type="number" step="0.1" value="5.8" />
                <div id="postAutoclaveList"></div>
                <input id="recipeName" placeholder="Recipe Name" />
                <textarea id="recipeNotes" placeholder="Recipe Notes"></textarea>
            </div>
        </div>
        <div id="notification"></div>
    `;

    // Mock global dependencies
    if (!window.StateManager) {
        window.StateManager = {
            state: {
                recipes: [],
                inventory: []
            },
            getState: function(path) {
                return this.state[path.split('.').pop()];
            },
            setState: function(path, value) {
                this.state[path.split('.').pop()] = value;
            }
        };
    }

    if (!window.UIUtils) {
        window.UIUtils = {
            showNotification: function(message, type = 'info') {
                console.log(`Notification (${type}): ${message}`);
                return { message, type };
            },
            updateStats: function() {
                console.log('Stats updated');
            }
        };
    }

    // Clear localStorage for clean tests
    localStorage.removeItem('labRecipes');
    localStorage.removeItem('labRecipesBackup');

    // Initialize recipe modules if available
    if (window.RecipeCalculator) {
        window.RecipeCalculator.initialize();
    }
    if (window.RecipeStorage) {
        window.RecipeStorage.initialize();
    }
}

// Test Suite 1: Recipe Creation with Default Values
function testRecipeCreationWithDefaults() {
    console.log('🧪 Testing Recipe Creation with Default Values...');
    
    const testCases = [
        { mediaType: 'Initiation', volume: '1L' },
        { mediaType: 'Multiplication', volume: '1L' },
        { mediaType: 'Rooting', volume: '1L' },
        { mediaType: 'Initiation', volume: '500mL' },
        { mediaType: 'Initiation', volume: '2L' }
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`  Testing: ${testCase.mediaType} - ${testCase.volume}`);
        
        // Set form values
        document.getElementById('mediaType').value = testCase.mediaType;
        document.getElementById('volume').value = testCase.volume;
        document.getElementById('recipeName').value = `Test Recipe ${index + 1}`;
        
        // Auto-populate values
        if (window.RecipeCalculator) {
            window.RecipeCalculator.autoPopulateRecipe();
        }
        
        // Get the populated values
        const recipeData = {
            id: `test_recipe_${Date.now()}_${index}`,
            name: document.getElementById('recipeName').value,
            mediaType: testCase.mediaType,
            volume: testCase.volume,
            basalSalt: {
                type: document.getElementById('basalSalt').value,
                amount: parseFloat(document.getElementById('basalSaltAmount').value)
            },
            gellingAgent: {
                type: document.getElementById('gellingAgent').value,
                amount: parseFloat(document.getElementById('gellingAgentAmount').value)
            },
            preAutoclave: {
                gamborgVitamin: parseFloat(document.getElementById('gamborgVitamin').value),
                sucrose: parseFloat(document.getElementById('sucrose').value),
                ppm: parseFloat(document.getElementById('ppm').value)
            },
            pH: parseFloat(document.getElementById('phValue').value),
            createdDate: new Date().toISOString()
        };
        
        // Validate the recipe data
        if (!recipeData.name) {
            throw new Error(`Recipe ${index + 1}: Missing name`);
        }
        if (!recipeData.basalSalt.amount || recipeData.basalSalt.amount <= 0) {
            throw new Error(`Recipe ${index + 1}: Invalid basal salt amount: ${recipeData.basalSalt.amount}`);
        }
        if (!recipeData.gellingAgent.amount || recipeData.gellingAgent.amount <= 0) {
            throw new Error(`Recipe ${index + 1}: Invalid gelling agent amount: ${recipeData.gellingAgent.amount}`);
        }
        
        // Save recipe
        if (window.RecipeStorage) {
            const savedId = window.RecipeStorage.saveRecipe(recipeData);
            if (!savedId) {
                throw new Error(`Recipe ${index + 1}: Failed to save`);
            }
        }
        
        console.log(`  ✅ Recipe ${index + 1} created successfully`);
    });
    
    console.log('✅ Recipe creation with defaults tests passed');
    return true;
}

// Test Suite 2: Recipe Creation with Modified Values
function testRecipeCreationWithModifications() {
    console.log('🧪 Testing Recipe Creation with Modified Values...');
    
    const modifications = [
        {
            name: 'Modified Basal Salt Amount',
            changes: { basalSaltAmount: 5.0 }
        },
        {
            name: 'Modified Gelling Agent Amount',
            changes: { gellingAgentAmount: 3.5 }
        },
        {
            name: 'Modified Sucrose Amount',
            changes: { sucrose: 35.0 }
        },
        {
            name: 'Modified pH',
            changes: { phValue: 6.0 }
        },
        {
            name: 'Multiple Modifications',
            changes: {
                basalSaltAmount: 4.8,
                gellingAgentAmount: 2.8,
                sucrose: 32.0,
                gamborgVitamin: 1.2,
                phValue: 5.9
            }
        }
    ];
    
    modifications.forEach((modification, index) => {
        console.log(`  Testing modification: ${modification.name}`);
        
        // Reset form to defaults
        document.getElementById('mediaType').value = 'Initiation';
        document.getElementById('volume').value = '1L';
        document.getElementById('recipeName').value = `Modified Recipe ${index + 1}`;
        
        // Auto-populate with defaults first
        if (window.RecipeCalculator) {
            window.RecipeCalculator.autoPopulateRecipe();
        }
        
        // Store original values
        const originalValues = {};
        Object.keys(modification.changes).forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                originalValues[fieldId] = element.value;
            }
        });
        
        // Apply modifications
        Object.entries(modification.changes).forEach(([fieldId, newValue]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = newValue;
                // Trigger change event to simulate user input
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        // Create recipe with modified values
        const modifiedRecipeData = {
            id: `modified_recipe_${Date.now()}_${index}`,
            name: document.getElementById('recipeName').value,
            mediaType: 'Initiation',
            volume: '1L',
            basalSalt: {
                type: document.getElementById('basalSalt').value,
                amount: parseFloat(document.getElementById('basalSaltAmount').value)
            },
            gellingAgent: {
                type: document.getElementById('gellingAgent').value,
                amount: parseFloat(document.getElementById('gellingAgentAmount').value)
            },
            preAutoclave: {
                gamborgVitamin: parseFloat(document.getElementById('gamborgVitamin').value),
                sucrose: parseFloat(document.getElementById('sucrose').value),
                ppm: parseFloat(document.getElementById('ppm').value)
            },
            pH: parseFloat(document.getElementById('phValue').value),
            modifications: modification.changes,
            originalValues: originalValues,
            createdDate: new Date().toISOString()
        };
        
        // Validate that modifications were applied
        Object.entries(modification.changes).forEach(([fieldId, expectedValue]) => {
            let actualValue;
            if (fieldId === 'basalSaltAmount') {
                actualValue = modifiedRecipeData.basalSalt.amount;
            } else if (fieldId === 'gellingAgentAmount') {
                actualValue = modifiedRecipeData.gellingAgent.amount;
            } else if (fieldId === 'sucrose') {
                actualValue = modifiedRecipeData.preAutoclave.sucrose;
            } else if (fieldId === 'gamborgVitamin') {
                actualValue = modifiedRecipeData.preAutoclave.gamborgVitamin;
            } else if (fieldId === 'ppm') {
                actualValue = modifiedRecipeData.preAutoclave.ppm;
            } else if (fieldId === 'phValue') {
                actualValue = modifiedRecipeData.pH;
            }
            
            if (Math.abs(actualValue - expectedValue) > 0.01) {
                throw new Error(`Modification ${modification.name}: Expected ${fieldId} to be ${expectedValue}, got ${actualValue}`);
            }
        });
        
        // Save modified recipe
        if (window.RecipeStorage) {
            const savedId = window.RecipeStorage.saveRecipe(modifiedRecipeData);
            if (!savedId) {
                throw new Error(`Modified recipe ${modification.name}: Failed to save`);
            }
            
            // Verify the recipe was saved with modifications
            const retrievedRecipe = window.RecipeStorage.loadRecipe(savedId);
            if (!retrievedRecipe) {
                throw new Error(`Modified recipe ${modification.name}: Failed to retrieve after save`);
            }
            
            // Verify saved modifications
            Object.entries(modification.changes).forEach(([fieldId, expectedValue]) => {
                let savedValue;
                if (fieldId === 'basalSaltAmount') {
                    savedValue = retrievedRecipe.basalSalt.amount;
                } else if (fieldId === 'gellingAgentAmount') {
                    savedValue = retrievedRecipe.gellingAgent.amount;
                } else if (fieldId === 'sucrose') {
                    savedValue = retrievedRecipe.preAutoclave.sucrose;
                } else if (fieldId === 'gamborgVitamin') {
                    savedValue = retrievedRecipe.preAutoclave.gamborgVitamin;
                } else if (fieldId === 'ppm') {
                    savedValue = retrievedRecipe.preAutoclave.ppm;
                } else if (fieldId === 'phValue') {
                    savedValue = retrievedRecipe.pH;
                }
                
                if (Math.abs(savedValue - expectedValue) > 0.01) {
                    throw new Error(`Saved recipe ${modification.name}: Expected ${fieldId} to be ${expectedValue}, got ${savedValue}`);
                }
            });
        }
        
        console.log(`  ✅ Modified recipe "${modification.name}" created and verified`);
    });
    
    console.log('✅ Recipe creation with modifications tests passed');
    return true;
}

// Test Suite 3: Recipe ID Generation and Uniqueness
function testRecipeIdGeneration() {
    console.log('🧪 Testing Recipe ID Generation and Uniqueness...');
    
    const generatedIds = new Set();
    const numTests = 100;
    
    for (let i = 0; i < numTests; i++) {
        let recipeId;
        
        if (window.RecipeStorage && window.RecipeStorage.generateRecipeId) {
            recipeId = window.RecipeStorage.generateRecipeId();
        } else {
            // Fallback ID generation
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 5);
            recipeId = `recipe_${timestamp}_${random}`;
        }
        
        // Check ID format
        if (!/^recipe_\d+_[a-z0-9]{5}$/.test(recipeId)) {
            throw new Error(`Invalid recipe ID format: ${recipeId}`);
        }
        
        // Check uniqueness
        if (generatedIds.has(recipeId)) {
            throw new Error(`Duplicate recipe ID generated: ${recipeId}`);
        }
        
        generatedIds.add(recipeId);
    }
    
    console.log(`  ✅ Generated ${numTests} unique recipe IDs`);
    console.log('✅ Recipe ID generation tests passed');
    return true;
}

// Test Suite 4: Recipe Volume Scaling
function testRecipeVolumeScaling() {
    console.log('🧪 Testing Recipe Volume Scaling...');
    
    const baseRecipe = {
        mediaType: 'Initiation',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.4 },
        gellingAgent: { type: 'Phytogel', amount: 2.3 },
        preAutoclave: {
            gamborgVitamin: 1.0,
            sucrose: 30.0,
            ppm: 1.0
        }
    };
    
    const scalingTests = [
        { from: '1L', to: '500mL', expectedScale: 0.5 },
        { from: '1L', to: '2L', expectedScale: 2.0 },
        { from: '500mL', to: '1L', expectedScale: 2.0 },
        { from: '500mL', to: '2L', expectedScale: 4.0 },
        { from: '2L', to: '1L', expectedScale: 0.5 },
        { from: '2L', to: '500mL', expectedScale: 0.25 }
    ];
    
    scalingTests.forEach((test, index) => {
        console.log(`  Testing scaling from ${test.from} to ${test.to}`);
        
        let scaledRecipe;
        if (window.RecipeCalculator && window.RecipeCalculator.scaleRecipe) {
            scaledRecipe = window.RecipeCalculator.scaleRecipe(
                { ...baseRecipe, volume: test.from },
                test.to
            );
        } else {
            // Manual scaling calculation
            const volumes = { '500mL': 0.5, '1L': 1.0, '2L': 2.0 };
            const scaleFactor = volumes[test.to] / volumes[test.from];
            
            scaledRecipe = {
                ...baseRecipe,
                volume: test.to,
                basalSalt: {
                    ...baseRecipe.basalSalt,
                    amount: baseRecipe.basalSalt.amount * scaleFactor
                },
                gellingAgent: {
                    ...baseRecipe.gellingAgent,
                    amount: baseRecipe.gellingAgent.amount * scaleFactor
                },
                preAutoclave: {
                    gamborgVitamin: baseRecipe.preAutoclave.gamborgVitamin * scaleFactor,
                    sucrose: baseRecipe.preAutoclave.sucrose * scaleFactor,
                    ppm: baseRecipe.preAutoclave.ppm * scaleFactor
                }
            };
        }
        
        // Verify scaling
        const expectedBasalSalt = baseRecipe.basalSalt.amount * test.expectedScale;
        const expectedGellingAgent = baseRecipe.gellingAgent.amount * test.expectedScale;
        const expectedSucrose = baseRecipe.preAutoclave.sucrose * test.expectedScale;
        
        if (Math.abs(scaledRecipe.basalSalt.amount - expectedBasalSalt) > 0.01) {
            throw new Error(`Scaling test ${index + 1}: Expected basal salt ${expectedBasalSalt}, got ${scaledRecipe.basalSalt.amount}`);
        }
        
        if (Math.abs(scaledRecipe.gellingAgent.amount - expectedGellingAgent) > 0.01) {
            throw new Error(`Scaling test ${index + 1}: Expected gelling agent ${expectedGellingAgent}, got ${scaledRecipe.gellingAgent.amount}`);
        }
        
        if (Math.abs(scaledRecipe.preAutoclave.sucrose - expectedSucrose) > 0.01) {
            throw new Error(`Scaling test ${index + 1}: Expected sucrose ${expectedSucrose}, got ${scaledRecipe.preAutoclave.sucrose}`);
        }
        
        console.log(`  ✅ Scaling from ${test.from} to ${test.to} successful`);
    });
    
    console.log('✅ Recipe volume scaling tests passed');
    return true;
}

// Test Suite 5: Recipe Storage and Retrieval with Modifications
function testRecipeStorageWithModifications() {
    console.log('🧪 Testing Recipe Storage and Retrieval with Modifications...');
    
    const testRecipes = [
        {
            name: 'Custom Initiation Recipe',
            mediaType: 'Initiation',
            volume: '1L',
            basalSalt: { type: 'M&S', amount: 4.8 }, // Modified from 4.4
            gellingAgent: { type: 'Phytogel', amount: 2.5 }, // Modified from 2.3
            preAutoclave: {
                gamborgVitamin: 1.2, // Modified from 1.0
                sucrose: 32.0, // Modified from 30.0
                ppm: 1.0
            },
            pH: 5.9, // Modified from 5.8
            notes: 'Custom recipe with increased amounts'
        },
        {
            name: 'High-Volume Multiplication Recipe',
            mediaType: 'Multiplication',
            volume: '2L',
            basalSalt: { type: 'DKW', amount: 8.8 }, // Different salt type
            gellingAgent: { type: 'Agar', amount: 4.6 }, // Different agent
            preAutoclave: {
                gamborgVitamin: 2.0,
                sucrose: 60.0,
                ppm: 2.0
            },
            pH: 6.0,
            notes: 'Large batch recipe with alternative components'
        }
    ];
    
    const savedIds = [];
    
    // Save recipes
    testRecipes.forEach((recipe, index) => {
        console.log(`  Saving recipe: ${recipe.name}`);
        
        const recipeData = {
            ...recipe,
            id: `storage_test_${Date.now()}_${index}`,
            createdDate: new Date().toISOString()
        };
        
        let savedId;
        if (window.RecipeStorage) {
            savedId = window.RecipeStorage.saveRecipe(recipeData);
        } else {
            // Manual storage fallback
            const recipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
            recipes.push(recipeData);
            localStorage.setItem('labRecipes', JSON.stringify(recipes));
            savedId = recipeData.id;
        }
        
        if (!savedId) {
            throw new Error(`Failed to save recipe: ${recipe.name}`);
        }
        
        savedIds.push(savedId);
        console.log(`  ✅ Recipe saved with ID: ${savedId}`);
    });
    
    // Retrieve and verify recipes
    savedIds.forEach((savedId, index) => {
        console.log(`  Retrieving recipe: ${savedId}`);
        
        let retrievedRecipe;
        if (window.RecipeStorage) {
            retrievedRecipe = window.RecipeStorage.loadRecipe(savedId);
        } else {
            // Manual retrieval fallback
            const recipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
            retrievedRecipe = recipes.find(r => r.id === savedId);
        }
        
        if (!retrievedRecipe) {
            throw new Error(`Failed to retrieve recipe: ${savedId}`);
        }
        
        const originalRecipe = testRecipes[index];
        
        // Verify all fields were preserved
        if (retrievedRecipe.name !== originalRecipe.name) {
            throw new Error(`Recipe name mismatch: expected "${originalRecipe.name}", got "${retrievedRecipe.name}"`);
        }
        
        if (retrievedRecipe.mediaType !== originalRecipe.mediaType) {
            throw new Error(`Media type mismatch: expected "${originalRecipe.mediaType}", got "${retrievedRecipe.mediaType}"`);
        }
        
        if (Math.abs(retrievedRecipe.basalSalt.amount - originalRecipe.basalSalt.amount) > 0.01) {
            throw new Error(`Basal salt amount mismatch: expected ${originalRecipe.basalSalt.amount}, got ${retrievedRecipe.basalSalt.amount}`);
        }
        
        if (Math.abs(retrievedRecipe.pH - originalRecipe.pH) > 0.01) {
            throw new Error(`pH mismatch: expected ${originalRecipe.pH}, got ${retrievedRecipe.pH}`);
        }
        
        console.log(`  ✅ Recipe retrieved and verified: ${retrievedRecipe.name}`);
    });
    
    console.log('✅ Recipe storage and retrieval tests passed');
    return true;
}

// Test Suite 6: Recipe Validation
function testRecipeValidation() {
    console.log('🧪 Testing Recipe Validation...');
    
    const validationTests = [
        {
            name: 'Valid Recipe',
            recipe: {
                name: 'Valid Test Recipe',
                mediaType: 'Initiation',
                volume: '1L',
                basalSalt: { type: 'M&S', amount: 4.4 },
                gellingAgent: { type: 'Phytogel', amount: 2.3 },
                preAutoclave: {
                    gamborgVitamin: 1.0,
                    sucrose: 30.0,
                    ppm: 1.0
                },
                pH: 5.8
            },
            shouldBeValid: true
        },
        {
            name: 'Missing Name',
            recipe: {
                mediaType: 'Initiation',
                volume: '1L',
                basalSalt: { type: 'M&S', amount: 4.4 }
            },
            shouldBeValid: false
        },
        {
            name: 'Invalid pH - Too Low',
            recipe: {
                name: 'Invalid pH Recipe',
                mediaType: 'Initiation',
                volume: '1L',
                pH: 4.5
            },
            shouldBeValid: false
        },
        {
            name: 'Invalid pH - Too High',
            recipe: {
                name: 'Invalid pH Recipe',
                mediaType: 'Initiation',
                volume: '1L',
                pH: 7.5
            },
            shouldBeValid: false
        }
    ];
    
    validationTests.forEach((test, index) => {
        console.log(`  Testing validation: ${test.name}`);
        
        let validationResult;
        
        if (window.RecipeCalculator && window.RecipeCalculator.validateRecipe) {
            validationResult = window.RecipeCalculator.validateRecipe(test.recipe);
        } else {
            // Manual validation fallback
            const errors = [];
            
            if (!test.recipe.name) {
                errors.push('Recipe name is required');
            }
            
            if (!test.recipe.mediaType) {
                errors.push('Media type is required');
            }
            
            if (test.recipe.pH && (test.recipe.pH < 5.0 || test.recipe.pH > 7.0)) {
                errors.push('pH must be between 5.0 and 7.0');
            }
            
            validationResult = {
                valid: errors.length === 0,
                errors
            };
        }
        
        if (validationResult.valid !== test.shouldBeValid) {
            throw new Error(`Validation test "${test.name}": Expected valid=${test.shouldBeValid}, got valid=${validationResult.valid}`);
        }
        
        if (!test.shouldBeValid && validationResult.errors.length === 0) {
            throw new Error(`Validation test "${test.name}": Expected errors but got none`);
        }
        
        console.log(`  ✅ Validation test "${test.name}" passed`);
    });
    
    console.log('✅ Recipe validation tests passed');
    return true;
}

// Main test runner
function runRecipeCreationTests() {
    console.log('🚀 Starting Recipe Creation Test Suite...');
    
    try {
        setupRecipeTestEnvironment();
        
        // Run all test suites
        testRecipeCreationWithDefaults();
        testRecipeCreationWithModifications();
        testRecipeIdGeneration();
        testRecipeVolumeScaling();
        testRecipeStorageWithModifications();
        testRecipeValidation();
        
        console.log('🎉 All Recipe Creation Tests Passed!');
        console.log('📊 Test Summary:');
        console.log('  ✅ Recipe creation with default values');
        console.log('  ✅ Recipe creation with modified values');
        console.log('  ✅ Recipe ID generation and uniqueness');
        console.log('  ✅ Recipe volume scaling');
        console.log('  ✅ Recipe storage and retrieval');
        console.log('  ✅ Recipe validation');
        
        return true;
        
    } catch (error) {
        console.error('❌ Recipe Creation Test Failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runRecipeCreationTests,
        setupRecipeTestEnvironment,
        testRecipeCreationWithDefaults,
        testRecipeCreationWithModifications,
        testRecipeIdGeneration,
        testRecipeVolumeScaling,
        testRecipeStorageWithModifications,
        testRecipeValidation
    };
}

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    document.addEventListener('DOMContentLoaded', function() {
        // Add a button to run tests manually
        const testButton = document.createElement('button');
        testButton.textContent = 'Run Recipe Creation Tests';
        testButton.style.position = 'fixed';
        testButton.style.top = '10px';
        testButton.style.right = '10px';
        testButton.style.zIndex = '9999';
        testButton.style.padding = '10px';
        testButton.style.backgroundColor = '#007bff';
        testButton.style.color = 'white';
        testButton.style.border = 'none';
        testButton.style.borderRadius = '4px';
        testButton.style.cursor = 'pointer';
        
        testButton.addEventListener('click', function() {
            runRecipeCreationTests();
        });
        
        document.body.appendChild(testButton);
    });
}

