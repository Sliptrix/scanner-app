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
    
    // Set initial mode to intake
    UIUtils.switchMode('intake');
    
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
    const currentCount = StateManager.getState('transferState.splitCount');
    const newCount = Math.max(2, Math.min(10, currentCount + change));
    
    if (window.ContainerTransfer) {
        ContainerTransfer.handleSplitCountChange(newCount);
    } else {
        // Fallback for legacy support
        StateManager.setState('transferState.splitCount', newCount);
        UIUtils.updateContent('splitCount', newCount);
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

// Legacy compatibility for global function references
window.switchMode = switchMode;
window.nextBuilderStep = nextBuilderStep;
window.resetBuilder = resetBuilder;
window.useGeneratedBarcode = useGeneratedBarcode;
window.selectTransferMode = selectTransferMode;
window.adjustSplitCount = adjustSplitCount;
window.processTransfer = processTransfer;
window.clearTransfer = clearTransfer;
window.exportInventory = exportInventory;
window.clearInventory = clearInventory;
window.toggleBarcodeDetails = toggleBarcodeDetails;
window.emailIntakeForm = emailIntakeForm;

