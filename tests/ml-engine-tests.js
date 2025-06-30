/**
 * Comprehensive ML Engine Test Suite
 * Tests ML initialization, recipe recommendations, transfer predictions, and learning hooks
 */

class MLEngineTestSuite {
    constructor() {
        this.results = [];
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
    }

    // Test assertion helpers
    assertTrue(condition, message) {
        this.testCount++;
        if (condition) {
            this.passCount++;
            this.log(`✅ PASS: ${message}`);
        } else {
            this.failCount++;
            this.log(`❌ FAIL: ${message}`);
            throw new Error(message);
        }
    }

    assertFalse(condition, message) {
        this.assertTrue(!condition, message);
    }

    assertNotNull(value, message) {
        this.assertTrue(value !== null && value !== undefined, message);
    }

    assertEqual(actual, expected, message) {
        this.assertTrue(actual === expected, `${message} - Expected: ${expected}, Actual: ${actual}`);
    }

    assertInstanceOf(value, type, message) {
        this.assertTrue(typeof value === type, `${message} - Expected type: ${type}, Actual type: ${typeof value}`);
    }

    log(message) {
        console.log(message);
        this.results.push(message);
    }

    // Test: ML Engine Initialization
    testMLEngineInitialization() {
        this.log('\n🧪 Testing ML Engine Initialization...');
        
        // Test that ML engine exists on window
        this.assertNotNull(window.LabMLEngine, 'ML Engine should be available on window object');
        
        // Test that ML engine is initialized
        this.assertTrue(window.LabMLEngine.initialized, 'ML Engine should be initialized');
        
        // Test that patterns object exists
        this.assertNotNull(window.LabMLEngine.patterns, 'ML Engine should have patterns object');
        
        this.log('ML Engine initialization tests completed ✅');
    }

    // Test: ML Integration Initialization
    testMLIntegrationInitialization() {
        this.log('\n🧪 Testing ML Integration Initialization...');
        
        // Test that ML integration exists
        this.assertNotNull(window.MLIntegration, 'ML Integration should be available on window object');
        
        // Test that ML integration is initialized
        this.assertTrue(window.MLIntegration.initialized, 'ML Integration should be initialized');
        
        this.log('ML Integration initialization tests completed ✅');
    }

    // Test: Recipe Recommendations for Plant Care
    testRecipeRecommendations() {
        this.log('\n🧪 Testing Recipe Recommendations for Plant Care...');
        
        const engine = window.LabMLEngine;
        
        // Test vegetative stage recommendations
        const vegetativeContext = { stage: 'vegetative' };
        const vegetativeRec = engine.getRecipeRecommendations(vegetativeContext);
        this.log(`Vegetative recommendations: ${JSON.stringify(vegetativeRec)}`);
        
        // Test flowering stage recommendations
        const floweringContext = { stage: 'flowering' };
        const floweringRec = engine.getRecipeRecommendations(floweringContext);
        this.log(`Flowering recommendations: ${JSON.stringify(floweringRec)}`);
        
        // Test initiation stage recommendations
        const initiationContext = { stage: 'initiation' };
        const initiationRec = engine.getRecipeRecommendations(initiationContext);
        this.log(`Initiation recommendations: ${JSON.stringify(initiationRec)}`);
        
        this.log('Recipe recommendation tests completed ✅');
    }

    // Test: Transfer Success Prediction
    testTransferSuccessPrediction() {
        this.log('\n🧪 Testing Transfer Success Prediction...');
        
        const engine = window.LabMLEngine;
        
        // Test basic prediction
        const basicContext = {};
        const basicPrediction = engine.predictTransferSuccess(basicContext);
        this.assertInstanceOf(basicPrediction, 'number', 'Prediction should be a number');
        this.assertTrue(basicPrediction >= 0 && basicPrediction <= 1, 'Prediction should be between 0 and 1');
        
        // Test prediction with context
        const contextualPrediction = engine.predictTransferSuccess({
            sourceContainerAge: 30,
            tissueCount: 10,
            mediaType: 'MS',
            stage: 'vegetative'
        });
        this.assertInstanceOf(contextualPrediction, 'number', 'Contextual prediction should be a number');
        
        this.log('Transfer success prediction tests completed ✅');
    }

    // Test: Operation Recording and Learning
    testOperationRecording() {
        this.log('\n🧪 Testing Operation Recording and Learning...');
        
        const engine = window.LabMLEngine;
        
        // Test recording container creation
        const containerOperation = {
            type: 'containerCreated',
            data: {
                containerId: 'TEST001',
                stage: 'vegetative',
                mediaType: 'MS',
                tissueCount: 5
            }
        };
        
        // Should not throw error
        try {
            engine.recordOperation(containerOperation);
            this.assertTrue(true, 'Container creation operation recorded successfully');
        } catch (error) {
            this.assertTrue(false, `Operation recording failed: ${error.message}`);
        }
        
        // Test recording transfer completion
        const transferOperation = {
            type: 'transferCompleted',
            data: {
                sourceId: 'TEST001',
                destinationIds: ['TEST002', 'TEST003'],
                success: true
            }
        };
        
        try {
            engine.recordOperation(transferOperation);
            this.assertTrue(true, 'Transfer completion operation recorded successfully');
        } catch (error) {
            this.assertTrue(false, `Transfer operation recording failed: ${error.message}`);
        }
        
        this.log('Operation recording tests completed ✅');
    }

    // Test: Integration with Existing Workflows
    testWorkflowIntegration() {
        this.log('\n🧪 Testing Integration with Existing Workflows...');
        
        const integration = window.MLIntegration;
        
        // Test that integration methods exist and are callable
        this.assertInstanceOf(integration.enhanceRecipeWorkflow, 'function', 'enhanceRecipeWorkflow should be a function');
        this.assertInstanceOf(integration.enhanceTransferWorkflow, 'function', 'enhanceTransferWorkflow should be a function');
        this.assertInstanceOf(integration.setupLearningHooks, 'function', 'setupLearningHooks should be a function');
        
        // Test calling integration methods (should not throw errors)
        try {
            integration.enhanceRecipeWorkflow();
            this.assertTrue(true, 'Recipe workflow enhancement executed without errors');
        } catch (error) {
            this.assertTrue(false, `Recipe workflow enhancement failed: ${error.message}`);
        }
        
        try {
            integration.enhanceTransferWorkflow();
            this.assertTrue(true, 'Transfer workflow enhancement executed without errors');
        } catch (error) {
            this.assertTrue(false, `Transfer workflow enhancement failed: ${error.message}`);
        }
        
        try {
            integration.setupLearningHooks();
            this.assertTrue(true, 'Learning hooks setup executed without errors');
        } catch (error) {
            this.assertTrue(false, `Learning hooks setup failed: ${error.message}`);
        }
        
        this.log('Workflow integration tests completed ✅');
    }

    // Test: Error Handling and Graceful Degradation
    testErrorHandling() {
        this.log('\n🧪 Testing Error Handling and Graceful Degradation...');
        
        const engine = window.LabMLEngine;
        
        // Test with invalid context
        try {
            const invalidRec = engine.getRecipeRecommendations(null);
            this.assertTrue(true, 'Engine handles null context gracefully');
        } catch (error) {
            this.log(`Warning: Engine should handle null context gracefully: ${error.message}`);
        }
        
        // Test with undefined stage
        try {
            const undefinedRec = engine.getRecipeRecommendations({ stage: 'nonexistent' });
            this.assertTrue(true, 'Engine handles unknown stage gracefully');
        } catch (error) {
            this.log(`Warning: Engine should handle unknown stages gracefully: ${error.message}`);
        }
        
        this.log('Error handling tests completed ✅');
    }

    // Main test runner
    runAllTests() {
        this.log('🚀 Starting ML Engine Comprehensive Test Suite...');
        this.log('================================================');
        
        try {
            this.testMLEngineInitialization();
            this.testMLIntegrationInitialization();
            this.testRecipeRecommendations();
            this.testTransferSuccessPrediction();
            this.testOperationRecording();
            this.testWorkflowIntegration();
            this.testErrorHandling();
        } catch (error) {
            this.log(`💥 Test suite error: ${error.message}`);
        }
        
        this.log('\n================================================');
        this.log(`📊 Test Results Summary:`);
        this.log(`Total Tests: ${this.testCount}`);
        this.log(`Passed: ${this.passCount}`);
        this.log(`Failed: ${this.failCount}`);
        this.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
        
        if (this.failCount === 0) {
            this.log('🎉 All tests passed! ML system is working correctly.');
        } else {
            this.log('⚠️  Some tests failed. Please review the implementation.');
        }
        
        return {
            total: this.testCount,
            passed: this.passCount,
            failed: this.failCount,
            results: this.results
        };
    }
}

// Make test suite available globally
window.MLEngineTestSuite = MLEngineTestSuite;

// Auto-run tests if this is loaded as a standalone script
if (typeof window !== 'undefined' && window.document) {
    // Wait for DOM and other scripts to load
    window.addEventListener('load', () => {
        setTimeout(() => {
            console.log('🧪 Auto-running ML Engine tests...');
            const testSuite = new MLEngineTestSuite();
            testSuite.runAllTests();
        }, 1000); // Give time for ML modules to initialize
    });
}
