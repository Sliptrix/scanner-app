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
        
        // Reset save state for new barcode generation
        window.appState.currentBarcodeIsSaved = false;
        
        // Generate enhanced Code128 barcode
        const barcodeResult = this.generateEnhancedBarcode(values, metadata);
        
        if (!barcodeResult.success) {
            NotificationSystem.error(`Barcode generation failed: ${barcodeResult.error}`);
            return false;
        }
        
        // Ensure barcode result has actual data
        if (!barcodeResult.data) {
            NotificationSystem.error('Barcode generation failed: No barcode data produced');
            console.error('Barcode generation produced no data:', barcodeResult);
            return false;
        }
        
        // Display the generated barcode with Code128 visual
        this.displayEnhancedBarcode(values.container, barcodeResult, values, metadata);
        
        // Store in global state for processing
        window.appState.currentContainer = values.container;
        window.appState.currentSample = barcodeResult.data;
        window.appState.currentMetadata = this.buildMetadata(values, metadata);
        window.appState.currentBarcodeResult = barcodeResult;
        
        NotificationSystem.success(`Enhanced Code128 barcode generated: ${barcodeResult.data}`);
        console.log('Enhanced barcode generated:', {
            container: values.container,
            barcode: barcodeResult.data,
            type: barcodeResult.type,
            metadata: window.appState.currentMetadata,
            saveState: window.appState.currentBarcodeIsSaved
        });
        
        return true;
    },
    
    // Generate enhanced Code128 barcode using the new generator
    generateEnhancedBarcode: function(values, metadata) {
        try {
            // Prepare fields for Code128 generator (excluding container)
            const fields = {
                owner: values.owner,
                strain: values.strain,
                media: values.media,
                stage: values.stage,
                tissue: values.tissue,
                date: values.date
            };
            
            // Use the enhanced Code128 generator
            if (window.Code128BarcodeGenerator) {
                return window.Code128BarcodeGenerator.generateCode128Barcode(fields);
            } else {
                // Fallback to basic generation if enhanced generator not available
                return this.generateBasicBarcode(fields);
            }
            
        } catch (error) {
            console.error('Enhanced barcode generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // Fallback basic barcode generation
    generateBasicBarcode: function(fields) {
        const compositeString = fields.owner + fields.strain + fields.media + 
                               fields.stage + fields.tissue + fields.date;
        
        return {
            success: true,
            type: 'BASIC',
            data: compositeString,
            fields: fields,
            timestamp: new Date().toISOString()
        };
    },
    
    // Display enhanced barcode with Code128 visual
    displayEnhancedBarcode: function(container, barcodeResult, values, metadata) {
        // Display container and barcode data
        UIUtils.updateContent('finalContainerId', container);
        
        // Create enhanced barcode display
        const barcodeDisplay = document.getElementById('barcodeDisplay');
        if (barcodeDisplay && barcodeResult.success) {
            let displayHtml = `
                <div class="barcode-visual-container">
                    <div class="barcode-type-badge">${barcodeResult.type}</div>
                    <div class="barcode-data-display">
                        <div class="barcode-string">${barcodeResult.data}</div>
                    </div>
            `;
            
            // Add visual barcode (prefer SVG over base64 for consistency)
            if (barcodeResult.svg) {
                displayHtml += `
                    <div class="barcode-visual-display">
                        <div class="barcode-svg-container">
                            ${barcodeResult.svg}
                        </div>
                    </div>
                `;
            } else if (barcodeResult.base64) {
                displayHtml += `
                    <div class="barcode-visual-display">
                        <div class="barcode-image-container">
                            <img src="${barcodeResult.base64}" alt="Generated barcode" class="barcode-image"/>
                        </div>
                    </div>
                `;
            }
            
            displayHtml += `
                    <div class="barcode-metadata">
                        <small>Generated: ${new Date(barcodeResult.timestamp).toLocaleString()}</small>
                    </div>
                </div>
            `;
            
            barcodeDisplay.innerHTML = displayHtml;
        }
        
        // Create detailed breakdown
        this.displayEnhancedBreakdown(values, metadata, barcodeResult);
        
        // Show the barcode section
        UIUtils.showElement('generatedBarcode', true);
        
        // Scroll to barcode section
        const barcodeSection = document.getElementById('generatedBarcode');
        if (barcodeSection) {
            barcodeSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },
    
    // Display enhanced barcode breakdown with Code128 info
    displayEnhancedBreakdown: function(values, metadata, barcodeResult) {
        const breakdownDiv = document.getElementById('barcodeBreakdown');
        if (!breakdownDiv) return;
        
        let breakdown = `
            <div class="barcode-info-header">
                <h4>Barcode Composition</h4>
            </div>
            <div class="breakdown-grid">
                <div class="breakdown-part">
                    <strong>Owner:</strong> ${values.owner} 
                    <span class="metadata-name">(${metadata.ownerName || values.owner})</span>
                </div>
                <div class="breakdown-part">
                    <strong>Strain:</strong> ${values.strain} 
                    <span class="metadata-name">(${metadata.strainName || 'Unknown'})</span>
                </div>
                <div class="breakdown-part">
                    <strong>Media:</strong> ${values.media} 
                    <span class="metadata-name">(${metadata.mediaName || values.media})</span>
                </div>
                <div class="breakdown-part">
                    <strong>Stage:</strong> ${values.stage} 
                    <span class="metadata-name">(${metadata.stageName || `Stage ${values.stage}`})</span>
                </div>
                <div class="breakdown-part">
                    <strong>Tissue:</strong> ${values.tissue} samples
                </div>
                <div class="breakdown-part">
                    <strong>Date:</strong> ${DataUtils.formatDate(values.date)}
                </div>
            </div>
        `;
        
        // Add technical details if Code128 was used
        if (barcodeResult.type === 'CODE128' && barcodeResult.metadata) {
            breakdown += `
                <div class="barcode-tech-info">
                    <h5>Technical Information</h5>
                    <div class="tech-details">
                        <div><strong>Barcode Type:</strong> ${barcodeResult.type}</div>
                        <div><strong>Composite String:</strong> <code>${barcodeResult.data}</code></div>
                        <div><strong>Human Readable:</strong> ${barcodeResult.includesText ? 'Yes' : 'No'}</div>
                        <div><strong>Generated:</strong> ${new Date(barcodeResult.timestamp).toLocaleString()}</div>
                    </div>
                </div>
            `;
        }
        
        breakdownDiv.innerHTML = breakdown;
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
        console.log('🔍 BARCODE BUILDER: saveToInventory() called');
        console.log('🔍 Call stack:', new Error().stack);
        
        // CRITICAL: Prevent double-saves immediately
        if (window.appState.currentBarcodeIsSaved) {
            NotificationSystem.warning('This barcode has already been saved to inventory.');
            console.log('Double-save prevented - barcode already saved');
            return false;
        }
        
        // CRITICAL: Ensure we're in builder mode - no transfer operations allowed
        if (window.appState.mode !== 'builder') {
            NotificationSystem.error('Cannot save barcode while in transfer mode. Switch to Barcode Builder mode first.');
            return false;
        }
        
        // Validate required data exists
        if (!window.appState.currentContainer) {
            NotificationSystem.error('No container ID available. Please generate a barcode first.');
            return false;
        }
        
        if (!window.appState.currentSample) {
            NotificationSystem.error('No barcode data available. Please generate a barcode first.');
            return false;
        }
        
        // Validate that we have complete barcode data with actual barcode string
        if (!window.appState.currentBarcodeResult || 
            !window.appState.currentBarcodeResult.success || 
            !window.appState.currentBarcodeResult.data) {
            NotificationSystem.error('Invalid or incomplete barcode data. Please regenerate the barcode.');
            console.error('Barcode validation failed:', {
                hasResult: !!window.appState.currentBarcodeResult,
                success: window.appState.currentBarcodeResult?.success,
                hasData: !!window.appState.currentBarcodeResult?.data
            });
            return false;
        }
        
        // Enhanced duplicate prevention - check for ANY entry with same container ID
        const containerExists = window.appState.inventory.find(entry => 
            entry.containerId === window.appState.currentContainer
        );
        
        if (containerExists) {
            NotificationSystem.warning(`Container ${window.appState.currentContainer} already exists in inventory. Cannot create duplicate container.`);
            console.log('Duplicate container prevented:', {
                attempted: window.appState.currentContainer,
                existing: containerExists
            });
            return false;
        }
        
        // Additional check for exact barcode match
        const exactBarcodeMatch = window.appState.inventory.find(entry => 
            entry.sampleBarcode === window.appState.currentSample
        );
        
        if (exactBarcodeMatch) {
            NotificationSystem.warning('This exact barcode already exists in inventory.');
            console.log('Duplicate barcode prevented:', {
                attempted: window.appState.currentSample,
                existing: exactBarcodeMatch
            });
            return false;
        }
        
        // Update highest container ID if needed
        const containerId = parseInt(window.appState.currentContainer);
        if (!isNaN(containerId) && containerId > window.appState.highestContainerId) {
            window.appState.highestContainerId = containerId;
        }
        
        // Get container lineage
        const lineage = DataUtils.getContainerLineage(window.appState.currentContainer);
        
        // CRITICAL: Mark as saved BEFORE creating entry to prevent race conditions
        window.appState.currentBarcodeIsSaved = true;
        
        // Ensure we have metadata (fallback to builder state if needed)
        const metadata = window.appState.currentMetadata || this.buildMetadata(
            window.appState.builderState.values, 
            window.appState.builderState.metadata
        );
        
        // Create inventory entry with complete barcode information - MUST include actual barcode
        const inventoryEntry = {
            timestamp: new Date(),
            containerId: window.appState.currentContainer,
            containerLineage: lineage.length > 0 ? lineage.join(' ← ') : null,
            sampleBarcode: window.appState.currentSample,
            barcode: window.appState.currentBarcodeResult.data, // CRITICAL: Include actual barcode data
            barcodeType: window.appState.currentBarcodeResult.type || 'CODE128',
            barcodeMetadata: window.appState.currentBarcodeResult.metadata || null,
            strain: metadata.strain || 'Unknown',
            strainId: metadata.strainId || '',
            owner: metadata.owner || 'Unknown',
            ownerId: metadata.ownerId || '',
            stage: metadata.stage || 'Unknown',
            stageId: metadata.stageId || '',
            media: metadata.mediaType || metadata.mediaId || 'Unknown',
            mediaType: metadata.mediaType || 'Unknown',
            mediaId: metadata.mediaId || '',
            tissueCount: metadata.tissueCount || 1,
            date: metadata.formattedDate || new Date().toISOString().split('T')[0],
            status: 'Complete'
        };
        
        // Final validation before adding to inventory
        if (!inventoryEntry.barcode || !inventoryEntry.containerId) {
            window.appState.currentBarcodeIsSaved = false; // Reset save state on error
            NotificationSystem.error('Cannot save entry - missing critical barcode or container data');
            console.error('Save validation failed:', {
                hasBarcode: !!inventoryEntry.barcode,
                hasContainer: !!inventoryEntry.containerId,
                entry: inventoryEntry
            });
            return false;
        }
        
        // Add to inventory
        window.appState.inventory.unshift(inventoryEntry);
        window.appState.sessionCounter++;
        
        // Update displays
        UIUtils.updateStats();
        this.updateInventoryTable();
        
        console.log('✅ Entry saved to inventory:', inventoryEntry);
        NotificationSystem.success(`Barcode saved to inventory: ${inventoryEntry.strain} (Container: ${inventoryEntry.containerId})`);
        
        // Persist to localStorage immediately to prevent data loss
        if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
            window.InventoryManager.saveToLocalStorage();
        }
        
        // Auto-reset for next entry after a delay
        setTimeout(() => {
            this.resetForNext();
        }, 2500);
        
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
        window.appState.currentBarcodeResult = null;
        window.appState.currentBarcodeIsSaved = false;
        
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
        window.appState.currentBarcodeResult = null;
        window.appState.currentBarcodeIsSaved = false;
        
        // Hide barcode display
        UIUtils.showElement('generatedBarcode', false);
        
        // Reset builder
        BuilderStepManager.reset();
        
        NotificationSystem.info('Current barcode cleared');
    }
};
