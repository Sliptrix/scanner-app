// Import/Export Functionality Tests
// Tests for the data import and export features

console.log('🧪 Running Import/Export Tests...');

// Test data structures
const testAppState = {
    inventory: [
        {
            containerId: '1001',
            barcode: 'TEST001',
            strain: '00001',
            owner: 'LW',
            stage: '1',
            media: 'IA',
            tissueCount: 15,
            date: '20240101',
            transferSource: '',
            transferType: ''
        },
        {
            containerId: '1002',
            barcode: 'TEST002',
            strain: '00002',
            owner: 'J',
            stage: '2',
            media: 'MA',
            tissueCount: 10,
            date: '20240102',
            transferSource: '1001',
            transferType: 'split'
        }
    ],
    transferHistory: [
        {
            id: 'transfer_001',
            timestamp: '2024-01-02T10:00:00Z',
            type: 'split',
            sourceContainer: '1001',
            destinationContainers: ['1002', '1003'],
            samplesTransferred: 15,
            splitCount: 2
        }
    ],
    containerLineage: {
        '1002': [
            {
                sourceContainer: '1001',
                transferDate: '2024-01-02',
                transferType: 'split',
                samplesReceived: 8
            }
        ],
        '1003': [
            {
                sourceContainer: '1001',
                transferDate: '2024-01-02',
                transferType: 'split',
                samplesReceived: 7
            }
        ]
    },
    highestContainerId: 1003,
    sessionCounter: 2,
    strainsTable: {
        1: 'Test Strain 1',
        2: 'Test Strain 2'
    },
    ownersTable: {
        'LW': 'Luke Walker',
        'J': 'Jane Doe'
    },
    stagesTable: {
        1: 'Initiation',
        2: 'Multiplication'
    },
    mediaTypesTable: {
        'IA': 'Initiation Agar',
        'MA': 'Multiplication Agar'
    },
    strainOwnerMapping: {
        1: 'LW',
        2: 'J'
    }
};

// Test export data structure
const testExportData = {
    metadata: {
        exportDate: new Date().toISOString(),
        exportedBy: 'Lab Scanner System',
        version: '1.0.0',
        fileName: 'test_export'
    },
    appState: testAppState
};

// Test Functions
function testExportDataStructure() {
    console.log('Testing export data structure...');
    
    // Test that export data has required structure
    if (!testExportData.metadata || !testExportData.appState) {
        console.error('❌ Export data missing required structure');
        return false;
    }
    
    // Test metadata fields
    const metadata = testExportData.metadata;
    if (!metadata.exportDate || !metadata.exportedBy || !metadata.version) {
        console.error('❌ Export metadata missing required fields');
        return false;
    }
    
    // Test appState structure
    const appState = testExportData.appState;
    const requiredFields = ['inventory', 'transferHistory', 'containerLineage', 'highestContainerId', 'sessionCounter'];
    
    for (const field of requiredFields) {
        if (!(field in appState)) {
            console.error(`❌ AppState missing required field: ${field}`);
            return false;
        }
    }
    
    console.log('✅ Export data structure test passed');
    return true;
}

function testImportDataValidation() {
    console.log('Testing import data validation...');
    
    // Test valid data
    const validData = { ...testExportData };
    
    // Test invalid data - missing metadata
    const invalidData1 = { appState: testAppState };
    
    // Test invalid data - missing appState
    const invalidData2 = { metadata: testExportData.metadata };
    
    // Test invalid data - malformed metadata
    const invalidData3 = {
        metadata: { exportDate: '2024-01-01' }, // missing other required fields
        appState: testAppState
    };
    
    // Simulate validation function
    function validateImportData(data) {
        if (!data.metadata || !data.appState) {
            return false;
        }
        
        if (!data.metadata.exportDate || !data.metadata.exportedBy) {
            return false;
        }
        
        if (typeof data.appState !== 'object') {
            return false;
        }
        
        return true;
    }
    
    // Run validation tests
    const results = [
        validateImportData(validData),
        !validateImportData(invalidData1),
        !validateImportData(invalidData2),
        !validateImportData(invalidData3)
    ];
    
    if (results.every(result => result === true)) {
        console.log('✅ Import data validation test passed');
        return true;
    } else {
        console.error('❌ Import data validation test failed');
        return false;
    }
}

function testDataRestoration() {
    console.log('Testing data restoration...');
    
    // Save current state
    const originalState = { ...window.appState };
    
    // Clear state
    window.appState.inventory = [];
    window.appState.transferHistory = [];
    window.appState.containerLineage = {};
    window.appState.highestContainerId = 0;
    window.appState.sessionCounter = 0;
    
    // Simulate data restoration
    function restoreData(importData) {
        const appState = importData.appState;
        
        if (appState.inventory && Array.isArray(appState.inventory)) {
            window.appState.inventory = appState.inventory;
        }
        
        if (appState.transferHistory && Array.isArray(appState.transferHistory)) {
            window.appState.transferHistory = appState.transferHistory;
        }
        
        if (appState.containerLineage && typeof appState.containerLineage === 'object') {
            window.appState.containerLineage = appState.containerLineage;
        }
        
        if (typeof appState.highestContainerId === 'number') {
            window.appState.highestContainerId = appState.highestContainerId;
        }
        
        if (typeof appState.sessionCounter === 'number') {
            window.appState.sessionCounter = appState.sessionCounter;
        }
    }
    
    // Restore test data
    restoreData(testExportData);
    
    // Verify restoration
    const restorationSuccessful = (
        window.appState.inventory.length === 2 &&
        window.appState.transferHistory.length === 1 &&
        Object.keys(window.appState.containerLineage).length === 2 &&
        window.appState.highestContainerId === 1003 &&
        window.appState.sessionCounter === 2
    );
    
    // Restore original state
    window.appState = originalState;
    
    if (restorationSuccessful) {
        console.log('✅ Data restoration test passed');
        return true;
    } else {
        console.error('❌ Data restoration test failed');
        return false;
    }
}

function testJSONSerialization() {
    console.log('Testing JSON serialization...');
    
    try {
        // Test serialization
        const serialized = JSON.stringify(testExportData, null, 2);
        
        // Test deserialization
        const deserialized = JSON.parse(serialized);
        
        // Test that deserialized data matches original
        const matches = (
            deserialized.metadata.exportedBy === testExportData.metadata.exportedBy &&
            deserialized.appState.inventory.length === testExportData.appState.inventory.length &&
            deserialized.appState.highestContainerId === testExportData.appState.highestContainerId
        );
        
        if (matches) {
            console.log('✅ JSON serialization test passed');
            return true;
        } else {
            console.error('❌ JSON serialization test failed - data mismatch');
            return false;
        }
    } catch (error) {
        console.error('❌ JSON serialization test failed:', error);
        return false;
    }
}

function testExportOptions() {
    console.log('Testing export options...');
    
    // Test different export options
    const options = {
        inventory: true,
        transfers: true,
        lineage: true,
        summary: false,
        fullAppState: false
    };
    
    // Simulate export data generation
    function generateExportData(options) {
        const exportData = {
            metadata: {
                exportDate: new Date().toISOString(),
                exportedBy: 'Lab Scanner System',
                version: '1.0.0',
                fileName: 'test_export'
            },
            appState: {}
        };
        
        if (options.inventory) {
            exportData.appState.inventory = testAppState.inventory;
        }
        
        if (options.transfers) {
            exportData.appState.transferHistory = testAppState.transferHistory;
        }
        
        if (options.lineage) {
            exportData.appState.containerLineage = testAppState.containerLineage;
        }
        
        if (options.fullAppState) {
            exportData.appState = { ...testAppState };
        }
        
        return exportData;
    }
    
    const exportedData = generateExportData(options);
    
    // Verify that only selected data is included
    const hasInventory = exportedData.appState.inventory && exportedData.appState.inventory.length > 0;
    const hasTransfers = exportedData.appState.transferHistory && exportedData.appState.transferHistory.length > 0;
    const hasLineage = exportedData.appState.containerLineage && Object.keys(exportedData.appState.containerLineage).length > 0;
    const hasStrains = exportedData.appState.strainsTable && Object.keys(exportedData.appState.strainsTable).length > 0;
    
    if (hasInventory && hasTransfers && hasLineage && !hasStrains) {
        console.log('✅ Export options test passed');
        return true;
    } else {
        console.error('❌ Export options test failed');
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('🧪 Starting Import/Export Tests...\n');
    
    const testResults = [
        testExportDataStructure(),
        testImportDataValidation(),
        testDataRestoration(),
        testJSONSerialization(),
        testExportOptions()
    ];
    
    const passed = testResults.filter(result => result === true).length;
    const total = testResults.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('✅ All Import/Export tests passed!');
    } else {
        console.log('❌ Some tests failed. Please review the output above.');
    }
    
    return passed === total;
}

// Export test functions for manual testing
window.ImportExportTests = {
    runAllTests,
    testExportDataStructure,
    testImportDataValidation,
    testDataRestoration,
    testJSONSerialization,
    testExportOptions
};

// Auto-run tests if this is being loaded directly
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    // Run tests immediately if DOM is already ready
    runAllTests();
}
