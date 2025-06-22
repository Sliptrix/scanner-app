// Barcode Generator and Display
// Lab Barcode Builder & Transfer System

window.BuilderBarcodeGenerator = {
    // Generate barcode from current builder state
    generateBarcode: function() {
        const values = window.appState.builderState.values;
        const metadata = window.appState.builderState.metadata;
        
        // Validate all required values are present
        if (!this.validateAllValues(values)) {
            NotificationSystem.error('Missing required values for barcode generation');
            return false;
        }
        
        // Build the barcode (excluding container from barcode)
        const barcode = values.owner + 
                       values.strain + 
                       values.media + 
                       values.stage + 
                       values.tissue + 
                       values.date;
        
        // Display the generated barcode
        this.displayBarcode(values.container, barcode, values, metadata);
        
        // Store in global state for processing
        window.appState.currentContainer = values.container;
        window.appState.currentSample = barcode;
        window.appState.currentMetadata = this.buildMetadata(values, metadata);
        
        NotificationSystem.success(`Barcode generated: ${barcode}`);
        console.log('Barcode generated:', {
            container: values.container,
            barcode: barcode,
            metadata: window.appState.currentMetadata
        });
        
        return true;
    },
    
    // Validate all required values are present
    validateAllValues: function(values) {
        const requiredFields = ['container', 'owner', 'strain', 'media', 'stage', 'tissue', 'date'];
        
        for (const field of requiredFields) {
            if (!values[field]) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }
        
        return true;
    },
    
    // Display the generated barcode in the UI
    displayBarcode: function(container, barcode, values, metadata) {
        // Display container and barcode
        UIUtils.updateContent('finalContainerId', container);
        UIUtils.updateContent('barcodeDisplay', barcode);
        
        // Create detailed breakdown
        this.displayBreakdown(values, metadata);
        
        // Show the barcode section
        UIUtils.showElement('generatedBarcode', true);
        
        // Scroll to barcode section
        const barcodeSection = document.getElementById('generatedBarcode');
        if (barcodeSection) {
            barcodeSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },
    
    // Display detailed barcode breakdown
    displayBreakdown: function(values, metadata) {
        const breakdownDiv = document.getElementById('barcodeBreakdown');
        if (!breakdownDiv) return;
        
        const breakdown = `
            <div class="breakdown-part">
                <strong>Owner:</strong> ${values.owner} (${metadata.ownerName || values.owner})
            </div>
            <div class="breakdown-part">
                <strong>Strain:</strong> ${values.strain} (${metadata.strainName || 'Unknown'})
            </div>
            <div class="breakdown-part">
                <strong>Media:</strong> ${values.media} (${metadata.mediaName || values.media})
            </div>
            <div class="breakdown-part">
                <strong>Stage:</strong> ${values.stage} (${metadata.stageName || `Stage ${values.stage}`})
            </div>
            <div class="breakdown-part">
                <strong>Tissue:</strong> ${values.tissue} samples
            </div>
            <div class="breakdown-part">
                <strong>Date:</strong> ${DataUtils.formatDate(values.date)}
            </div>
        `;
        
        breakdownDiv.innerHTML = breakdown;
    },
    
    // Build comprehensive metadata object
    buildMetadata: function(values, metadata) {
        return {
            // Original metadata
            ownerName: metadata.ownerName || values.owner,
            strainName: metadata.strainName || 'Unknown Strain',
            mediaName: metadata.mediaName || values.media,
            stageName: metadata.stageName || `Stage ${values.stage}`,
            
            // Processed values
            tissueCount: values.tissue,
            date: values.date,
            formattedDate: DataUtils.formatDate(values.date),
            
            // For inventory compatibility
            strain: metadata.strainName || 'Unknown Strain',
            owner: metadata.ownerName || values.owner,
            stage: metadata.stageName || `Stage ${values.stage}`,
            mediaType: metadata.mediaName || values.media,
            
            // IDs for reference
            strainId: values.strain,
            ownerId: values.owner,
            stageId: values.stage,
            mediaId: values.media
        };
    },
    
    // Process and save the generated barcode to inventory
    saveToInventory: function() {
        if (!window.appState.currentContainer || !window.appState.currentSample) {
            NotificationSystem.error('No barcode to save. Please generate a barcode first.');
            return false;
        }
        
        // Update highest container ID if needed
        const containerId = parseInt(window.appState.currentContainer);
        if (!isNaN(containerId) && containerId > window.appState.highestContainerId) {
            window.appState.highestContainerId = containerId;
        }
        
        // Get container lineage
        const lineage = DataUtils.getContainerLineage(window.appState.currentContainer);
        
        // Create inventory entry
        const inventoryEntry = {
            timestamp: new Date(),
            containerId: window.appState.currentContainer,
            containerLineage: lineage.length > 0 ? lineage.join(' ← ') : null,
            sampleBarcode: window.appState.currentSample,
            strain: window.appState.currentMetadata.strain,
            strainId: window.appState.currentMetadata.strainId,
            owner: window.appState.currentMetadata.owner,
            ownerId: window.appState.currentMetadata.ownerId,
            stage: window.appState.currentMetadata.stage,
            stageId: window.appState.currentMetadata.stageId,
            mediaType: window.appState.currentMetadata.mediaType,
            mediaId: window.appState.currentMetadata.mediaId,
            tissueCount: window.appState.currentMetadata.tissueCount,
            date: window.appState.currentMetadata.formattedDate,
            status: 'Complete'
        };
        
        // Add to inventory
        window.appState.inventory.unshift(inventoryEntry);
        window.appState.sessionCounter++;
        
        // Update displays
        UIUtils.updateStats();
        this.updateInventoryTable();
        
        console.log('✅ Entry saved to inventory:', inventoryEntry);
        NotificationSystem.success(`Barcode saved to inventory: ${inventoryEntry.strain}`);
        
        // Auto-reset for next entry
        setTimeout(() => {
            this.resetForNext();
        }, 2000);
        
        return true;
    },
    
    // Update inventory table display
    updateInventoryTable: function() {
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        window.appState.inventory.slice(0, 100).forEach((entry, index) => {
            const row = tbody.insertRow();
            if (index === 0) row.classList.add('current-entry');
            
            // Determine status color
            let statusColor = '#d4edda';
            let statusTextColor = '#155724';
            if (entry.status === 'Incomplete Data') {
                statusColor = '#fff3cd';
                statusTextColor = '#856404';
            } else if (entry.status === 'Split Transfer') {
                statusColor = '#e3f2fd';
                statusTextColor = '#1976d2';
            }
            
            // Format lineage display
            let lineageDisplay = '';
            if (entry.containerLineage) {
                lineageDisplay = `<span class="lineage-badge" title="Container history: ${entry.containerLineage}">
                    ${entry.containerLineage.split(' ← ').length} transfers
                </span>`;
            }
            
            row.innerHTML = `
                <td style="font-family: monospace; font-weight: bold;">${entry.containerId}</td>
                <td>${lineageDisplay}</td>
                <td style="font-family: monospace; font-size: 0.8rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis;" title="${entry.sampleBarcode}">${entry.sampleBarcode}</td>
                <td style="font-weight: 600;" title="${entry.strain} (ID: ${entry.strainId})">${entry.strain}</td>
                <td title="${entry.owner} (${entry.ownerId})">${entry.owner}</td>
                <td title="${entry.stage} (${entry.stageId})">${entry.stage}</td>
                <td title="${entry.mediaType} (${entry.mediaId})">${entry.mediaType}</td>
                <td style="text-align: center;">${entry.tissueCount}</td>
                <td style="font-size: 0.8rem;">${entry.date}</td>
                <td><span style="padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; font-weight: bold; 
                     background: ${statusColor}; color: ${statusTextColor};">
                     ${entry.status}</span></td>
            `;
        });
    },
    
    // Reset for next barcode generation
    resetForNext: function() {
        // Clear current processing data
        window.appState.currentContainer = null;
        window.appState.currentSample = null;
        window.appState.currentMetadata = null;
        
        // Reset builder
        BuilderStepManager.reset();
        
        NotificationSystem.info('Ready for next barcode generation');
    },
    
    // Clear current barcode without saving
    clearCurrent: function() {
        // Clear current processing data
        window.appState.currentContainer = null;
        window.appState.currentSample = null;
        window.appState.currentMetadata = null;
        
        // Hide barcode display
        UIUtils.showElement('generatedBarcode', false);
        
        // Reset builder
        BuilderStepManager.reset();
        
        NotificationSystem.info('Current barcode cleared');
    }
};
