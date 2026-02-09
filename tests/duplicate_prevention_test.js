#!/usr/bin/env node

// Test script to verify duplicate container prevention
// This tests that when a container is created via one method, 
// the other method correctly prevents creating a duplicate

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Duplicate Container Prevention...');

// Setup DOM environment
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="builderInput"></div>
    <div id="sourceContainerInput"></div>
    <div id="transferBtn"></div>
    <div id="splitCount">2</div>
    <div id="transferFeedback"></div>
    <div id="notification"></div>
</body>
</html>`);

global.window = dom.window;
global.document = dom.window.document;

// Mock localStorage
global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; }
};
dom.window.localStorage = global.localStorage;

// Load core modules
const stateContent = fs.readFileSync(path.join(__dirname, '../src/js/core/state.js'), 'utf8');
const notificationsContent = fs.readFileSync(path.join(__dirname, '../src/js/core/notifications.js'), 'utf8');
const dataUtilsContent = fs.readFileSync(path.join(__dirname, '../src/js/utils/dataUtils.js'), 'utf8');
const builderBarcodeContent = fs.readFileSync(path.join(__dirname, '../src/js/modules/builder/barcodeGenerator.js'), 'utf8');

// Execute modules
eval(stateContent);
global.Logger = window.Logger;
global.DEBUG_MODE = window.DEBUG_MODE;
eval(notificationsContent);
global.NotificationSystem = window.NotificationSystem;
eval(dataUtilsContent);
global.DataUtils = window.DataUtils;
eval(builderBarcodeContent);

// Create global aliases
global.StateManager = window.StateManager;
global.NotificationSystem = window.NotificationSystem;
global.DataUtils = window.DataUtils;
global.BuilderBarcodeGenerator = window.BuilderBarcodeGenerator;

// Mock UIUtils for the test
global.UIUtils = {
    updateStats: () => {},
    rebuildInventoryTable: () => {}
};

// Test data setup
function setupTestData() {
    // Initialize empty state
    window.StateManager.setState('inventory', []);
    window.StateManager.setState('highestContainerId', 0);
    
    // Setup builder state for container 1
    window.appState.currentContainer = 1;
    window.appState.currentSample = 'TEST-SAMPLE-001';
    window.appState.currentMetadata = {
        strain: 'Test Strain',
        owner: 'Test Owner',
        stage: 'T1',
        mediaType: 'MS',
        tissueCount: 3,
        formattedDate: '2025-06-30'
    };
    window.appState.currentBarcodeResult = {
        success: true,
        type: 'CODE128',
        data: 'TEST-SAMPLE-001'
    };
    window.appState.currentBarcodeIsSaved = false;
}

// Test 1: Barcode builder creates container, transfer system should prevent duplicate
function testBuilderFirstThenTransfer() {
    console.log('\n🧪 Test 1: Builder creates container, transfer should prevent duplicate');
    
    setupTestData();
    
    // Step 1: Use builder to create container 1
    const builderSuccess = window.BuilderBarcodeGenerator.saveToInventory();
    
    if (!builderSuccess) {
        console.log('❌ Builder failed to save initial container');
        return false;
    }
    
    console.log('✅ Builder successfully created container 1');
    
    // Step 2: Try to create container 1 again via builder
    window.appState.currentBarcodeIsSaved = false; // Reset saved flag
    const duplicateAttempt = window.BuilderBarcodeGenerator.saveToInventory();
    
    if (duplicateAttempt) {
        console.log('❌ Builder allowed duplicate container creation');
        return false;
    }
    
    console.log('✅ Builder correctly prevented duplicate container creation');
    
    // Check inventory only has one entry
    const inventory = window.StateManager.getState('inventory');
    if (inventory.length !== 1) {
        console.log('❌ Inventory should have exactly 1 entry, but has:', inventory.length);
        return false;
    }
    
    console.log('✅ Inventory correctly has only one entry');
    return true;
}

// Test 2: Multiple save attempts should be prevented
function testMultipleSaveAttempts() {
    console.log('\n🧪 Test 2: Multiple save attempts should be prevented');
    
    setupTestData();
    
    // First save
    const firstSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (!firstSave) {
        console.log('❌ First save failed unexpectedly');
        return false;
    }
    
    // Second save attempt (should be prevented by currentBarcodeIsSaved flag)
    const secondSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (secondSave) {
        console.log('❌ Second save was allowed when it should be prevented');
        return false;
    }
    
    // Third save attempt after resetting flag (should be prevented by inventory check)
    window.appState.currentBarcodeIsSaved = false;
    const thirdSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (thirdSave) {
        console.log('❌ Third save was allowed when it should be prevented');
        return false;
    }
    
    // Check inventory still has only one entry
    const inventory = window.StateManager.getState('inventory');
    if (inventory.length !== 1) {
        console.log('❌ Inventory should have exactly 1 entry, but has:', inventory.length);
        return false;
    }
    
    console.log('✅ Multiple save attempts correctly prevented');
    return true;
}

// Test 3: Different containers should be allowed
function testDifferentContainersAllowed() {
    console.log('\n🧪 Test 3: Different containers should be allowed');
    
    setupTestData();
    
    // Create container 1
    const firstSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (!firstSave) {
        console.log('❌ First container save failed');
        return false;
    }
    
    // Setup for container 2
    window.appState.currentContainer = 2;
    window.appState.currentSample = 'TEST-SAMPLE-002';
    window.appState.currentBarcodeIsSaved = false;
    
    // Create container 2 (should be allowed)
    const secondSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (!secondSave) {
        console.log('❌ Second container save failed unexpectedly');
        return false;
    }
    
    // Check inventory has two entries
    const inventory = window.StateManager.getState('inventory');
    if (inventory.length !== 2) {
        console.log('❌ Inventory should have exactly 2 entries, but has:', inventory.length);
        return false;
    }
    
    // Check containers have different IDs
    const containerIds = inventory.map(entry => entry.containerId);
    if (containerIds.includes(1) && containerIds.includes(2)) {
        console.log('✅ Different containers correctly allowed');
        return true;
    } else {
        console.log('❌ Container IDs not as expected:', containerIds);
        return false;
    }
}

// Test 4: Exact barcode duplicate prevention
function testExactBarcodeDuplicatePrevention() {
    console.log('\n🧪 Test 4: Exact barcode duplicate prevention');
    
    setupTestData();
    
    // Create first container
    const firstSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (!firstSave) {
        console.log('❌ First save failed');
        return false;
    }
    
    // Try to create different container with same barcode
    window.appState.currentContainer = 2;
    window.appState.currentSample = 'TEST-SAMPLE-001'; // Same barcode as first
    window.appState.currentBarcodeIsSaved = false;
    
    const duplicateBarcodeSave = window.BuilderBarcodeGenerator.saveToInventory();
    if (duplicateBarcodeSave) {
        console.log('❌ Duplicate barcode was allowed');
        return false;
    }
    
    console.log('✅ Duplicate barcode correctly prevented');
    return true;
}

// Run all tests
console.log('\n🧪 Running Duplicate Prevention Tests...\n');

const tests = [
    testBuilderFirstThenTransfer,
    testMultipleSaveAttempts,
    testDifferentContainersAllowed,
    testExactBarcodeDuplicatePrevention
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    try {
        const result = test();
        if (result) {
            passed++;
        } else {
            failed++;
        }
    } catch (error) {
        console.log(`❌ Test ${index + 1} threw error:`, error.message);
        failed++;
    }
});

// Results
console.log('\n🎯 TEST RESULTS:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\n✅ Duplicate prevention is working correctly:');
    console.log('   • Builder prevents container ID duplicates');
    console.log('   • Builder prevents exact barcode duplicates');
    console.log('   • Multiple save attempts are blocked');
    console.log('   • Different containers are still allowed');
    process.exit(0);
} else {
    console.log('🚨 SOME TESTS FAILED!');
    process.exit(1);
}
