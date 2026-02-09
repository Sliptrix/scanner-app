// Lab Barcode Builder & Transfer System - Main JavaScript Entry Point
// Phase 3: Core Infrastructure

// Global unhandled promise rejection handler
// FIX: Catch unhandled async errors to prevent silent failures
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Show user-friendly notification if possible
    if (window.NotificationSystem) {
        const errorMessage = event.reason && event.reason.message 
            ? event.reason.message 
            : 'An unexpected error occurred';
        window.NotificationSystem.error(`Error: ${errorMessage}`);
    }
    
    // Prevent default browser error handling (don't show in console twice)
    event.preventDefault();
});

// Global error handler for synchronous errors
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });
    
    if (window.NotificationSystem) {
        window.NotificationSystem.error('An unexpected error occurred. Please refresh the page if issues persist.');
    }
    
    return false; // Don't suppress the error in console
};

// Application initialization
document.addEventListener('DOMContentLoaded', function() {
    Logger.debug('Lab Scanner System - Phase 3 Core Infrastructure loaded');
    
    // PERF: Measure app initialization time
    const initStart = performance.now();
    initializeApp();
    const initDuration = performance.now() - initStart;
    console.log(`[Performance] App initialization: ${initDuration.toFixed(2)}ms`);
    
    // PERF: Track initialization in performance monitor
    if (window.PerformanceMonitor) {
        PerformanceMonitor.trackRender('AppInitialization', initDuration);
    }
});

// PERF: Lazy initialization for non-critical modules
function initializeLazyModules() {
    // Use requestIdleCallback for non-critical initialization
    const runWhenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
    
    runWhenIdle(() => {
        // Initialize ML integration if available
        if (window.MLIntegration && typeof MLIntegration.initialize === 'function') {
            Logger.debug('Lazy-loading MLIntegration...');
            MLIntegration.initialize();
        }
        
        // Initialize analytics that aren't immediately visible
        if (window.AnalyticsEngine && !window.AnalyticsEngine.isInitialized) {
            Logger.debug('Lazy-loading AnalyticsEngine...');
        }
    }, { timeout: 3000 });
}

// Main application initialization
function initializeApp() {
    Logger.debug('Initializing Lab Scanner System...');
    
    // Initialize state from any existing inventory
    StateManager.initializeFromInventory();
    
    // Try to load saved Excel data first
    loadSavedExcelDataOnStartup();
    
    // If no Excel data loaded, try JSON fallback
    if (!window.appState.isDataLoaded) {
        Logger.debug('No Excel data found, trying JSON fallback...');
        DataUtils.loadJSONFallbackData();
        
        // If still no data after JSON attempt, immediately load minimal fallback
        setTimeout(() => {
            if (!window.appState.isDataLoaded) {
                Logger.debug('JSON fallback not available, loading minimal data...');
                DataUtils.loadMinimalFallbackData();
            }
        }, 1000); // Give JSON loading 1 second to complete
    }
    
    // Set initial mode to dashboard
    UIUtils.switchMode('dashboard');
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup focus management
    UIUtils.setupFocusManagement();
    
    // Update initial stats
    UIUtils.updateStats();
    
    // Initialize builder module if in builder mode
    if (window.appState.mode === 'builder') {
        BarcodeBuilder.initialize();
    }
    
    // Initialize transfer module
    if (window.ContainerTransfer) {
        ContainerTransfer.initialize();
    }
    
    // Initialize inventory management module
    if (window.InventoryManager) {
        InventoryManager.initialize();
    }
    
    // Initialize Lineage and Audit services (Phase 3: Data Tracking & Lineage Enhancements)
    if (window.LineageService) {
        LineageService.initialize();
        Logger.debug('LineageService initialized');
    }
    
    if (window.AuditService) {
        AuditService.initialize();
        Logger.debug('AuditService initialized');
    }
    
    if (window.LineageUI) {
        LineageUI.initialize();
        Logger.debug('LineageUI initialized');
    }
    
    // Initialize container initiator module
    if (window.ContainerInitiator) {
        ContainerInitiator.initialize();
    }

    // Initialize Inventory Lookup Service (for flexible input resolution)
    initializeInventoryLookupService();

    // Initialize intake module
    if (window.IntakeMain) {
        IntakeMain.init().catch(error => {
            console.error('Error initializing intake module:', error);
        });
    }
    
    // Initialize authentication
    if (window.AuthManager) {
        AuthManager.init().catch(error => {
            console.error('Error initializing auth:', error);
        });
    }

    // Initialize OneDrive/SharePoint cloud sync
    if (window.OneDriveSync && window.AuthManager) {
        // Build options from CLOUD_HQ_CONFIG (if available) or use defaults
        const cloudConfig = window.CLOUD_HQ_CONFIG || {};
        
        // SECURITY: No hardcoded SharePoint URL - must be configured via config/cloud-hq-config.js
        if (!cloudConfig.shareUrl || cloudConfig.shareUrl.includes('YOUR_')) {
            console.warn('[CloudSync] No shareUrl configured in CLOUD_HQ_CONFIG. Set it in config/cloud-hq-config.js');
        }
        
        const syncOptions = {
            shareUrl: (cloudConfig.shareUrl && !cloudConfig.shareUrl.includes('YOUR_')) 
                ? cloudConfig.shareUrl 
                : null,
            refreshIntervalMs: cloudConfig.refreshIntervalMs || 300000, // 5 minutes
            statusElementId: cloudConfig.ui?.statusElementId || 'cloud-sync-status',
            buttonElementId: cloudConfig.ui?.buttonElementId || 'cloud-sync-btn',
            // Table names from config
            inventoryTableName: cloudConfig.tables?.activeInventory || 'tblActiveInventory',
            strainMappingTableName: cloudConfig.tables?.strainMapping || 'tblStrainMapping',
            recipeTableName: cloudConfig.tables?.recipes || 'tblRecipes',
            batchTableName: cloudConfig.tables?.batches || 'tblMediaBatches'
        };
        
        // Log configuration source
        if (cloudConfig.shareUrl && !cloudConfig.shareUrl.includes('YOUR_')) {
            Logger.info('Using cloud config from CLOUD_HQ_CONFIG');
        } else {
            Logger.warn('Cloud sync disabled: no shareUrl configured in CLOUD_HQ_CONFIG');
        }
        
        OneDriveSync.init(AuthManager, syncOptions);

        // Start auto-refresh if authenticated
        if (AuthManager.isSignedIn()) {
            Logger.debug('User authenticated, enabling cloud sync auto-refresh...');
            OneDriveSync.startAutoRefresh();

            // Attempt initial cloud sync (non-blocking)
            DataUtils.loadStrainOwnerMappingWithCloud({ nonBlocking: true })
                .then(result => {
                    Logger.debug(`Initial data loaded from: ${result.source}`);
                })
                .catch(error => {
                    console.warn('Initial cloud sync failed:', error);
                });
        }

        // Subscribe to cloud updates
        if (window.DataUtils) {
            DataUtils.subscribeToCloudUpdates();
        }
    }

    // Setup import data event
    setupImportEventListener();

    // Initialize recipe management module
    if (window.RecipeManager) {
        RecipeManager.initialize();
        // Force setup of recipe UI
        RecipeManager.setupRecipeUI();
        Logger.debug('RecipeManager initialized with UI setup');
    }

    // Initialize recipe versioning module (Phase 4)
    if (window.RecipeVersioning) {
        RecipeVersioning.initialize();
        Logger.debug('RecipeVersioning initialized');
    }

    // Initialize media batch manager (Phase 4)
    if (window.MediaBatchManager) {
        MediaBatchManager.initialize();
        Logger.debug('MediaBatchManager initialized');
    }

    // Initialize media lab UI (batch tracking)
    if (window.MediaLabUI) {
        MediaLabUI.initialize();
        Logger.debug('MediaLabUI initialized');
    }

    // Show initial status
    NotificationSystem.info('Lab system ready! Load Excel data to begin.');

    // Check for QR code scan (URL parameter ?c=shortCode)
    // Also check sessionStorage for params saved before login redirect
    handleQRCodeScan();

    Logger.info('Lab Scanner System initialized successfully');
    
    // PERF: Defer non-critical module initialization
    initializeLazyModules();
}

// Setup all event listeners
function setupEventListeners() {
    // File upload events
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Drag and drop for upload area
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('drop', handleFileDrop);
    }
    
    // Builder input events
    const builderInput = document.getElementById('builderInput');
    if (builderInput) {
        builderInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleBuilderInput();
            }
        });
    }
    
    // Transfer input events
    const sourceInput = document.getElementById('sourceContainerInput');
    if (sourceInput) {
        sourceInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSourceContainerInput();
            }
        });
    }
    
    // Initiator input events are handled by the ContainerInitiator module itself
    
    const destInput = document.getElementById('destContainerInput');
    if (destInput) {
        destInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleDestContainerInput();
            }
        });
    }
    
    // Global Search handler
    const globalSearchInput = document.querySelector('.search-input');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const query = globalSearchInput.value.trim();
                if (query) {
                    performGlobalSearch(query);
                }
            }
        });
        globalSearchInput.addEventListener('input', function(e) {
            const query = globalSearchInput.value.trim();
            if (query.length >= 2) {
                showGlobalSearchResults(query);
            } else {
                hideGlobalSearchResults();
            }
        });
    }
    
    Logger.debug('Event listeners setup complete');
}

// Setup import event listener
function setupImportEventListener() {
    const importInput = document.getElementById('importInput');
    if (importInput) {
        importInput.addEventListener('change', handleFileImport);
    }
}

// Handle the import file
function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) {
        // Check file extension
        if (!file.name.match(/\.(json)$/i)) {
            NotificationSystem.error('Please select a JSON file exported from this system');
            return;
        }
        
        NotificationSystem.info('Importing data...');
        
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate the imported data structure
                if (!validateImportData(data)) {
                    NotificationSystem.error('Invalid file format. Please select a file exported from this system.');
                    return;
                }
                
                restoreDataToAppState(data);
                NotificationSystem.success(`Data imported successfully from ${file.name}!`);
                Logger.debug('Data imported:', data);
                
                // Update UI after import
                updateUIAfterImport();
                
            } catch (error) {
                console.error('Error importing data:', error);
                NotificationSystem.error('Failed to import data: ' + error.message);
            }
        };

        reader.readAsText(file);
    }
}

// Validate imported data structure
function validateImportData(data) {
    try {
        // Check for expected structure
        if (!data.metadata || !data.appState) {
            return false;
        }
        
        // Check metadata
        if (!data.metadata.exportDate || !data.metadata.exportedBy) {
            return false;
        }
        
        // Check appState structure
        if (typeof data.appState !== 'object') {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error validating import data:', error);
        return false;
    }
}

// Restore imported data to appState
function restoreDataToAppState(data) {
    try {
        const importedAppState = data.appState;
        
        // Restore core data
        if (importedAppState.inventory && Array.isArray(importedAppState.inventory)) {
            window.appState.inventory = importedAppState.inventory;
        }
        
        if (importedAppState.transferHistory && Array.isArray(importedAppState.transferHistory)) {
            window.appState.transferHistory = importedAppState.transferHistory;
        }
        
        if (importedAppState.containerLineage && typeof importedAppState.containerLineage === 'object') {
            window.appState.containerLineage = importedAppState.containerLineage;
        }
        
        // Restore counters and IDs
        if (typeof importedAppState.highestContainerId === 'number') {
            window.appState.highestContainerId = importedAppState.highestContainerId;
        }
        
        if (typeof importedAppState.sessionCounter === 'number') {
            window.appState.sessionCounter = importedAppState.sessionCounter;
        }
        
        // Restore lookup tables
        if (importedAppState.strainsTable && typeof importedAppState.strainsTable === 'object') {
            window.appState.strainsTable = importedAppState.strainsTable;
            window.appState.isDataLoaded = true;
        }
        
        if (importedAppState.ownersTable && typeof importedAppState.ownersTable === 'object') {
            window.appState.ownersTable = importedAppState.ownersTable;
        }
        
        if (importedAppState.stagesTable && typeof importedAppState.stagesTable === 'object') {
            window.appState.stagesTable = importedAppState.stagesTable;
        }
        
        if (importedAppState.locationsTable && Array.isArray(importedAppState.locationsTable)) {
            window.appState.locationsTable = importedAppState.locationsTable;
        }
        
        if (importedAppState.mediaTypesTable && typeof importedAppState.mediaTypesTable === 'object') {
            window.appState.mediaTypesTable = importedAppState.mediaTypesTable;
        }
        
        if (importedAppState.strainOwnerMapping && typeof importedAppState.strainOwnerMapping === 'object') {
            window.appState.strainOwnerMapping = importedAppState.strainOwnerMapping;
        }
        
        Logger.debug('AppState restored successfully from imported data');
        
        // Log import statistics
        console.log('=== DATA IMPORT SUMMARY ===');
        console.log(`Import Date: ${data.metadata.exportDate}`);
        console.log(`Inventory Items: ${window.appState.inventory.length}`);
        console.log(`Transfer History: ${window.appState.transferHistory.length}`);
        console.log(`Container Lineage: ${Object.keys(window.appState.containerLineage).length} containers`);
        console.log(`Highest Container ID: ${window.appState.highestContainerId}`);
        console.log(`Session Counter: ${window.appState.sessionCounter}`);
        console.log(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
        console.log(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
        
    } catch (error) {
        console.error('Error restoring appState:', error);
        throw error;
    }
}

// Update UI components after import
function updateUIAfterImport() {
    try {
        // Update statistics
        UIUtils.updateStats();
        
        // Update data status if we have lookup tables
        if (window.appState.strainsTable && Object.keys(window.appState.strainsTable).length > 0) {
            UIUtils.updateDataStatus(true, 'Imported Data', false);
        }
        
        // Rebuild inventory table if it exists
        if (window.InventoryTableManager) {
            InventoryTableManager.rebuildTable();
        }
        
        // Update builder if active
        if (window.appState.mode === 'builder') {
            UIUtils.focusBuilderInput();
        }
        
        Logger.debug('UI updated after import');
    } catch (error) {
        console.error('Error updating UI after import:', error);
    }
}

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        loadExcelFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files[0];
    if (file) {
        loadExcelFile(file);
    }
}

// Load saved Excel data on startup
function loadSavedExcelDataOnStartup() {
    const savedData = DataUtils.loadSavedExcelData();
    
    if (savedData.success) {
        // Update UI to show cached data is loaded
        UIUtils.updateDataStatus(true, savedData.metadata.fileName, true);
        UIUtils.updateStats(); // Triggers dashboard refresh with loaded data
        
        NotificationSystem.success(
            `📁 Cached Excel data loaded: ${savedData.metadata.fileName} ` +
            `(${new Date(savedData.metadata.loadDate).toLocaleDateString()})`
        );
        
        // Update builder if active
        if (window.appState.mode === 'builder') {
            UIUtils.focusBuilderInput();
        }
        
        Logger.debug('Startup: Using cached Excel data');
    } else {
        Logger.debug('Startup: No cached Excel data found, user will need to load file');
    }
}

function loadExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        NotificationSystem.error('Please select an Excel file (.xlsx or .xls)');
        return;
    }
    
    NotificationSystem.info('Loading Excel file...');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Process the workbook using DataUtils (now includes saving to localStorage)
            const success = DataUtils.processExcelData(workbook, file.name);
            
            if (success) {
                // Update UI
                UIUtils.updateDataStatus(true, file.name, false);
                UIUtils.updateStats(); // Triggers dashboard refresh
                NotificationSystem.success(`📊 Excel data loaded and cached: ${file.name}`);
                
                // Update builder if active
                if (window.appState.mode === 'builder') {
                    UIUtils.focusBuilderInput();
                }
            } else {
                NotificationSystem.error('Error processing Excel file');
            }
            
        } catch (error) {
            console.error('Error loading Excel file:', error);
            NotificationSystem.error('Error loading Excel file: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Input handling functions
function handleBuilderInput() {
    // Builder input is now handled by BuilderStepManager
    BuilderStepManager.handleInput();
}

function handleSourceContainerInput() {
    const input = document.getElementById('sourceContainerInput').value.trim();
    if (input && window.ContainerTransfer) {
        ContainerTransfer.handleSourceInput(input);
    }
}

function handleDestContainerInput() {
    const input = document.getElementById('destContainerInput').value.trim();
    if (input && window.ContainerTransfer) {
        ContainerTransfer.handleDestInput(input);
    }
}

// Global functions for HTML onclick events (Phase 1 compatibility)
function switchMode(mode) {
    UIUtils.switchMode(mode);
}

function nextBuilderStep() {
    BuilderStepManager.handleNextButton();
}

function resetBuilder() {
    BuilderStepManager.reset();
}

// Cloud inventory sync controls
async function syncInventoryFromCloud() {
    const btn = document.getElementById('inventory-sync-from-cloud-btn');
    if (btn && btn.disabled) return; // Prevent double-click
    
    try {
        if (!window.AuthManager || !AuthManager.isSignedIn()) {
            if (window.NotificationSystem) {
                NotificationSystem.error('Please sign in with Microsoft 365 before syncing inventory from cloud.');
            }
            return;
        }
        if (!window.OneDriveSync) {
            if (window.NotificationSystem) {
                NotificationSystem.error('Cloud sync module is not initialized.');
            }
            return;
        }

        // Disable button during operation
        if (btn) {
            btn.disabled = true;
            btn._originalText = btn.textContent;
            btn.textContent = '⏳ Syncing...';
        }

        const result = await OneDriveSync.syncActiveInventoryToApp();

        const statusEl = document.getElementById('inventory-sync-status');
        if (statusEl) {
            const ts = new Date().toLocaleString();
            if (result && result.success && typeof result.count === 'number') {
                statusEl.textContent = `Inventory sync: Pulled ${result.count} row(s) from cloud at ${ts}`;
            } else {
                statusEl.textContent = `Inventory sync: Cloud pull completed with 0 rows at ${ts}`;
            }
        }

        // After pulling cloud inventory, update the next available container ID
        // so the initiator doesn't overwrite existing containers
        if (result && result.success) {
            if (window.ContainerInitiator && typeof ContainerInitiator.updateNextAvailableId === 'function') {
                ContainerInitiator.updateNextAvailableId();
                Logger.debug('Updated next available container ID after cloud sync');
            }
        }

        if (!result || !result.success) {
            if (window.NotificationSystem) {
                NotificationSystem.warn('Cloud inventory sync completed but no rows were loaded.');
            }
        }
    } catch (error) {
        console.error('Error syncing inventory from cloud:', error);
        if (window.NotificationSystem) {
            NotificationSystem.error('Error syncing inventory from cloud: ' + error.message);
        }
    } finally {
        // Re-enable button
        const btn = document.getElementById('inventory-sync-from-cloud-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn._originalText || '⬇️ Pull from Cloud';
        }
    }
}

async function syncInventoryToCloud() {
    const btn = document.getElementById('inventory-sync-to-cloud-btn');
    if (btn && btn.disabled) return; // Prevent double-click
    
    try {
        if (!window.AuthManager || !AuthManager.isSignedIn()) {
            if (window.NotificationSystem) {
                NotificationSystem.error('Please sign in with Microsoft 365 before syncing inventory to cloud.');
            }
            return;
        }
        if (!window.OneDriveSync) {
            if (window.NotificationSystem) {
                NotificationSystem.error('Cloud sync module is not initialized.');
            }
            return;
        }

        // Disable button during operation
        if (btn) {
            btn.disabled = true;
            btn._originalText = btn.textContent;
            btn.textContent = '⏳ Syncing...';
        }

        const result = await OneDriveSync.appendNewInventoryRowsToCloud();

        const statusEl = document.getElementById('inventory-sync-status');
        if (statusEl) {
            const ts = new Date().toLocaleString();
            const count = result && typeof result.count === 'number' ? result.count : 0;
            if (count > 0) {
                statusEl.textContent = `Inventory sync: Pushed ${count} new row(s) to cloud at ${ts}`;
            } else {
                statusEl.textContent = `Inventory sync: No new rows to push at ${ts}`;
            }
        }

        if (!result || result.count === 0) {
            if (window.NotificationSystem) {
                NotificationSystem.info('No new inventory rows to sync to cloud.');
            }
        }
    } catch (error) {
        console.error('Error syncing inventory to cloud:', error);
        if (window.NotificationSystem) {
            NotificationSystem.error('Error syncing inventory to cloud: ' + error.message);
        }
    } finally {
        // Re-enable button
        const btn = document.getElementById('inventory-sync-to-cloud-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn._originalText || '⬆️ Push to Cloud';
        }
    }
}

// Quick cloud sync for easy access
async function quickCloudSync() {
    const btn = document.getElementById('cloud-sync-quick-btn');
    if (btn && btn.disabled) return; // Prevent double-click
    
    if (!window.AuthManager || !AuthManager.isSignedIn()) {
        if (window.NotificationSystem) {
            NotificationSystem.error('Please sign in with Microsoft 365 to sync from cloud.');
        }
        return;
    }

    if (!window.OneDriveSync) {
        if (window.NotificationSystem) {
            NotificationSystem.error('Cloud sync module is not initialized.');
        }
        return;
    }

    // Disable button during operation
    if (btn) {
        btn.disabled = true;
        btn._originalText = btn.textContent;
        btn.textContent = '⏳ Syncing...';
    }

    if (window.NotificationSystem) {
        NotificationSystem.info('Syncing data from cloud...');
    }

    try {
        await OneDriveSync.manualSync();
        // Update next container ID after cloud sync to prevent overwrites
        if (window.ContainerInitiator && typeof ContainerInitiator.updateNextAvailableId === 'function') {
            ContainerInitiator.updateNextAvailableId();
            Logger.debug('Updated next available container ID after quick cloud sync');
        }
    } catch (error) {
        console.error('Quick cloud sync error:', error);
        if (window.NotificationSystem) {
            NotificationSystem.error('Cloud sync failed: ' + error.message);
        }
    } finally {
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn._originalText || '☁️ Sync from HQ Workbook';
        }
    }
}

function useGeneratedBarcode() {
    // Early validation - check if we have the necessary components
    if (!window.appState.currentContainer || !window.appState.currentSample) {
        NotificationSystem.error('No barcode to save. Please generate a barcode first.');
        return;
    }
    
    // Check if barcode has already been saved (primary duplicate prevention)
    if (window.appState.currentBarcodeIsSaved) {
        NotificationSystem.warning('This barcode has already been saved to inventory.');
        Logger.debug('Save blocked - barcode already saved:', window.appState.currentContainer);
        return;
    }
    
    // Validate barcode data integrity
    if (!window.appState.currentBarcodeResult || 
        !window.appState.currentBarcodeResult.success || 
        !window.appState.currentBarcodeResult.data) {
        NotificationSystem.error('Invalid barcode data. Please regenerate the barcode.');
        console.error('Save blocked - invalid barcode data:', window.appState.currentBarcodeResult);
        return;
    }
    
    // Additional check for container already existing in inventory
    if (window.appState.currentContainer) {
        const existingContainer = window.appState.inventory.find(entry => 
            parseInt(entry.containerId) === parseInt(window.appState.currentContainer)
        );
        
        if (existingContainer) {
            NotificationSystem.warning(`Container ${window.appState.currentContainer} already exists in inventory. Cannot save duplicate container.`);
            Logger.debug('Duplicate container save prevented:', {
                attempted: window.appState.currentContainer,
                existing: existingContainer
            });
            return;
        }
    }
    
    // Disable the save button to prevent double-clicks
    const saveButton = document.querySelector('button[onclick="useGeneratedBarcode()"]');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }
    
    try {
        const success = BarcodeBuilder.saveBarcode();
        
        if (success && saveButton) {
            saveButton.textContent = 'Saved ✓';
            saveButton.style.background = '#28a745';
            
            // Reset button after delay - button will be re-enabled when new barcode is generated
            setTimeout(() => {
                if (saveButton && !window.appState.currentBarcodeIsSaved) {
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save to Inventory';
                    saveButton.style.background = '';
                }
            }, 3000);
        } else if (saveButton) {
            // Re-enable button if save failed
            saveButton.disabled = false;
            saveButton.textContent = 'Save to Inventory';
            saveButton.style.background = '';
        }
    } catch (error) {
        console.error('Save barcode error:', error);
        NotificationSystem.error('Failed to save barcode: ' + error.message);
        
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save to Inventory';
            saveButton.style.background = '';
        }
    }
}

function selectTransferMode(mode) {
    if (window.ContainerTransfer) {
        ContainerTransfer.handleModeChange(mode);
    } else {
        // Fallback for legacy support
        StateManager.setState('transferState.mode', mode);
        Logger.debug('Transfer mode set to:', mode);
    }
}

function adjustSplitCount(change) {
    const currentCount = StateManager.getState('transferState.splitCount') || 1;
    const newCount = Math.max(1, Math.min(10, currentCount + change));

    if (window.ContainerTransfer) {
        ContainerTransfer.handleSplitCountChange(newCount);
    } else {
        StateManager.setState('transferState.splitCount', newCount);
        UIUtils.updateContent('splitCount', newCount);
    }

    // Update preview and button
    if (window.TransferInputManager) {
        TransferInputManager.updateTransferPreview();
        TransferInputManager.updateTransferButtonState();
    }
}

function toggleDiscardPanel() {
    const toggle = document.getElementById('discardToggle');
    const panel = document.getElementById('discardPanel');
    if (panel) {
        panel.style.display = toggle && toggle.checked ? 'block' : 'none';
    }
    if (!toggle || !toggle.checked) {
        StateManager.setState('transferState.discardCount', 0);
        StateManager.setState('transferState.discardReason', '');
        const countEl = document.getElementById('discardCount');
        if (countEl) countEl.textContent = '0';
    }
    if (window.TransferInputManager) {
        TransferInputManager.updateTransferPreview();
        TransferInputManager.updateTransferButtonState();
    }
}

function adjustDiscardCount(change) {
    const source = StateManager.getState('transferState.sourceContainer');
    const maxDiscard = source && source.data ? source.data.totalSamples - 1 : 0;
    const current = StateManager.getState('transferState.discardCount') || 0;
    const newCount = Math.max(0, Math.min(maxDiscard, current + change));
    StateManager.setState('transferState.discardCount', newCount);

    const countEl = document.getElementById('discardCount');
    if (countEl) countEl.textContent = newCount;

    if (window.TransferInputManager) {
        TransferInputManager.updateTransferPreview();
        TransferInputManager.updateTransferButtonState();
    }
}

function processTransfer() {
    Logger.debug('processTransfer() called');
    Logger.debug('processTransfer call stack:', new Error().stack);
    
    // Disable button during processing to prevent double-clicks
    const transferBtn = document.getElementById('transferBtn');
    if (transferBtn) {
        transferBtn.disabled = true;
        transferBtn.textContent = 'Processing...';
    }
    
    try {
        if (window.TransferProcessor) {
            const success = TransferProcessor.processTransfer();
            
            if (success) {
                NotificationSystem.success('Transfer completed successfully!');
                
                // Clear inputs after successful transfer
                if (window.TransferInputManager) {
                    TransferInputManager.clearInputs();
                }
            }
        } else {
            NotificationSystem.error('Transfer system not available');
        }
    } catch (error) {
        console.error('Transfer error:', error);
        NotificationSystem.error('Transfer failed: ' + error.message);
    } finally {
        // Re-enable button
        if (transferBtn) {
            transferBtn.disabled = false;
            transferBtn.textContent = 'Process Transfer';
        }
        
        // Update button state based on current inputs
        if (window.TransferInputManager) {
            TransferInputManager.updateTransferButtonState();
        }
    }
}

function clearTransfer() {
    if (window.ContainerTransfer) {
        ContainerTransfer.clearTransfer();
    } else {
        // Fallback for legacy support
        StateManager.resetTransferState();
        UIUtils.clearInput('sourceContainerInput');
        UIUtils.clearInput('destContainerInput');
        UIUtils.updateContent('sourceContainerValue', '-');
        UIUtils.updateContent('destContainerValue', '-');
        UIUtils.updateContent('sourceSummary', 'Scan to see contents');
        UIUtils.updateContent('destSummary', 'Single or multiple containers');
        UIUtils.removeClass('sourceContainer', 'filled');
        UIUtils.removeClass('destContainer', 'filled');
        NotificationSystem.info('Transfer cleared');
    }
}

function exportInventory() {
    if (window.DataExportManager) {
        DataExportManager.showExportDialog();
    } else {
        NotificationSystem.info('Export functionality not available');
    }
}

// Global Search Implementation
function performGlobalSearch(query) {
    const q = query.toLowerCase();
    const results = [];
    
    // Search inventory
    if (window.appState && window.appState.inventory) {
        window.appState.inventory.forEach(item => {
            const searchable = [
                item.containerId, item.strain, item.owner, item.stage,
                item.media, item.location, item.notes, item.sampleBarcode
            ].filter(Boolean).join(' ').toLowerCase();
            if (searchable.includes(q)) {
                results.push({ type: 'inventory', item });
            }
        });
    }
    
    // Search reference data (strains)
    if (window.appState && window.appState.strains) {
        window.appState.strains.forEach(strain => {
            const name = (strain.name || strain.strainName || '').toLowerCase();
            if (name.includes(q)) {
                results.push({ type: 'strain', item: strain });
            }
        });
    }
    
    if (results.length > 0) {
        // Navigate to inventory view if inventory results found
        if (results.some(r => r.type === 'inventory')) {
            UIUtils.switchMode('inventory');
            // Populate inventory search
            const invSearch = document.getElementById('inventorySearch');
            if (invSearch) {
                invSearch.value = query;
                invSearch.dispatchEvent(new Event('input'));
            }
        }
        NotificationSystem.success(`Found ${results.length} result(s) for "${query}"`);
    } else {
        NotificationSystem.info(`No results found for "${query}"`);
    }
    hideGlobalSearchResults();
}

function showGlobalSearchResults(query) {
    const q = query.toLowerCase();
    let dropdown = document.getElementById('globalSearchDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'globalSearchDropdown';
        dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#1e293b;border:1px solid #334155;border-radius:8px;max-height:300px;overflow-y:auto;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.style.position = 'relative';
            searchBox.appendChild(dropdown);
        }
    }
    
    const results = [];
    
    // Search inventory
    if (window.appState && window.appState.inventory) {
        window.appState.inventory.forEach(item => {
            const searchable = [
                item.containerId, item.strain, item.owner, item.stage, item.location
            ].filter(Boolean).join(' ').toLowerCase();
            if (searchable.includes(q)) {
                results.push(`<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #334155;color:#e2e8f0;" 
                    onclick="performGlobalSearch('${query}')"}>
                    📦 ${item.containerId || '?'} — ${item.strain || 'Unknown'} (${item.stage || '?'})
                </div>`);
            }
        });
    }
    
    // Search strains
    if (window.appState && window.appState.strains) {
        const s = UIUtils.sanitize;
        window.appState.strains.forEach(strain => {
            const name = (strain.name || strain.strainName || '').toLowerCase();
            if (name.includes(q)) {
                const safeQuery = s(query).replace(/'/g, '&#39;');
                results.push(`<div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #334155;color:#e2e8f0;" 
                    onclick="performGlobalSearch('${safeQuery}')">
                    🌱 ${s(strain.name || strain.strainName)} (${s(strain.id || strain.strainId || '?')})
                </div>`);
            }
        });
    }
    
    if (results.length > 0) {
        dropdown.innerHTML = results.slice(0, 10).join('');
        dropdown.style.display = 'block';
    } else if (query.length >= 2) {
        dropdown.innerHTML = '<div style="padding:8px 12px;color:#94a3b8;">No results found</div>';
        dropdown.style.display = 'block';
    }
}

function hideGlobalSearchResults() {
    const dropdown = document.getElementById('globalSearchDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Close search dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-box')) {
        hideGlobalSearchResults();
    }
});

function clearInventory() {
    if (window.InventoryManager && typeof window.InventoryManager.confirmClearInventory === 'function') {
        // Use the enhanced clear inventory dialog from Phase 6
        // For now, we'll call the private function directly since showClearInventoryDialog is not exposed
        // This will be enhanced in the next iteration
        if (confirm('Clear all inventory data? This action cannot be undone.')) {
            window.appState.inventory = [];
            window.appState.sessionCounter = 0;
            window.appState.transferHistory = [];
            window.appState.containerLineage = {};
            window.appState.highestContainerId = 0;
            
            UIUtils.updateStats();
            if (window.InventoryTableManager) {
                InventoryTableManager.rebuildTable();
            }
            NotificationSystem.success('Inventory cleared successfully');
        }
    } else {
        // Fallback to simple confirmation
        if (confirm('Clear all inventory data? This cannot be undone.')) {
            window.appState.inventory = [];
            window.appState.sessionCounter = 0;
            window.appState.transferHistory = [];
            window.appState.containerLineage = {};
            window.appState.highestContainerId = 0;
            
            const tableBody = document.getElementById('inventoryTableBody');
            if (tableBody) {
                tableBody.innerHTML = '';
            }
            
            UIUtils.updateStats();
            NotificationSystem.info('Inventory log cleared');
        }
    }
}


// Toggle barcode details in compact preview
function toggleBarcodeDetails() {
    const details = document.getElementById('statusDetails');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (details.style.display === 'none' || !details.style.display) {
        details.style.display = 'block';
        toggleIcon.textContent = '▲';
    } else {
        details.style.display = 'none';
        toggleIcon.textContent = '▼';
    }
}

/**
 * Email intake form
 */
async function emailIntakeForm() {
    const btn = document.getElementById('emailIntakeBtn');
    if (btn && btn.disabled) return; // Prevent double-click
    
    const formData = IntakeFormManager.currentIntakeData;
    if (!formData) {
        NotificationSystem.error('No intake data to email');
        return;
    }

    if (!AuthManager.isSignedIn()) {
        NotificationSystem.error('Please sign in to send emails');
        return;
    }

    const recipientsInput = document.getElementById('emailRecipients');
    const recipientsText = recipientsInput ? recipientsInput.value : 'pozersky@lonewolfgenetics.com';
    const recipients = recipientsText.split(',').map(e => e.trim()).filter(e => e);

    if (recipients.length === 0) {
        NotificationSystem.error('Please enter at least one email address');
        return;
    }

    // Disable button during operation
    if (btn) {
        btn.disabled = true;
        btn._originalText = btn.textContent;
        btn.textContent = '⏳ Sending...';
    }

    try {
        NotificationSystem.info('Sending email...');

        const result = await EmailService.sendIntakeForm(formData, recipients);

        NotificationSystem.success(`Email sent successfully to ${result.recipientCount} recipient(s)!`);
    } catch (error) {
        console.error('Error sending email:', error);
        NotificationSystem.error('Failed to send email: ' + error.message);
    } finally {
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn._originalText || '📧 Send Email';
        }
    }
}

/**
 * Handle QR code scan from URL with smart routing
 * - If user has SharePoint permissions → Opens Excel workbook with row highlighted
 * - If no permissions → Falls back to web app modal
 *
 * Supports URL formats:
 * - /qr/XXXXXX (pre-printed QR code with pool ID)
 * - ?c=containerId
 * - ?container=containerId
 * - ?barcode=barcodeData
 */
async function handleQRCodeScan() {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        let containerParam = urlParams.get('c') || urlParams.get('container');
        let barcodeParam = urlParams.get('barcode');

        // If no URL params, check sessionStorage (saved before login redirect)
        if (!containerParam && !barcodeParam) {
            const savedScan = sessionStorage.getItem('pendingQRScan');
            if (savedScan) {
                try {
                    const parsed = JSON.parse(savedScan);
                    containerParam = parsed.container || null;
                    barcodeParam = parsed.barcode || null;
                    console.log('Restored QR scan from sessionStorage:', parsed);
                } catch (e) {
                    console.warn('Failed to parse saved QR scan:', e);
                }
                sessionStorage.removeItem('pendingQRScan');
            }
        }

        if (!containerParam && !barcodeParam) {
            return; // No QR scan parameter present
        }

        // Save QR params in case we need to redirect for login
        sessionStorage.setItem('pendingQRScan', JSON.stringify({
            container: containerParam,
            barcode: barcodeParam
        }));

        console.log('QR code scanned!', `Container: ${containerParam}`);

        // If not signed in, prompt login (params are saved in sessionStorage)
        if (window.AuthManager && !AuthManager.isSignedIn()) {
            console.log('User not signed in, redirecting to login. QR params saved.');
            NotificationSystem.info('Please sign in to view container details...');
            // Small delay so user sees the message
            setTimeout(() => AuthManager.signIn(), 500);
            return;
        }

        // Wait for data to be loaded (longer timeout — cloud sync can take a while)
        let waitCount = 0;
        const maxWait = 40; // 20 seconds
        while (!window.appState.isDataLoaded && waitCount < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 500));
            waitCount++;
        }

        // If data still not loaded, try triggering a sync
        if (!window.appState.isDataLoaded && window.OneDriveSync && AuthManager.isSignedIn()) {
            console.log('Data not loaded after wait, triggering cloud sync...');
            NotificationSystem.info('Loading data from HQ workbook...');
            try {
                if (typeof quickCloudSync === 'function') {
                    await quickCloudSync();
                } else if (window.OneDriveSync.syncNow) {
                    await OneDriveSync.syncNow();
                }
                // Wait a bit more for data to propagate
                let extraWait = 0;
                while (!window.appState.isDataLoaded && extraWait < 20) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    extraWait++;
                }
            } catch (syncError) {
                console.warn('Cloud sync failed during QR scan:', syncError);
            }
        }

        // Find the container in inventory
        let container = null;

        if (containerParam) {
            container = window.appState.inventory.find(item =>
                item.containerId === containerParam ||
                item.containerId === parseInt(containerParam)
            );
        }

        if (!container && barcodeParam) {
            container = window.appState.inventory.find(item =>
                item.barcode === barcodeParam ||
                item.sampleBarcode === barcodeParam
            );
        }

        if (!container) {
            console.warn(`Container not found for QR scan. Container: ${containerParam}, Barcode: ${barcodeParam}`);
            sessionStorage.removeItem('pendingQRScan');
            NotificationSystem.warning(`Container not found in inventory. It may not be loaded yet.`);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        console.log(`✅ Container found:`, container);

        // Clear saved QR scan — we found the container
        sessionStorage.removeItem('pendingQRScan');

        // SMART ROUTING: Check if user has SharePoint permissions
        const hasSharePointAccess = window.AuthManager && window.AuthManager.isSignedIn();

        if (hasSharePointAccess) {
            // User is authenticated - Try to open Excel workbook with row highlighted
            const success = await tryOpenExcelWorkbook(container);

            if (success) {
                console.log('✅ Opening Excel workbook with row highlighted');
                NotificationSystem.success(`Opening HQ workbook for container ${container.containerId}...`);
                // Give Excel a moment to open, then fall back to modal if needed
                setTimeout(() => {
                    // Show modal as backup in case Excel didn't open properly
                    showContainerDetail(container);
                }, 3000);
            } else {
                // Excel open failed, fall back to modal
                console.log('⚠️ Excel workbook open failed, showing modal instead');
                showContainerDetail(container);
            }
        } else {
            // No SharePoint permissions - Show web app modal
            console.log('ℹ️ No SharePoint access, showing web app modal');
            showContainerDetail(container);
        }

        // Clean the URL (remove QR parameters)
        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
        console.error('Error handling QR code scan:', error);
        NotificationSystem.error('Error processing QR code scan');
        // Clean URL even on error
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

/**
 * Try to open Excel workbook with specific container row highlighted
 * @param {Object} container - Container object
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function tryOpenExcelWorkbook(container) {
    try {
        if (!window.OneDriveSync || !window.OneDriveSync.shareUrl) {
            console.warn('OneDriveSync not configured');
            return false;
        }

        // Get the SharePoint workbook URL
        const shareUrl = window.OneDriveSync.shareUrl;
        if (!shareUrl) {
            console.warn('SharePoint URL not configured');
            return false;
        }

        // Extract the base SharePoint URL (before query params)
        const baseUrl = shareUrl.split('?')[0];

        // Find the row number by querying the Excel table via Graph API
        let excelRow = null;
        if (window.OneDriveSync.findContainerRow) {
            excelRow = await window.OneDriveSync.findContainerRow(container.containerId);
        }

        if (!excelRow) {
            console.warn('Could not determine Excel row for container');
            return false;
        }

        // Construct Excel Online URL with cell reference
        // Format: URL#SheetName!CellReference
        // Navigate to cell A{row} to highlight the container row
        const excelDeepLink = `${baseUrl}?web=1#Active_Inventory!A${excelRow}`;

        console.log(`📊 Opening Excel workbook at row ${excelRow}: ${excelDeepLink}`);

        // Try to open the workbook in a new window
        const excelWindow = window.open(excelDeepLink, '_blank');

        if (excelWindow) {
            // Window opened successfully
            return true;
        } else {
            // Pop-up blocked or failed
            console.warn('Failed to open Excel window (pop-up blocked?)');
            return false;
        }

    } catch (error) {
        console.error('Error opening Excel workbook:', error);
        return false;
    }
}

/**
 * Highlight a specific container row in the inventory table
 * @param {string} barcodeData - The barcode data to search for
 * @param {string} containerId - The container ID to search for
 */
function highlightContainerInTable(barcodeData, containerId) {
    const inventoryTable = document.getElementById('inventoryTable');
    if (!inventoryTable) {
        console.error('Inventory table not found');
        return;
    }

    // Find the row with matching barcode or container ID
    const rows = inventoryTable.querySelectorAll('tbody tr');
    let foundRow = null;

    for (const row of rows) {
        const cells = row.cells;
        if (!cells || cells.length === 0) continue;

        // Check if barcode or container ID matches
        const rowBarcode = cells[3]?.textContent || ''; // Assuming barcode is in column 3
        const rowContainerId = cells[0]?.textContent || ''; // Assuming ID is in column 0

        if (rowBarcode.includes(barcodeData) || rowContainerId === containerId) {
            foundRow = row;
            break;
        }
    }

    if (foundRow) {
        // Remove any existing highlights
        rows.forEach(r => r.classList.remove('qr-highlighted'));

        // Add highlight class to found row
        foundRow.classList.add('qr-highlighted');

        // Scroll the row into view
        foundRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

        console.log(`✅ Container row highlighted for ID: ${containerId}`);

        // Remove highlight after 5 seconds
        setTimeout(() => {
            foundRow.classList.remove('qr-highlighted');
        }, 5000);
    } else {
        console.warn(`Container not found in table: ${containerId}`);
        NotificationSystem.warning(`Container ${containerId} not currently visible in inventory`);
    }
}

/**
 * Show container detail modal with metadata
 * @param {Object} container - Container object from inventory
 */
async function showContainerDetail(container) {
    const modal = document.getElementById('containerDetailModal');
    const content = document.getElementById('containerDetailContent');

    if (!modal || !content) {
        console.error('Container detail modal elements not found');
        return;
    }

    // Store current container for editing
    window.currentEditingContainer = container;
    
    // SECURITY: Sanitize all container fields for safe HTML display
    const s = UIUtils.sanitize.bind(UIUtils);
    const safe = {
        containerId: s(container.containerId) || 'N/A',
        status: s(container.status) || 'N/A',
        owner: s(container.owner) || 'N/A',
        ownerId: s(container.ownerId) || 'N/A',
        strain: s(container.strain) || 'N/A',
        strainId: s(container.strainId) || 'N/A',
        mediaType: s(container.mediaType || container.media) || 'N/A',
        mediaId: s(container.mediaId) || 'N/A',
        stage: s(container.stage) || 'N/A',
        stageId: s(container.stageId) || 'N/A',
        tissueCount: s(container.tissueCount) || 'N/A',
        date: s(container.date) || 'N/A',
        barcode: s(container.barcode || container.sampleBarcode) || 'N/A',
        containerLineage: s(container.containerLineage) || '',
        qrcoDeUrl: s(container.qrcoDeUrl) || ''
    };

    // Compute Excel deep link for QR destination
    let excelDeepLink = '';
    if (window.OneDriveSync && window.OneDriveSync.shareUrl && window.OneDriveSync.findContainerRow) {
        try {
            const baseUrl = window.OneDriveSync.shareUrl.split('?')[0];
            const excelRow = await window.OneDriveSync.findContainerRow(container.containerId);
            if (excelRow) {
                excelDeepLink = `${baseUrl}?web=1#Active_Inventory!A${excelRow}`;
            }
        } catch (e) {
            console.warn('Failed to resolve Excel row for detail modal:', e);
        }
    }
    const qrDestUrl = excelDeepLink || `${window.location.origin}?c=${s(container.containerId)}`;

    // Build detail view HTML with sanitized values
    const html = `
        <div class="container-detail-grid">
            <div class="container-detail-field">
                <label>Container ID</label>
                <div class="value" data-field="containerId">${safe.containerId}</div>
            </div>
            <div class="container-detail-field">
                <label>Status</label>
                <div class="value" data-field="status">${safe.status}</div>
            </div>
            <div class="container-detail-field">
                <label>Owner</label>
                <div class="value" data-field="owner">${safe.owner}</div>
            </div>
            <div class="container-detail-field">
                <label>Owner ID</label>
                <div class="value" data-field="ownerId">${safe.ownerId}</div>
            </div>
            <div class="container-detail-field">
                <label>Strain</label>
                <div class="value" data-field="strain">${safe.strain}</div>
            </div>
            <div class="container-detail-field">
                <label>Strain ID</label>
                <div class="value" data-field="strainId">${safe.strainId}</div>
            </div>
            <div class="container-detail-field">
                <label>Media Type</label>
                <div class="value" data-field="mediaType">${safe.mediaType}</div>
            </div>
            <div class="container-detail-field">
                <label>Media ID</label>
                <div class="value" data-field="mediaId">${safe.mediaId}</div>
            </div>
            <div class="container-detail-field">
                <label>Stage</label>
                <div class="value" data-field="stage">${safe.stage}</div>
            </div>
            <div class="container-detail-field">
                <label>Stage ID</label>
                <div class="value" data-field="stageId">${safe.stageId}</div>
            </div>
            <div class="container-detail-field">
                <label>Tissue Count</label>
                <div class="value" data-field="tissueCount">${safe.tissueCount}</div>
            </div>
            <div class="container-detail-field">
                <label>Date</label>
                <div class="value" data-field="date">${safe.date}</div>
            </div>
            <div class="container-detail-field full-width">
                <label>Barcode</label>
                <div class="value" data-field="barcode" style="font-family: monospace; font-size: 0.95rem;">${safe.barcode}</div>
            </div>
            ${safe.containerLineage ? `
            <div class="container-detail-field full-width">
                <label>Container Lineage</label>
                <div class="value" data-field="containerLineage">${safe.containerLineage}</div>
            </div>
            ` : ''}
        </div>

        <div class="qr-code-instructions">
            <h4>QR Code</h4>
            ${safe.qrcoDeUrl ? `
                <p style="margin: 4px 0;"><strong>Assigned QR:</strong> <a href="${safe.qrcoDeUrl}" target="_blank" rel="noopener noreferrer">${safe.qrcoDeUrl}</a></p>
            ` : `
                <p style="margin: 0 0 4px 0; font-size: 0.85rem;"><strong>Assign pre-printed QR code:</strong></p>
                <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                    <input type="text" id="detailQrAssignInput" placeholder="Scan or paste qrco.de URL" style="flex: 1; padding: 6px; font-size: 0.8rem; font-family: monospace; border: 1px solid #d97706; border-radius: 4px;">
                    <button type="button" id="detailQrAssignBtn" style="padding: 6px 12px; font-size: 0.8rem; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer;">Assign</button>
                </div>
                <p id="detailQrAssignStatus" style="margin: 0; font-size: 0.75rem;"></p>
            `}
            <p style="margin: 4px 0; font-size: 0.8rem;"><strong>Destination URL:</strong></p>
            <input type="text" value="${qrDestUrl}" readonly onclick="this.select()" style="width: 100%; padding: 6px; font-size: 0.75rem; font-family: monospace; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb;">
        </div>
    `;

    content.innerHTML = html;
    modal.style.display = 'flex';

    // Wire up QR assign button in detail modal (if container has no QR assigned yet)
    const detailAssignBtn = document.getElementById('detailQrAssignBtn');
    const detailAssignInput = document.getElementById('detailQrAssignInput');
    if (detailAssignBtn && detailAssignInput) {
        const doAssign = () => {
            const rawUrl = detailAssignInput.value.trim();
            if (!rawUrl) return;

            let shortCode = rawUrl;
            try {
                const parsed = new URL(rawUrl);
                shortCode = parsed.pathname.replace(/^\//, '');
            } catch (_) { /* raw short code */ }

            if (!shortCode) {
                document.getElementById('detailQrAssignStatus').textContent = 'Invalid QR code URL.';
                return;
            }

            // Update inventory
            const inv = window.appState.inventory.find(
                item => item.containerId === container.containerId
            );
            if (inv) {
                inv.qrcoDeUrl = rawUrl;
                inv.qrcoDeShortCode = shortCode;
                inv.barcodeMetadata = inv.barcodeMetadata || {};
                inv.barcodeMetadata.qrCode = inv.barcodeMetadata.qrCode || {};
                inv.barcodeMetadata.qrCode.qrcoDeUrl = rawUrl;
                inv.barcodeMetadata.qrCode.qrcoDeShortCode = shortCode;
            }
            container.qrcoDeUrl = rawUrl;
            container.qrcoDeShortCode = shortCode;

            if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
                window.InventoryManager.saveToLocalStorage();
            }

            const statusEl = document.getElementById('detailQrAssignStatus');
            // SECURITY: Sanitize shortCode before inserting into HTML
            const safeShortCode = UIUtils.sanitize(shortCode);
            if (statusEl) statusEl.innerHTML = `<span style="color: #059669;">Assigned: <strong>${safeShortCode}</strong></span>`;
            detailAssignInput.readOnly = true;
            detailAssignBtn.disabled = true;
            detailAssignBtn.textContent = 'Assigned';
            detailAssignBtn.style.background = '#6b7280';
        };

        detailAssignBtn.addEventListener('click', doAssign);
        detailAssignInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAssign(); });
    }

    // Reset edit mode
    document.getElementById('editContainerBtn').style.display = 'inline-block';
    document.getElementById('saveContainerBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';

    // Show "Open in Excel" button if user has SharePoint access
    const hasSharePointAccess = window.AuthManager && window.AuthManager.isSignedIn();
    if (hasSharePointAccess) {
        // Add "Open in Excel" button
        const actionsDiv = document.querySelector('.container-detail-actions');
        if (actionsDiv && !document.getElementById('openExcelBtn')) {
            const openExcelBtn = document.createElement('button');
            openExcelBtn.id = 'openExcelBtn';
            openExcelBtn.className = 'btn';
            openExcelBtn.style.background = '#059669';
            openExcelBtn.style.color = 'white';
            openExcelBtn.textContent = '📊 Open in Excel';
            openExcelBtn.onclick = () => {
                tryOpenExcelWorkbook(container);
                NotificationSystem.info('Opening HQ workbook in new tab...');
            };
            actionsDiv.insertBefore(openExcelBtn, actionsDiv.firstChild);
        }
    }

    NotificationSystem.success(`Container ${container.containerId} details loaded`);
}

/**
 * Close container detail modal
 */
function closeContainerDetail() {
    const modal = document.getElementById('containerDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Remove "Open in Excel" button if it exists
    const openExcelBtn = document.getElementById('openExcelBtn');
    if (openExcelBtn) {
        openExcelBtn.remove();
    }

    window.currentEditingContainer = null;
}

/**
 * Toggle container edit mode
 */
function toggleContainerEdit() {
    const container = window.currentEditingContainer;
    if (!container) return;

    const fields = document.querySelectorAll('.container-detail-field .value');
    const editableFields = ['owner', 'strain', 'mediaType', 'stage', 'tissueCount', 'date', 'status'];

    fields.forEach(field => {
        const fieldName = field.getAttribute('data-field');
        if (!editableFields.includes(fieldName)) return;

        const currentValue = container[fieldName] || '';

        if (fieldName === 'status') {
            // Status dropdown
            field.innerHTML = `
                <select data-field="${fieldName}" style="width: 100%;">
                    <option value="Complete" ${currentValue === 'Complete' ? 'selected' : ''}>Complete</option>
                    <option value="In Progress" ${currentValue === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Pending" ${currentValue === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Archived" ${currentValue === 'Archived' ? 'selected' : ''}>Archived</option>
                </select>
            `;
        } else {
            // Text input — SECURITY: sanitize value to prevent attribute injection
            const safeValue = UIUtils.sanitize(currentValue).replace(/"/g, '&quot;');
            const safeField = UIUtils.sanitize(fieldName).replace(/"/g, '&quot;');
            field.innerHTML = `<input type="text" data-field="${safeField}" value="${safeValue}" />`;
        }
    });

    // Update buttons
    document.getElementById('editContainerBtn').style.display = 'none';
    document.getElementById('saveContainerBtn').style.display = 'inline-block';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';

    NotificationSystem.info('Edit mode enabled. Modify fields and click Save Changes.');
}

/**
 * Cancel container edit
 */
function cancelContainerEdit() {
    const container = window.currentEditingContainer;
    if (container) {
        showContainerDetail(container); // Reload original data
    }
}

/**
 * Save container changes
 */
async function saveContainerChanges() {
    const btn = document.getElementById('saveContainerBtn');
    if (btn && btn.disabled) return; // Prevent double-click
    
    const container = window.currentEditingContainer;
    if (!container) return;

    // Disable button during operation
    if (btn) {
        btn.disabled = true;
        btn._originalText = btn.textContent;
        btn.textContent = '⏳ Saving...';
    }

    try {
    // Collect updated values from input fields
    const inputs = document.querySelectorAll('.container-detail-field input, .container-detail-field select');
    const updates = {};

    inputs.forEach(input => {
        const fieldName = input.getAttribute('data-field');
        if (fieldName) {
            updates[fieldName] = input.value;
        }
    });

    // Update the container object
    Object.assign(container, updates);

    // Find and update in inventory array
    const index = window.appState.inventory.findIndex(item => item.containerId === container.containerId);
    if (index !== -1) {
        window.appState.inventory[index] = container;
    }

    // Save to localStorage
    if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
        window.InventoryManager.saveToLocalStorage();
    }

    // Sync to cloud
    if (window.OneDriveSync && window.OneDriveSync.updateRowByContainerId) {
        try {
            console.log(`saveContainerChanges: Syncing updates for ${container.containerId} to cloud...`);
            const result = await window.OneDriveSync.updateRowByContainerId(container.containerId, {
                strain: container.strain || container.strainName || '',
                owner: container.owner || container.ownerName || '',
                stage: container.stage || container.stageName || '',
                location: container.location || '',
                media: container.media || container.mediaType || '',
                tissueCount: container.tissueCount || container.quantity || '',
                date: container.date || container.dateCreated || '',
                notes: container.notes || '',
                status: container.status || ''
            });
            if (result.success) {
                console.log(`saveContainerChanges: Cloud sync successful for ${container.containerId}`);
            } else {
                console.warn(`saveContainerChanges: Cloud sync failed for ${container.containerId}`);
            }
        } catch (err) {
            console.error('saveContainerChanges: Error syncing to cloud:', err);
        }
    }

    // Refresh inventory table if visible
    if (window.InventoryTableManager && typeof window.InventoryTableManager.rebuildTable === 'function') {
        window.InventoryTableManager.rebuildTable();
    }

    // Reload detail view
    showContainerDetail(container);

    NotificationSystem.success(`Container ${container.containerId} updated successfully!`);
    } catch (error) {
        console.error('Error saving container changes:', error);
        if (window.NotificationSystem) {
            NotificationSystem.error('Failed to save changes: ' + error.message);
        }
    } finally {
        // Re-enable button
        const btn = document.getElementById('saveContainerBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = btn._originalText || '💾 Save Changes';
        }
    }
}

// ─── QR Pool UI Functions ──────────────────────────────────────────

function updateQrPoolStatus() {
    const statusEl = document.getElementById('qrPoolStatus');
    if (!statusEl || !window.QRCodeService) return;
    // Use backend pool API
    QRCodeService.getPoolCodes().then(res => {
        const codes = res.codes || [];
        const unassigned = codes.filter(c => c.status === 'unassigned').length;
        const assigned = codes.filter(c => c.status === 'assigned').length;
        statusEl.textContent = `${unassigned} available, ${assigned} assigned`;
    }).catch(() => {
        // Fallback to localStorage pool
        const unassigned = QRCodeService.getUnassigned().length;
        const assigned = QRCodeService.getAssigned().length;
        statusEl.textContent = `${unassigned} available, ${assigned} assigned`;
    });

    // Fetch and display next available ID
    fetchNextPoolId();
}

function fetchNextPoolId() {
    if (!window.QRCodeService || typeof QRCodeService.getNextId !== 'function') return;
    const infoEl = document.getElementById('qrNextIdInfo');
    const valueEl = document.getElementById('qrNextIdValue');
    if (!infoEl || !valueEl) return;

    QRCodeService.getNextId().then(res => {
        if (res.nextId) {
            valueEl.textContent = res.nextId;
            infoEl.style.display = 'block';
            // Store for use during generation
            window._qrNextId = res.nextId;
        }
    }).catch(err => {
        console.warn('Could not fetch next pool ID:', err.message);
        infoEl.style.display = 'none';
    });
}

async function generateQrBatch() {
    if (!window.QRCodeService) {
        NotificationSystem.error('QR Code Service not available');
        return;
    }

    const countInput = document.getElementById('qrBatchCount');
    const count = parseInt(countInput?.value) || 10;

    const progressDiv = document.getElementById('qrBatchProgress');
    const progressBar = document.getElementById('qrBatchProgressBar');
    const progressText = document.getElementById('qrBatchProgressText');
    const btn = document.getElementById('qrBatchGenerateBtn');

    if (progressDiv) progressDiv.style.display = 'block';
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    if (progressBar) progressBar.style.width = '50%';
    if (progressText) progressText.textContent = `Generating ${count} codes...`;

    // Determine startId: manual override > pre-fetched > auto
    const startFromInput = document.getElementById('qrStartFromId');
    let startId = startFromInput?.value ? parseInt(startFromInput.value) : (window._qrNextId || null);

    let result;
    try {
        // Use backend pool API for generation
        result = await QRCodeService.generatePoolBatch(count, 'LW', null, startId);
    } catch (error) {
        console.error('QR batch generation failed:', error);
        NotificationSystem.error('Failed to generate QR codes: ' + error.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Generate QR Batch'; }
        if (progressDiv) progressDiv.style.display = 'none';
        return;
    }

    if (progressBar) progressBar.style.width = '100%';
    console.log('QR batch generation result:', result);

    if (!result.generated || result.generated === 0) {
        if (btn) {
            btn.textContent = '⚠️ None Generated';
            btn.style.background = '#dc3545';
        }
        NotificationSystem.warning('No QR codes were generated. Make sure the backend server is running.');
        setTimeout(() => {
            if (btn) { btn.disabled = false; btn.textContent = 'Generate QR Batch'; btn.style.background = '#7c3aed'; }
            if (progressDiv) progressDiv.style.display = 'none';
        }, 3000);
        return;
    }

    if (btn) {
        btn.textContent = `✅ ${result.generated} Generated!`;
        btn.style.background = '#059669';
    }

    // Clear manual start-from input after successful generation
    if (startFromInput) startFromInput.value = '';

    updateQrPoolStatus();

    setTimeout(() => {
        if (window.ContainerInitiator && typeof ContainerInitiator.refreshQrPicker === 'function') {
            ContainerInitiator.refreshQrPicker();
        }
    }, 100);

    NotificationSystem.success(`✅ Generated ${result.generated} QR codes${result.errors ? ` (${result.errors} errors)` : ''}`);

    setTimeout(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Generate QR Batch'; btn.style.background = '#7c3aed'; }
        if (progressDiv) progressDiv.style.display = 'none';
    }, 2000);
}

async function viewQrPool() {
    if (!window.QRCodeService) return;

    const modal = document.getElementById('containerDetailModal');
    const content = document.getElementById('containerDetailContent');
    if (!modal || !content) return;

    content.innerHTML = '<p style="text-align:center;padding:20px;">Loading pool data...</p>';
    modal.style.display = 'flex';

    // Hide edit buttons
    ['editContainerBtn', 'saveContainerBtn', 'cancelEditBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    try {
        const [unassignedRes, assignedRes] = await Promise.all([
            QRCodeService.getPoolCodes('unassigned'),
            QRCodeService.getPoolCodes('assigned')
        ]);

        const unassigned = unassignedRes.codes || [];
        const assigned = assignedRes.codes || [];

        let html = '<h3 style="margin-bottom: 15px;">QR Code Pool</h3>';
        html += `<p style="margin-bottom: 10px;"><strong>${unassigned.length}</strong> available, <strong>${assigned.length}</strong> assigned`;
        if (unassigned.length > 0) {
            html += ` <button onclick="printUnassignedLabels()" style="margin-left: 10px; padding: 4px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">🖨️ Print Unassigned</button>`;
        }
        html += `</p>`;

        if (unassigned.length > 0) {
            html += '<h4 style="margin: 15px 0 10px;">Available (Unassigned)</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">';
            unassigned.forEach(qr => {
                const hasImage = qr.qrImageDataUrl && qr.qrImageDataUrl !== 'null';
                html += `
                    <div style="text-align: center; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
                        ${hasImage
                            ? `<img src="${qr.qrImageDataUrl}" alt="QR ${qr.shortCode}" style="width: 120px; height: 120px;" />`
                            : `<div style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border-radius: 8px; margin: 0 auto; font-size: 2rem; color: #9ca3af;">📋</div>`
                        }
                        <p style="margin: 6px 0 0; font-family: monospace; font-size: 0.9rem; font-weight: bold; color: #7c3aed;">${qr.shortCode}</p>
                        <button onclick="assignPoolCodeFromView('${qr.shortCode}')" style="margin-top:6px;padding:4px 14px;font-size:0.8rem;background:#059669;color:white;border:none;border-radius:4px;cursor:pointer;">Assign</button>
                    </div>`;
            });
            html += '</div>';
        }

        if (assigned.length > 0) {
            html += '<h4 style="margin: 20px 0 10px;">Assigned</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">';
            assigned.forEach(qr => {
                html += `
                    <div style="text-align: center; padding: 10px; border: 1px solid #10b981; border-radius: 8px; background: #f0fdf4;">
                        <img src="${qr.qrImageDataUrl}" alt="QR ${qr.shortCode}" style="width: 120px; height: 120px;" />
                        <p style="margin: 6px 0 0; font-family: monospace; font-size: 0.9rem; font-weight: bold; color: #059669;">${qr.shortCode}</p>
                        <p style="margin: 2px 0 0; font-size: 0.75rem; color: #047857;">→ ${qr.containerId}</p>
                        <button onclick="unassignPoolCode('${qr.shortCode}')" style="margin-top:4px;padding:2px 8px;font-size:0.75rem;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">Unassign</button>
                    </div>`;
            });
            html += '</div>';
        }

        if (unassigned.length === 0 && assigned.length === 0) {
            html += '<p style="color: #6b7280; margin-top: 10px;">No QR codes generated yet. Use "Generate QR Batch" to create some.</p>';
        }

        content.innerHTML = html;
    } catch (err) {
        content.innerHTML = `<p style="color: #dc2626;">Failed to load pool: ${err.message}</p>`;
    }
}

/**
 * Assign a pool code from the pool view — switches to Initiator tab
 * with the QR ID pre-filled so the user goes through the assignment form.
 */
function assignPoolCodeFromView(shortCode) {
    // Close the pool modal
    const modal = document.getElementById('containerDetailModal');
    if (modal) modal.style.display = 'none';

    // Switch to the Initiator tab
    switchMode('initiator');

    // Show the step wizard, pre-fill, and trigger processing
    setTimeout(() => {
        // CRITICAL: Reset initiator to QR step before processing
        // Without this, the shortCode gets processed as an owner/strain instead of QR input
        if (window.StateManager) {
            StateManager.setState('initiatorState.currentStep', 'qr');
            StateManager.setState('initiatorState.owner', null);
            StateManager.setState('initiatorState.strain', null);
            StateManager.setState('initiatorState.media', null);
            StateManager.setState('initiatorState.stage', null);
            StateManager.setState('initiatorState.tissue', null);
            StateManager.setState('initiatorState.date', null);
            StateManager.setState('initiatorState.location', null);
            StateManager.setState('initiatorState.completed', false);
        }

        const wizard = document.getElementById('initiatorStepWizard');
        if (wizard) wizard.style.display = 'block';

        // Dim the quick assign panel
        const panel = document.getElementById('quickAssignPanel');
        if (panel) panel.style.opacity = '0.6';

        // Pre-fill the quick assign input for visual feedback
        const quickInput = document.getElementById('quickAssignId');
        if (quickInput) quickInput.value = shortCode;

        // Pre-fill the initiator input and trigger the QR step
        const input = document.getElementById('initiatorInput');
        if (input) {
            input.value = shortCode;
            input.focus();
        }

        if (window.NotificationSystem) {
            NotificationSystem.info(`Container #${shortCode} selected — processing...`);
        }

        // Trigger QR step processing
        setTimeout(() => {
            const btn = document.getElementById('initiateBtn');
            if (btn) btn.click();
        }, 100);
    }, 200);
}

async function unassignPoolCode(shortCode) {
    if (!window.QRCodeService) return;
    try {
        await QRCodeService.unassignPoolCode(shortCode);
        NotificationSystem.success(`Code ${shortCode} unassigned`);
        updateQrPoolStatus();
        viewQrPool(); // refresh
    } catch (err) {
        NotificationSystem.error('Failed to unassign: ' + err.message);
    }
}

// Update pool status on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateQrPoolStatus, 500);
});

/**
 * Initialize the Inventory Lookup Service
 * Provides flexible input resolution (ID, abbreviation, or name) for strains, owners, stages, etc.
 */
function initializeInventoryLookupService() {
    console.log('🔍 Initializing Inventory Lookup Service...');

    if (!window.InventoryLookupService) {
        console.warn('InventoryLookupService module not loaded');
        return;
    }

    // Load abbreviation data from JSON if available
    fetch('./inventory_lookup_data.json')
        .then(response => {
            if (!response.ok) throw new Error('Lookup data file not found');
            return response.json();
        })
        .then(data => {
            console.log('📁 Loading lookup abbreviation data...');

            // Load abbreviations and alternates into the lookup service
            if (data.strainAbbreviations || data.ownerAlternates) {
                window.InventoryLookupService.loadAbbreviationData({
                    strainAbbreviations: data.strainAbbreviations || {},
                    ownerAlternates: data.ownerAlternates || {}
                });
            }

            // Populate appState tables from JSON - prefer JSON if it has more data than cached
            // This ensures updated JSON data takes priority over stale localStorage cache
            const currentStrainsCount = Object.keys(window.appState.strainsTable || {}).length;
            const jsonStrainsCount = Object.keys(data.strainNameMapping || {}).length;

            if (data.strainNameMapping && jsonStrainsCount > currentStrainsCount) {
                window.appState.strainsTable = data.strainNameMapping;
                console.log(`  Loaded ${jsonStrainsCount} strains from lookup data (was ${currentStrainsCount})`);
            } else if (data.strainNameMapping && currentStrainsCount === 0) {
                window.appState.strainsTable = data.strainNameMapping;
                console.log(`  Loaded ${jsonStrainsCount} strains from lookup data`);
            }

            const currentOwnersCount = Object.keys(window.appState.ownersTable || {}).length;
            const jsonOwnersCount = Object.keys(data.ownerNameMapping || {}).length;

            if (data.ownerNameMapping && (jsonOwnersCount > currentOwnersCount || currentOwnersCount === 0)) {
                window.appState.ownersTable = data.ownerNameMapping;
                console.log(`  Loaded ${jsonOwnersCount} owners from lookup data`);
            }

            const currentStagesCount = Object.keys(window.appState.stagesTable || {}).length;
            const jsonStagesCount = Object.keys(data.stageNameMapping || {}).length;

            if (data.stageNameMapping && (jsonStagesCount > currentStagesCount || currentStagesCount === 0)) {
                window.appState.stagesTable = data.stageNameMapping;
                console.log(`  Loaded ${jsonStagesCount} stages from lookup data`);
            }

            const currentMediaCount = Object.keys(window.appState.mediaTypesTable || {}).length;
            const jsonMediaCount = Object.keys(data.mediaTypeMapping || {}).length;

            if (data.mediaTypeMapping && (jsonMediaCount > currentMediaCount || currentMediaCount === 0)) {
                window.appState.mediaTypesTable = data.mediaTypeMapping;
                console.log(`  Loaded ${jsonMediaCount} media types from lookup data`);
            }

            const currentLocationsCount = (window.appState.locationsTable || []).length;
            const jsonLocationsCount = (data.locationsList || []).length;

            if (data.locationsList && (jsonLocationsCount > currentLocationsCount || currentLocationsCount === 0)) {
                window.appState.locationsTable = data.locationsList;
                console.log(`  Loaded ${jsonLocationsCount} locations from lookup data`);
            }

            const currentMappingsCount = Object.keys(window.appState.strainOwnerMapping || {}).length;
            const jsonMappingsCount = Object.keys(data.strainOwnerMapping || {}).length;

            if (data.strainOwnerMapping && (jsonMappingsCount > currentMappingsCount || currentMappingsCount === 0)) {
                window.appState.strainOwnerMapping = data.strainOwnerMapping;
                console.log(`  Loaded ${jsonMappingsCount} strain-owner mappings from lookup data`);
            }

            // Initialize the lookup service
            window.InventoryLookupService.initialize();

            // Mark data as loaded
            window.appState.isDataLoaded = true;

            console.log('✅ Inventory Lookup Service initialized successfully');
            console.log(`   Final strain count: ${Object.keys(window.appState.strainsTable).length}`);

            // Refresh UI to show updated counts
            if (window.UIUtils && window.UIUtils.updateDataStatus) {
                window.UIUtils.updateDataStatus(true, 'inventory_lookup_data.json', false);
            }

            // Notify other modules that data is available
            if (window.DataUtils && window.DataUtils.triggerDataLoadedCallbacks) {
                window.DataUtils.triggerDataLoadedCallbacks();
            }
        })
        .catch(error => {
            console.log('📁 inventory_lookup_data.json not found, initializing with existing data:', error.message);

            // Initialize lookup service with whatever data we have
            window.InventoryLookupService.initialize();
            console.log('✅ Inventory Lookup Service initialized with existing appState data');
        });
}

// Legacy compatibility for global function references
window.switchMode = switchMode;
window.nextBuilderStep = nextBuilderStep;
window.resetBuilder = resetBuilder;
window.useGeneratedBarcode = useGeneratedBarcode;
window.selectTransferMode = selectTransferMode;
window.adjustSplitCount = adjustSplitCount;
window.processTransfer = processTransfer;
window.clearTransfer = clearTransfer;
window.toggleDiscardPanel = toggleDiscardPanel;
window.adjustDiscardCount = adjustDiscardCount;
window.exportInventory = exportInventory;
window.performGlobalSearch = performGlobalSearch;
window.showGlobalSearchResults = showGlobalSearchResults;
window.hideGlobalSearchResults = hideGlobalSearchResults;
window.clearInventory = clearInventory;
window.toggleBarcodeDetails = toggleBarcodeDetails;
window.emailIntakeForm = emailIntakeForm;
window.showContainerDetail = showContainerDetail;
window.closeContainerDetail = closeContainerDetail;
window.toggleContainerEdit = toggleContainerEdit;
window.cancelContainerEdit = cancelContainerEdit;
window.saveContainerChanges = saveContainerChanges;
window.tryOpenExcelWorkbook = tryOpenExcelWorkbook;
window.generateQrBatch = generateQrBatch;
window.viewQrPool = viewQrPool;
window.updateQrPoolStatus = updateQrPoolStatus;
window.printUnassignedLabels = printUnassignedLabels;
window.assignPoolCodeFromView = assignPoolCodeFromView;
window.quickAssignContainer = quickAssignContainer;

/**
 * Quick Assign Container — primary workflow entry point.
 * User types a numeric label ID, we show the step wizard and auto-process the QR step.
 */
function quickAssignContainer() {
    const input = document.getElementById('quickAssignId');
    const feedback = document.getElementById('quickAssignFeedback');
    const val = (input ? input.value : '').trim();

    if (!val || isNaN(val) || parseInt(val) < 1) {
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.color = '#dc2626';
            feedback.textContent = '⚠️ Please enter a valid numeric container ID (e.g. 305)';
        }
        return;
    }

    // CRITICAL: Reset initiator to QR step before processing
    // Without this, if the wizard is already on 'owner' step from a previous
    // attempt, the container ID gets processed as an owner name instead of QR input
    if (window.StateManager) {
        StateManager.setState('initiatorState.currentStep', 'qr');
        StateManager.setState('initiatorState.owner', null);
        StateManager.setState('initiatorState.strain', null);
        StateManager.setState('initiatorState.media', null);
        StateManager.setState('initiatorState.stage', null);
        StateManager.setState('initiatorState.completed', false);
    }

    // Show the step wizard
    const wizard = document.getElementById('initiatorStepWizard');
    if (wizard) wizard.style.display = 'block';

    // Hide the quick assign panel highlight (keep visible but dim)
    const panel = document.getElementById('quickAssignPanel');
    if (panel) panel.style.opacity = '0.6';

    // Pre-fill the initiator input and trigger the QR step
    const initiatorInput = document.getElementById('initiatorInput');
    if (initiatorInput) {
        initiatorInput.value = val;
        initiatorInput.focus();
    }

    // Trigger the QR processing step
    if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#047857';
        feedback.textContent = `Looking up container #${val}...`;
    }

    // Use ContainerInitiator to process the QR input
    setTimeout(() => {
        const btn = document.getElementById('initiateBtn');
        if (btn) btn.click();
    }, 100);
}

// Label printing — uses backend print endpoint
function printUnassignedLabels() {
    const backendUrl = window.QRCodeService ? QRCodeService.backendUrl : 'http://localhost:3001';
    window.open(`${backendUrl}/api/qrcodes/pool/print?status=unassigned&limit=50`, '_blank');
}

function printAssignedLabels() {
    const backendUrl = window.QRCodeService ? QRCodeService.backendUrl : 'http://localhost:3001';
    window.open(`${backendUrl}/api/qrcodes/pool/print?status=assigned&limit=50`, '_blank');
}

function printTransferLabels(containerIds) {
    if (window.LabelPrintService) {
        LabelPrintService.printFromPool(containerIds);
    } else {
        NotificationSystem.error('Label print service not available');
    }
}

window.printAssignedLabels = printAssignedLabels;
window.printTransferLabels = printTransferLabels;
window.unassignPoolCode = unassignPoolCode;

