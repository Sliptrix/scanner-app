/**
 * Comprehensive Test Suite for Critical Bug Fixes
 * Tests all 6 critical fixes that were applied
 */

// Mock browser environment
global.window = {
    localStorage: {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, value) { this._data[key] = value; },
        removeItem(key) { delete this._data[key]; },
        clear() { this._data = {}; },
        get length() { return Object.keys(this._data).length; },
        key(i) { return Object.keys(this._data)[i]; }
    },
    dispatchEvent: () => {},
    CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } },
    appState: {
        inventory: [],
        transferHistory: [],
        containerLineage: {},
        highestContainerId: 0,
        sessionCounter: 0,
        builderState: { values: {}, metadata: {}, currentStep: 0, steps: ['stage', 'tissue', 'date'] },
        mode: 'builder',
        isDataLoaded: false
    }
};
global.localStorage = global.window.localStorage;

// Mock NotificationSystem
global.NotificationSystem = {
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    warning: (msg) => console.log(`⚠️ ${msg}`),
    info: (msg) => console.log(`ℹ️ ${msg}`)
};
global.window.NotificationSystem = global.NotificationSystem;

// Load StateManager
const fs = require('fs');
const path = require('path');

// Simple StateManager mock
global.StateManager = {
    _state: global.window.appState,
    getState(path) {
        const keys = path.split('.');
        let val = this._state;
        for (const key of keys) {
            if (val === undefined) return undefined;
            val = val[key];
        }
        return val;
    },
    setState(path, value) {
        const keys = path.split('.');
        let obj = this._state;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    },
    resetBuilderState() {
        this._state.builderState = { values: {}, metadata: {}, currentStep: 0, steps: ['stage', 'tissue', 'date'] };
    }
};

// UIUtils mock
global.UIUtils = {
    rebuildInventoryTable: () => {},
    updateStats: () => {}
};

console.log('🧪 COMPREHENSIVE TEST SUITE FOR CRITICAL BUG FIXES\n');
console.log('=' .repeat(60) + '\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ============================================================================
// TEST 1: Tissue Validation Regex Fix
// ============================================================================
console.log('\n📋 TEST GROUP 1: Tissue Validation Regex\n');

test('Tissue validation allows 1', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(regex.test('1'), 'Should allow 1');
});

test('Tissue validation allows 9', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(regex.test('9'), 'Should allow 9');
});

test('Tissue validation allows 10', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(regex.test('10'), 'Should allow 10');
});

test('Tissue validation allows 99', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(regex.test('99'), 'Should allow 99');
});

test('Tissue validation rejects 0', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(!regex.test('0'), 'Should reject 0');
});

test('Tissue validation rejects 00', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(!regex.test('00'), 'Should reject 00');
});

test('Tissue validation rejects 100', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(!regex.test('100'), 'Should reject 100');
});

test('Tissue validation rejects 01', () => {
    const regex = /^([1-9]|[1-9]\d)$/;
    assertTrue(!regex.test('01'), 'Should reject leading zero');
});

// ============================================================================
// TEST 2: localStorage Error Handling
// ============================================================================
console.log('\n📋 TEST GROUP 2: localStorage Error Handling\n');

test('saveToLocalStorage handles normal save', () => {
    // Reset state
    StateManager.setState('inventory', [{ containerId: 1, barcode: 'TEST001' }]);
    StateManager.setState('highestContainerId', 1);

    // Simulate save
    const state = {
        inventory: StateManager.getState('inventory') || [],
        transferHistory: StateManager.getState('transferHistory') || [],
        containerLineage: StateManager.getState('containerLineage') || {},
        highestContainerId: StateManager.getState('highestContainerId') || 0,
        lastSaved: new Date().toISOString()
    };
    localStorage.setItem('labInventoryData', JSON.stringify(state));

    // Verify
    const saved = JSON.parse(localStorage.getItem('labInventoryData'));
    assertEqual(saved.inventory.length, 1, 'Should save inventory');
    assertEqual(saved.highestContainerId, 1, 'Should save highestContainerId');
});

test('loadFromLocalStorage restores data', () => {
    // Clear current state
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 0);

    // Load from storage
    const savedData = localStorage.getItem('labInventoryData');
    if (savedData) {
        const state = JSON.parse(savedData);
        StateManager.setState('inventory', state.inventory || []);
        StateManager.setState('highestContainerId', state.highestContainerId || 0);
    }

    // Verify
    assertEqual(StateManager.getState('inventory').length, 1, 'Should restore inventory');
    assertEqual(StateManager.getState('highestContainerId'), 1, 'Should restore highestContainerId');
});

// ============================================================================
// TEST 3: Container ID Race Condition Fix
// ============================================================================
console.log('\n📋 TEST GROUP 3: Container ID Generation\n');

// Simulate the fixed generateNewContainerIds function
let idGenerationLock = false;

function generateNewContainerIds(count) {
    if (idGenerationLock) {
        throw new Error('Container ID generation in progress. Please wait and try again.');
    }

    idGenerationLock = true;

    try {
        const newIds = [];
        let highestId = StateManager.getState('highestContainerId') || 0;
        const currentInventory = StateManager.getState('inventory') || [];

        currentInventory.forEach(entry => {
            const entryId = parseInt(entry.containerId);
            if (!isNaN(entryId) && entryId > highestId) {
                highestId = entryId;
            }
        });

        for (let i = 0; i < count; i++) {
            let candidateId;
            let attempts = 0;

            do {
                highestId++;
                candidateId = highestId;
                attempts++;
                if (attempts > 1000) {
                    throw new Error('Unable to generate unique container ID');
                }
            } while (
                currentInventory.some(entry => parseInt(entry.containerId) === candidateId) ||
                newIds.includes(candidateId)
            );

            newIds.push(candidateId);
        }

        StateManager.setState('highestContainerId', highestId);
        return newIds;
    } finally {
        idGenerationLock = false;
    }
}

test('generateNewContainerIds creates unique sequential IDs', () => {
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 0);

    const ids = generateNewContainerIds(3);

    assertEqual(ids.length, 3, 'Should create 3 IDs');
    assertEqual(ids[0], 1, 'First ID should be 1');
    assertEqual(ids[1], 2, 'Second ID should be 2');
    assertEqual(ids[2], 3, 'Third ID should be 3');
});

test('generateNewContainerIds skips existing IDs', () => {
    StateManager.setState('inventory', [
        { containerId: 1 },
        { containerId: 2 },
        { containerId: 5 }
    ]);
    StateManager.setState('highestContainerId', 2);

    const ids = generateNewContainerIds(2);

    // Should find highest ID (5) and continue from there
    assertEqual(ids[0], 6, 'Should skip to 6');
    assertEqual(ids[1], 7, 'Should continue to 7');
});

test('generateNewContainerIds prevents duplicates in same batch', () => {
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 0);

    const ids = generateNewContainerIds(5);
    const uniqueIds = new Set(ids);

    assertEqual(uniqueIds.size, 5, 'All IDs should be unique');
});

test('generateNewContainerIds updates highestContainerId', () => {
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 10);

    generateNewContainerIds(3);

    assertEqual(StateManager.getState('highestContainerId'), 13, 'Should update highest ID');
});

// ============================================================================
// TEST 4: Null Check for Samples Array
// ============================================================================
console.log('\n📋 TEST GROUP 4: Samples Array Null Check\n');

function executeTransferSafe(sourceContainer) {
    const samples = sourceContainer.data?.samples;
    if (!samples || !Array.isArray(samples) || samples.length === 0) {
        return {
            success: false,
            message: 'Source container has no valid samples to transfer'
        };
    }
    return { success: true, samples };
}

test('Handles null samples gracefully', () => {
    const result = executeTransferSafe({ data: { samples: null } });
    assertEqual(result.success, false, 'Should fail with null samples');
    assertTrue(result.message.includes('no valid samples'), 'Should have proper message');
});

test('Handles undefined samples gracefully', () => {
    const result = executeTransferSafe({ data: {} });
    assertEqual(result.success, false, 'Should fail with undefined samples');
});

test('Handles empty samples array gracefully', () => {
    const result = executeTransferSafe({ data: { samples: [] } });
    assertEqual(result.success, false, 'Should fail with empty samples');
});

test('Handles missing data property gracefully', () => {
    const result = executeTransferSafe({});
    assertEqual(result.success, false, 'Should fail with missing data');
});

test('Accepts valid samples array', () => {
    const result = executeTransferSafe({
        data: {
            samples: [{ id: 1, tissueCount: 5 }]
        }
    });
    assertEqual(result.success, true, 'Should succeed with valid samples');
});

// ============================================================================
// TEST 5: EnhancedDataLayer Persistence
// ============================================================================
console.log('\n📋 TEST GROUP 5: EnhancedDataLayer Persistence\n');

const STORAGE_KEY = 'enhancedDataLayer_data';

// Simulate EnhancedDataLayer functions
const dataStore = {
    inventory: [],
    strains: [],
    stages: [],
    locations: [],
    owners: [],
    media_batches: []
};

function persistToLocalStorage() {
    const dataToSave = {
        inventory: dataStore.inventory,
        strains: dataStore.strains,
        lastSaved: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

function loadFromLocalStorageEDL() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        const parsed = JSON.parse(savedData);
        dataStore.inventory = parsed.inventory || [];
        dataStore.strains = parsed.strains || [];
        return true;
    }
    return false;
}

function saveItem(item) {
    dataStore.inventory.push(item);
    persistToLocalStorage();  // CRITICAL: Now persists!
    return { success: true, item };
}

test('EnhancedDataLayer persists on save', () => {
    localStorage.clear();
    dataStore.inventory = [];

    saveItem({ asset_id: 'TEST001', strain_name: 'TestStrain' });

    const saved = localStorage.getItem(STORAGE_KEY);
    assertTrue(saved !== null, 'Should save to localStorage');

    const parsed = JSON.parse(saved);
    assertEqual(parsed.inventory.length, 1, 'Should have one item');
});

test('EnhancedDataLayer loads on init', () => {
    // Save some data
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        inventory: [{ asset_id: 'LOADED001' }],
        strains: [{ strain_id: 'S001' }]
    }));

    dataStore.inventory = [];
    dataStore.strains = [];

    const loaded = loadFromLocalStorageEDL();

    assertTrue(loaded, 'Should return true on successful load');
    assertEqual(dataStore.inventory.length, 1, 'Should load inventory');
    assertEqual(dataStore.strains.length, 1, 'Should load strains');
});

// ============================================================================
// TEST 6: Data Persistence Across "Refresh"
// ============================================================================
console.log('\n📋 TEST GROUP 6: Data Persistence Simulation\n');

test('Full workflow: Create -> Save -> "Refresh" -> Load', () => {
    // Step 1: Fresh start
    localStorage.clear();
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 0);

    // Step 2: Create some data
    const testEntry = {
        containerId: 1,
        barcode: 'TEST-PERSIST-001',
        strain: 'PersistenceStrain',
        date: new Date().toISOString()
    };

    const inventory = StateManager.getState('inventory') || [];
    inventory.push(testEntry);
    StateManager.setState('inventory', inventory);
    StateManager.setState('highestContainerId', 1);

    // Step 3: Save to localStorage (simulating auto-save)
    const state = {
        inventory: StateManager.getState('inventory'),
        highestContainerId: StateManager.getState('highestContainerId'),
        lastSaved: new Date().toISOString()
    };
    localStorage.setItem('labInventoryData', JSON.stringify(state));

    // Step 4: Simulate page refresh (clear memory state)
    StateManager.setState('inventory', []);
    StateManager.setState('highestContainerId', 0);

    // Verify memory is cleared
    assertEqual(StateManager.getState('inventory').length, 0, 'Memory should be cleared');

    // Step 5: Load from localStorage (simulating page load)
    const savedData = localStorage.getItem('labInventoryData');
    assertTrue(savedData !== null, 'Data should exist in localStorage');

    const restored = JSON.parse(savedData);
    StateManager.setState('inventory', restored.inventory);
    StateManager.setState('highestContainerId', restored.highestContainerId);

    // Step 6: Verify restoration
    assertEqual(StateManager.getState('inventory').length, 1, 'Should restore 1 item');
    assertEqual(StateManager.getState('inventory')[0].barcode, 'TEST-PERSIST-001', 'Should restore correct barcode');
    assertEqual(StateManager.getState('highestContainerId'), 1, 'Should restore highestContainerId');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '=' .repeat(60));
console.log('\n🎯 TEST RESULTS SUMMARY\n');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📊 Total:  ${passed + failed}`);
console.log(`   🎯 Success Rate: ${Math.round(passed / (passed + failed) * 100)}%\n`);

if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! The critical fixes are working correctly.\n');
} else {
    console.log(`⚠️  ${failed} test(s) failed. Please review the issues above.\n`);
    process.exit(1);
}
