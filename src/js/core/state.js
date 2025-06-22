// Core Application State Management
// Lab Barcode Builder & Transfer System

// Global application state
window.appState = {
    // Basic app state
    mode: 'builder',
    isDataLoaded: false,
    currentStep: 0,
    
    // Excel data and references
    excelData: null,
    strainsTable: {},
    ownersTable: {},
    stagesTable: {},
    locationsTable: [],
    mediaTypesTable: {},
    
    // Inventory and session tracking
    inventory: [],
    sessionCounter: 0,
    highestContainerId: 0,
    
    // Current processing data
    currentContainer: null,
    currentSample: null,
    currentMetadata: null,
    
    // Container lineage tracking
    containerLineage: {},
    transferHistory: [],
    
    // Barcode Builder state
    builderState: {
        currentStep: 0,
        steps: ['container', 'owner', 'strain', 'media', 'stage', 'tissue', 'date'],
        values: {
            container: null,
            owner: null,
            strain: null,
            media: null,
            stage: null,
            tissue: null,
            date: null
        },
        metadata: {
            ownerName: null,
            strainName: null,
            mediaName: null,
            stageName: null
        }
    },
    
    // Container Transfer state
    transferState: {
        source: null,
        sourceData: null,
        destination: null,
        mode: 'single', // 'single' or 'split'
        splitCount: 2,
        maxSplitCount: 10,
        totalTissueCount: 0
    }
};

// State management functions
window.StateManager = {
    // Get state
    getState: function(path) {
        const keys = path.split('.');
        let value = window.appState;
        for (const key of keys) {
            value = value[key];
            if (value === undefined) return undefined;
        }
        return value;
    },
    
    // Set state
    setState: function(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = window.appState;
        
        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }
        
        target[lastKey] = value;
        console.log(`State updated: ${path} =`, value);
    },
    
    // Reset specific state sections
    resetBuilderState: function() {
        window.appState.builderState = {
            currentStep: 0,
            steps: ['container', 'owner', 'strain', 'media', 'stage', 'tissue', 'date'],
            values: {
                container: null,
                owner: null,
                strain: null,
                media: null,
                stage: null,
                tissue: null,
                date: null
            },
            metadata: {
                ownerName: null,
                strainName: null,
                mediaName: null,
                stageName: null
            }
        };
        console.log('Builder state reset');
    },
    
    resetTransferState: function() {
        window.appState.transferState = {
            source: null,
            sourceData: null,
            destination: null,
            mode: 'single',
            splitCount: 2,
            maxSplitCount: 10,
            totalTissueCount: 0
        };
        console.log('Transfer state reset');
    },
    
    // Initialize state from existing inventory
    initializeFromInventory: function() {
        // Scan existing inventory to find highest container ID
        window.appState.inventory.forEach(entry => {
            const containerId = parseInt(entry.containerId);
            if (!isNaN(containerId) && containerId > window.appState.highestContainerId) {
                window.appState.highestContainerId = containerId;
            }
        });
        console.log('State initialized from inventory');
    }
};
