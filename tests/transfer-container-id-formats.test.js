#!/usr/bin/env node

// Tests for container ID format handling in transfer module
// Ensures C00003, 000003, 3, C3 all resolve to the same container

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Container ID Format Handling in Transfer...');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="sourceContainerInput"></div>
    <div id="sourceContainerValue"></div>
    <div id="sourceSummary"></div>
    <div id="sourceInfo"></div>
    <div id="sourceSampleCountNumber"></div>
    <div id="transferStep2"></div>
    <div id="splitCount">1</div>
    <div id="smartSuggestions"></div>
    <div id="transferPreview"></div>
    <div id="transferBtn"></div>
    <div id="transferFeedback"></div>
    <div id="updateStage"></div>
    <div id="updateMedia"></div>
    <div id="updateDate"></div>
    <div id="updateNotes"></div>
</body></html>`);

global.window = dom.window;
global.document = dom.window.document;

const localStorageData = {};
global.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = String(value); },
    removeItem: (key) => { delete localStorageData[key]; },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); }
};
dom.window.localStorage = global.localStorage;

// Load modules
const stateContent = fs.readFileSync(path.join(__dirname, '../src/js/core/state.js'), 'utf8');
const notificationsContent = fs.readFileSync(path.join(__dirname, '../src/js/core/notifications.js'), 'utf8');
const uiUtilsContent = fs.readFileSync(path.join(__dirname, '../src/js/utils/uiUtils.js'), 'utf8');
const inputManagerContent = fs.readFileSync(path.join(__dirname, '../src/js/modules/transfer/inputManager.js'), 'utf8');

eval(stateContent);
eval(notificationsContent);
eval(uiUtilsContent);

global.Logger = window.Logger;
global.StateManager = window.StateManager;
global.NotificationSystem = window.NotificationSystem;
global.UIUtils = window.UIUtils;

eval(inputManagerContent);
global.TransferInputManager = window.TransferInputManager;

// Inventory with 6-digit padded IDs (as loaded from OneDrive/HQ workbook)
function setupInventoryWithPaddedIds() {
    window.appState.mode = 'transfer';
    window.StateManager.setState('inventory', [
        { containerId: '000001', strain: 'StrainA', owner: 'Owner1', stage: 'Stage1', media: 'Media1', tissueCount: 5 },
        { containerId: '000002', strain: 'StrainB', owner: 'Owner1', stage: 'Stage1', media: 'Media1', tissueCount: 3 },
        { containerId: '000003', strain: 'StrainC', owner: 'Owner2', stage: 'Stage2', media: 'Media2', tissueCount: 8 },
    ]);
    window.StateManager.setState('highestContainerId', 3);
}

// Inventory with numeric IDs
function setupInventoryWithNumericIds() {
    window.appState.mode = 'transfer';
    window.StateManager.setState('inventory', [
        { containerId: 1, strain: 'StrainA', owner: 'Owner1', stage: 'Stage1', media: 'Media1', tissueCount: 5 },
        { containerId: 2, strain: 'StrainB', owner: 'Owner1', stage: 'Stage1', media: 'Media1', tissueCount: 3 },
        { containerId: 3, strain: 'StrainC', owner: 'Owner2', stage: 'Stage2', media: 'Media2', tissueCount: 8 },
    ]);
    window.StateManager.setState('highestContainerId', 3);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) { passed++; console.log(`✅ ${name}`); }
        else { failed++; console.log(`❌ ${name}`); }
    } catch (e) {
        failed++;
        console.log(`❌ ${name} — Error: ${e.message}`);
    }
}

// Test: C00003 with padded inventory
test('C00003 finds padded 000003 in inventory', () => {
    setupInventoryWithPaddedIds();
    const result = window.TransferInputManager.findContainerInInventory('C00003');
    return result !== null && result.totalSamples === 8;
});

// Test: 000003 with padded inventory
test('000003 finds padded 000003 in inventory', () => {
    setupInventoryWithPaddedIds();
    const result = window.TransferInputManager.findContainerInInventory('000003');
    return result !== null && result.totalSamples === 8;
});

// Test: 3 with padded inventory
test('3 finds padded 000003 in inventory', () => {
    setupInventoryWithPaddedIds();
    const result = window.TransferInputManager.findContainerInInventory('3');
    return result !== null && result.totalSamples === 8;
});

// Test: C3 with padded inventory
test('C3 finds padded 000003 in inventory', () => {
    setupInventoryWithPaddedIds();
    const result = window.TransferInputManager.findContainerInInventory('C3');
    return result !== null && result.totalSamples === 8;
});

// Test: C00003 with numeric inventory
test('C00003 finds numeric 3 in inventory', () => {
    setupInventoryWithNumericIds();
    const result = window.TransferInputManager.findContainerInInventory('C00003');
    return result !== null && result.totalSamples === 8;
});

// Test: processSourceContainer with C00003
test('processSourceContainer(C00003) succeeds with padded inventory', () => {
    setupInventoryWithPaddedIds();
    // Clear any previous transfer state
    window.StateManager.setState('transferState.sourceContainer', null);
    const success = window.TransferInputManager.processSourceContainer('C00003');
    return success === true;
});

// Test: processSourceContainer with 000003
test('processSourceContainer(000003) succeeds with padded inventory', () => {
    setupInventoryWithPaddedIds();
    window.StateManager.setState('transferState.sourceContainer', null);
    const success = window.TransferInputManager.processSourceContainer('000003');
    return success === true;
});

// Test: validateContainerId accepts various formats
test('validateContainerId accepts C00003', () => window.TransferInputManager.validateContainerId('C00003'));
test('validateContainerId accepts 000003', () => window.TransferInputManager.validateContainerId('000003'));
test('validateContainerId accepts 3', () => window.TransferInputManager.validateContainerId('3'));
test('validateContainerId accepts C3', () => window.TransferInputManager.validateContainerId('C3'));
test('validateContainerId rejects empty', () => !window.TransferInputManager.validateContainerId(''));
test('validateContainerId rejects letters', () => !window.TransferInputManager.validateContainerId('ABC'));

// Test: empty inventory returns null
test('findContainerInInventory returns null with empty inventory', () => {
    window.StateManager.setState('inventory', []);
    const result = window.TransferInputManager.findContainerInInventory('C00003');
    return result === null;
});

// Results
console.log(`\n🎯 TEST RESULTS: ✅ ${passed} | ❌ ${failed}`);
process.exit(failed > 0 ? 1 : 0);
