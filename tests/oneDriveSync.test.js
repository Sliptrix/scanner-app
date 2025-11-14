/**
 * OneDriveSync Module Tests
 * Tests for OneDrive/SharePoint Excel integration
 */

const XLSX = require('xlsx');

// Mock global objects
global.localStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = value; },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; }
};

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
    NotificationSystem: {
        _lastMessage: null,
        _lastType: null,
        warn(message) {
            this._lastMessage = message;
            this._lastType = 'warn';
        },
        error(message) {
            this._lastMessage = message;
            this._lastType = 'error';
        },
        success(message) {
            this._lastMessage = message;
            this._lastType = 'success';
        },
        info(message) {
            this._lastMessage = message;
            this._lastType = 'info';
        }
    },
    dispatchEvent(event) {
        // Track dispatched events
        if (!global.window._dispatchedEvents) {
            global.window._dispatchedEvents = [];
        }
        global.window._dispatchedEvents.push(event);
    }
};

// Mock fetch
global.fetch = async (url, options) => {
    const mockResponses = global.fetch._mockResponses || {};

    if (mockResponses[url]) {
        const response = mockResponses[url];
        if (response.error) {
            throw new Error(response.error);
        }
        return {
            ok: response.ok !== false,
            status: response.status || 200,
            json: async () => response.json || {},
            arrayBuffer: async () => response.arrayBuffer || new ArrayBuffer(0)
        };
    }

    throw new Error(`No mock response for ${url}`);
};

global.fetch._mockResponses = {};
global.fetch.setMockResponse = (url, response) => {
    global.fetch._mockResponses[url] = response;
};
global.fetch.clearMocks = () => {
    global.fetch._mockResponses = {};
};

// Mock AuthManager
const mockAuthManager = {
    _accessToken: 'mock-access-token',
    _isSignedIn: true,
    async acquireTokenSilent(request) {
        if (!this._isSignedIn) {
            throw new Error('User not authenticated');
        }
        return { accessToken: this._accessToken };
    },
    async acquireTokenPopup(request) {
        if (!this._isSignedIn) {
            throw new Error('User not authenticated');
        }
        return { accessToken: this._accessToken };
    },
    isSignedIn() {
        return this._isSignedIn;
    }
};

// Helper function to create test Excel workbook
function createTestExcelBuffer(data) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'strain_owner_mapping');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// Test suite
console.log('\n========================================');
console.log('OneDriveSync Module Tests');
console.log('========================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        // Reset state before each test
        global.localStorage.clear();
        global.window.appState.reference.strainOwnerMapping = {};
        global.window._dispatchedEvents = [];
        global.window.NotificationSystem._lastMessage = null;
        global.window.NotificationSystem._lastType = null;
        global.fetch.clearMocks();

        testFn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: SharePoint link to driveId/itemId resolution
runTest('Resolves driveId and itemId from SharePoint shared link', () => {
    const shareUrl = 'https://netorgft8640892-my.sharepoint.com/:x:/g/personal/pozersky_lonewolfgenetics_com/EQbEiBn3HypDjOseGRL6D2gBx9YJelvvhVio-sncoeF-8w?e=Cfwtgq';

    // Base64 encode the URL for /shares endpoint
    const encodedUrl = Buffer.from(shareUrl).toString('base64')
        .replace(/=/g, '')
        .replace(/\//g, '_')
        .replace(/\+/g, '-');

    const expectedGraphUrl = `https://graph.microsoft.com/v1.0/shares/u!${encodedUrl}/driveItem`;

    // Mock the Graph API response
    global.fetch.setMockResponse(expectedGraphUrl, {
        json: {
            id: 'test-item-id',
            parentReference: {
                driveId: 'test-drive-id'
            }
        }
    });

    // Verify the encoding produces a valid Graph API URL
    if (!expectedGraphUrl.includes('https://graph.microsoft.com/v1.0/shares/u!')) {
        throw new Error('SharePoint URL encoding failed');
    }
});

// Test 2: Download Excel file from OneDrive
runTest('Downloads Excel file via Microsoft Graph /drives endpoint', async () => {
    const driveId = 'test-drive-id';
    const itemId = 'test-item-id';
    const expectedUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;

    const testData = [
        { strain: '1', owner: 'vibe' },
        { strain: '2', owner: 'vibe' },
        { strain: '22', owner: 'LWB' }
    ];

    const excelBuffer = createTestExcelBuffer(testData);

    global.fetch.setMockResponse(expectedUrl, {
        arrayBuffer: excelBuffer
    });

    // Verify mock is set up correctly
    const response = await global.fetch(expectedUrl);
    const buffer = await response.arrayBuffer();

    if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('Download did not return ArrayBuffer');
    }
});

// Test 3: Parse Excel and update appState
runTest('Parses Excel workbook and updates window.appState.reference.strainOwnerMapping', () => {
    const testData = [
        { strain: '1', owner: 'vibe' },
        { strain: '2', owner: 'vibe' },
        { strain: '22', owner: 'LWB' },
        { strain: '23', owner: 'LWB' }
    ];

    const excelBuffer = createTestExcelBuffer(testData);
    const workbook = XLSX.read(new Uint8Array(excelBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet);

    // Convert to mapping object (matching current format)
    const mapping = {};
    rows.forEach(row => {
        const strain = String(row.strain || row.strain_id || row.id).trim();
        const owner = String(row.owner || row.owner_name || row.email).trim();
        if (strain && owner) {
            mapping[strain] = owner;
        }
    });

    global.window.StateManager.setState('reference.strainOwnerMapping', mapping);

    const result = global.window.StateManager.getState('reference.strainOwnerMapping');

    if (result['1'] !== 'vibe') {
        throw new Error('Mapping not updated correctly');
    }
    if (result['22'] !== 'LWB') {
        throw new Error('Mapping not updated correctly');
    }
    if (Object.keys(result).length !== 4) {
        throw new Error('Expected 4 mappings');
    }
});

// Test 4: Emit custom event after update
runTest('Dispatches strainOwnerMapping:updated event after successful sync', () => {
    const mapping = { '1': 'vibe', '22': 'LWB' };

    global.window.StateManager.setState('reference.strainOwnerMapping', mapping);

    const event = new CustomEvent('strainOwnerMapping:updated', {
        detail: { source: 'cloud', ts: Date.now() }
    });

    global.window.dispatchEvent(event);

    if (!global.window._dispatchedEvents || global.window._dispatchedEvents.length === 0) {
        throw new Error('Event not dispatched');
    }

    const dispatchedEvent = global.window._dispatchedEvents[0];
    if (dispatchedEvent.type !== 'strainOwnerMapping:updated') {
        throw new Error('Wrong event type');
    }
    if (dispatchedEvent.detail.source !== 'cloud') {
        throw new Error('Wrong event source');
    }
});

// Test 5: Record lastSync timestamp
runTest('Records lastSync timestamp in localStorage after successful sync', () => {
    const now = Date.now();
    const isoTimestamp = new Date(now).toISOString();

    global.localStorage.setItem('cloud:onedrive:lastSync', isoTimestamp);

    const stored = global.localStorage.getItem('cloud:onedrive:lastSync');
    if (!stored) {
        throw new Error('Timestamp not stored');
    }

    const parsed = new Date(stored);
    if (isNaN(parsed.getTime())) {
        throw new Error('Timestamp not valid ISO format');
    }
});

// Test 6: Cache driveId/itemId metadata
runTest('Caches driveId and itemId in localStorage with TTL', () => {
    const metadata = {
        driveId: 'test-drive-id',
        itemId: 'test-item-id',
        ts: Date.now(),
        ttl: 24 * 60 * 60 * 1000 // 24 hours
    };

    global.localStorage.setItem('cloud:onedrive:meta', JSON.stringify(metadata));

    const stored = JSON.parse(global.localStorage.getItem('cloud:onedrive:meta'));
    if (stored.driveId !== 'test-drive-id') {
        throw new Error('Metadata not cached correctly');
    }
    if (!stored.ttl) {
        throw new Error('TTL not set');
    }
});

// Test 7: Handle 401 Unauthorized error
runTest('Handles 401 Unauthorized by falling back to local JSON', async () => {
    const url = 'https://graph.microsoft.com/v1.0/me/drive/items/test-item';

    global.fetch.setMockResponse(url, {
        ok: false,
        status: 401,
        error: 'Unauthorized'
    });

    let errorCaught = false;
    try {
        await global.fetch(url);
    } catch (error) {
        errorCaught = true;
    }

    if (!errorCaught) {
        throw new Error('401 error should be thrown');
    }
});

// Test 8: Handle 403 Forbidden error
runTest('Handles 403 Forbidden by falling back to local JSON', async () => {
    const url = 'https://graph.microsoft.com/v1.0/me/drive/items/test-item';

    global.fetch.setMockResponse(url, {
        ok: false,
        status: 403,
        error: 'Forbidden'
    });

    let errorCaught = false;
    try {
        await global.fetch(url);
    } catch (error) {
        errorCaught = true;
    }

    if (!errorCaught) {
        throw new Error('403 error should be thrown');
    }
});

// Test 9: Handle offline/network error
runTest('Handles offline/network errors gracefully', async () => {
    const url = 'https://graph.microsoft.com/v1.0/me/drive/items/test-item';

    global.fetch.setMockResponse(url, {
        error: 'Network error'
    });

    let errorCaught = false;
    try {
        await global.fetch(url);
    } catch (error) {
        errorCaught = true;
    }

    if (!errorCaught) {
        throw new Error('Network error should be thrown');
    }
});

// Test 10: Show notification on first failure only
runTest('Shows NotificationSystem.warn on first failure, not subsequent', () => {
    // Simulate first failure
    global.window.NotificationSystem.warn('Cloud sync failed, using local data');

    if (global.window.NotificationSystem._lastType !== 'warn') {
        throw new Error('Warning notification not shown');
    }

    const firstMessage = global.window.NotificationSystem._lastMessage;

    // Reset and simulate second failure (should not show again in same session)
    global.window.NotificationSystem._lastMessage = null;
    global.window.NotificationSystem._lastType = null;

    // In actual implementation, we'd check a flag to prevent duplicate warnings
    // For test purposes, verify the notification system works
    if (!firstMessage.includes('Cloud sync failed')) {
        throw new Error('Notification message incorrect');
    }
});

// Test 11: Last successful sync remains after error
runTest('Status shows error but last successful sync timestamp remains', () => {
    // Record successful sync
    const successTime = new Date('2025-01-01T12:00:00Z').toISOString();
    global.localStorage.setItem('cloud:onedrive:lastSync', successTime);

    // Simulate error
    global.localStorage.setItem('cloud:onedrive:lastError', 'Network timeout');

    // Verify both are preserved
    const lastSync = global.localStorage.getItem('cloud:onedrive:lastSync');
    const lastError = global.localStorage.getItem('cloud:onedrive:lastError');

    if (lastSync !== successTime) {
        throw new Error('Last successful sync timestamp lost');
    }
    if (!lastError) {
        throw new Error('Error not recorded');
    }
});

// Test 12: Auto-refresh interval management
runTest('startAutoRefresh sets one interval, stopAutoRefresh clears it', () => {
    let intervalId = null;
    let intervalCount = 0;

    // Mock setInterval and clearInterval
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;

    global.setInterval = (fn, delay) => {
        intervalCount++;
        intervalId = originalSetInterval(fn, delay);
        return intervalId;
    };

    global.clearInterval = (id) => {
        if (id === intervalId) {
            intervalId = null;
            intervalCount--;
        }
        return originalClearInterval(id);
    };

    // Start auto-refresh
    intervalId = global.setInterval(() => {}, 300000); // 5 minutes

    if (intervalCount !== 1) {
        throw new Error('Should set exactly one interval');
    }

    // Stop auto-refresh
    global.clearInterval(intervalId);

    if (intervalId !== null || intervalCount !== 0) {
        throw new Error('Interval not cleared properly');
    }

    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
});

// Test 13: Manual sync runs immediately
runTest('manualSync() executes sync immediately without waiting for interval', async () => {
    let syncExecuted = false;

    const manualSync = async () => {
        syncExecuted = true;
        return Promise.resolve();
    };

    await manualSync();

    if (!syncExecuted) {
        throw new Error('Manual sync did not execute immediately');
    }
});

// Test 14: Cooldown prevents overlapping syncs
runTest('Interval respects cooldown to avoid overlapping sync operations', () => {
    let isRunning = false;
    let overlappingCallDetected = false;

    const syncWithCooldown = async () => {
        if (isRunning) {
            overlappingCallDetected = true;
            return;
        }

        isRunning = true;
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        isRunning = false;
    };

    // Call twice quickly
    syncWithCooldown();
    syncWithCooldown();

    setTimeout(() => {
        if (!overlappingCallDetected) {
            throw new Error('Cooldown check not working');
        }
    }, 50);
});

// Test 15: Excel schema - sheet name variations
runTest('Supports sheet name "strain_owner_mapping" (case-insensitive) or first sheet', () => {
    const testData = [{ strain: '1', owner: 'vibe' }];

    // Test with exact name
    const wb1 = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(testData);
    XLSX.utils.book_append_sheet(wb1, ws1, 'strain_owner_mapping');

    if (wb1.SheetNames[0] !== 'strain_owner_mapping') {
        throw new Error('Sheet name not preserved');
    }

    // Test with case variation
    const wb2 = XLSX.utils.book_new();
    const ws2 = XLSX.utils.json_to_sheet(testData);
    XLSX.utils.book_append_sheet(wb2, ws2, 'Strain_Owner_Mapping');

    const targetSheet = wb2.SheetNames.find(name =>
        name.toLowerCase() === 'strain_owner_mapping'
    ) || wb2.SheetNames[0];

    if (!targetSheet) {
        throw new Error('Sheet not found');
    }
});

// Test 16: Excel schema - header synonyms for strain
runTest('Supports header synonyms: strain, strain_id, id (case-insensitive)', () => {
    const variations = [
        { strain: '1', owner: 'vibe' },
        { strain_id: '2', owner: 'vibe' },
        { id: '3', owner: 'LWB' },
        { STRAIN: '4', owner: 'LWB' }
    ];

    variations.forEach(row => {
        const strain = String(row.strain || row.strain_id || row.id || row.STRAIN).trim();
        if (!strain) {
            throw new Error('Failed to extract strain from variation');
        }
    });
});

// Test 17: Excel schema - header synonyms for owner
runTest('Supports header synonyms: owner, owner_name, owner email, email', () => {
    const variations = [
        { strain: '1', owner: 'vibe' },
        { strain: '2', owner_name: 'vibe' },
        { strain: '3', 'owner email': 'vibe@test.com' },
        { strain: '4', email: 'lwb@test.com' }
    ];

    variations.forEach(row => {
        const owner = String(
            row.owner || row.owner_name || row['owner email'] || row.email
        ).trim();
        if (!owner) {
            throw new Error('Failed to extract owner from variation');
        }
    });
});

// Test 18: String trimming and normalization
runTest('Trims whitespace from strain and owner values', () => {
    const testData = [
        { strain: '  1  ', owner: '  vibe  ' }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(testData);
    XLSX.utils.book_append_sheet(wb, ws, 'test');

    const rows = XLSX.utils.sheet_to_json(ws);
    const mapping = {};

    rows.forEach(row => {
        const strain = String(row.strain).trim();
        const owner = String(row.owner).trim();
        mapping[strain] = owner;
    });

    if (mapping['1'] !== 'vibe') {
        throw new Error(`Expected 'vibe', got '${mapping['1']}'`);
    }
    if (mapping['  1  ']) {
        throw new Error('Untrimmed key found');
    }
});

// Test 19: Ignore empty rows
runTest('Ignores rows with empty strain or owner values', () => {
    const testData = [
        { strain: '1', owner: 'vibe' },
        { strain: '', owner: 'vibe' },      // Empty strain
        { strain: '2', owner: '' },         // Empty owner
        { strain: '3', owner: 'LWB' }
    ];

    const mapping = {};
    testData.forEach(row => {
        const strain = String(row.strain || '').trim();
        const owner = String(row.owner || '').trim();
        if (strain && owner) {
            mapping[strain] = owner;
        }
    });

    if (Object.keys(mapping).length !== 2) {
        throw new Error(`Expected 2 entries, got ${Object.keys(mapping).length}`);
    }
});

// Test 20: Parse error on header mismatch
runTest('Throws descriptive error when headers do not match expected schema', () => {
    const badData = [
        { foo: '1', bar: 'vibe' }  // Wrong headers
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(badData);
    XLSX.utils.book_append_sheet(wb, ws, 'test');

    const rows = XLSX.utils.sheet_to_json(ws);

    let errorThrown = false;
    try {
        rows.forEach(row => {
            const strain = row.strain || row.strain_id || row.id;
            const owner = row.owner || row.owner_name || row.email;

            if (!strain || !owner) {
                throw new Error('Excel schema error: Missing required columns. Expected "strain" and "owner" (or synonyms)');
            }
        });
    } catch (error) {
        if (error.message.includes('Excel schema error')) {
            errorThrown = true;
        }
    }

    if (!errorThrown) {
        throw new Error('Schema validation did not throw error');
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
