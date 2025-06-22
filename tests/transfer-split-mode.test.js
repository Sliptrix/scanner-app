#!/usr/bin/env node

// Unit tests for split mode transfer functionality
// Tests that new containers are generated correctly during tissue splitting

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Split Mode Transfer - New Container Generation...');

// Setup DOM environment
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="sourceContainerInput"></div>
    <div id="destContainerInput"></div>
    <div id="sourceContainerValue"></div>
    <div id="destContainerValue"></div>
    <div id="sourceSummary"></div>
    <div id="destSummary"></div>
    <div id="sourceContainer"></div>
    <div id="destContainer"></div>
    <div id="transferBtn"></div>
    <div id="splitCount">3</div>
    <div id="splitPreview"></div>
    <div id="splitSummary"></div>
    <div id="newContainersList"></div>
    <div id="transferFeedback"></div>
</body>
</html>`);

global.window = dom.window;
global.document = dom.window.document;

// Load the modules
const stateContent = fs.readFileSync(path.join(__dirname, '../src/js/core/state.js'), 'utf8');
const notificationsContent = fs.readFileSync(path.join(__dirname, '../src/js/core/notifications.js'), 'utf8');
const uiUtilsContent = fs.readFileSync(path.join(__dirname, '../src/js/utils/uiUtils.js'), 'utf8');
const inputManagerContent = fs.readFileSync(path.join(__dirname, '../src/js/modules/transfer/inputManager.js'), 'utf8');
const transferProcessorContent = fs.readFileSync(path.join(__dirname, '../src/js/modules/transfer/transferProcessor.js'), 'utf8');
const transferMainContent = fs.readFileSync(path.join(__dirname, '../src/js/modules/transfer/transferMain.js'), 'utf8');

// Execute the modules
eval(stateContent);
eval(notificationsContent);
eval(uiUtilsContent);
eval(inputManagerContent);
eval(transferProcessorContent);
eval(transferMainContent);

// Initialize modules safely
try {
    if (window.TransferInputManager && window.TransferInputManager.initialize) {
        window.TransferInputManager.initialize();
    }
    if (window.TransferProcessor && window.TransferProcessor.initialize) {
        window.TransferProcessor.initialize();
    }
} catch (error) {
    console.log('Module initialization skipped due to dependencies');
}

// Test data setup
function setupTestData() {
    // Initialize state
    window.StateManager.setState('inventory', [
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue1', date: '2024-01-01' },
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue2', date: '2024-01-01' },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue3', date: '2024-01-01' },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue4', date: '2024-01-01' },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue5', date: '2024-01-01' }
    ]);
    
    window.StateManager.setState('highestContainerId', 1);
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 3);
}

// Test 1: Split mode should not require destination container input
function testSplitModeNoDestinationRequired() {
    console.log('\n🧪 Test 1: Split mode should not require destination container input');
    
    setupTestData();
    
    // Set source container
    const sourceSuccess = window.TransferInputManager.processSourceContainer('1');
    
    if (!sourceSuccess) {
        console.log('❌ Failed to set source container');
        return false;
    }
    
    // In split mode, transfer should be possible without destination container
    const transferState = window.StateManager.getState('transferState');
    const hasValidSource = transferState.sourceContainer && transferState.sourceContainer.data;
    const isReady = hasValidSource && transferState.mode === 'split';
    
    if (isReady) {
        console.log('✅ Split mode allows transfer without destination container');
        return true;
    } else {
        console.log('❌ Split mode incorrectly requires destination container');
        return false;
    }
}

// Test 2: Split transfer should generate new container IDs
function testSplitTransferGeneratesNewContainers() {
    console.log('\n🧪 Test 2: Split transfer should generate new container IDs');
    
    setupTestData();
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 3);
    
    // Mock destination container for split mode (should be ignored)
    window.StateManager.setState('transferState.destContainer', { id: 'auto', exists: false });
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that new containers were created
    const newInventory = window.StateManager.getState('inventory');
    const newContainerIds = [...new Set(newInventory.map(item => item.containerId))];
    
    // Should have containers 2, 3, 4 (original container 1 samples moved to new containers)
    const expectedContainers = [2, 3, 4];
    const hasNewContainers = expectedContainers.every(id => newContainerIds.includes(id));
    
    if (hasNewContainers) {
        console.log('✅ Split transfer generated new containers:', newContainerIds.filter(id => id > 1));
        return true;
    } else {
        console.log('❌ Split transfer did not generate expected new containers');
        console.log('   Expected:', expectedContainers);
        console.log('   Found:', newContainerIds);
        return false;
    }
}

// Test 3: New containers should have proper metadata
function testNewContainersHaveMetadata() {
    console.log('\n🧪 Test 3: New containers should inherit metadata from source');
    
    setupTestData();
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 2);
    
    // Mock destination container for split mode
    window.StateManager.setState('transferState.destContainer', { id: 'auto', exists: false });
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that new containers have metadata
    const newInventory = window.StateManager.getState('inventory');
    const newContainerSamples = newInventory.filter(item => item.containerId > 1);
    
    // All new samples should have transfer metadata
    const hasTransferMetadata = newContainerSamples.every(sample => 
        sample.transferDate && 
        sample.transferSource === 1 && 
        sample.transferType === 'split'
    );
    
    // All new samples should retain original metadata
    const hasOriginalMetadata = newContainerSamples.every(sample =>
        sample.owner === 'TestOwner' &&
        sample.stage === 'Stage1' &&
        sample.media === 'Media1'
    );
    
    if (hasTransferMetadata && hasOriginalMetadata) {
        console.log('✅ New containers have proper metadata');
        return true;
    } else {
        console.log('❌ New containers missing proper metadata');
        console.log('   Transfer metadata:', hasTransferMetadata);
        console.log('   Original metadata:', hasOriginalMetadata);
        return false;
    }
}

// Test 4: Highest container ID should be updated
function testHighestContainerIdUpdated() {
    console.log('\n🧪 Test 4: Highest container ID should be updated after split');
    
    setupTestData();
    
    const initialHighestId = window.StateManager.getState('highestContainerId');
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 3);
    
    // Mock destination container for split mode
    window.StateManager.setState('transferState.destContainer', { id: 'auto', exists: false });
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    const finalHighestId = window.StateManager.getState('highestContainerId');
    const expectedHighestId = initialHighestId + 3; // Should be 4
    
    if (finalHighestId === expectedHighestId) {
        console.log('✅ Highest container ID updated correctly:', finalHighestId);
        return true;
    } else {
        console.log('❌ Highest container ID not updated correctly');
        console.log('   Expected:', expectedHighestId);
        console.log('   Found:', finalHighestId);
        return false;
    }
}

// Test 5: Source container should be emptied after split
function testSourceContainerEmptied() {
    console.log('\n🧪 Test 5: Source container should be emptied after split');
    
    setupTestData();
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 2);
    
    // Mock destination container for split mode
    window.StateManager.setState('transferState.destContainer', { id: 'auto', exists: false });
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that source container is empty
    const finalInventory = window.StateManager.getState('inventory');
    const sourceContainerSamples = finalInventory.filter(item => item.containerId === 1);
    
    if (sourceContainerSamples.length === 0) {
        console.log('✅ Source container emptied after split');
        return true;
    } else {
        console.log('❌ Source container still has samples after split:', sourceContainerSamples.length);
        return false;
    }
}

// Run all tests
console.log('\n🧪 Running Split Mode Transfer Tests...\n');

const tests = [
    testSplitModeNoDestinationRequired,
    testSplitTransferGeneratesNewContainers,
    testNewContainersHaveMetadata,
    testHighestContainerIdUpdated,
    testSourceContainerEmptied
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
    process.exit(0);
} else {
    console.log('🚨 SOME TESTS FAILED!');
    process.exit(1);
}
