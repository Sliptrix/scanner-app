#!/usr/bin/env node

// Unit tests for transfer status functionality
// Tests that transferred samples have the correct "Complete" status instead of "active"

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Transfer Status - Complete Status Assignment...');

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

// Mock localStorage for Node.js environment
const localStorageData = {};
global.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = value; },
    removeItem: (key) => { delete localStorageData[key]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
dom.window.localStorage = global.localStorage;

// Mock Logger
global.Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    group: () => {},
    groupEnd: () => {}
};
dom.window.Logger = global.Logger;

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

// Create global aliases to make modules work in Node.js
global.StateManager = window.StateManager;
global.NotificationSystem = window.NotificationSystem;
global.UIUtils = window.UIUtils;

eval(inputManagerContent);
eval(transferProcessorContent);
eval(transferMainContent);

// Create aliases for all modules after they are loaded
global.ContainerTransfer = window.ContainerTransfer;
global.TransferProcessor = window.TransferProcessor;
global.TransferInputManager = window.TransferInputManager;

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

// Test data setup with mixed status samples
function setupTestDataWithActiveStatus() {
    // Ensure we're in transfer mode for the tests
    if (!window.appState) {
        window.appState = { mode: 'transfer' };
    }
    window.appState.mode = 'transfer';
    
    // Initialize state with samples that have "active" status (simulating the problem)
    window.StateManager.setState('inventory', [
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue1', date: '2024-01-01', status: 'active', tissueCount: 2 },
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue2', date: '2024-01-01', status: 'active', tissueCount: 3 },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue3', date: '2024-01-01', status: 'active', tissueCount: 1 },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue4', date: '2024-01-01', status: 'active', tissueCount: 2 },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue5', date: '2024-01-01', status: 'active', tissueCount: 1 }
    ]);
    
    window.StateManager.setState('highestContainerId', 1);
}

// Test 1: Single transfer should set status to "Complete"
function testSingleTransferStatusComplete() {
    console.log('\n🧪 Test 1: Single transfer should set status to "Complete"');
    
    setupTestDataWithActiveStatus();
    
    // Set source container
    const sourceSuccess = window.TransferInputManager.processSourceContainer('1');
    
    if (!sourceSuccess) {
        console.log('❌ Failed to set source container');
        return false;
    }
    
    // Set transfer mode to single
    window.StateManager.setState('transferState.mode', 'single');
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that all transferred samples have "Complete" status
    const newInventory = window.StateManager.getState('inventory');
    const transferredSamples = newInventory.filter(item => item.containerId > 1);
    
    const allHaveCompleteStatus = transferredSamples.every(sample => sample.status === 'Complete');
    const noActiveStatus = transferredSamples.every(sample => sample.status !== 'active');
    
    if (allHaveCompleteStatus && noActiveStatus) {
        console.log('✅ All transferred samples have "Complete" status');
        console.log(`   Transferred ${transferredSamples.length} samples to container ${transferredSamples[0]?.containerId}`);
        return true;
    } else {
        console.log('❌ Some transferred samples do not have "Complete" status');
        console.log('   Sample statuses:', transferredSamples.map(s => ({ id: s.containerId, status: s.status })));
        return false;
    }
}

// Test 2: Split transfer should set status to "Complete"
function testSplitTransferStatusComplete() {
    console.log('\n🧪 Test 2: Split transfer should set status to "Complete"');
    
    setupTestDataWithActiveStatus();
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 3);
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that all split samples have "Complete" status
    const newInventory = window.StateManager.getState('inventory');
    const splitSamples = newInventory.filter(item => item.containerId > 1);
    
    const allHaveCompleteStatus = splitSamples.every(sample => sample.status === 'Complete');
    const noActiveStatus = splitSamples.every(sample => sample.status !== 'active');
    
    if (allHaveCompleteStatus && noActiveStatus) {
        console.log('✅ All split samples have "Complete" status');
        console.log(`   Split into ${new Set(splitSamples.map(s => s.containerId)).size} containers with ${splitSamples.length} total samples`);
        return true;
    } else {
        console.log('❌ Some split samples do not have "Complete" status');
        console.log('   Sample statuses:', splitSamples.map(s => ({ id: s.containerId, status: s.status, transferType: s.transferType })));
        return false;
    }
}

// Test 3: Verify split samples retain transfer metadata with correct status
function testSplitSamplesMetadataAndStatus() {
    console.log('\n🧪 Test 3: Split samples should have transfer metadata and "Complete" status');
    
    setupTestDataWithActiveStatus();
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 2);
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that all split samples have proper metadata and status
    const newInventory = window.StateManager.getState('inventory');
    const splitSamples = newInventory.filter(item => item.containerId > 1);
    
    const hasCorrectStatus = splitSamples.every(sample => sample.status === 'Complete');
    const hasTransferMetadata = splitSamples.every(sample => 
        sample.transferDate && 
        sample.transferSource === 1 &&
        sample.transferType === 'split' &&
        sample.splitPortion &&
        sample.originalTissueCount
    );
    
    if (hasCorrectStatus && hasTransferMetadata) {
        console.log('✅ Split samples have correct status and metadata');
        console.log(`   All ${splitSamples.length} samples have "Complete" status and transfer metadata`);
        return true;
    } else {
        console.log('❌ Split samples missing correct status or metadata');
        console.log('   Correct status:', hasCorrectStatus);
        console.log('   Transfer metadata:', hasTransferMetadata);
        console.log('   Sample details:', splitSamples.slice(0, 2).map(s => ({ 
            status: s.status, 
            transferType: s.transferType, 
            splitPortion: s.splitPortion 
        })));
        return false;
    }
}

// Test 4: Verify original source samples are properly removed
function testSourceSamplesRemoved() {
    console.log('\n🧪 Test 4: Source samples should be completely removed after transfer');
    
    setupTestDataWithActiveStatus();
    
    const originalInventory = window.StateManager.getState('inventory');
    const originalSourceSamples = originalInventory.filter(item => item.containerId === 1);
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to single
    window.StateManager.setState('transferState.mode', 'single');
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that source container samples are gone
    const newInventory = window.StateManager.getState('inventory');
    const remainingSourceSamples = newInventory.filter(item => item.containerId === 1);
    const transferredSamples = newInventory.filter(item => item.containerId > 1);
    
    if (remainingSourceSamples.length === 0 && transferredSamples.length === originalSourceSamples.length) {
        console.log('✅ Source samples properly removed and transferred');
        console.log(`   Original: ${originalSourceSamples.length}, Transferred: ${transferredSamples.length}, Remaining: ${remainingSourceSamples.length}`);
        return true;
    } else {
        console.log('❌ Source samples not properly removed');
        console.log(`   Original: ${originalSourceSamples.length}, Transferred: ${transferredSamples.length}, Remaining: ${remainingSourceSamples.length}`);
        return false;
    }
}

// Test 5: Verify mixed status samples get corrected to "Complete"
function testMixedStatusCorrection() {
    console.log('\n🧪 Test 5: Mixed status samples should all become "Complete" after transfer');
    
    // Setup with intentionally mixed statuses
    window.StateManager.setState('inventory', [
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue1', date: '2024-01-01', status: 'active', tissueCount: 1 },
        { containerId: 1, strain: 'TestStrain1', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue2', date: '2024-01-01', status: 'Complete', tissueCount: 1 },
        { containerId: 1, strain: 'TestStrain2', owner: 'TestOwner', stage: 'Stage1', media: 'Media1', tissue: 'Tissue3', date: '2024-01-01', status: 'pending', tissueCount: 1 }
    ]);
    
    window.StateManager.setState('highestContainerId', 1);
    
    // Set source container
    window.TransferInputManager.processSourceContainer('1');
    
    // Set transfer mode to split
    window.StateManager.setState('transferState.mode', 'split');
    window.StateManager.setState('transferState.splitCount', 2);
    
    // Process the transfer
    const transferSuccess = window.TransferProcessor.processTransfer();
    
    if (!transferSuccess) {
        console.log('❌ Transfer failed');
        return false;
    }
    
    // Check that all samples now have "Complete" status regardless of original status
    const newInventory = window.StateManager.getState('inventory');
    const transferredSamples = newInventory.filter(item => item.containerId > 1);
    
    const allComplete = transferredSamples.every(sample => sample.status === 'Complete');
    const uniqueStatuses = [...new Set(transferredSamples.map(s => s.status))];
    
    if (allComplete && uniqueStatuses.length === 1 && uniqueStatuses[0] === 'Complete') {
        console.log('✅ All mixed status samples corrected to "Complete"');
        console.log(`   ${transferredSamples.length} samples all have "Complete" status`);
        return true;
    } else {
        console.log('❌ Mixed status samples not properly corrected');
        console.log('   Found statuses:', uniqueStatuses);
        console.log('   Sample details:', transferredSamples.map(s => ({ status: s.status, tissue: s.tissue })));
        return false;
    }
}

// Run all tests
console.log('\n🧪 Running Transfer Status Tests...\n');

const tests = [
    testSingleTransferStatusComplete,
    testSplitTransferStatusComplete,
    testSplitSamplesMetadataAndStatus,
    testSourceSamplesRemoved,
    testMixedStatusCorrection
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
        console.log('   Stack:', error.stack);
        failed++;
    }
});

// Results
console.log('\n🎯 TEST RESULTS:');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

if (failed === 0) {
    console.log('🎉 ALL STATUS TESTS PASSED!');
    process.exit(0);
} else {
    console.log('🚨 SOME STATUS TESTS FAILED!');
    process.exit(1);
}
