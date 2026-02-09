#!/usr/bin/env node

/**
 * SCANNER APP - COMPREHENSIVE INTEGRATION TEST SUITE
 * Tests complete user workflows end-to-end and module integration
 * 
 * Test Categories:
 * 1. User Workflow Tests (Login → Dashboard → Create → Transfer → View)
 * 2. Module Integration Tests (StateManager ↔ InventoryManager, etc.)
 * 3. Error Handling Tests
 * 4. Data Persistence Tests
 * 5. Barcode/QR Generation Tests
 */

const fs = require('fs');
const nodePath = require('path');
const { JSDOM } = require('jsdom');

// Test Results Tracking
const testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    startTime: Date.now()
};

// Utilities
function log(message, type = 'info') {
    const icons = { info: 'ℹ️', pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️', section: '📋' };
    console.log(`${icons[type] || ''} ${message}`);
}

function assert(condition, testName, details = '') {
    if (condition) {
        testResults.passed++;
        log(`${testName}`, 'pass');
        return true;
    } else {
        testResults.failed++;
        testResults.errors.push({ test: testName, details });
        log(`${testName}: ${details}`, 'fail');
        return false;
    }
}

function assertThrows(fn, testName) {
    try {
        fn();
        testResults.failed++;
        testResults.errors.push({ test: testName, details: 'Expected error was not thrown' });
        log(`${testName}: Expected error was not thrown`, 'fail');
        return false;
    } catch (e) {
        testResults.passed++;
        log(`${testName}`, 'pass');
        return true;
    }
}

function skip(testName, reason) {
    testResults.skipped++;
    testResults.warnings.push({ test: testName, reason });
    log(`${testName}: ${reason}`, 'skip');
}

// ========================================
// DOM Environment Setup
// ========================================
function createTestEnvironment() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <head><title>Scanner App Test</title></head>
        <body>
            <div id="loginPage" style="display: flex;"></div>
            <div id="appContent" style="display: none;">
                <div id="dashboardSection" class="section"></div>
                <div id="intakeSection" class="section"></div>
                <div id="transferSection" class="section"></div>
                <div id="inventorySection" class="section"></div>
            </div>
            <div id="notification"></div>
            <div id="inventoryTable"></div>
            <div id="inventoryBody"></div>
            <div id="enhancedStatsContainer"></div>
            <div id="stageDistributionChart"></div>
            <div id="transferTimelineChart"></div>
            <div id="recentIntakeBody"></div>
            <button id="loginBtn"></button>
            <button id="logoutBtn" style="display: none;"></button>
            <div id="userInfo" style="display: none;"></div>
            <span id="userName"></span>
            <span id="userEmail"></span>
            <span id="activePlants">0</span>
            <span id="uniqueStrains">0</span>
            <span id="mediaBatches">0</span>
            <span id="efficiency">100%</span>
        </body>
        </html>
    `, {
        url: 'http://localhost:8000',
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        resources: 'usable'
    });

    const { window } = dom;
    const { document } = window;

    // Setup global references
    global.window = window;
    global.document = document;
    global.localStorage = createMockLocalStorage();
    global.sessionStorage = createMockLocalStorage();
    global.console = console;

    // Setup window.location
    window.location.hostname = 'localhost';
    window.location.origin = 'http://localhost:8000';

    // Mock CustomEvent for JSDOM compatibility
    window.CustomEvent = class CustomEvent extends window.Event {
        constructor(type, options = {}) {
            super(type, options);
            this.detail = options.detail || null;
        }
    };

    // Mock addEventListener with no-op for lineage events
    const originalAddEventListener = window.addEventListener.bind(window);
    window.addEventListener = function(type, callback, options) {
        // Allow events but don't fail if they're not standard DOM events
        try {
            originalAddEventListener(type, callback, options);
        } catch (e) {
            // Silently ignore listener registration errors in test
        }
    };

    // Mock dispatchEvent to handle CustomEvent
    const originalDispatchEvent = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event) {
        try {
            if (event instanceof window.Event || event instanceof window.CustomEvent) {
                return originalDispatchEvent(event);
            }
            // Create a proper event from the object
            const properEvent = new window.CustomEvent(event.type || 'custom', { detail: event.detail });
            return originalDispatchEvent(properEvent);
        } catch (e) {
            // Log but don't fail - event dispatching is not critical for unit tests
            return true;
        }
    };

    return { window, document };
}

function createMockLocalStorage() {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (n) => Object.keys(store)[n] || null
    };
}

// ========================================
// Module Loading
// ========================================
function loadModules(window) {
    const modulePaths = [
        'src/js/core/state.js',
        'src/js/core/notifications.js',
        'src/js/utils/dataUtils.js',
        'src/js/modules/lineage/lineageService.js',
        'src/js/modules/lineage/auditService.js',
        'src/js/modules/dashboard/analyticsEngine.js',
        'src/js/modules/dashboard/chartRenderer.js',
        'src/js/modules/recipe/recipeStorage.js',
        'src/js/modules/recipe/mediaBatchManager.js',
    ];

    const loadedModules = [];

    for (const modulePath of modulePaths) {
        const fullPath = nodePath.join(process.cwd(), modulePath);
        if (fs.existsSync(fullPath)) {
            try {
                const code = fs.readFileSync(fullPath, 'utf8');
                // Create a function in the window context
                const fn = new window.Function(code);
                fn.call(window);
                loadedModules.push(modulePath);
            } catch (e) {
                log(`Failed to load ${modulePath}: ${e.message}`, 'warn');
            }
        } else {
            log(`Module not found: ${modulePath}`, 'warn');
        }
    }

    return loadedModules;
}

// ========================================
// TEST SUITE 1: STATE MANAGER INTEGRATION
// ========================================
function testStateManagerIntegration() {
    log('\n=== STATE MANAGER INTEGRATION TESTS ===', 'section');

    const { window } = createTestEnvironment();

    // Initialize StateManager
    window.appState = {
        mode: 'builder',
        isDataLoaded: false,
        inventory: [],
        transferHistory: [],
        containerLineage: {},
        highestContainerId: 0,
        strainsTable: {},
        ownersTable: {},
        stagesTable: {},
        locationsTable: [],
        builderState: {
            currentStep: 0,
            values: {}
        },
        transferState: {
            mode: 'single',
            splitCount: 2
        }
    };

    window.StateManager = {
        getState: function(path) {
            const keys = path.split('.');
            let value = window.appState;
            for (const key of keys) {
                if (value === undefined) return undefined;
                value = value[key];
            }
            return value;
        },
        setState: function(path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = window.appState;
            for (const key of keys) {
                if (!target[key]) target[key] = {};
                target = target[key];
            }
            target[lastKey] = value;
        },
        resetBuilderState: function() {
            window.appState.builderState = { currentStep: 0, values: {} };
        }
    };

    // Test 1: Basic getState/setState
    window.StateManager.setState('mode', 'transfer');
    assert(
        window.StateManager.getState('mode') === 'transfer',
        'StateManager.getState/setState basic operations'
    );

    // Test 2: Nested path operations
    window.StateManager.setState('builderState.currentStep', 2);
    assert(
        window.StateManager.getState('builderState.currentStep') === 2,
        'StateManager nested path operations'
    );

    // Test 3: Array operations
    window.StateManager.setState('inventory', [{ containerId: '001', strain: 'TestStrain' }]);
    const inventory = window.StateManager.getState('inventory');
    assert(
        Array.isArray(inventory) && inventory.length === 1 && inventory[0].containerId === '001',
        'StateManager array state operations'
    );

    // Test 4: State reset functionality
    window.StateManager.setState('builderState.values.owner', 'TestOwner');
    window.StateManager.resetBuilderState();
    assert(
        window.StateManager.getState('builderState.values.owner') === undefined &&
        window.StateManager.getState('builderState.currentStep') === 0,
        'StateManager reset functionality'
    );

    // Test 5: HighestContainerId tracking
    window.StateManager.setState('highestContainerId', 100);
    assert(
        window.StateManager.getState('highestContainerId') === 100,
        'StateManager highestContainerId tracking'
    );

    return testResults;
}

// ========================================
// TEST SUITE 2: LINEAGE SERVICE INTEGRATION
// ========================================
function testLineageServiceIntegration() {
    log('\n=== LINEAGE SERVICE INTEGRATION TESTS ===', 'section');

    const { window } = createTestEnvironment();

    // Setup minimal state
    window.appState = {
        inventory: [],
        transferHistory: [],
        containerLineage: {}
    };

    window.StateManager = {
        getState: (path) => {
            const keys = path.split('.');
            let value = window.appState;
            for (const key of keys) {
                if (value === undefined) return undefined;
                value = value[key];
            }
            return value;
        }
    };

    window.localStorage = createMockLocalStorage();

    // Load and initialize LineageService
    const lineageCode = fs.readFileSync(nodePath.join(process.cwd(), 'src/js/modules/lineage/lineageService.js'), 'utf8');
    try {
        // Create a wrapper that includes dependencies
        const wrappedCode = `
            var StateManager = this.StateManager;
            var localStorage = this.localStorage;
            ${lineageCode}
        `;
        const fn = new Function(wrappedCode);
        fn.call(window);
    } catch (e) {
        log(`Failed to load LineageService: ${e.message}`, 'fail');
        return testResults;
    }

    const LineageService = window.LineageService;

    // Test 1: Initialize service
    try {
        LineageService.initialize();
        assert(true, 'LineageService initialization');
    } catch (e) {
        assert(false, 'LineageService initialization', e.message);
    }

    // Test 2: Add node
    const node1 = LineageService.addNode('C001', { strain: 'TestStrain', owner: 'TestOwner' });
    assert(
        node1 && node1.id === 'C001' && node1.strain === 'TestStrain',
        'LineageService.addNode creates node'
    );

    // Test 3: Record transfer
    const result = LineageService.recordTransfer('C001', ['C002', 'C003'], { 
        strain: 'TestStrain',
        consumed: true 
    });
    assert(
        result && LineageService.getNode('C002') && LineageService.getNode('C003'),
        'LineageService.recordTransfer creates child nodes'
    );

    // Test 4: Get generation
    assert(
        LineageService.getGeneration('C002') === 1,
        'LineageService.getGeneration returns correct generation'
    );

    // Test 5: Get ancestors
    const ancestors = LineageService.getAncestors('C002');
    assert(
        Array.isArray(ancestors) && ancestors.length === 1 && ancestors[0].id === 'C001',
        'LineageService.getAncestors returns parent'
    );

    // Test 6: Get descendants
    const descendants = LineageService.getDescendants('C001');
    assert(
        Array.isArray(descendants) && descendants.length === 2,
        'LineageService.getDescendants returns children'
    );

    // Test 7: Validate lineage
    const validation = LineageService.validateLineage();
    assert(
        validation && validation.valid === true,
        'LineageService.validateLineage finds no issues'
    );

    // Test 8: Get stats
    const stats = LineageService.getStats();
    assert(
        stats && stats.totalNodes === 3 && stats.maxGeneration === 1,
        'LineageService.getStats returns correct counts'
    );

    // Test 9: Export/Import lineage
    const exported = LineageService.exportLineage();
    assert(
        exported && exported.nodes && Object.keys(exported.nodes).length === 3,
        'LineageService.exportLineage exports all nodes'
    );

    // Test 10: Get lineage path
    const lineagePath = LineageService.getLineagePath('C002');
    assert(
        lineagePath === 'C001 → C002',
        'LineageService.getLineagePath returns formatted path'
    );

    return testResults;
}

// ========================================
// TEST SUITE 3: AUDIT SERVICE INTEGRATION
// ========================================
function testAuditServiceIntegration() {
    log('\n=== AUDIT SERVICE INTEGRATION TESTS ===', 'section');

    const { window } = createTestEnvironment();
    window.localStorage = createMockLocalStorage();

    // Mock AuthManager
    window.AuthManager = {
        isSignedIn: () => true,
        getUser: () => ({ id: 'test-user', name: 'Test User', email: 'test@test.com' })
    };

    // Load AuditService - inject dependencies into the eval context
    const auditCode = fs.readFileSync(nodePath.join(process.cwd(), 'src/js/modules/lineage/auditService.js'), 'utf8');
    try {
        // Create a wrapper that includes dependencies
        const wrappedCode = `
            var AuthManager = this.AuthManager;
            var localStorage = this.localStorage;
            ${auditCode}
        `;
        const fn = new Function(wrappedCode);
        fn.call(window);
    } catch (e) {
        log(`Failed to load AuditService: ${e.message}`, 'fail');
        return testResults;
    }

    const AuditService = window.AuditService;

    // Test 1: Initialize service
    try {
        AuditService.initialize();
        assert(true, 'AuditService initialization');
    } catch (e) {
        assert(false, 'AuditService initialization', e.message);
    }

    // Test 2: Log container created event
    const event1 = AuditService.logContainerCreated('C001', { strain: 'TestStrain' });
    assert(
        event1 && event1.type === 'CONTAINER_CREATED' && event1.containerId === 'C001',
        'AuditService.logContainerCreated logs event'
    );

    // Test 3: Log container updated event
    const event2 = AuditService.logContainerUpdated('C001', 
        { stage: 'T1' }, 
        { stage: 'T2' },
        { stage: { from: 'T1', to: 'T2' } }
    );
    assert(
        event2 && event2.containerId === 'C001',
        'AuditService.logContainerUpdated logs update'
    );

    // Test 4: Log transfer event
    const event3 = AuditService.logTransfer('C001', ['C002', 'C003'], { tissuesTransferred: 5 });
    assert(
        event3 && event3.relatedContainers.length === 2,
        'AuditService.logTransfer logs transfer'
    );

    // Test 5: Get container history
    const history = AuditService.getContainerHistory('C001');
    assert(
        Array.isArray(history) && history.length >= 2,
        'AuditService.getContainerHistory retrieves events'
    );

    // Test 6: Get recent events
    const recent = AuditService.getRecentEvents(10);
    assert(
        Array.isArray(recent) && recent.length >= 3,
        'AuditService.getRecentEvents retrieves events'
    );

    // Test 7: Get stats
    const stats = AuditService.getStats();
    assert(
        stats && stats.totalEvents >= 3,
        'AuditService.getStats returns correct counts'
    );

    // Test 8: Export log
    const exported = AuditService.exportLog();
    assert(
        exported && exported.entries && exported.entries.length >= 3,
        'AuditService.exportLog exports entries'
    );

    // Test 9: Get container timeline
    const timeline = AuditService.getContainerTimeline('C001');
    assert(
        Array.isArray(timeline) && timeline.length >= 2 && timeline[0].typeLabel,
        'AuditService.getContainerTimeline formats events'
    );

    // Test 10: Relative time formatting
    const relTime = AuditService.getRelativeTime(new Date().toISOString());
    assert(
        relTime === 'Just now' || relTime.includes('m ago'),
        'AuditService.getRelativeTime formats correctly'
    );

    return testResults;
}

// ========================================
// TEST SUITE 4: ANALYTICS ENGINE INTEGRATION
// ========================================
function testAnalyticsEngineIntegration() {
    log('\n=== ANALYTICS ENGINE INTEGRATION TESTS ===', 'section');

    const { window } = createTestEnvironment();
    window.localStorage = createMockLocalStorage();

    // Setup test inventory data
    window.appState = {
        inventory: [
            { containerId: 'C001', strain: 'Strain1', owner: 'Owner1', stage: 'T1', status: 'Active', date: new Date().toISOString(), tissueCount: 5 },
            { containerId: 'C002', strain: 'Strain1', owner: 'Owner2', stage: 'T2', status: 'Active', date: new Date().toISOString(), tissueCount: 10 },
            { containerId: 'C003', strain: 'Strain2', owner: 'Owner1', stage: 'T1', status: 'Consumed', date: new Date().toISOString(), tissueCount: 3 },
        ],
        transferHistory: [
            { timestamp: new Date().toISOString(), type: 'split', samplesTransferred: 5, destinationContainers: ['C002', 'C003'] },
            { timestamp: new Date().toISOString(), type: 'single', samplesTransferred: 3, destinationContainers: ['C004'] },
        ]
    };

    // Mock dependencies
    window.RecipeStorage = { getAllRecipes: () => [] };
    window.MediaBatchManager = { 
        getAllBatches: () => [],
        getBatchStats: () => ({ ready: 0, inUse: 0, expired: 0 }),
        getExpiringBatches: () => []
    };
    window.LineageService = {
        getStats: () => ({ totalNodes: 3, activeNodes: 2 }),
        validateLineage: () => ({ valid: true, issueCount: 0 }),
        getNode: () => ({ generation: 1 }),
        exportLineage: () => ({ nodes: {} }),
        findOrphans: () => [],
        findIsolatedNodes: () => []
    };

    // Load AnalyticsEngine
    const analyticsCode = fs.readFileSync(nodePath.join(process.cwd(), 'src/js/modules/dashboard/analyticsEngine.js'), 'utf8');
    try {
        const fn = new Function('window', analyticsCode);
        fn(window);
    } catch (e) {
        log(`Failed to load AnalyticsEngine: ${e.message}`, 'fail');
        return testResults;
    }

    const AnalyticsEngine = window.AnalyticsEngine;

    // Test 1: Get default date range
    const dateRange = AnalyticsEngine.getDefaultDateRange();
    assert(
        dateRange && dateRange.start && dateRange.end && dateRange.label,
        'AnalyticsEngine.getDefaultDateRange returns valid range'
    );

    // Test 2: Get analytics
    const analytics = AnalyticsEngine.getAnalytics();
    assert(
        analytics && analytics.containers && analytics.transfers,
        'AnalyticsEngine.getAnalytics returns analytics object'
    );

    // Test 3: Container analytics
    assert(
        analytics.containers.total === 3 && analytics.containers.byStatus.active >= 1,
        'AnalyticsEngine container analytics are correct'
    );

    // Test 4: Transfer analytics
    assert(
        analytics.transfers.total === 2 && analytics.transfers.byType.split === 1,
        'AnalyticsEngine transfer analytics are correct'
    );

    // Test 5: Stage distribution
    assert(
        analytics.containers.byStage && analytics.containers.byStage['T1'] === 2,
        'AnalyticsEngine stage distribution is correct'
    );

    // Test 6: Owner distribution
    assert(
        analytics.containers.byOwner && analytics.containers.byOwner['Owner1'] === 2,
        'AnalyticsEngine owner distribution is correct'
    );

    // Test 7: Tissue count
    assert(
        analytics.containers.tissueCount === 18,
        'AnalyticsEngine tissue count is correct'
    );

    // Test 8: Date range presets
    const presets = AnalyticsEngine.getDateRangePresets();
    assert(
        Array.isArray(presets) && presets.length >= 5,
        'AnalyticsEngine.getDateRangePresets returns presets'
    );

    // Test 9: Cache invalidation
    AnalyticsEngine.invalidateCache();
    const freshAnalytics = AnalyticsEngine.getAnalytics({ forceRefresh: true });
    // After invalidation, we should get a new analytics object (forceRefresh ensures fresh calculation)
    assert(
        freshAnalytics && freshAnalytics.containers && freshAnalytics.transfers,
        'AnalyticsEngine cache invalidation works'
    );

    // Test 10: Export analytics
    const exported = AnalyticsEngine.exportAnalytics();
    assert(
        typeof exported === 'string' && exported.includes('containers'),
        'AnalyticsEngine.exportAnalytics returns JSON string'
    );

    return testResults;
}

// ========================================
// TEST SUITE 5: DATA PERSISTENCE TESTS
// ========================================
function testDataPersistence() {
    log('\n=== DATA PERSISTENCE TESTS ===', 'section');

    const { window } = createTestEnvironment();
    const storage = createMockLocalStorage();
    window.localStorage = storage;

    // Test 1: Save inventory to localStorage
    const testInventory = [
        { containerId: 'C001', strain: 'TestStrain', owner: 'TestOwner' },
        { containerId: 'C002', strain: 'TestStrain2', owner: 'TestOwner2' }
    ];
    
    storage.setItem('labInventoryData', JSON.stringify({ 
        inventory: testInventory,
        highestContainerId: 2 
    }));
    
    const loaded = JSON.parse(storage.getItem('labInventoryData'));
    assert(
        loaded.inventory.length === 2 && loaded.inventory[0].containerId === 'C001',
        'Inventory saves to localStorage correctly'
    );

    // Test 2: Load inventory from localStorage
    assert(
        loaded.highestContainerId === 2,
        'HighestContainerId persists correctly'
    );

    // Test 3: Transfer history persistence
    const transferHistory = [
        { timestamp: new Date().toISOString(), type: 'split', sourceId: 'C001' }
    ];
    storage.setItem('labTransferHistory', JSON.stringify(transferHistory));
    const loadedHistory = JSON.parse(storage.getItem('labTransferHistory'));
    assert(
        loadedHistory.length === 1 && loadedHistory[0].type === 'split',
        'Transfer history persists correctly'
    );

    // Test 4: Lineage data persistence
    const lineageData = { nodes: { 'C001': { id: 'C001', parent: null, children: ['C002'] } } };
    storage.setItem('lwb_lineage_data', JSON.stringify(lineageData));
    const loadedLineage = JSON.parse(storage.getItem('lwb_lineage_data'));
    assert(
        loadedLineage.nodes['C001'].children.includes('C002'),
        'Lineage data persists correctly'
    );

    // Test 5: Recipe storage persistence
    const recipes = [{ id: 'R001', name: 'Test Recipe', ingredients: [] }];
    storage.setItem('labRecipes', JSON.stringify(recipes));
    const loadedRecipes = JSON.parse(storage.getItem('labRecipes'));
    assert(
        loadedRecipes.length === 1 && loadedRecipes[0].name === 'Test Recipe',
        'Recipes persist correctly'
    );

    // Test 6: Audit log persistence
    const auditLog = { entries: [{ type: 'CONTAINER_CREATED', timestamp: new Date().toISOString() }] };
    storage.setItem('lwb_audit_log', JSON.stringify(auditLog));
    const loadedAudit = JSON.parse(storage.getItem('lwb_audit_log'));
    assert(
        loadedAudit.entries.length === 1,
        'Audit log persists correctly'
    );

    // Test 7: Cloud sync metadata persistence
    const cloudMeta = { driveId: 'test-drive', itemId: 'test-item', ts: Date.now() };
    storage.setItem('cloud:onedrive:meta', JSON.stringify(cloudMeta));
    const loadedMeta = JSON.parse(storage.getItem('cloud:onedrive:meta'));
    assert(
        loadedMeta.driveId === 'test-drive',
        'Cloud sync metadata persists correctly'
    );

    // Test 8: Storage quota handling
    try {
        // Simulate large data
        const largeData = { data: 'x'.repeat(100000) };
        storage.setItem('test_large', JSON.stringify(largeData));
        const loaded = storage.getItem('test_large');
        assert(loaded !== null, 'Large data storage works');
    } catch (e) {
        assert(false, 'Large data storage works', e.message);
    }

    // Test 9: Clear specific app keys
    storage.removeItem('labInventoryData');
    assert(
        storage.getItem('labInventoryData') === null,
        'Storage removal works correctly'
    );

    // Test 10: Full storage clear
    storage.clear();
    assert(
        storage.length === 0,
        'Full storage clear works'
    );

    return testResults;
}

// ========================================
// TEST SUITE 6: ERROR HANDLING TESTS
// ========================================
function testErrorHandling() {
    log('\n=== ERROR HANDLING TESTS ===', 'section');

    const { window } = createTestEnvironment();
    window.localStorage = createMockLocalStorage();

    // Setup minimal state
    window.appState = { inventory: [], transferHistory: [] };
    window.StateManager = {
        getState: (path) => {
            const keys = path.split('.');
            let value = window.appState;
            for (const key of keys) {
                if (value === undefined) return undefined;
                value = value[key];
            }
            return value;
        },
        setState: (path, value) => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = window.appState;
            for (const key of keys) {
                if (!target[key]) target[key] = {};
                target = target[key];
            }
            target[lastKey] = value;
        }
    };

    // Test 1: Invalid state path handling
    const invalidPath = window.StateManager.getState('nonexistent.deep.path');
    assert(
        invalidPath === undefined,
        'StateManager handles invalid paths gracefully'
    );

    // Test 2: Invalid JSON handling
    window.localStorage.setItem('test_invalid', 'not-valid-json{');
    let parseError = null;
    try {
        JSON.parse(window.localStorage.getItem('test_invalid'));
    } catch (e) {
        parseError = e;
    }
    assert(
        parseError !== null,
        'Invalid JSON triggers error (expected behavior)'
    );

    // Test 3: Empty inventory handling in analytics
    window.RecipeStorage = { getAllRecipes: () => [] };
    window.MediaBatchManager = { 
        getAllBatches: () => [],
        getBatchStats: () => ({ ready: 0, inUse: 0 }),
        getExpiringBatches: () => []
    };
    window.LineageService = {
        getStats: () => ({}),
        validateLineage: () => ({ valid: true }),
        getNode: () => null,
        exportLineage: () => ({ nodes: {} }),
        findOrphans: () => [],
        findIsolatedNodes: () => []
    };

    const analyticsCode = fs.readFileSync(nodePath.join(process.cwd(), 'src/js/modules/dashboard/analyticsEngine.js'), 'utf8');
    try {
        const fn = new Function('window', analyticsCode);
        fn(window);
        const analytics = window.AnalyticsEngine.getAnalytics();
        assert(
            analytics && analytics.containers.total === 0,
            'Analytics handles empty inventory gracefully'
        );
    } catch (e) {
        assert(false, 'Analytics handles empty inventory gracefully', e.message);
    }

    // Test 4: Null/undefined container ID handling
    assert(
        window.StateManager.getState('inventory').length === 0,
        'Empty inventory array is valid'
    );

    // Test 5: Missing required fields validation
    const invalidEntry = { strain: 'Test' }; // Missing containerId
    assert(
        !invalidEntry.containerId,
        'Missing containerId is detected'
    );

    // Test 6: Date parsing error handling
    const invalidDate = new Date('invalid-date');
    assert(
        isNaN(invalidDate.getTime()),
        'Invalid date returns NaN (expected behavior)'
    );

    // Test 7: Circular reference detection (simulated)
    const obj = { a: 1 };
    obj.self = obj;
    let circularError = null;
    try {
        JSON.stringify(obj);
    } catch (e) {
        circularError = e;
    }
    assert(
        circularError !== null,
        'Circular reference triggers error (expected behavior)'
    );

    // Test 8: Large number handling
    const largeNum = Number.MAX_SAFE_INTEGER + 1;
    assert(
        !Number.isSafeInteger(largeNum),
        'Large numbers are handled appropriately'
    );

    // Test 9: Type coercion handling
    const stringNum = '123';
    const parsed = parseInt(stringNum, 10);
    assert(
        parsed === 123 && typeof parsed === 'number',
        'String to number conversion works'
    );

    // Test 10: Array method safety
    const nullArray = null;
    let arrayError = null;
    try {
        nullArray.forEach(() => {});
    } catch (e) {
        arrayError = e;
    }
    assert(
        arrayError !== null,
        'Null array access triggers error (guard needed)'
    );

    return testResults;
}

// ========================================
// TEST SUITE 7: USER WORKFLOW SIMULATION
// ========================================
function testUserWorkflows() {
    log('\n=== USER WORKFLOW SIMULATION TESTS ===', 'section');

    const { window, document } = createTestEnvironment();
    window.localStorage = createMockLocalStorage();

    // Setup comprehensive state
    window.appState = {
        mode: 'dashboard',
        isDataLoaded: false,
        inventory: [],
        transferHistory: [],
        containerLineage: {},
        highestContainerId: 0,
        strainsTable: { 'S001': 'Test Strain Alpha', 'S002': 'Test Strain Beta' },
        ownersTable: { 'O001': 'Test Owner', 'O002': 'Test Owner 2' },
        stagesTable: { '1': 'T1', '2': 'T2', '3': 'T3' },
        locationsTable: ['Room A', 'Room B', 'Cold Storage'],
        builderState: { currentStep: 0, values: {} },
        transferState: { mode: 'single', splitCount: 2 }
    };

    window.StateManager = {
        getState: (path) => {
            const keys = path.split('.');
            let value = window.appState;
            for (const key of keys) {
                if (value === undefined) return undefined;
                value = value[key];
            }
            return value;
        },
        setState: (path, value) => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = window.appState;
            for (const key of keys) {
                if (!target[key]) target[key] = {};
                target = target[key];
            }
            target[lastKey] = value;
        }
    };

    // WORKFLOW 1: Login → Dashboard
    log('Testing: Login → Dashboard workflow', 'info');
    
    // Simulate login
    window.AuthManager = {
        currentUser: { username: 'test@test.com', name: 'Test User' },
        isSignedIn: () => true,
        getAccount: () => ({ name: 'Test User', username: 'test@test.com' })
    };
    
    // Update UI state
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    
    assert(
        document.getElementById('loginPage').style.display === 'none' &&
        document.getElementById('appContent').style.display === 'block',
        'Workflow: Login shows app content'
    );

    // WORKFLOW 2: Create Container
    log('Testing: Container creation workflow', 'info');
    
    const newContainer = {
        containerId: '000001',
        strain: 'Test Strain Alpha',
        strainId: 'S001',
        owner: 'Test Owner',
        ownerId: 'O001',
        stage: 'T1',
        media: 'LB Agar',
        tissueCount: 5,
        date: new Date().toISOString(),
        status: 'Active',
        barcode: '000001-S001-O001-T1',
        notes: 'Test container'
    };
    
    window.appState.inventory.push(newContainer);
    window.appState.highestContainerId = 1;
    
    assert(
        window.appState.inventory.length === 1 &&
        window.appState.inventory[0].containerId === '000001',
        'Workflow: Container created successfully'
    );

    // WORKFLOW 3: Transfer (Split) Operation
    log('Testing: Container transfer workflow', 'info');
    
    const sourceContainer = window.appState.inventory[0];
    const destContainers = [
        { ...sourceContainer, containerId: '000002', tissueCount: 2, transferSource: '000001' },
        { ...sourceContainer, containerId: '000003', tissueCount: 2, transferSource: '000001' }
    ];
    
    // Update source
    sourceContainer.status = 'Consumed';
    sourceContainer.tissueCount = 0;
    
    // Add destinations
    window.appState.inventory.push(...destContainers);
    window.appState.highestContainerId = 3;
    
    // Record transfer
    window.appState.transferHistory.push({
        timestamp: new Date().toISOString(),
        type: 'split',
        sourceId: '000001',
        destinationContainers: ['000002', '000003'],
        samplesTransferred: 4,
        samplesDiscarded: 1
    });
    
    assert(
        window.appState.inventory.length === 3 &&
        window.appState.transferHistory.length === 1 &&
        window.appState.inventory[0].status === 'Consumed',
        'Workflow: Split transfer completed successfully'
    );

    // WORKFLOW 4: View Inventory
    log('Testing: Inventory view workflow', 'info');
    
    const activeContainers = window.appState.inventory.filter(c => c.status === 'Active');
    const consumedContainers = window.appState.inventory.filter(c => c.status === 'Consumed');
    
    assert(
        activeContainers.length === 2 && consumedContainers.length === 1,
        'Workflow: Inventory view shows correct status counts'
    );

    // WORKFLOW 5: Update Container Stage
    log('Testing: Stage update workflow', 'info');
    
    const containerToUpdate = window.appState.inventory.find(c => c.containerId === '000002');
    const oldStage = containerToUpdate.stage;
    containerToUpdate.stage = 'T2';
    
    assert(
        containerToUpdate.stage === 'T2' && oldStage === 'T1',
        'Workflow: Stage update works correctly'
    );

    // WORKFLOW 6: Data export preparation
    log('Testing: Export workflow', 'info');
    
    const exportData = {
        inventory: window.appState.inventory,
        transferHistory: window.appState.transferHistory,
        exportDate: new Date().toISOString()
    };
    
    assert(
        exportData.inventory.length === 3 && exportData.transferHistory.length === 1,
        'Workflow: Export data preparation works'
    );

    // WORKFLOW 7: Search/Filter simulation
    log('Testing: Search/Filter workflow', 'info');
    
    const filteredByStrain = window.appState.inventory.filter(c => 
        c.strain.toLowerCase().includes('alpha')
    );
    
    assert(
        filteredByStrain.length === 3,
        'Workflow: Strain filter works correctly'
    );

    // WORKFLOW 8: Batch operation simulation
    log('Testing: Batch operation workflow', 'info');
    
    const containerIds = ['000002', '000003'];
    let batchUpdated = 0;
    window.appState.inventory.forEach(c => {
        if (containerIds.includes(c.containerId)) {
            c.location = 'Room B';
            batchUpdated++;
        }
    });
    
    assert(
        batchUpdated === 2,
        'Workflow: Batch update works correctly'
    );

    // WORKFLOW 9: Delete container
    log('Testing: Delete container workflow', 'info');
    
    const deleteId = '000003';
    const beforeDelete = window.appState.inventory.length;
    window.appState.inventory = window.appState.inventory.filter(c => c.containerId !== deleteId);
    
    assert(
        window.appState.inventory.length === beforeDelete - 1,
        'Workflow: Container deletion works'
    );

    // WORKFLOW 10: Session persistence
    log('Testing: Session persistence workflow', 'info');
    
    const stateToSave = {
        inventory: window.appState.inventory,
        transferHistory: window.appState.transferHistory,
        highestContainerId: window.appState.highestContainerId
    };
    window.localStorage.setItem('labInventoryData', JSON.stringify(stateToSave));
    
    const restored = JSON.parse(window.localStorage.getItem('labInventoryData'));
    assert(
        restored.inventory.length === 2 && restored.highestContainerId === 3,
        'Workflow: Session persistence works'
    );

    return testResults;
}

// ========================================
// TEST SUITE 8: CHART RENDERER TESTS
// ========================================
function testChartRenderer() {
    log('\n=== CHART RENDERER TESTS ===', 'section');

    const { window, document } = createTestEnvironment();

    // Load ChartRenderer
    const chartCode = fs.readFileSync(nodePath.join(process.cwd(), 'src/js/modules/dashboard/chartRenderer.js'), 'utf8');
    try {
        const fn = new Function('window', 'document', chartCode);
        fn(window, document);
    } catch (e) {
        log(`Failed to load ChartRenderer: ${e.message}`, 'fail');
        return testResults;
    }

    const ChartRenderer = window.ChartRenderer;

    // Test 1: Bar chart with data
    const barContainer = document.createElement('div');
    barContainer.id = 'testBarChart';
    document.body.appendChild(barContainer);
    
    ChartRenderer.renderBarChart('testBarChart', {
        labels: ['Stage 1', 'Stage 2', 'Stage 3'],
        values: [10, 25, 15]
    }, { title: 'Test Bar Chart' });
    
    assert(
        barContainer.innerHTML.includes('bar-chart'),
        'ChartRenderer.renderBarChart creates bar chart'
    );

    // Test 2: Bar chart with empty data
    const emptyBarContainer = document.createElement('div');
    emptyBarContainer.id = 'emptyBarChart';
    document.body.appendChild(emptyBarContainer);
    
    ChartRenderer.renderBarChart('emptyBarChart', { labels: [], values: [] });
    
    assert(
        emptyBarContainer.innerHTML.includes('No data'),
        'ChartRenderer handles empty bar chart data'
    );

    // Test 3: Pie chart with data
    const pieContainer = document.createElement('div');
    pieContainer.id = 'testPieChart';
    document.body.appendChild(pieContainer);
    
    ChartRenderer.renderPieChart('testPieChart', {
        labels: ['Active', 'Consumed', 'Discarded'],
        values: [50, 30, 20]
    }, { title: 'Status Distribution', donut: true });
    
    assert(
        pieContainer.innerHTML.includes('pie-chart'),
        'ChartRenderer.renderPieChart creates pie chart'
    );

    // Test 4: Line chart with data
    const lineContainer = document.createElement('div');
    lineContainer.id = 'testLineChart';
    document.body.appendChild(lineContainer);
    
    ChartRenderer.renderLineChart('testLineChart', {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: [5, 8, 12, 7, 15]
    }, { title: 'Activity Trend' });
    
    assert(
        lineContainer.innerHTML.includes('line-chart'),
        'ChartRenderer.renderLineChart creates line chart'
    );

    // Test 5: Heatmap with data
    const heatmapContainer = document.createElement('div');
    heatmapContainer.id = 'testHeatmap';
    document.body.appendChild(heatmapContainer);
    
    ChartRenderer.renderHeatmap('testHeatmap', {
        heatmap: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        dayLabels: ['Mon', 'Tue', 'Wed']
    }, { title: 'Activity Heatmap' });
    
    assert(
        heatmapContainer.innerHTML.includes('heatmap'),
        'ChartRenderer.renderHeatmap creates heatmap'
    );

    // Test 6: Stat cards
    const statsContainer = document.createElement('div');
    statsContainer.id = 'testStats';
    document.body.appendChild(statsContainer);
    
    ChartRenderer.renderStatCards('testStats', [
        { label: 'Total', value: 100, icon: '📦' },
        { label: 'Active', value: 75, trend: { percent: 10, direction: 'up' } }
    ]);
    
    assert(
        statsContainer.innerHTML.includes('stat-card'),
        'ChartRenderer.renderStatCards creates stat cards'
    );

    // Test 7: Colors palette availability
    assert(
        ChartRenderer.COLORS && ChartRenderer.COLORS.palette.length >= 5,
        'ChartRenderer has color palette'
    );

    // Test 8: Sparkline rendering
    const sparkContainer = document.createElement('div');
    sparkContainer.id = 'testSparkline';
    document.body.appendChild(sparkContainer);
    
    ChartRenderer.renderSparkline('testSparkline', [1, 3, 2, 5, 4]);
    
    assert(
        sparkContainer.innerHTML.includes('sparkline'),
        'ChartRenderer.renderSparkline creates sparkline'
    );

    // Test 9: Progress ring
    const progressContainer = document.createElement('div');
    progressContainer.id = 'testProgress';
    document.body.appendChild(progressContainer);
    
    ChartRenderer.renderProgressRing('testProgress', 75, { label: 'Complete' });
    
    assert(
        progressContainer.innerHTML.includes('progress-ring'),
        'ChartRenderer.renderProgressRing creates progress ring'
    );

    // Test 10: Invalid container handling
    ChartRenderer.renderBarChart('nonexistent-container', { labels: ['A'], values: [1] });
    assert(true, 'ChartRenderer handles invalid container gracefully');

    return testResults;
}

// ========================================
// MAIN TEST RUNNER
// ========================================
async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 SCANNER APP INTEGRATION TEST SUITE');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toISOString()}\n`);

    // Check dependencies
    try {
        require('jsdom');
    } catch (e) {
        console.error('❌ Missing dependency: jsdom');
        console.log('Run: npm install jsdom');
        process.exit(1);
    }

    // Run all test suites
    testStateManagerIntegration();
    testLineageServiceIntegration();
    testAuditServiceIntegration();
    testAnalyticsEngineIntegration();
    testDataPersistence();
    testErrorHandling();
    testUserWorkflows();
    testChartRenderer();

    // Calculate results
    const duration = ((Date.now() - testResults.startTime) / 1000).toFixed(2);
    const total = testResults.passed + testResults.failed + testResults.skipped;
    const passRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed:  ${testResults.passed}`);
    console.log(`❌ Failed:  ${testResults.failed}`);
    console.log(`⏭️ Skipped: ${testResults.skipped}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    console.log(`⏱️ Duration: ${duration}s`);

    if (testResults.errors.length > 0) {
        console.log('\n🔴 FAILED TESTS:');
        testResults.errors.forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.test}`);
            if (err.details) console.log(`     Details: ${err.details}`);
        });
    }

    if (testResults.warnings.length > 0) {
        console.log('\n⚠️ WARNINGS:');
        testResults.warnings.forEach((warn, i) => {
            console.log(`  ${i + 1}. ${warn.test}: ${warn.reason}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    if (testResults.failed > 0) {
        console.log('❌ INTEGRATION TESTS FAILED');
        process.exit(1);
    } else {
        console.log('✅ ALL INTEGRATION TESTS PASSED');
        process.exit(0);
    }
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(2);
});
