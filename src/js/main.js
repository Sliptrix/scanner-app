// Lab Barcode Builder & Transfer System - Main JavaScript Entry Point
// Phase 3: Core Infrastructure

// Application initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Lab Scanner System - Phase 3 Core Infrastructure loaded');
    initializeApp();
});

// Main application initialization
function initializeApp() {
    console.log('Initializing Lab Scanner System...');
    
    // Initialize state from any existing inventory
    StateManager.initializeFromInventory();
    
    // Try to load saved Excel data first
    loadSavedExcelDataOnStartup();
    
    // If no Excel data loaded, try JSON fallback
    if (!window.appState.isDataLoaded) {
        console.log('No Excel data found, trying JSON fallback...');
        DataUtils.loadJSONFallbackData();
        
        // If still no data after JSON attempt, immediately load minimal fallback
        setTimeout(() => {
            if (!window.appState.isDataLoaded) {
                console.log('JSON fallback not available, loading minimal data...');
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
    
    // Initialize container initiator module
    if (window.ContainerInitiator) {
        ContainerInitiator.initialize();
    }
    
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
        OneDriveSync.init(AuthManager, {
            // Enhanced Plant Inventory System workbook (HQ source of truth)
            shareUrl: 'https://netorgft8640892-my.sharepoint.com/:x:/r/personal/aterkonda_lonewolfgenetics_com/_layouts/15/Doc.aspx?sourcedoc=%7B4E2D4D05-505A-4790-84B7-2ECB59A4B65F%7D&file=Enhanced_Plant_Inventory_System.xlsx&action=default&mobileredirect=true&DefaultItemOpen=1&wdOrigin=WAC.EXCEL.HOME-BUTTON%2CAPPHOME-WEB.FILEBROWSER.RECENT&wdPreviousSession=1c886364-c1d1-4e1e-8692-d758a3632783&wdPreviousSessionSrc=AppHomeWeb&ct=1766427274916',
            refreshIntervalMs: 300000, // 5 minutes
            statusElementId: 'cloud-sync-status',
            buttonElementId: 'cloud-sync-btn',
            inventoryTableName: 'tblActiveInventory' // Excel table name for Active_Inventory sheet
        });

        // Start auto-refresh if authenticated
        if (AuthManager.isSignedIn()) {
            console.log('User authenticated, enabling cloud sync auto-refresh...');
            OneDriveSync.startAutoRefresh();

            // Attempt initial cloud sync (non-blocking)
            DataUtils.loadStrainOwnerMappingWithCloud({ nonBlocking: true })
                .then(result => {
                    console.log(`Initial data loaded from: ${result.source}`);
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
        console.log('✅ RecipeManager initialized with UI setup');
    }
    
    // Show initial status
    NotificationSystem.info('Lab system ready! Load Excel data to begin.');

    // Check for QR code scan (URL parameter ?c=shortCode)
    handleQRCodeScan();

    console.log('Lab Scanner System initialized successfully');
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
    
    console.log('Event listeners setup complete');
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
                console.log('Data imported:', data);
                
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
        
        console.log('AppState restored successfully from imported data');
        
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
        
        console.log('UI updated after import');
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
        
        NotificationSystem.success(
            `📁 Cached Excel data loaded: ${savedData.metadata.fileName} ` +
            `(${new Date(savedData.metadata.loadDate).toLocaleDateString()})`
        );
        
        // Update builder if active
        if (window.appState.mode === 'builder') {
            UIUtils.focusBuilderInput();
        }
        
        console.log('Startup: Using cached Excel data');
    } else {
        console.log('Startup: No cached Excel data found, user will need to load file');
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
                console.log('✅ Updated next available container ID after cloud sync');
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
    }
}

async function syncInventoryToCloud() {
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
    }
}

// Quick cloud sync for easy access
async function quickCloudSync() {
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

    if (window.NotificationSystem) {
        NotificationSystem.info('Syncing data from cloud...');
    }

    try {
        await OneDriveSync.manualSync();
        // Update next container ID after cloud sync to prevent overwrites
        if (window.ContainerInitiator && typeof ContainerInitiator.updateNextAvailableId === 'function') {
            ContainerInitiator.updateNextAvailableId();
            console.log('✅ Updated next available container ID after quick cloud sync');
        }
    } catch (error) {
        console.error('Quick cloud sync error:', error);
        if (window.NotificationSystem) {
            NotificationSystem.error('Cloud sync failed: ' + error.message);
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
        console.log('Save blocked - barcode already saved:', window.appState.currentContainer);
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
            console.log('Duplicate container save prevented:', {
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
        console.log('Transfer mode set to:', mode);
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
    console.log('🔍 MAIN.JS: processTransfer() called');
    console.log('🔍 Call stack:', new Error().stack);
    
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

    try {
        NotificationSystem.info('Sending email...');

        const result = await EmailService.sendIntakeForm(formData, recipients);

        NotificationSystem.success(`Email sent successfully to ${result.recipientCount} recipient(s)!`);
    } catch (error) {
        console.error('Error sending email:', error);
        NotificationSystem.error('Failed to send email: ' + error.message);
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

        const containerParam = urlParams.get('c') || urlParams.get('container');
        const barcodeParam = urlParams.get('barcode');

        if (!containerParam && !barcodeParam) {
            return; // No QR scan parameter present
        }

        console.log('QR code scanned!', `Container: ${containerParam}`);

        // Wait for data to be loaded
        let waitCount = 0;
        while (!window.appState.isDataLoaded && waitCount < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));
            waitCount++;
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
            NotificationSystem.warning(`Container not found in inventory. It may not be loaded yet.`);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        console.log(`✅ Container found:`, container);

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
    const qrDestUrl = excelDeepLink || `${window.location.origin}?c=${container.containerId}`;

    // Build detail view HTML
    const html = `
        <div class="container-detail-grid">
            <div class="container-detail-field">
                <label>Container ID</label>
                <div class="value" data-field="containerId">${container.containerId || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Status</label>
                <div class="value" data-field="status">${container.status || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Owner</label>
                <div class="value" data-field="owner">${container.owner || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Owner ID</label>
                <div class="value" data-field="ownerId">${container.ownerId || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Strain</label>
                <div class="value" data-field="strain">${container.strain || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Strain ID</label>
                <div class="value" data-field="strainId">${container.strainId || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Media Type</label>
                <div class="value" data-field="mediaType">${container.mediaType || container.media || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Media ID</label>
                <div class="value" data-field="mediaId">${container.mediaId || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Stage</label>
                <div class="value" data-field="stage">${container.stage || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Stage ID</label>
                <div class="value" data-field="stageId">${container.stageId || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Tissue Count</label>
                <div class="value" data-field="tissueCount">${container.tissueCount || 'N/A'}</div>
            </div>
            <div class="container-detail-field">
                <label>Date</label>
                <div class="value" data-field="date">${container.date || 'N/A'}</div>
            </div>
            <div class="container-detail-field full-width">
                <label>Barcode</label>
                <div class="value" data-field="barcode" style="font-family: monospace; font-size: 0.95rem;">${container.barcode || container.sampleBarcode || 'N/A'}</div>
            </div>
            ${container.containerLineage ? `
            <div class="container-detail-field full-width">
                <label>Container Lineage</label>
                <div class="value" data-field="containerLineage">${container.containerLineage}</div>
            </div>
            ` : ''}
        </div>

        <div class="qr-code-instructions">
            <h4>QR Code</h4>
            ${container.qrcoDeUrl ? `
                <p style="margin: 4px 0;"><strong>Assigned QR:</strong> <a href="${container.qrcoDeUrl}" target="_blank">${container.qrcoDeUrl}</a></p>
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
            if (statusEl) statusEl.innerHTML = `<span style="color: #059669;">Assigned: <strong>${shortCode}</strong></span>`;
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
            // Text input
            field.innerHTML = `<input type="text" data-field="${fieldName}" value="${currentValue}" />`;
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
function saveContainerChanges() {
    const container = window.currentEditingContainer;
    if (!container) return;

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

    // Refresh inventory table if visible
    if (window.InventoryTableManager && typeof window.InventoryTableManager.rebuildTable === 'function') {
        window.InventoryTableManager.rebuildTable();
    }

    // Reload detail view
    showContainerDetail(container);

    NotificationSystem.success(`Container ${container.containerId} updated successfully!`);
}

// ─── QR Pool UI Functions ──────────────────────────────────────────

function updateQrPoolStatus() {
    const statusEl = document.getElementById('qrPoolStatus');
    if (!statusEl || !window.QRCodeService) return;
    const unassigned = QRCodeService.getUnassigned().length;
    const assigned = QRCodeService.getAssigned().length;
    statusEl.textContent = `${unassigned} available, ${assigned} assigned`;
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

    const result = await QRCodeService.generateBatch(count, (done, total) => {
        const pct = Math.round((done / total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressText) progressText.textContent = `${done} / ${total}`;
    });

    if (btn) { btn.disabled = false; btn.textContent = 'Generate QR Batch'; }
    if (progressDiv) setTimeout(() => { progressDiv.style.display = 'none'; }, 2000);

    updateQrPoolStatus();
    NotificationSystem.success(`Generated ${result.generated} QR codes${result.errors ? ` (${result.errors} errors)` : ''}`);
}

function viewQrPool() {
    if (!window.QRCodeService) return;

    const pool = QRCodeService.getPool();
    const unassigned = pool.filter(qr => !qr.assignedContainerId);
    const assigned = pool.filter(qr => qr.assignedContainerId);

    const modal = document.getElementById('containerDetailModal');
    const content = document.getElementById('containerDetailContent');
    if (!modal || !content) return;

    let html = '<h3 style="margin-bottom: 15px;">QR Code Pool</h3>';
    html += `<p style="margin-bottom: 10px;"><strong>${unassigned.length}</strong> available, <strong>${assigned.length}</strong> assigned</p>`;

    if (unassigned.length > 0) {
        html += '<h4 style="margin: 15px 0 10px;">Available (Unassigned)</h4>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">';
        unassigned.forEach(qr => {
            html += `
                <div style="text-align: center; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
                    <img src="${qr.dataUrl}" alt="QR Row ${qr.excelRow}" style="width: 120px; height: 120px;" />
                    <p style="margin: 6px 0 0; font-family: monospace; font-size: 0.85rem; font-weight: bold;">Row ${qr.excelRow}</p>
                    ${qr.containerId ? `<p style="margin: 2px 0 0; font-size: 0.75rem; color: #059669;">ID: ${qr.containerId}</p>` : ''}
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
                    <img src="${qr.dataUrl}" alt="QR Row ${qr.excelRow}" style="width: 120px; height: 120px;" />
                    <p style="margin: 6px 0 0; font-family: monospace; font-size: 0.85rem; font-weight: bold;">Row ${qr.excelRow}</p>
                    <p style="margin: 2px 0 0; font-size: 0.75rem; color: #059669;">Container: ${qr.assignedContainerId}</p>
                </div>`;
        });
        html += '</div>';
    }

    if (pool.length === 0) {
        html += '<p style="color: #6b7280; margin-top: 10px;">No QR codes generated yet. Use "Generate QR Batch" to create some.</p>';
    }

    content.innerHTML = html;
    modal.style.display = 'flex';

    // Hide edit buttons since this isn't a container detail view
    const editBtn = document.getElementById('editContainerBtn');
    const saveBtn = document.getElementById('saveContainerBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

// Update pool status on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateQrPoolStatus, 500);
});

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

// Label printing
function printAssignedLabels() {
    if (window.LabelPrintService) {
        LabelPrintService.printNewAssignments();
    } else {
        NotificationSystem.error('Label print service not available');
    }
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

