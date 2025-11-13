/**
 * Main Intake Module
 * Orchestrates intake form submission and data exports
 */

window.IntakeMain = {
    /**
     * Initialize intake module
     */
    async init() {
        console.log('Initializing Intake Main module...');
        await IntakeFormManager.init();
    }
};

/**
 * Submit intake form
 * Called from HTML button
 */
function submitIntakeForm() {
    console.log('Submitting intake form...');
    
    // Validate form
    const errors = IntakeFormManager.validateForm();
    if (errors.length > 0) {
        showNotification('Validation errors: ' + errors.join(', '), 'error');
        return;
    }
    
    // Collect form data
    const formData = IntakeFormManager.collectFormData();
    console.log('Form data:', formData);
    
    // Add to strain owner mapping
    IntakeDataManager.addStrainOwner(
        formData.strainID,
        formData.strainName,
        formData.ownerID
    );
    
    // Store current intake data for export
    IntakeFormManager.currentIntakeData = formData;
    
    // Display summary
    IntakeFormManager.displaySummary(formData);
    
    // Show success notification
    showNotification('Intake submitted successfully!', 'success');
    
    console.log('Intake submitted successfully');
}

/**
 * Clear intake form
 * Called from HTML button
 */
function clearIntakeForm() {
    IntakeFormManager.clearForm();
    showNotification('Form cleared', 'info');
}

/**
 * Download intake data as JSON
 * Called from HTML button
 */
function downloadIntakeJSON() {
    const data = IntakeFormManager.currentIntakeData;
    if (!data) {
        showNotification('No intake data to download', 'error');
        return;
    }
    
    // Create JSON file with intake data
    const intakeRecord = {
        intake: data,
        strainOwnerMapping: IntakeDataManager.getData()
    };
    
    const dataStr = JSON.stringify(intakeRecord, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intake_${data.strainID}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showNotification('JSON downloaded successfully', 'success');
}

/**
 * Download intake data as Excel
 * Called from HTML button
 */
function downloadIntakeExcel() {
    const data = IntakeFormManager.currentIntakeData;
    if (!data) {
        showNotification('No intake data to download', 'error');
        return;
    }
    
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
        showNotification('Excel export library not loaded', 'error');
        return;
    }
    
    // Create worksheet data
    const wsData = [
        ['LoneWolf Biotech Intake Form'],
        [],
        ['Timestamp', new Date(data.timestamp).toLocaleString()],
        ['Customer Type', data.customerType],
        ['Customer Name', data.customerName],
        ['Address', data.address || ''],
        ['PO Number', data.poNumber || ''],
        [],
        ['Services'],
        ...data.services.map(service => ['', service]),
        [],
        ['Genetics', data.genetics],
        [],
        ['Strain Information'],
        ['Strain Name', data.strainName],
        ['Owner ID', data.ownerID],
        ['Strain ID', data.strainID]
    ];
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Style the header
    ws['A1'].s = { font: { bold: true, sz: 14 } };
    
    // Set column widths
    ws['!cols'] = [
        { wch: 20 },
        { wch: 40 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Intake');
    
    // Add strain owner mapping sheet
    const mappingData = IntakeDataManager.getData();
    if (mappingData && mappingData.strainOwnerMapping) {
        const mappingWsData = [
            ['Strain ID', 'Strain Name', 'Owner ID'],
            ...Object.keys(mappingData.strainOwnerMapping).map(strainID => [
                strainID,
                mappingData.strainNameMapping[strainID] || '',
                mappingData.strainOwnerMapping[strainID]
            ])
        ];
        
        const mappingWs = XLSX.utils.aoa_to_sheet(mappingWsData);
        mappingWs['!cols'] = [
            { wch: 12 },
            { wch: 30 },
            { wch: 15 }
        ];
        
        XLSX.utils.book_append_sheet(wb, mappingWs, 'Strain Mapping');
    }
    
    // Download file
    XLSX.writeFile(wb, `intake_${data.strainID}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showNotification('Excel file downloaded successfully', 'success');
}

/**
 * Download intake data as PDF
 * Called from HTML button
 */
function downloadIntakePDF() {
    const data = IntakeFormManager.currentIntakeData;
    if (!data) {
        showNotification('No intake data to download', 'error');
        return;
    }
    
    try {
        IntakePDFGenerator.downloadPDF(data);
        showNotification('PDF downloaded successfully', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('Error generating PDF: ' + error.message, 'error');
    }
}

// Expose to global scope
window.downloadIntakePDF = downloadIntakePDF;

/**
 * Toggle between single entry and bulk upload modes
 */
function toggleIntakeMode(mode) {
    const singleEntrySection = document.getElementById('singleEntrySection');
    const bulkUploadSection = document.getElementById('bulkUploadSection');
    const singleEntryBtn = document.getElementById('singleEntryBtn');
    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    
    if (mode === 'single') {
        singleEntrySection.style.display = 'block';
        bulkUploadSection.style.display = 'none';
        singleEntryBtn.classList.add('active');
        bulkUploadBtn.classList.remove('active');
    } else {
        singleEntrySection.style.display = 'none';
        bulkUploadSection.style.display = 'block';
        singleEntryBtn.classList.remove('active');
        bulkUploadBtn.classList.add('active');
        
        // Setup bulk upload event listeners
        setupBulkUploadListeners();
    }
}

/**
 * Setup bulk upload event listeners
 */
function setupBulkUploadListeners() {
    const uploadArea = document.getElementById('bulkUploadArea');
    const fileInput = document.getElementById('bulkFileInput');
    
    if (!uploadArea || !fileInput) return;
    
    // Click to browse
    uploadArea.onclick = () => fileInput.click();
    
    // File selected
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            handleBulkFileUpload(e.target.files[0]);
        }
    };
    
    // Drag and drop
    uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#5568d3';
        uploadArea.style.background = '#f0f4ff';
    };
    
    uploadArea.ondragleave = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f8f9ff';
    };
    
    uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#667eea';
        uploadArea.style.background = '#f8f9ff';
        
        if (e.dataTransfer.files.length > 0) {
            handleBulkFileUpload(e.dataTransfer.files[0]);
        }
    };
}

/**
 * Handle bulk file upload
 */
async function handleBulkFileUpload(file) {
    try {
        showNotification('Parsing file...', 'info');
        
        // Parse file
        const entries = await BulkUploadParser.parseFile(file);
        
        if (entries.length === 0) {
            showNotification('No valid entries found in file', 'error');
            return;
        }
        
        // Store parsed data
        BulkUploadParser.parsedData = entries;
        
        // Show file info
        document.getElementById('bulkFileName').textContent = file.name;
        document.getElementById('bulkFileInfo').style.display = 'block';
        
        // Generate and show preview
        const previewHtml = BulkUploadParser.generatePreviewTable(entries);
        document.getElementById('bulkDataPreview').innerHTML = previewHtml;
        document.getElementById('bulkPreviewSection').style.display = 'block';
        
        showNotification(`Parsed ${entries.length} entries from file`, 'success');
        
    } catch (error) {
        console.error('Error handling bulk file:', error);
        showNotification('Error parsing file: ' + error.message, 'error');
    }
}

/**
 * Clear bulk file and reset upload section
 */
function clearBulkFile() {
    document.getElementById('bulkFileInput').value = '';
    document.getElementById('bulkFileInfo').style.display = 'none';
    document.getElementById('bulkPreviewSection').style.display = 'none';
    BulkUploadParser.parsedData = [];
    showNotification('File cleared', 'info');
}

/**
 * Submit bulk intake entries
 */
function submitBulkIntake() {
    const entries = BulkUploadParser.parsedData;
    
    if (entries.length === 0) {
        showNotification('No entries to submit', 'error');
        return;
    }
    
    // Filter out entries with errors
    const validEntries = entries.filter(e => e.errors.length === 0);
    
    if (validEntries.length === 0) {
        showNotification('No valid entries to submit. Please fix errors first.', 'error');
        return;
    }
    
    if (validEntries.length < entries.length) {
        const proceed = confirm(
            `${entries.length - validEntries.length} entries have errors and will be skipped. ` +
            `Proceed with ${validEntries.length} valid entries?`
        );
        if (!proceed) return;
    }
    
    // Process each valid entry
    let processed = 0;
    validEntries.forEach(entry => {
        // Generate IDs
        const ownerID = IntakeDataManager.generateOwnerID(entry.customerName, false);
        const strainID = IntakeDataManager.getNextStrainID();
        
        // Add to mapping
        IntakeDataManager.addStrainOwner(strainID, entry.strainName, ownerID);
        processed++;
    });
    
    showNotification(`Successfully processed ${processed} entries!`, 'success');
    
    // Clear and return to upload
    clearBulkFile();
}

// Expose functions globally
window.toggleIntakeMode = toggleIntakeMode;
window.clearBulkFile = clearBulkFile;
window.submitBulkIntake = submitBulkIntake;
