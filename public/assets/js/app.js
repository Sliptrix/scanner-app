// Lab Barcode Builder & Transfer System - JavaScript Application
// Phase 1: Basic function placeholders to ensure UI loads without errors

// Global application state
let appState = {
    mode: 'builder',
    excelData: null,
    inventory: [],
    builderStep: 0,
    transferData: {}
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Lab Scanner System initialized - Phase 1');
    initializeApp();
});

function initializeApp() {
    // Set initial mode
    switchMode('builder');
    
    // Add event listeners for file upload
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Add drag and drop functionality
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('drop', handleFileDrop);
    }
}

// Mode switching functionality
function switchMode(mode) {
    appState.mode = mode;
    
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode === 'builder') {
        document.querySelector('.mode-btn').classList.add('active');
        document.getElementById('builderSection').classList.add('active');
        document.getElementById('transferSection').classList.remove('active');
        document.getElementById('currentMode').textContent = 'Builder';
    } else {
        document.querySelectorAll('.mode-btn')[1].classList.add('active');
        document.getElementById('builderSection').classList.remove('active');
        document.getElementById('transferSection').classList.add('active');
        document.getElementById('currentMode').textContent = 'Transfer';
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

function loadExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        showNotification('Please select an Excel file (.xlsx or .xls)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Process the workbook (placeholder)
            appState.excelData = workbook;
            
            // Update UI
            const dataStatus = document.getElementById('dataStatus');
            dataStatus.classList.add('loaded');
            dataStatus.innerHTML = '<span>✅ Excel data loaded successfully</span><button class="btn btn-secondary" onclick="document.getElementById(\'fileInput\').click()">Load Different File</button>';
            
            showNotification('Excel file loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error loading Excel file:', error);
            showNotification('Error loading Excel file', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Builder functions (placeholders)
function nextBuilderStep() {
    console.log('Next builder step - placeholder function');
    showNotification('Builder step functionality will be implemented in Phase 4', 'info');
}

function resetBuilder() {
    console.log('Reset builder - placeholder function');
    const builderInput = document.getElementById('builderInput');
    if (builderInput) {
        builderInput.value = '';
    }
    
    const generatedBarcode = document.getElementById('generatedBarcode');
    if (generatedBarcode) {
        generatedBarcode.classList.remove('show');
    }
    
    showNotification('Builder reset', 'info');
}

function useGeneratedBarcode() {
    console.log('Use generated barcode - placeholder function');
    showNotification('Barcode save functionality will be implemented in Phase 4', 'info');
}

// Transfer functions (placeholders)
function selectTransferMode(mode) {
    console.log('Transfer mode:', mode);
    
    // Update UI
    document.querySelectorAll('.mode-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (mode === 'single') {
        document.getElementById('singleTransferOption').classList.add('selected');
        document.getElementById('singleTransferDetails').style.display = 'block';
        document.getElementById('splitTransferDetails').style.display = 'none';
    } else {
        document.getElementById('splitTransferOption').classList.add('selected');
        document.getElementById('singleTransferDetails').style.display = 'none';
        document.getElementById('splitTransferDetails').style.display = 'block';
    }
}

function adjustSplitCount(change) {
    const splitCountElement = document.getElementById('splitCount');
    let currentCount = parseInt(splitCountElement.textContent);
    const newCount = Math.max(2, Math.min(10, currentCount + change));
    splitCountElement.textContent = newCount;
    
    // Update buttons
    document.getElementById('decreaseBtn').disabled = newCount <= 2;
    document.getElementById('increaseBtn').disabled = newCount >= 10;
}

function processTransfer() {
    console.log('Process transfer - placeholder function');
    showNotification('Transfer functionality will be implemented in Phase 5', 'info');
}

function clearTransfer() {
    console.log('Clear transfer - placeholder function');
    
    // Clear inputs
    const sourceInput = document.getElementById('sourceContainerInput');
    const destInput = document.getElementById('destContainerInput');
    
    if (sourceInput) sourceInput.value = '';
    if (destInput) destInput.value = '';
    
    // Reset UI
    document.getElementById('sourceContainerValue').textContent = '-';
    document.getElementById('destContainerValue').textContent = '-';
    document.getElementById('sourceSummary').textContent = 'Scan to see contents';
    document.getElementById('destSummary').textContent = 'Single or multiple containers';
    
    showNotification('Transfer cleared', 'info');
}

// Inventory functions (placeholders)
function exportInventory() {
    console.log('Export inventory - placeholder function');
    showNotification('Export functionality will be implemented in Phase 6', 'info');
}

function clearInventory() {
    console.log('Clear inventory - placeholder function');
    const tableBody = document.getElementById('inventoryTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    
    // Reset stats
    document.getElementById('totalProcessed').textContent = '0';
    document.getElementById('uniqueStrains').textContent = '0';
    document.getElementById('sessionCount').textContent = '0';
    
    appState.inventory = [];
    showNotification('Inventory cleared', 'info');
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Add console logging for debugging
console.log('Lab Scanner System - Phase 1 JavaScript loaded');
