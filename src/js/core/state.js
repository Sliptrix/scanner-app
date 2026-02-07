// Core Application State Management
// Lab Barcode Builder & Transfer System

// Debug mode flag - set to true for verbose logging
window.DEBUG_MODE = localStorage.getItem('labScanner_debugMode') === 'true';

// Logger utility - respects debug mode
window.Logger = {
    debug: function(...args) {
        if (window.DEBUG_MODE) {
            console.log('[DEBUG]', ...args);
        }
    },
    info: function(...args) {
        console.log('[INFO]', ...args);
    },
    warn: function(...args) {
        console.warn('[WARN]', ...args);
    },
    error: function(...args) {
        console.error('[ERROR]', ...args);
    },
    // Toggle debug mode
    setDebugMode: function(enabled) {
        window.DEBUG_MODE = enabled;
        localStorage.setItem('labScanner_debugMode', enabled ? 'true' : 'false');
        console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
};

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
        steps: ['stage', 'tissue', 'date'],
        values: {
            container: null,
            owner: null,
            strain: null,
            media: null,
            recipe: null,  // Recipe selected from dropdown, not a separate step
            stage: null,
            tissue: null,
            date: null
        },
        metadata: {
            ownerName: null,
            strainName: null,
            mediaName: null,
            stageName: null,
            recipeName: null
        }
    },
    
    // Container Transfer state
    transferState: {
        mode: 'single', // 'single' or 'split'
        splitCount: 2,
        sourceContainer: null,
        destContainer: null
    },
    
    // Container Initiator state (now full container+barcode wizard)
    initiatorState: {
        // Steps: owner -> strain -> media -> stage -> tissue -> date -> location
        currentStep: 'owner',
        owner: null,
        strain: null,
        media: null,
        stage: null,
        tissue: null,
        date: null,
        location: null,
        // Marks whether the current initiator flow has created a container
        completed: false
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
        Logger.debug(`State updated: ${path} =`, value);
    },
    
    // Reset specific state sections
    resetBuilderState: function() {
        window.appState.builderState = {
            currentStep: 0,
            steps: ['stage', 'tissue', 'date'],
            values: {
                container: null,
                owner: null,
                strain: null,
                media: null,
                recipe: null,
                stage: null,
                tissue: null,
                date: null
            },
            metadata: {
                ownerName: null,
                strainName: null,
                mediaName: null,
                stageName: null,
                recipeName: null
            }
        };
        Logger.debug('Builder state reset');
    },
    
    resetTransferState: function() {
        window.appState.transferState = {
            mode: 'single',
            splitCount: 2,
            sourceContainer: null,
            destContainer: null
        };
        Logger.debug('Transfer state reset');
    },
    
    resetInitiatorState: function() {
        window.appState.initiatorState = {
            currentStep: 'owner',
            owner: null,
            strain: null,
            media: null,
            stage: null,
            tissue: null,
            date: null,
            location: null,
            completed: false
        };
        Logger.debug('Initiator state reset');
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
        Logger.debug('State initialized from inventory');
    }
};
