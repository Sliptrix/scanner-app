/**
 * Recipe Test Runner
 * Comprehensive test suite runner for all recipe functionality
 * 
 * Runs all recipe-related tests:
 * - Recipe Integration Tests
 * - Recipe Creation Tests (with value changes)
 * - Recipe Edge Cases
 * - Recipe Performance Tests
 * 
 * Usage:
 * - Node.js: node tests/run-recipe-tests.js
 * - Browser: Include this file and call runAllRecipeTests()
 */

// Import test modules if in Node.js environment
if (typeof require !== 'undefined') {
    // Node.js environment
    const { runRecipeIntegrationTests } = require('./recipe-integration.test.js');
    const { runRecipeCreationTests } = require('./recipe-creation.test.js');
}

// Test configuration
const TEST_CONFIG = {
    verbose: true,
    stopOnFirstFailure: false,
    timeoutMs: 30000,
    retryCount: 1
};

// Test results tracking
let testResults = {
    totalSuites: 0,
    passedSuites: 0,
    failedSuites: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    startTime: null,
    endTime: null,
    duration: 0,
    errors: []
};

/**
 * Execute a test suite with error handling and timing
 */
async function executeTestSuite(suiteName, testFunction, retries = 0) {
    console.log(`\n🔧 Starting test suite: ${suiteName}`);
    const startTime = Date.now();
    
    try {
        testResults.totalSuites++;
        
        // Run the test function
        const result = await Promise.race([
            Promise.resolve(testFunction()),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Test timeout')), TEST_CONFIG.timeoutMs)
            )
        ]);
        
        const duration = Date.now() - startTime;
        
        if (result === true) {
            testResults.passedSuites++;
            console.log(`✅ ${suiteName} PASSED (${duration}ms)`);
            return { success: true, duration, error: null };
        } else {
            throw new Error('Test function returned false or undefined');
        }
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        if (retries < TEST_CONFIG.retryCount) {
            console.log(`⚠️ ${suiteName} failed, retrying... (${retries + 1}/${TEST_CONFIG.retryCount})`);
            return executeTestSuite(suiteName, testFunction, retries + 1);
        }
        
        testResults.failedSuites++;
        testResults.errors.push({
            suite: suiteName,
            error: error.message,
            stack: error.stack,
            duration
        });
        
        console.error(`❌ ${suiteName} FAILED (${duration}ms): ${error.message}`);
        
        if (TEST_CONFIG.stopOnFirstFailure) {
            throw error;
        }
        
        return { success: false, duration, error: error.message };
    }
}

/**
 * Test Suite: Recipe Value Change Validation
 * Tests that recipe creation actually creates new recipes when values are changed
 */
function testRecipeValueChangeValidation() {
    console.log('🧪 Testing Recipe Value Change Validation...');
    
    // Setup test environment
    if (typeof setupRecipeTestEnvironment === 'function') {
        setupRecipeTestEnvironment();
    }
    
    // Clear any existing recipes
    localStorage.removeItem('labRecipes');
    
    const testCases = [
        {
            name: 'Create Base Recipe',
            mediaType: 'Initiation',
            volume: '1L',
            modifications: {}
        },
        {
            name: 'Create Recipe with Modified Basal Salt',
            mediaType: 'Initiation',
            volume: '1L',
            modifications: { basalSaltAmount: 5.0 }
        },
        {
            name: 'Create Recipe with Modified Volume',
            mediaType: 'Initiation',
            volume: '2L',
            modifications: {}
        },
        {
            name: 'Create Recipe with Multiple Modifications',
            mediaType: 'Initiation',
            volume: '1L',
            modifications: { 
                basalSaltAmount: 4.8,
                sucrose: 35.0,
                phValue: 6.0
            }
        }
    ];
    
    const createdRecipeIds = [];
    
    testCases.forEach((testCase, index) => {
        console.log(`  Creating recipe: ${testCase.name}`);
        
        // Set up form
        document.getElementById('mediaType').value = testCase.mediaType;
        document.getElementById('volume').value = testCase.volume;
        document.getElementById('recipeName').value = testCase.name;
        
        // Auto-populate defaults
        if (window.RecipeCalculator) {
            window.RecipeCalculator.autoPopulateRecipe();
        }
        
        // Apply modifications
        Object.entries(testCase.modifications).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = value;
            }
        });
        
        // Create recipe data
        const recipeData = {
            id: `value_change_test_${Date.now()}_${index}`,
            name: testCase.name,
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
        
        // Save recipe
        let savedId;
        if (window.RecipeStorage) {
            savedId = window.RecipeStorage.saveRecipe(recipeData);
        } else {
            const recipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
            recipes.push(recipeData);
            localStorage.setItem('labRecipes', JSON.stringify(recipes));
            savedId = recipeData.id;
        }
        
        if (!savedId) {
            throw new Error(`Failed to save recipe: ${testCase.name}`);
        }
        
        createdRecipeIds.push(savedId);
        console.log(`  ✅ Created recipe: ${testCase.name} (ID: ${savedId})`);
    });
    
    // Verify all recipes were created as separate entities
    const allRecipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
    
    if (allRecipes.length < testCases.length) {
        throw new Error(`Expected ${testCases.length} recipes, but only ${allRecipes.length} were saved`);
    }
    
    // Verify each recipe has unique values based on modifications
    for (let i = 0; i < testCases.length; i++) {
        const recipe = allRecipes.find(r => r.id === createdRecipeIds[i]);
        if (!recipe) {
            throw new Error(`Recipe ${testCases[i].name} not found in storage`);
        }
        
        // Verify modifications were applied
        Object.entries(testCases[i].modifications).forEach(([fieldId, expectedValue]) => {
            let actualValue;
            if (fieldId === 'basalSaltAmount') {
                actualValue = recipe.basalSalt.amount;
            } else if (fieldId === 'sucrose') {
                actualValue = recipe.preAutoclave.sucrose;
            } else if (fieldId === 'phValue') {
                actualValue = recipe.pH;
            }
            
            if (actualValue !== undefined && Math.abs(actualValue - expectedValue) > 0.01) {
                throw new Error(`Recipe ${testCases[i].name}: Expected ${fieldId} to be ${expectedValue}, got ${actualValue}`);
            }
        });
    }
    
    console.log(`✅ Successfully created ${testCases.length} unique recipes with different values`);
    return true;
}

/**
 * Test Suite: Recipe Persistence and Reload
 * Tests that modified recipes persist correctly across sessions
 */
function testRecipePersistenceAndReload() {
    console.log('🧪 Testing Recipe Persistence and Reload...');
    
    // Clear storage
    localStorage.removeItem('labRecipes');
    
    const originalRecipe = {
        id: 'persistence_test_001',
        name: 'Persistence Test Recipe',
        mediaType: 'Initiation',
        volume: '1L',
        basalSalt: { type: 'M&S', amount: 4.8 },
        gellingAgent: { type: 'Phytogel', amount: 2.5 },
        preAutoclave: {
            gamborgVitamin: 1.2,
            sucrose: 32.0,
            ppm: 1.1
        },
        pH: 5.9,
        createdDate: new Date().toISOString()
    };
    
    // Save recipe
    if (window.RecipeStorage) {
        const savedId = window.RecipeStorage.saveRecipe(originalRecipe);
        if (!savedId) {
            throw new Error('Failed to save original recipe');
        }
    } else {
        const recipes = [originalRecipe];
        localStorage.setItem('labRecipes', JSON.stringify(recipes));
    }
    
    // Simulate session reload by clearing modules and reinitializing
    if (window.RecipeStorage) {
        window.RecipeStorage.initialize();
    }
    
    // Retrieve recipe and verify all values persist
    let retrievedRecipe;
    if (window.RecipeStorage) {
        retrievedRecipe = window.RecipeStorage.loadRecipe('persistence_test_001');
    } else {
        const recipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
        retrievedRecipe = recipes.find(r => r.id === 'persistence_test_001');
    }
    
    if (!retrievedRecipe) {
        throw new Error('Failed to retrieve persisted recipe');
    }
    
    // Verify all fields match
    const fieldsToCheck = [
        ['name', 'name'],
        ['mediaType', 'mediaType'],
        ['volume', 'volume'],
        ['basalSalt.amount', 'basalSalt.amount'],
        ['gellingAgent.amount', 'gellingAgent.amount'],
        ['preAutoclave.gamborgVitamin', 'preAutoclave.gamborgVitamin'],
        ['preAutoclave.sucrose', 'preAutoclave.sucrose'],
        ['pH', 'pH']
    ];
    
    fieldsToCheck.forEach(([path, description]) => {
        const originalValue = getNestedValue(originalRecipe, path);
        const retrievedValue = getNestedValue(retrievedRecipe, path);
        
        if (typeof originalValue === 'number') {
            if (Math.abs(originalValue - retrievedValue) > 0.01) {
                throw new Error(`Persistence test failed for ${description}: expected ${originalValue}, got ${retrievedValue}`);
            }
        } else {
            if (originalValue !== retrievedValue) {
                throw new Error(`Persistence test failed for ${description}: expected "${originalValue}", got "${retrievedValue}"`);
            }
        }
    });
    
    console.log('✅ Recipe persistence and reload test passed');
    return true;
}

/**
 * Helper function to get nested object values
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Test Suite: Recipe Modification Workflow
 * Tests the complete workflow of modifying and saving recipes
 */
function testRecipeModificationWorkflow() {
    console.log('🧪 Testing Recipe Modification Workflow...');
    
    // Setup environment
    if (typeof setupRecipeTestEnvironment === 'function') {
        setupRecipeTestEnvironment();
    }
    
    localStorage.removeItem('labRecipes');
    
    // Step 1: Create base recipe with defaults
    document.getElementById('mediaType').value = 'Initiation';
    document.getElementById('volume').value = '1L';
    document.getElementById('recipeName').value = 'Workflow Test Base Recipe';
    
    if (window.RecipeCalculator) {
        window.RecipeCalculator.autoPopulateRecipe();
    }
    
    const baseRecipeData = {
        id: 'workflow_base_001',
        name: 'Workflow Test Base Recipe',
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
        createdDate: new Date().toISOString()
    };
    
    // Save base recipe
    if (window.RecipeStorage) {
        const baseId = window.RecipeStorage.saveRecipe(baseRecipeData);
        if (!baseId) {
            throw new Error('Failed to save base recipe');
        }
    }
    
    // Step 2: Modify values and create variant
    document.getElementById('recipeName').value = 'Workflow Test Modified Recipe';
    document.getElementById('basalSaltAmount').value = '5.0';
    document.getElementById('sucrose').value = '35.0';
    document.getElementById('phValue').value = '6.0';
    
    const modifiedRecipeData = {
        id: 'workflow_modified_001',
        name: 'Workflow Test Modified Recipe',
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
        createdDate: new Date().toISOString()
    };
    
    // Save modified recipe
    if (window.RecipeStorage) {
        const modifiedId = window.RecipeStorage.saveRecipe(modifiedRecipeData);
        if (!modifiedId) {
            throw new Error('Failed to save modified recipe');
        }
    }
    
    // Step 3: Verify both recipes exist and are different
    const allRecipes = JSON.parse(localStorage.getItem('labRecipes') || '[]');
    
    if (allRecipes.length < 2) {
        throw new Error('Expected 2 recipes after modification workflow');
    }
    
    const baseRecipe = allRecipes.find(r => r.id === 'workflow_base_001');
    const modifiedRecipe = allRecipes.find(r => r.id === 'workflow_modified_001');
    
    if (!baseRecipe || !modifiedRecipe) {
        throw new Error('Could not find both base and modified recipes');
    }
    
    // Verify differences
    if (Math.abs(baseRecipe.basalSalt.amount - modifiedRecipe.basalSalt.amount) < 0.1) {
        throw new Error('Base and modified recipes have same basal salt amount');
    }
    
    if (Math.abs(baseRecipe.preAutoclave.sucrose - modifiedRecipe.preAutoclave.sucrose) < 0.1) {
        throw new Error('Base and modified recipes have same sucrose amount');
    }
    
    if (Math.abs(baseRecipe.pH - modifiedRecipe.pH) < 0.1) {
        throw new Error('Base and modified recipes have same pH');
    }
    
    console.log('✅ Recipe modification workflow test passed');
    return true;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
    console.log('\n📊 COMPREHENSIVE RECIPE TEST REPORT');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total Duration: ${testResults.duration}ms`);
    console.log(`📦 Test Suites: ${testResults.passedSuites}/${testResults.totalSuites} passed`);
    console.log(`🧪 Individual Tests: ${testResults.passedTests}/${testResults.totalTests} passed`);
    
    if (testResults.skippedTests > 0) {
        console.log(`⏭️  Skipped Tests: ${testResults.skippedTests}`);
    }
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        testResults.errors.forEach((error, index) => {
            console.log(`\n${index + 1}. ${error.suite} (${error.duration}ms)`);
            console.log(`   Error: ${error.error}`);
            if (TEST_CONFIG.verbose && error.stack) {
                console.log(`   Stack: ${error.stack.split('\n')[1]?.trim() || 'No stack trace'}`);
            }
        });
    }
    
    // Success rate calculation
    const suiteSuccessRate = (testResults.passedSuites / testResults.totalSuites * 100).toFixed(1);
    console.log(`\n🎯 Success Rate: ${suiteSuccessRate}%`);
    
    if (testResults.failedSuites === 0) {
        console.log('\n🎉 ALL RECIPE TESTS PASSED! 🎉');
        console.log('The recipe creation functionality is working correctly.');
        console.log('✅ Recipes are properly created when values are changed');
        console.log('✅ Recipe modifications are saved and persist correctly');
        console.log('✅ Recipe workflow operates as expected');
    } else {
        console.log('\n⚠️  SOME TESTS FAILED');
        console.log('Please review the errors above and fix the issues.');
    }
    
    console.log('=' .repeat(60));
}

/**
 * Main test runner - executes all recipe tests
 */
async function runAllRecipeTests() {
    console.log('🚀 COMPREHENSIVE RECIPE FUNCTIONALITY TEST SUITE');
    console.log('Testing recipe creation with value changes and persistence');
    console.log('=' .repeat(60));
    
    testResults.startTime = Date.now();
    
    const testSuites = [
        // Core functionality tests
        { 
            name: 'Recipe Integration Tests', 
            func: () => {
                if (typeof runRecipeIntegrationTests === 'function') {
                    return runRecipeIntegrationTests();
                } else {
                    console.log('⏭️  Skipping Recipe Integration Tests - function not available');
                    testResults.skippedTests++;
                    return true;
                }
            }
        },
        { 
            name: 'Recipe Creation Tests', 
            func: () => {
                if (typeof runRecipeCreationTests === 'function') {
                    return runRecipeCreationTests();
                } else {
                    console.log('⏭️  Skipping Recipe Creation Tests - function not available');
                    testResults.skippedTests++;
                    return true;
                }
            }
        },
        // Specific issue tests
        { 
            name: 'Recipe Value Change Validation', 
            func: testRecipeValueChangeValidation 
        },
        { 
            name: 'Recipe Persistence and Reload', 
            func: testRecipePersistenceAndReload 
        },
        { 
            name: 'Recipe Modification Workflow', 
            func: testRecipeModificationWorkflow 
        }
    ];
    
    // Execute all test suites
    for (const suite of testSuites) {
        await executeTestSuite(suite.name, suite.func);
    }
    
    testResults.endTime = Date.now();
    testResults.duration = testResults.endTime - testResults.startTime;
    
    // Generate final report
    generateTestReport();
    
    return testResults.failedSuites === 0;
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllRecipeTests,
        testRecipeValueChangeValidation,
        testRecipePersistenceAndReload,
        testRecipeModificationWorkflow
    };
}

// Auto-run in Node.js environment
if (typeof require !== 'undefined' && require.main === module) {
    runAllRecipeTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

// Browser environment setup
if (typeof window !== 'undefined') {
    // Make functions available globally
    window.runAllRecipeTests = runAllRecipeTests;
    window.testRecipeValueChangeValidation = testRecipeValueChangeValidation;
    window.testRecipePersistenceAndReload = testRecipePersistenceAndReload;
    window.testRecipeModificationWorkflow = testRecipeModificationWorkflow;
    
    // Auto-run on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Add test runner button
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 Run All Recipe Tests';
        testButton.style.position = 'fixed';
        testButton.style.top = '10px';
        testButton.style.left = '10px';
        testButton.style.zIndex = '9999';
        testButton.style.padding = '12px 20px';
        testButton.style.backgroundColor = '#28a745';
        testButton.style.color = 'white';
        testButton.style.border = 'none';
        testButton.style.borderRadius = '6px';
        testButton.style.cursor = 'pointer';
        testButton.style.fontSize = '14px';
        testButton.style.fontWeight = 'bold';
        
        testButton.addEventListener('click', function() {
            runAllRecipeTests();
        });
        
        document.body.appendChild(testButton);
    });
}
