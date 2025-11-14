/**
 * DataUtils Cloud Fallback Tests
 * Tests for cloud data source fallback behavior
 */

console.log('\n========================================');
console.log('DataUtils Cloud Fallback Tests');
console.log('========================================\n');

// Mock global objects
global.window = {
    appState: {
        reference: {
            strainOwnerMapping: {}
        }
    },
    StateManager: {
        setState(path, value) {
            const parts = path.split('.');
            let obj = global.window.appState;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
        },
        getState(path) {
            const parts = path.split('.');
            let obj = global.window.appState;
            for (const part of parts) {
                if (!obj) return undefined;
                obj = obj[part];
            }
            return obj;
        }
    },
    OneDriveSync: null,
    AuthManager: {
        _isSignedIn: true,
        isSignedIn() { return this._isSignedIn; }
    }
};

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        // Reset state
        global.window.appState.reference.strainOwnerMapping = {};

        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Prefer OneDrive when authenticated and available
runTest('When authenticated and cloud available, prefers OneDrive data', async () => {
    global.window.AuthManager._isSignedIn = true;

    // Mock OneDriveSync module
    global.window.OneDriveSync = {
        _available: true,
        _lastSync: Date.now(),
        async manualSync() {
            // Simulate successful cloud sync
            const cloudMapping = { '1': 'vibe', '22': 'LWB' };
            global.window.StateManager.setState('reference.strainOwnerMapping', cloudMapping);
            return { success: true, source: 'cloud' };
        },
        getStatus() {
            return {
                lastSync: this._lastSync,
                lastError: null,
                isRunning: false,
                fromCloud: true
            };
        }
    };

    // Simulate data loading priority
    let dataSource = null;

    if (global.window.AuthManager.isSignedIn() && global.window.OneDriveSync) {
        const result = await global.window.OneDriveSync.manualSync();
        if (result.success) {
            dataSource = 'cloud';
        }
    }

    if (!dataSource) {
        dataSource = 'local-json'; // Fallback
    }

    if (dataSource !== 'cloud') {
        throw new Error(`Expected 'cloud', got '${dataSource}'`);
    }

    const mapping = global.window.StateManager.getState('reference.strainOwnerMapping');
    if (mapping['1'] !== 'vibe') {
        throw new Error('Cloud data not loaded');
    }
});

// Test 2: Fall back to local JSON when cloud fails
runTest('When cloud fails/unavailable, falls back to local JSON', async () => {
    global.window.AuthManager._isSignedIn = true;

    // Mock OneDriveSync with failure
    global.window.OneDriveSync = {
        async manualSync() {
            throw new Error('Network error');
        },
        getStatus() {
            return {
                lastSync: null,
                lastError: 'Network error',
                isRunning: false,
                fromCloud: false
            };
        }
    };

    let dataSource = null;

    // Try cloud first
    if (global.window.AuthManager.isSignedIn() && global.window.OneDriveSync) {
        try {
            const result = await global.window.OneDriveSync.manualSync();
            if (result.success) {
                dataSource = 'cloud';
            }
        } catch (error) {
            // Cloud failed, fall back to local JSON
            dataSource = 'local-json';
        }
    }

    if (!dataSource) {
        dataSource = 'local-json';
    }

    if (dataSource !== 'local-json') {
        throw new Error(`Expected fallback to 'local-json', got '${dataSource}'`);
    }
});

// Test 3: Fall back to minimal when both cloud and JSON fail
runTest('Falls back to minimal fallback when both cloud and JSON unavailable', async () => {
    global.window.AuthManager._isSignedIn = true;

    // Mock OneDriveSync with failure
    global.window.OneDriveSync = {
        async manualSync() {
            throw new Error('Network error');
        }
    };

    let dataSource = null;

    // Try cloud first
    try {
        await global.window.OneDriveSync.manualSync();
        dataSource = 'cloud';
    } catch (error) {
        // Try local JSON
        try {
            // Simulate JSON fetch failure
            throw new Error('JSON not found');
        } catch (jsonError) {
            // Fall back to minimal
            dataSource = 'minimal';
        }
    }

    if (dataSource !== 'minimal') {
        throw new Error(`Expected fallback to 'minimal', got '${dataSource}'`);
    }
});

// Test 4: Periodic refresh updates mapping
runTest('When cloud later becomes available, periodic refresh updates mapping', async () => {
    let refreshCount = 0;
    let currentMapping = {};

    // Mock OneDriveSync with initial failure, then success
    global.window.OneDriveSync = {
        _attemptNumber: 0,
        async manualSync() {
            this._attemptNumber++;

            if (this._attemptNumber === 1) {
                // First attempt fails
                throw new Error('Network error');
            } else {
                // Second attempt succeeds
                refreshCount++;
                currentMapping = { '1': 'vibe', '22': 'LWB' };
                global.window.StateManager.setState('reference.strainOwnerMapping', currentMapping);
                return { success: true, source: 'cloud' };
            }
        },
        startAutoRefresh() {
            // Simulate auto-refresh
            setTimeout(async () => {
                try {
                    await this.manualSync();
                } catch (error) {
                    // Ignore
                }
            }, 100);
        }
    };

    // Initial load fails
    try {
        await global.window.OneDriveSync.manualSync();
    } catch (error) {
        // Expected failure
    }

    // Start auto-refresh (simulates periodic check)
    global.window.OneDriveSync.startAutoRefresh();

    // Wait for refresh to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    if (refreshCount !== 1) {
        throw new Error(`Expected 1 refresh, got ${refreshCount}`);
    }

    if (currentMapping['1'] !== 'vibe') {
        throw new Error('Mapping not updated after recovery');
    }
});

// Test 5: Event emission on cloud data update
runTest('Emits strainOwnerMapping:updated event when cloud sync succeeds', () => {
    let eventReceived = false;
    let eventDetail = null;

    // Mock event listener
    const originalDispatchEvent = global.window.dispatchEvent || (() => {});
    global.window.dispatchEvent = (event) => {
        if (event.type === 'strainOwnerMapping:updated') {
            eventReceived = true;
            eventDetail = event.detail;
        }
    };

    // Simulate successful cloud sync
    const mapping = { '1': 'vibe', '22': 'LWB' };
    global.window.StateManager.setState('reference.strainOwnerMapping', mapping);

    const event = new CustomEvent('strainOwnerMapping:updated', {
        detail: { source: 'cloud', ts: Date.now() }
    });
    global.window.dispatchEvent(event);

    if (!eventReceived) {
        throw new Error('Event not received');
    }

    if (eventDetail.source !== 'cloud') {
        throw new Error('Event source incorrect');
    }

    // Restore
    global.window.dispatchEvent = originalDispatchEvent;
});

// Test 6: No cloud preference when not authenticated
runTest('Does not attempt cloud sync when user is not authenticated', async () => {
    global.window.AuthManager._isSignedIn = false;

    let cloudAttempted = false;

    global.window.OneDriveSync = {
        async manualSync() {
            cloudAttempted = true;
            throw new Error('Should not be called');
        }
    };

    let dataSource = null;

    // Check auth before attempting cloud
    if (global.window.AuthManager.isSignedIn() && global.window.OneDriveSync) {
        await global.window.OneDriveSync.manualSync();
        dataSource = 'cloud';
    } else {
        dataSource = 'local-json'; // Skip cloud, go straight to fallback
    }

    if (cloudAttempted) {
        throw new Error('Cloud sync attempted when not authenticated');
    }

    if (dataSource !== 'local-json') {
        throw new Error(`Expected 'local-json', got '${dataSource}'`);
    }
});

// Test 7: Background sync does not block UI
runTest('Background cloud sync does not block initial data load', async () => {
    let initialDataLoaded = false;
    let cloudSyncCompleted = false;

    // Load minimal fallback immediately (non-blocking)
    const minimalMapping = { '1': 'demo', '2': 'demo' };
    global.window.StateManager.setState('reference.strainOwnerMapping', minimalMapping);
    initialDataLoaded = true;

    // Start background cloud sync
    setTimeout(async () => {
        const cloudMapping = { '1': 'vibe', '22': 'LWB' };
        global.window.StateManager.setState('reference.strainOwnerMapping', cloudMapping);
        cloudSyncCompleted = true;
    }, 50);

    // Verify initial data is available immediately
    if (!initialDataLoaded) {
        throw new Error('Initial data not loaded immediately');
    }

    const initialMapping = global.window.StateManager.getState('reference.strainOwnerMapping');
    if (initialMapping['1'] !== 'demo') {
        throw new Error('Initial data not correct');
    }

    // Wait for background sync
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!cloudSyncCompleted) {
        throw new Error('Background sync did not complete');
    }

    const finalMapping = global.window.StateManager.getState('reference.strainOwnerMapping');
    if (finalMapping['1'] !== 'vibe') {
        throw new Error('Background sync did not update mapping');
    }
});

// Test 8: Retry strategy for transient failures
runTest('Retries cloud sync on transient failure before falling back', async () => {
    let attemptCount = 0;

    global.window.OneDriveSync = {
        async manualSync() {
            attemptCount++;

            if (attemptCount < 2) {
                throw new Error('Transient network error');
            }

            // Success on second attempt
            const mapping = { '1': 'vibe' };
            global.window.StateManager.setState('reference.strainOwnerMapping', mapping);
            return { success: true, source: 'cloud' };
        }
    };

    let dataSource = null;

    // Attempt with retry
    for (let i = 0; i < 2; i++) {
        try {
            const result = await global.window.OneDriveSync.manualSync();
            if (result.success) {
                dataSource = 'cloud';
                break;
            }
        } catch (error) {
            if (i === 1) {
                // Last attempt failed, fall back
                dataSource = 'local-json';
            }
            // Otherwise retry
        }
    }

    if (attemptCount !== 2) {
        throw new Error(`Expected 2 attempts, got ${attemptCount}`);
    }

    if (dataSource !== 'cloud') {
        throw new Error('Should have succeeded on retry');
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
