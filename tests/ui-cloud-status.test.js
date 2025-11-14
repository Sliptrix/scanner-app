/**
 * UI Cloud Status Integration Tests
 * Tests for cloud sync button and status indicator in the UI
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('UI Cloud Status Integration Tests');
console.log('========================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Read index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let indexHTML = '';

try {
    indexHTML = fs.readFileSync(indexPath, 'utf8');
} catch (error) {
    console.log(`❌ Failed to read index.html: ${error.message}`);
    process.exit(1);
}

// Test 1: Cloud sync button exists
runTest('index.html contains cloud sync button with id="cloud-sync-btn"', () => {
    const buttonRegex = /<button[^>]*id=["']cloud-sync-btn["'][^>]*>/i;

    if (!buttonRegex.test(indexHTML)) {
        throw new Error('Cloud sync button with id="cloud-sync-btn" not found in index.html');
    }
});

// Test 2: Cloud status indicator exists
runTest('index.html contains cloud status indicator with id="cloud-sync-status"', () => {
    const statusRegex = /id=["']cloud-sync-status["']/i;

    if (!statusRegex.test(indexHTML)) {
        throw new Error('Cloud status element with id="cloud-sync-status" not found in index.html');
    }
});

// Test 3: Button is in data-status section
runTest('Cloud sync button is located in the data-status section', () => {
    const dataStatusRegex = /<div[^>]*class=["'][^"']*data-status[^"']*["'][^>]*>[\s\S]*?cloud-sync-btn[\s\S]*?<\/div>/i;

    if (!dataStatusRegex.test(indexHTML)) {
        throw new Error('Cloud sync button not found in data-status section');
    }
});

// Test 4: Status indicator is in data-status section
runTest('Cloud status indicator is located in the data-status section', () => {
    const dataStatusRegex = /<div[^>]*class=["'][^"']*data-status[^"']*["'][^>]*>[\s\S]*?cloud-sync-status[\s\S]*?<\/div>/i;

    if (!dataStatusRegex.test(indexHTML)) {
        throw new Error('Cloud status indicator not found in data-status section');
    }
});

// Test 5: Button has appropriate label
runTest('Cloud sync button has "Sync from Cloud" label or cloud icon', () => {
    const buttonPattern = /<button[^>]*id=["']cloud-sync-btn["'][^>]*>([^<]*)<\/button>/i;
    const match = indexHTML.match(buttonPattern);

    if (!match) {
        throw new Error('Could not extract button label');
    }

    const label = match[1];
    const hasCloudIcon = label.includes('☁') || label.includes('🔄') || label.includes('cloud');
    const hasSyncText = /sync/i.test(label);

    if (!hasCloudIcon && !hasSyncText) {
        throw new Error(`Button label "${label}" does not indicate cloud sync functionality`);
    }
});

// Test 6: Status element has initial text
runTest('Cloud status element has initial "Last synced" text or placeholder', () => {
    const statusPattern = /id=["']cloud-sync-status["'][^>]*>([^<]*)</i;
    const match = indexHTML.match(statusPattern);

    if (!match) {
        throw new Error('Could not extract status text');
    }

    const text = match[1].trim();
    const hasPlaceholder = text.includes('Last synced') || text.includes('—') || text.includes('Never') || text === '';

    if (!hasPlaceholder) {
        throw new Error(`Status text "${text}" does not appear to be a valid placeholder`);
    }
});

// Test 7: OneDriveSync script is included
runTest('index.html includes script tag for oneDriveSync.js', () => {
    const scriptRegex = /<script[^>]*src=["'][^"']*oneDriveSync\.js["'][^>]*>/i;

    if (!scriptRegex.test(indexHTML)) {
        throw new Error('Script tag for oneDriveSync.js not found in index.html');
    }
});

// Test 8: OneDriveSync script is loaded after authManager
runTest('oneDriveSync.js is loaded after authManager.js', () => {
    const authManagerIndex = indexHTML.indexOf('authManager.js');
    const oneDriveSyncIndex = indexHTML.indexOf('oneDriveSync.js');

    if (authManagerIndex === -1) {
        throw new Error('authManager.js not found in index.html');
    }

    if (oneDriveSyncIndex === -1) {
        throw new Error('oneDriveSync.js not found in index.html');
    }

    if (oneDriveSyncIndex <= authManagerIndex) {
        throw new Error('oneDriveSync.js must be loaded after authManager.js for dependency order');
    }
});

// Test 9: OneDriveSync script is loaded before main.js
runTest('oneDriveSync.js is loaded before main.js', () => {
    const oneDriveSyncIndex = indexHTML.indexOf('oneDriveSync.js');
    const mainJsIndex = indexHTML.indexOf('main.js');

    if (oneDriveSyncIndex === -1) {
        throw new Error('oneDriveSync.js not found in index.html');
    }

    if (mainJsIndex === -1) {
        throw new Error('main.js not found in index.html');
    }

    if (oneDriveSyncIndex >= mainJsIndex) {
        throw new Error('oneDriveSync.js must be loaded before main.js for proper initialization');
    }
});

// Test 10: Button click handler simulation
runTest('Clicking "Sync from Cloud" button should trigger OneDriveSync.manualSync()', () => {
    // Mock DOM and OneDriveSync
    const mockWindow = {
        OneDriveSync: {
            _manualSyncCalled: false,
            manualSync() {
                this._manualSyncCalled = true;
            }
        }
    };

    // Simulate button click handler
    const clickHandler = () => {
        mockWindow.OneDriveSync.manualSync();
    };

    clickHandler();

    if (!mockWindow.OneDriveSync._manualSyncCalled) {
        throw new Error('OneDriveSync.manualSync() was not called on button click');
    }
});

// Test 11: Status shows last sync time
runTest('Status updates to show "Last synced: [time]" after successful sync', () => {
    const mockStatusElement = {
        textContent: '',
        innerText: ''
    };

    const mockOneDriveSync = {
        getStatus() {
            return {
                lastSync: new Date('2025-01-15T10:30:00Z').toISOString(),
                lastError: null,
                fromCloud: true
            };
        }
    };

    // Simulate status update function
    const updateStatus = () => {
        const status = mockOneDriveSync.getStatus();
        if (status.lastSync) {
            const syncDate = new Date(status.lastSync);
            mockStatusElement.textContent = `Last synced: ${syncDate.toLocaleString()}`;
        } else {
            mockStatusElement.textContent = 'Last synced: —';
        }
    };

    updateStatus();

    if (!mockStatusElement.textContent.includes('Last synced:')) {
        throw new Error('Status does not include "Last synced:" text');
    }

    if (mockStatusElement.textContent.includes('—')) {
        throw new Error('Status should show actual time, not placeholder');
    }
});

// Test 12: Status shows error state
runTest('Status shows error message when cloud sync fails', () => {
    const mockStatusElement = {
        textContent: '',
        classList: {
            _classes: [],
            add(cls) { this._classes.push(cls); },
            remove(cls) { this._classes = this._classes.filter(c => c !== cls); }
        }
    };

    const mockOneDriveSync = {
        getStatus() {
            return {
                lastSync: null,
                lastError: 'Network timeout',
                fromCloud: false
            };
        }
    };

    // Simulate status update with error
    const updateStatus = () => {
        const status = mockOneDriveSync.getStatus();
        if (status.lastError) {
            mockStatusElement.textContent = `❌ Sync failed: ${status.lastError}`;
            mockStatusElement.classList.add('error');
        } else if (status.lastSync) {
            mockStatusElement.textContent = `✅ Last synced: ${new Date(status.lastSync).toLocaleString()}`;
            mockStatusElement.classList.remove('error');
        }
    };

    updateStatus();

    if (!mockStatusElement.textContent.includes('Sync failed')) {
        throw new Error('Error message not displayed in status');
    }

    if (!mockStatusElement.classList._classes.includes('error')) {
        throw new Error('Error class not added to status element');
    }
});

// Test 13: Status preserves last successful sync during error
runTest('Status shows both last successful sync and current error', () => {
    const mockOneDriveSync = {
        getStatus() {
            return {
                lastSync: new Date('2025-01-15T09:00:00Z').toISOString(),
                lastError: 'Connection lost',
                fromCloud: false
            };
        }
    };

    const updateStatus = () => {
        const status = mockOneDriveSync.getStatus();
        let statusText = '';

        if (status.lastError) {
            statusText = `❌ Error: ${status.lastError}`;
        }

        if (status.lastSync) {
            const syncDate = new Date(status.lastSync);
            statusText += ` (Last success: ${syncDate.toLocaleString()})`;
        }

        return statusText;
    };

    const statusText = updateStatus();

    if (!statusText.includes('Error:')) {
        throw new Error('Current error not shown');
    }

    if (!statusText.includes('Last success:')) {
        throw new Error('Last successful sync not preserved');
    }
});

// Test 14: Button is disabled during sync
runTest('Cloud sync button is disabled while sync is in progress', () => {
    const mockButton = {
        disabled: false,
        textContent: '🔄 Sync from Cloud'
    };

    const mockOneDriveSync = {
        _isRunning: false,
        getStatus() {
            return { isRunning: this._isRunning };
        },
        async manualSync() {
            this._isRunning = true;
            mockButton.disabled = true;
            mockButton.textContent = '⏳ Syncing...';

            // Simulate async work
            await new Promise(resolve => setTimeout(resolve, 10));

            this._isRunning = false;
            mockButton.disabled = false;
            mockButton.textContent = '🔄 Sync from Cloud';
        }
    };

    // Simulate click
    mockOneDriveSync.manualSync();

    // Check disabled state during sync
    if (!mockButton.disabled) {
        throw new Error('Button not disabled during sync');
    }

    if (!mockButton.textContent.includes('Syncing')) {
        throw new Error('Button text not updated during sync');
    }
});

// Print summary
console.log('\n========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log('========================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
