// Transfer Processor - Phase 5: Container Transfer Feature
// Handles the core transfer operations including tissue splitting, discard, and lineage tracking

window.TransferProcessor = (function() {
    'use strict';

    // Configuration
    const config = {
        maxSplitContainers: 10,
        minSplitContainers: 1
    };

    // Initialize the transfer processor
    function initialize() {
        console.log('TransferProcessor initialized');
    }

    // Process the transfer based on current state
    function processTransfer() {
        console.log('TransferProcessor: processTransfer() called');

        // Ensure we're in transfer mode
        const appMode = (window.appState && window.appState.mode) ? window.appState.mode : null;
        if (appMode && appMode !== 'transfer') {
            NotificationSystem.error(
                `Cannot process transfer while in "${appMode}" mode. Switch to Container Transfer mode first.`
            );
            return false;
        }

        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        if (!sourceContainer) {
            NotificationSystem.error('Source container must be specified');
            return false;
        }

        if (!sourceContainer.data || !sourceContainer.data.samples) {
            NotificationSystem.error('Source container has no samples to transfer');
            return false;
        }

        const splitCount = StateManager.getState('transferState.splitCount') || 1;
        const discardCount = StateManager.getState('transferState.discardCount') || 0;
        const discardReason = StateManager.getState('transferState.discardReason') || '';

        // Validate: can't discard all tissues
        const totalTissues = sourceContainer.data.totalSamples;
        if (discardCount >= totalTissues) {
            NotificationSystem.error('Cannot discard all tissues. At least 1 must be transferred.');
            return false;
        }

        try {
            const result = executeTransfer(sourceContainer, splitCount, discardCount, discardReason);

            if (result.success) {
                addToTransferHistory(result);
                updateInventoryAfterTransfer(result);
                updateUIAfterTransfer(result);
                clearTransferState();
                NotificationSystem.success(result.message);
                return true;
            } else {
                NotificationSystem.error(result.message);
                return false;
            }
        } catch (error) {
            console.error('Transfer processing error:', error);
            NotificationSystem.error('Transfer failed: ' + error.message);
            return false;
        }
    }

    /**
     * Execute the transfer: create new containers, handle discards, assign QR codes, build lineage.
     */
    function executeTransfer(sourceContainer, splitCount, discardCount, discardReason) {
        // CRITICAL FIX: Add null check for samples array to prevent runtime crash
        const samples = sourceContainer.data?.samples;
        if (!samples || !Array.isArray(samples) || samples.length === 0) {
            return {
                success: false,
                message: 'Source container has no valid samples to transfer'
            };
        }

        const totalTissues = sourceContainer.data.totalSamples || samples.reduce((sum, s) => sum + (s.tissueCount || 1), 0);
        const transferableTissues = totalTissues - discardCount;

        // Get updated plant data
        const updatedData = window.TransferInputManager ?
            TransferInputManager.getUpdatedPlantData() : {};

        // Build lineage path for new containers
        const sourceId = sourceContainer.id;
        const sourceSample = samples[0];
        const parentLineage = sourceSample.containerLineage || String(sourceId);

        // Generate new container IDs
        const newContainerIds = generateNewContainerIds(splitCount);

        // Distribute transferable tissues across new containers
        const tissuesPerContainer = Math.floor(transferableTissues / splitCount);
        const remainder = transferableTissues % splitCount;

        const transferredSamples = [];

        for (let i = 0; i < splitCount; i++) {
            const tissueCount = tissuesPerContainer + (i < remainder ? 1 : 0);
            const containerId = newContainerIds[i];
            const lineagePath = parentLineage + ' → ' + containerId;

            const newSample = {
                ...sourceSample,
                containerId: containerId,
                tissueCount: tissueCount,
                containerLineage: lineagePath,
                transferDate: new Date().toISOString(),
                transferSource: parseInt(sourceId),
                transferType: splitCount > 1 ? 'split' : 'single',
                timestamp: new Date(),
                status: 'Complete'
            };

            // Apply updated plant data
            if (updatedData.stage) {
                newSample.stage = updatedData.stage;
                newSample.stageId = updatedData.stageId;
            }
            if (updatedData.mediaType) {
                newSample.mediaType = updatedData.mediaType;
                newSample.media = updatedData.mediaType;
                newSample.mediaId = updatedData.mediaId;
            }
            if (updatedData.date) {
                newSample.date = updatedData.date;
            }
            if (updatedData.notes) {
                newSample.transferNotes = updatedData.notes;
            }

            // Auto-assign QR code from pool
            // CRITICAL FIX: Report failures instead of silent skip
            if (window.QRCodeService) {
                try {
                    const qrEntry = QRCodeService.assignNextToContainer(containerId);
                    if (qrEntry) {
                        newSample.qrExcelRow = qrEntry.excelRow;
                        newSample.qrExcelUrl = qrEntry.excelUrl;
                        newSample.qrDataUrl = qrEntry.dataUrl;
                        // Use pre-populated Container_ID if available
                        if (qrEntry.containerId) {
                            newSample.containerId = qrEntry.containerId;
                            newContainerIds[i] = qrEntry.containerId;
                            // Update lineage with the actual container ID
                            newSample.containerLineage = parentLineage + ' → ' + qrEntry.containerId;
                        }
                    } else {
                        // Log warning when no QR codes available
                        console.warn(`No QR code available for container ${containerId}`);
                        if (i === 0) {
                            // Only warn once per transfer operation
                            NotificationSystem.warning('No QR codes available in pool. Containers created without QR labels.');
                        }
                    }
                } catch (qrError) {
                    console.error(`Failed to assign QR code to container ${containerId}:`, qrError);
                    NotificationSystem.warning(`QR code assignment failed for container ${containerId}`);
                }
            }

            // Clean up source-specific fields that shouldn't carry over
            delete newSample.originalSampleIndex;
            delete newSample.originalTissueCount;
            delete newSample.splitPortion;

            transferredSamples.push(newSample);
        }

        // Create discard entry if discarding
        const discardedSamples = [];
        if (discardCount > 0) {
            const discardEntry = {
                ...sourceSample,
                containerId: sourceId, // Keep source ID for discarded
                tissueCount: discardCount,
                containerLineage: parentLineage,
                status: 'Discarded',
                discardDate: new Date().toISOString(),
                discardReason: discardReason || 'Discarded during transfer',
                notes: (sourceSample.notes ? sourceSample.notes + '; ' : '') +
                       'Discarded: ' + (discardReason || 'during transfer'),
                transferDate: new Date().toISOString(),
                transferSource: parseInt(sourceId),
                timestamp: new Date()
            };
            discardedSamples.push(discardEntry);
        }

        // Build result message
        let message = `Transferred ${transferableTissues} tissues from container ${sourceId} to ${splitCount} new container(s): ${newContainerIds.join(', ')}`;
        if (discardCount > 0) {
            message += `. ${discardCount} tissue(s) discarded: ${discardReason || 'no reason given'}`;
        }

        return {
            success: true,
            type: splitCount > 1 ? 'split' : 'single',
            sourceContainerId: sourceId,
            destinationContainers: newContainerIds,
            transferredSamples: transferredSamples,
            discardedSamples: discardedSamples,
            samplesTransferred: transferableTissues,
            samplesDiscarded: discardCount,
            splitCount: splitCount,
            message: message
        };
    }

    // Lock to prevent concurrent ID generation race conditions
    let idGenerationLock = false;

    // Generate new container IDs with race condition protection
    function generateNewContainerIds(count) {
        // CRITICAL FIX: Prevent race condition when multiple transfers happen simultaneously
        if (idGenerationLock) {
            throw new Error('Container ID generation in progress. Please wait and try again.');
        }

        idGenerationLock = true;

        try {
            const newIds = [];
            // Re-read highest ID at the start to get fresh value
            let highestId = StateManager.getState('highestContainerId') || 0;
            const currentInventory = StateManager.getState('inventory') || [];

            // Also scan inventory for any IDs higher than tracked
            currentInventory.forEach(entry => {
                const entryId = parseInt(entry.containerId);
                if (!isNaN(entryId) && entryId > highestId) {
                    highestId = entryId;
                }
            });

            for (let i = 0; i < count; i++) {
                let candidateId;
                let attempts = 0;

                do {
                    highestId++;
                    candidateId = highestId;
                    attempts++;
                    if (attempts > 1000) {
                        throw new Error('Unable to generate unique container ID after 1000 attempts');
                    }
                } while (
                    currentInventory.some(entry => parseInt(entry.containerId) === candidateId) ||
                    newIds.includes(candidateId)  // Also check against IDs we just generated
                );

                newIds.push(candidateId);
            }

            // Update state atomically
            StateManager.setState('highestContainerId', highestId);
            console.log('Generated new container IDs:', newIds);
            return newIds;
        } finally {
            // Always release lock
            idGenerationLock = false;
        }
    }

    // Update inventory after transfer
    function updateInventoryAfterTransfer(transferResult) {
        const currentInventory = StateManager.getState('inventory');
        const sourceContainerIdNum = parseInt(transferResult.sourceContainerId);

        // Remove source container entries
        const filteredInventory = currentInventory.filter(item => {
            const itemContainerIdNum = parseInt(item.containerId);
            return itemContainerIdNum !== sourceContainerIdNum &&
                   item.containerId !== transferResult.sourceContainerId;
        });

        // Add transferred samples + discarded entry
        const newInventory = [
            ...filteredInventory,
            ...transferResult.transferredSamples,
            ...transferResult.discardedSamples
        ];

        StateManager.setState('inventory', newInventory);

        // Update lineage tracking
        updateContainerLineage(transferResult);

        // Rebuild inventory table
        if (window.InventoryTableManager) {
            window.InventoryTableManager.rebuildTable();
        } else {
            UIUtils.rebuildInventoryTable();
        }

        // CRITICAL FIX: Save to localStorage with error handling
        try {
            if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
                window.InventoryManager.saveToLocalStorage();
            }
        } catch (saveError) {
            console.error('Failed to save transfer to localStorage:', saveError);
            NotificationSystem.warning('Transfer completed but may not be saved. Please export your data.');
        }

        console.log(`Inventory updated: ${transferResult.sourceContainerId} → ${transferResult.destinationContainers.join(', ')}${transferResult.samplesDiscarded ? `, ${transferResult.samplesDiscarded} discarded` : ''}`);
    }

    // Update container lineage tracking - Now uses LineageService for enhanced tracking
    function updateContainerLineage(transferResult) {
        // Legacy lineage tracking (for backwards compatibility)
        const lineage = StateManager.getState('containerLineage') || {};

        transferResult.destinationContainers.forEach(destId => {
            if (!lineage[destId]) {
                lineage[destId] = [];
            }
            lineage[destId].push({
                sourceContainer: transferResult.sourceContainerId,
                transferDate: new Date().toISOString(),
                transferType: transferResult.type,
                samplesReceived: transferResult.transferredSamples.filter(s =>
                    String(s.containerId) === String(destId)
                ).length
            });
        });

        StateManager.setState('containerLineage', lineage);

        // Enhanced lineage tracking via LineageService (Phase 3)
        if (window.LineageService) {
            try {
                // Get container data for metadata
                const sourceSample = transferResult.transferredSamples[0] || {};
                
                LineageService.recordTransfer(
                    transferResult.sourceContainerId,
                    transferResult.destinationContainers,
                    {
                        strain: sourceSample.strain,
                        owner: sourceSample.owner,
                        consumed: true, // Source is consumed after transfer
                        transferType: transferResult.type,
                        tissueCount: transferResult.samplesTransferred
                    }
                );
                
                console.log('LineageService: Transfer recorded');
            } catch (lineageError) {
                console.error('LineageService: Failed to record transfer:', lineageError);
            }
        }

        // Audit logging via AuditService (Phase 3)
        if (window.AuditService) {
            try {
                AuditService.logTransfer(
                    transferResult.sourceContainerId,
                    transferResult.destinationContainers,
                    {
                        tissuesTransferred: transferResult.samplesTransferred,
                        tissuesDiscarded: transferResult.samplesDiscarded,
                        discardReason: transferResult.discardReason,
                        transferType: transferResult.type
                    }
                );
                
                // Log discards separately if any
                if (transferResult.samplesDiscarded > 0) {
                    AuditService.logDiscard(
                        transferResult.sourceContainerId,
                        transferResult.samplesDiscarded,
                        transferResult.discardReason || 'during transfer'
                    );
                }
                
                console.log('AuditService: Transfer logged');
            } catch (auditError) {
                console.error('AuditService: Failed to log transfer:', auditError);
            }
        }
    }

    // Add transfer to history
    function addToTransferHistory(transferResult) {
        const history = StateManager.getState('transferHistory') || [];

        const historyEntry = {
            id: 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            type: transferResult.type,
            sourceContainer: transferResult.sourceContainerId,
            destinationContainers: transferResult.destinationContainers,
            samplesTransferred: transferResult.samplesTransferred,
            samplesDiscarded: transferResult.samplesDiscarded || 0,
            splitCount: transferResult.splitCount || 1
        };

        history.unshift(historyEntry);
        if (history.length > 50) history.splice(50);

        StateManager.setState('transferHistory', history);
        updateTransferHistoryDisplay();
    }

    // Update transfer history display
    function updateTransferHistoryDisplay() {
        const history = StateManager.getState('transferHistory') || [];
        const historyElement = document.getElementById('transferHistoryList');

        if (!historyElement) return;

        if (history.length === 0) {
            UIUtils.showElement('transferHistory', false);
            return;
        }

        UIUtils.showElement('transferHistory', true);

        const historyHTML = history.slice(0, 10).map(entry => `
            <div class="transfer-history-item">
                <div class="transfer-history-header">
                    <span class="transfer-type">${entry.type === 'split' ? '🌱 Split' : '📦 Single'}${entry.samplesDiscarded ? ' 🗑️' : ''}</span>
                    <span class="transfer-date">${new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div class="transfer-history-details">
                    Container ${entry.sourceContainer} → ${entry.destinationContainers.join(', ')}
                    (${entry.samplesTransferred} transferred${entry.samplesDiscarded ? `, ${entry.samplesDiscarded} discarded` : ''})
                </div>
            </div>
        `).join('');

        historyElement.innerHTML = historyHTML;
    }

    // Update UI after successful transfer
    function updateUIAfterTransfer(transferResult) {
        UIUtils.updateStats();

        const feedbackElement = document.getElementById('transferFeedback');
        if (feedbackElement) {
            // Build QR info for each new container
            let qrInfo = '';
            transferResult.transferredSamples.forEach(sample => {
                if (sample.qrExcelRow) {
                    qrInfo += `<br>Container ${sample.containerId} → QR Row ${sample.qrExcelRow}`;
                }
            });

            let discardInfo = '';
            if (transferResult.samplesDiscarded > 0) {
                discardInfo = `<br>🗑️ <strong>${transferResult.samplesDiscarded}</strong> tissue(s) discarded`;
            }

            feedbackElement.innerHTML = `
                <div class="success-feedback">
                    ✅ <strong>Transfer Complete!</strong><br>
                    ${transferResult.samplesTransferred} tissues → ${transferResult.destinationContainers.join(', ')}
                    ${discardInfo}
                    ${qrInfo}
                    <br><br>
                    <button class="btn" onclick="printTransferLabels([${transferResult.destinationContainers.map(id => `'${id}'`).join(',')}])" style="font-size: 0.9rem; padding: 8px 16px; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 8px;">
                        🖨️ Print Labels
                    </button>
                    <button class="btn btn-primary" onclick="clearTransfer()" style="font-size: 0.9rem; padding: 8px 16px;">
                        Start Another Transfer
                    </button>
                </div>
            `;
            feedbackElement.className = 'scan-feedback success';
        }
    }

    // Clear transfer state
    function clearTransferState() {
        const currentMode = StateManager.getState('transferState.mode');
        const currentSplitCount = StateManager.getState('transferState.splitCount');

        StateManager.resetTransferState();
        StateManager.setState('transferState.mode', currentMode);
        StateManager.setState('transferState.splitCount', currentSplitCount);
        StateManager.setState('transferState.discardCount', 0);
        StateManager.setState('transferState.discardReason', '');

        if (window.TransferInputManager) {
            TransferInputManager.clearInputs();
        }
    }

    // Preview split operation
    function previewSplit() {
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const splitCount = StateManager.getState('transferState.splitCount') || 1;
        const discardCount = StateManager.getState('transferState.discardCount') || 0;

        if (!sourceContainer || !sourceContainer.data) {
            return null;
        }

        const totalTissues = sourceContainer.data.totalSamples;
        const transferable = totalTissues - discardCount;

        if (transferable <= 0) return null;

        const tissuesPerContainer = Math.floor(transferable / splitCount);
        const remainderTissues = transferable % splitCount;

        const preview = [];
        for (let i = 0; i < splitCount; i++) {
            preview.push({
                containerIndex: i + 1,
                sampleCount: tissuesPerContainer + (i < remainderTissues ? 1 : 0)
            });
        }

        return {
            totalSamples: totalTissues,
            discardCount: discardCount,
            transferable: transferable,
            splitCount: splitCount,
            containers: preview
        };
    }

    // Public API
    return {
        initialize,
        processTransfer,
        previewSplit,
        updateTransferHistoryDisplay
    };

})();
