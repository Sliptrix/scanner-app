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
    
    // Set initial mode
    UIUtils.switchMode('builder');
    
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
            
            // Process the workbook using DataUtils
            const success = DataUtils.processExcelData(workbook);
            
            if (success) {
                // Update UI
                UIUtils.updateDataStatus(true, file.name);
                NotificationSystem.success(`Excel data loaded! Ready for barcode building.`);
                
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
    if (input) {
        NotificationSystem.info('Transfer input functionality will be implemented in Phase 5');
        console.log('Source container input:', input);
    }
}

function handleDestContainerInput() {
    const input = document.getElementById('destContainerInput').value.trim();
    if (input) {
        NotificationSystem.info('Destination input functionality will be implemented in Phase 5');
        console.log('Destination container input:', input);
    }
}

// Global functions for HTML onclick events (Phase 1 compatibility)
function switchMode(mode) {
    UIUtils.switchMode(mode);
}

function nextBuilderStep() {
    BarcodeBuilder.nextStep();
}

function resetBuilder() {
    BarcodeBuilder.reset();
}

function useGeneratedBarcode() {
    BarcodeBuilder.saveBarcode();
}

function selectTransferMode(mode) {
    StateManager.setState('transferState.mode', mode);
    
    // Update UI
    UIUtils.removeClass('singleTransferOption', 'selected');
    UIUtils.removeClass('splitTransferOption', 'selected');
    
    if (mode === 'single') {
        UIUtils.addClass('singleTransferOption', 'selected');
        UIUtils.showElement('singleTransferDetails', true);
        UIUtils.showElement('splitTransferDetails', false);
    } else {
        UIUtils.addClass('splitTransferOption', 'selected');
        UIUtils.showElement('singleTransferDetails', false);
        UIUtils.showElement('splitTransferDetails', true);
    }
    
    console.log('Transfer mode set to:', mode);
}

function adjustSplitCount(change) {
    const currentCount = StateManager.getState('transferState.splitCount');
    const newCount = Math.max(2, Math.min(10, currentCount + change));
    
    StateManager.setState('transferState.splitCount', newCount);
    UIUtils.updateContent('splitCount', newCount);
    
    // Update button states
    const decreaseBtn = document.getElementById('decreaseBtn');
    const increaseBtn = document.getElementById('increaseBtn');
    
    if (decreaseBtn) decreaseBtn.disabled = newCount <= 2;
    if (increaseBtn) increaseBtn.disabled = newCount >= 10;
}

function processTransfer() {
    NotificationSystem.info('Transfer functionality will be implemented in Phase 5');
}

function clearTransfer() {
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

function exportInventory() {
    NotificationSystem.info('Export functionality will be implemented in Phase 6');
}

function clearInventory() {
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
