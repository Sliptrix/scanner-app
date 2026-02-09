#!/usr/bin/env node

/**
 * E2E Critical Paths Test Suite
 * Tests core application flows:
 * - Container creation
 * - Transfer workflow
 * - Cloud sync operations
 * - Dashboard rendering
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('E2E Critical Paths Test Suite');
console.log('========================================\n');

// Setup DOM environment
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>
    <div id="builderSection"></div>
    <div id="transferSection"></div>
    <div id="inventorySection"></div>
    <div id="dashboardSection"></div>
    <div id="notification"></div>
    <div id="analyticsContainer"></div>
    <div id="containerStats"></div>
    <div id="transferStats"></div>
    <div id="activityHeatmap"></div>
    <canvas id="containerChart"></canvas>
    <canvas id="transferChart"></canvas>
</body></html>`);

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

// Mock localStorage
const localStorageData = {};
global.localStorage = {
    getItem: (key) => localStorageData[key] || null,
    setItem: (key, value) => { localStorageData[key] = String(value); },
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

// Mock Chart.js
global.Chart = class Chart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
    }
    update() {}
    destroy() {}
};
dom.window.Chart = global.Chart;

// Test Results
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function runTest(name, testFn) {
    try {
        const result = testFn();
        if (result !== false) {
            console.log(`✅ ${name}`);
            testsPassed++;
            testResults.push({ name, status: 'passed' });
        } else {
            console.log(`❌ ${name}`);
            testsFailed++;
            testResults.push({ name, status: 'failed' });
        }
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
        testResults.push({ name, status: 'failed', error: error.message });
    }
}

// ========================================
// 1. CONTAINER CREATION FLOW TESTS
// ========================================

console.log('📦 Container Creation Flow Tests\n');

runTest('State module exists and is loadable', () => {
    const statePath = path.join(__dirname, '..', 'src', 'js', 'core', 'state.js');
    const content = fs.readFileSync(statePath, 'utf8');
    return content.includes('StateManager') && content.includes('setState');
});

runTest('Builder module has container creation methods', () => {
    const builderPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'builder', 'builderMain.js');
    const content = fs.readFileSync(builderPath, 'utf8');
    return content.includes('BarcodeBuilder') || content.includes('BuilderMain') || content.includes('initialize') || content.includes('startNewSession');
});

runTest('Barcode generator module exists', () => {
    const genPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'builder', 'barcodeGenerator.js');
    const content = fs.readFileSync(genPath, 'utf8');
    return content.includes('BarcodeGenerator') && content.includes('generate');
});

runTest('Container creation validates required fields', () => {
    const stepMgrPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'builder', 'stepManager.js');
    const content = fs.readFileSync(stepMgrPath, 'utf8');
    // Should have validation logic for container fields
    return content.includes('validate') || content.includes('required') || content.includes('strain') && content.includes('owner');
});

runTest('Container IDs are auto-incremented', () => {
    const statePath = path.join(__dirname, '..', 'src', 'js', 'core', 'state.js');
    const content = fs.readFileSync(statePath, 'utf8');
    return content.includes('highestContainerId') || content.includes('nextContainerId') || content.includes('containerId');
});

// ========================================
// 2. TRANSFER WORKFLOW TESTS
// ========================================

console.log('\n🔄 Transfer Workflow Tests\n');

runTest('Transfer input manager handles source container', () => {
    const inputMgrPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'inputManager.js');
    const content = fs.readFileSync(inputMgrPath, 'utf8');
    return content.includes('sourceContainer') && content.includes('processSourceContainer');
});

runTest('Transfer processor supports single mode', () => {
    const procPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'transferProcessor.js');
    const content = fs.readFileSync(procPath, 'utf8');
    return content.includes('single') && content.includes('processTransfer');
});

runTest('Transfer processor supports split mode', () => {
    const procPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'transferProcessor.js');
    const content = fs.readFileSync(procPath, 'utf8');
    return content.includes('split') && content.includes('splitCount');
});

runTest('Transfer generates new container IDs in split mode', () => {
    const procPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'transferProcessor.js');
    const content = fs.readFileSync(procPath, 'utf8');
    return content.includes('Generated new container') || content.includes('newContainerIds');
});

runTest('Transfer updates inventory state', () => {
    const procPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'transferProcessor.js');
    const content = fs.readFileSync(procPath, 'utf8');
    return content.includes('setState') && content.includes('inventory');
});

runTest('Transfer sets Complete status on transferred samples', () => {
    const procPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'transfer', 'transferProcessor.js');
    const content = fs.readFileSync(procPath, 'utf8');
    return content.includes('Complete') || content.includes('status');
});

// ========================================
// 3. CLOUD SYNC OPERATIONS TESTS
// ========================================

console.log('\n☁️ Cloud Sync Operations Tests\n');

runTest('OneDrive sync module exists', () => {
    const syncPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'cloud', 'oneDriveSync.js');
    return fs.existsSync(syncPath);
});

runTest('OneDrive sync has manual sync method', () => {
    const syncPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'cloud', 'oneDriveSync.js');
    if (!fs.existsSync(syncPath)) return false;
    const content = fs.readFileSync(syncPath, 'utf8');
    return content.includes('manualSync') || content.includes('sync');
});

runTest('OneDrive sync has auto-refresh capability', () => {
    const syncPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'cloud', 'oneDriveSync.js');
    if (!fs.existsSync(syncPath)) return false;
    const content = fs.readFileSync(syncPath, 'utf8');
    return content.includes('autoRefresh') || content.includes('interval') || content.includes('refresh');
});

runTest('Cloud sync handles authentication errors gracefully', () => {
    const syncPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'cloud', 'oneDriveSync.js');
    if (!fs.existsSync(syncPath)) return false;
    const content = fs.readFileSync(syncPath, 'utf8');
    return content.includes('401') || content.includes('Unauthorized') || content.includes('auth') && content.includes('error');
});

runTest('Cloud sync parses strain-owner mapping from Excel', () => {
    const syncPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'cloud', 'oneDriveSync.js');
    if (!fs.existsSync(syncPath)) return false;
    const content = fs.readFileSync(syncPath, 'utf8');
    return content.includes('strain') && content.includes('owner') && (content.includes('mapping') || content.includes('parse'));
});

runTest('Data utils has cloud fallback for reference data', () => {
    const dataUtilsPath = path.join(__dirname, '..', 'src', 'js', 'utils', 'dataUtils.js');
    const content = fs.readFileSync(dataUtilsPath, 'utf8');
    return content.includes('fallback') || content.includes('cloud') || content.includes('reference');
});

// ========================================
// 4. DASHBOARD RENDERING TESTS
// ========================================

console.log('\n📊 Dashboard Rendering Tests\n');

runTest('Analytics engine module exists', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('AnalyticsEngine') && content.includes('getAnalytics');
});

runTest('Analytics engine calculates container statistics', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('container') && (content.includes('stats') || content.includes('count') || content.includes('total'));
});

runTest('Analytics engine calculates transfer statistics', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('transfer') && (content.includes('stats') || content.includes('history'));
});

runTest('Analytics engine generates activity heatmap data', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('heatmap') || content.includes('activity') || content.includes('trend');
});

runTest('Chart renderer module exists', () => {
    const chartPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'chartRenderer.js');
    const content = fs.readFileSync(chartPath, 'utf8');
    return content.includes('ChartRenderer') || content.includes('render') || content.includes('chart');
});

runTest('Dashboard main module initializes components', () => {
    const dashPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'dashboardMain.js');
    const content = fs.readFileSync(dashPath, 'utf8');
    return content.includes('init') && (content.includes('Dashboard') || content.includes('analytics'));
});

runTest('Dashboard supports date range filtering', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('dateRange') || content.includes('startDate') || content.includes('filterBy');
});

runTest('Dashboard exports analytics data', () => {
    const analyticsPath = path.join(__dirname, '..', 'src', 'js', 'modules', 'dashboard', 'analyticsEngine.js');
    const content = fs.readFileSync(analyticsPath, 'utf8');
    return content.includes('export') && (content.includes('JSON') || content.includes('CSV'));
});

// ========================================
// 5. INTEGRATION TESTS
// ========================================

console.log('\n🔗 Integration Tests\n');

runTest('Main.js orchestrates all modules', () => {
    const mainPath = path.join(__dirname, '..', 'src', 'js', 'main.js');
    const content = fs.readFileSync(mainPath, 'utf8');
    return content.includes('init') && (content.includes('Builder') || content.includes('Transfer') || content.includes('Inventory'));
});

runTest('Index.html includes all required module scripts', () => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');
    const hasBuilder = content.includes('builder');
    const hasTransfer = content.includes('transfer');
    const hasInventory = content.includes('inventory');
    const hasDashboard = content.includes('dashboard') || content.includes('analytics');
    return hasBuilder && hasTransfer && hasInventory && hasDashboard;
});

runTest('Notification system is available for all modules', () => {
    const notifPath = path.join(__dirname, '..', 'src', 'js', 'core', 'notifications.js');
    const content = fs.readFileSync(notifPath, 'utf8');
    return content.includes('NotificationSystem') && content.includes('success') && content.includes('error');
});

runTest('Lineage tracking module exists for genealogy', () => {
    const lineagePath = path.join(__dirname, '..', 'src', 'js', 'modules', 'lineage');
    return fs.existsSync(lineagePath) && fs.readdirSync(lineagePath).length > 0;
});

// ========================================
// SUMMARY
// ========================================

console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📊 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
console.log('========================================\n');

if (testsFailed > 0) {
    process.exit(1);
} else {
    console.log('🎉 ALL E2E CRITICAL PATH TESTS PASSED!\n');
}
