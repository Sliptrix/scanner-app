// Transfer Processor - Phase 5: Container Transfer Feature
// Handles the core transfer operations including tissue splitting functionality

window.TransferProcessor = (function() {
    'use strict';

    // Configuration
    const config = {
        maxSplitContainers: 10,
        minSplitContainers: 2
    };

    // Initialize the transfer processor
    function initialize() {
        console.log('TransferProcessor initialized');
    }

    // Process the transfer based on current state
    function processTransfer() {
        const transferMode = StateManager.getState('transferState.mode');
        const sourceContainer = StateManager.getState('transferState.sourceContainer');

        if (!sourceContainer) {
            NotificationSystem.error('Source container must be specified');
            return false;
        }
        
        // NEW WORKFLOW: We always create new containers, so no destination check needed for single mode
        
        // For split mode, we need a split count
        if (transferMode === 'split' && !StateManager.getState('transferState.splitCount')) {
            NotificationSystem.error('Split count must be specified for split transfer mode');
            return false;
        }

        if (!sourceContainer.data || !sourceContainer.data.samples) {
            NotificationSystem.error('Source container has no samples to transfer');
            return false;
        }

        try {
            let result;
            if (transferMode === 'single') {
                result = processSingleTransfer(sourceContainer); // No destination needed - always create new
            } else {
                result = processSplitTransfer(sourceContainer);
            }

            if (result.success) {
                // Add to transfer history
                addToTransferHistory(result);
                
                // Update inventory
                updateInventoryAfterTransfer(result);
                
                // Update UI
                updateUIAfterTransfer(result);
                
                // Clear transfer state
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

    // Process single container transfer - NEW WORKFLOW: Always create new container
    function processSingleTransfer(sourceContainer) {
        const samples = sourceContainer.data.samples;
        
        // Generate new container ID for single transfer
        const newContainerId = generateNewContainerIds(1)[0];
        
        // Get updated plant data from input manager
        const updatedData = window.TransferInputManager ? 
            window.TransferInputManager.getUpdatedPlantData() : {};
        
        // Transfer all samples to new destination with updated data
        const transferredSamples = samples.map(sample => {
            const newSample = {
                ...sample,
                containerId: newContainerId,
                transferDate: new Date().toISOString(),
                transferSource: parseInt(sourceContainer.id), // Convert to number for test compatibility
                transferType: 'single',
                timestamp: new Date(), // Update timestamp for new container
                status: 'Complete' // Ensure transferred samples have correct status
            };
            
            // Apply updated plant data if provided
            if (updatedData.stage) {
                newSample.stage = updatedData.stage;
                newSample.stageId = updatedData.stageId;
            }
            if (updatedData.mediaType) {
                newSample.mediaType = updatedData.mediaType;
                newSample.mediaId = updatedData.mediaId;
            }
            if (updatedData.date) {
                newSample.date = updatedData.date;
            }
            if (updatedData.notes) {
                newSample.transferNotes = updatedData.notes;
            }
            
            return newSample;
        });

        return {
            success: true,
            type: 'single',
            sourceContainerId: sourceContainer.id,
            destinationContainers: [newContainerId],
            transferredSamples: transferredSamples,
            samplesTransferred: samples.length,
            message: `Successfully transferred ${samples.length} samples from container ${sourceContainer.id} to new container ${newContainerId}`
        };
    }

    // Process split transfer (tissue splitting)
    function processSplitTransfer(sourceContainer) {
        const samples = sourceContainer.data.samples;
        const splitCount = StateManager.getState('transferState.splitCount');
        
        if (splitCount < config.minSplitContainers || splitCount > config.maxSplitContainers) {
            throw new Error(`Split count must be between ${config.minSplitContainers} and ${config.maxSplitContainers}`);
        }

        // Generate new container IDs for split
        const newContainerIds = generateNewContainerIds(splitCount);
        
        // Distribute samples across new containers
        const distributedSamples = distributeSamplesEvenly(samples, newContainerIds, sourceContainer.id);

        return {
            success: true,
            type: 'split',
            sourceContainerId: sourceContainer.id,
            destinationContainers: newContainerIds,
            transferredSamples: distributedSamples,
            samplesTransferred: samples.length,
            splitCount: splitCount,
            message: `Successfully split ${samples.length} samples from container ${sourceContainer.id} into ${splitCount} new containers`
        };
    }

    // Distribute samples evenly across containers
    function distributeSamplesEvenly(samples, containerIds, sourceId) {
        const distributedSamples = [];
        
        // Calculate total tissue count from all barcode entries
        const totalTissueCount = samples.reduce((total, sample) => {
            return total + (parseInt(sample.tissueCount) || 1);
        }, 0);
        
        // Calculate tissues per container
        const tissuesPerContainer = Math.floor(totalTissueCount / containerIds.length);
        const remainderTissues = totalTissueCount % containerIds.length;
        
        // Track tissue distribution
        let remainingTissueToDistribute = totalTissueCount;
        let currentSampleIndex = 0;
        let currentSampleTissueUsed = 0;
        
        containerIds.forEach((containerId, containerIndex) => {
            // Calculate how many tissues this container gets
            const tissuesForThisContainer = tissuesPerContainer + (containerIndex < remainderTissues ? 1 : 0);
            let tissuesAssignedToContainer = 0;
            
            // Distribute tissues to this container
            while (tissuesAssignedToContainer < tissuesForThisContainer && currentSampleIndex < samples.length) {
                const currentSample = samples[currentSampleIndex];
                const currentSampleTotalTissues = parseInt(currentSample.tissueCount) || 1;
                const remainingTissuesInCurrentSample = currentSampleTotalTissues - currentSampleTissueUsed;
                
                // How many tissues can we take from current sample for this container?
                const tissuesNeeded = tissuesForThisContainer - tissuesAssignedToContainer;
                const tissuesToTakeFromCurrentSample = Math.min(remainingTissuesInCurrentSample, tissuesNeeded);
                
                if (tissuesToTakeFromCurrentSample > 0) {
                    // Get updated plant data from input manager
                    const updatedData = window.TransferInputManager ? 
                        window.TransferInputManager.getUpdatedPlantData() : {};
                    
                    // Create a new barcode entry for this portion with updated data
                    const newSample = {
                        ...currentSample,
                        containerId: containerId,
                        tissueCount: tissuesToTakeFromCurrentSample,
                        transferDate: new Date().toISOString(),
                        transferSource: parseInt(sourceId), // Convert to number for test compatibility
                        transferType: 'split',
                        originalSampleIndex: currentSampleIndex,
                        originalTissueCount: currentSampleTotalTissues,
                        splitPortion: `${tissuesToTakeFromCurrentSample}/${currentSampleTotalTissues}`,
                        timestamp: new Date(), // Update timestamp for new container
                        status: 'Complete' // Ensure split samples have correct status
                    };
                    
                    // Apply updated plant data if provided
                    if (updatedData.stage) {
                        newSample.stage = updatedData.stage;
                        newSample.stageId = updatedData.stageId;
                    }
                    if (updatedData.mediaType) {
                        newSample.mediaType = updatedData.mediaType;
                        newSample.mediaId = updatedData.mediaId;
                    }
                    if (updatedData.date) {
                        newSample.date = updatedData.date;
                    }
                    if (updatedData.notes) {
                        newSample.transferNotes = updatedData.notes;
                    }
                    
                    distributedSamples.push(newSample);
                    
                    tissuesAssignedToContainer += tissuesToTakeFromCurrentSample;
                    currentSampleTissueUsed += tissuesToTakeFromCurrentSample;
                }
                
                // If we've used all tissues from current sample, move to next
                if (currentSampleTissueUsed >= currentSampleTotalTissues) {
                    currentSampleIndex++;
                    currentSampleTissueUsed = 0;
                }
            }
            
            remainingTissueToDistribute -= tissuesAssignedToContainer;
        });
        
        return distributedSamples;
    }

    // Generate new container IDs for split operation
    function generateNewContainerIds(count) {
        const newIds = [];
        let highestId = StateManager.getState('highestContainerId') || 0;
        
        for (let i = 0; i < count; i++) {
            highestId++;
            newIds.push(highestId);
        }
        
        // Update highest container ID in state
        StateManager.setState('highestContainerId', highestId);
        
        return newIds;
    }

    // Ensure container exists in the system
    function ensureContainerExists(containerId) {
        const highestId = StateManager.getState('highestContainerId') || 0;
        const numId = parseInt(containerId);
        
        if (numId > highestId) {
            StateManager.setState('highestContainerId', numId);
        }
        
        return numId;
    }

    // Update inventory after transfer
    function updateInventoryAfterTransfer(transferResult) {
        const currentInventory = StateManager.getState('inventory');
        
        // Convert source container ID to number for proper comparison
        const sourceContainerIdNum = parseInt(transferResult.sourceContainerId);
        
        // Remove samples from source container - compare both string and number versions
        const filteredInventory = currentInventory.filter(item => {
            const itemContainerIdNum = parseInt(item.containerId);
            return itemContainerIdNum !== sourceContainerIdNum && 
                   item.containerId !== transferResult.sourceContainerId;
        });
        
        // Add transferred samples to inventory
        const newInventory = [...filteredInventory, ...transferResult.transferredSamples];
        
        // Update state
        StateManager.setState('inventory', newInventory);
        
        // Update lineage tracking
        updateContainerLineage(transferResult);
        
        // Rebuild inventory table if available
        if (window.InventoryTableManager) {
            console.log('InventoryTableManager available, rebuilding table');
            window.InventoryTableManager.rebuildTable();
        } else {
            console.log('InventoryTableManager not available, using fallback');
            UIUtils.rebuildInventoryTable();
        }
        
        console.log(`Inventory updated: removed ${transferResult.samplesTransferred} from container ${transferResult.sourceContainerId}, added to containers ${transferResult.destinationContainers.join(', ')}`);
    }

    // Update container lineage tracking
    function updateContainerLineage(transferResult) {
        const lineage = StateManager.getState('containerLineage') || {};
        
        // Record the transfer in lineage
        transferResult.destinationContainers.forEach(destId => {
            if (!lineage[destId]) {
                lineage[destId] = [];
            }
            
            lineage[destId].push({
                sourceContainer: transferResult.sourceContainerId,
                transferDate: new Date().toISOString(),
                transferType: transferResult.type,
                samplesReceived: transferResult.transferredSamples.filter(s => s.containerId === destId).length
            });
        });
        
        StateManager.setState('containerLineage', lineage);
    }

    // Add transfer to history
    function addToTransferHistory(transferResult) {
        const history = StateManager.getState('transferHistory') || [];
        
        const historyEntry = {
            id: generateTransferHistoryId(),
            timestamp: new Date().toISOString(),
            type: transferResult.type,
            sourceContainer: transferResult.sourceContainerId,
            destinationContainers: transferResult.destinationContainers,
            samplesTransferred: transferResult.samplesTransferred,
            splitCount: transferResult.splitCount || 1
        };
        
        history.unshift(historyEntry); // Add to beginning
        
        // Keep only last 50 transfers
        if (history.length > 50) {
            history.splice(50);
        }
        
        StateManager.setState('transferHistory', history);
        
        // Update transfer history display
        updateTransferHistoryDisplay();
    }

    // Generate unique transfer history ID
    function generateTransferHistoryId() {
        return 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Update transfer history display
    function updateTransferHistoryDisplay() {
        const history = StateManager.getState('transferHistory') || [];
        const historyElement = document.getElementById('transferHistoryList');
        const historySection = document.getElementById('transferHistory');
        
        if (!historyElement) return;
        
        if (history.length === 0) {
            UIUtils.showElement('transferHistory', false);
            return;
        }
        
        // Show history section
        UIUtils.showElement('transferHistory', true);
        
        // Build history HTML
        const historyHTML = history.slice(0, 10).map(entry => `
            <div class="transfer-history-item">
                <div class="transfer-history-header">
                    <span class="transfer-type">${entry.type === 'split' ? '🌱 Split' : '📦 Single'}</span>
                    <span class="transfer-date">${new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div class="transfer-history-details">
                    Container ${entry.sourceContainer} → ${entry.destinationContainers.join(', ')} 
                    (${entry.samplesTransferred} samples)
                </div>
            </div>
        `).join('');
        
        historyElement.innerHTML = historyHTML;
    }

    // Update UI after successful transfer
    function updateUIAfterTransfer(transferResult) {
        // Update stats
        UIUtils.updateStats();
        
        // Show success feedback
        const feedbackElement = document.getElementById('transferFeedback');
        if (feedbackElement) {
            feedbackElement.innerHTML = `
                <div class="success-feedback">
                    ✅ <strong>Transfer Complete!</strong><br>
                    ${transferResult.samplesTransferred} samples transferred from container ${transferResult.sourceContainerId}
                    to container(s) ${transferResult.destinationContainers.join(', ')}
                </div>
            `;
            feedbackElement.className = 'scan-feedback success';
        }
        
        // Focus source input for next transfer
        setTimeout(() => {
            const sourceInput = document.getElementById('sourceContainerInput');
            if (sourceInput) {
                sourceInput.focus();
            }
        }, 100);
    }

    // Clear transfer state after successful transfer
    function clearTransferState() {
        // Reset transfer state but keep mode
        const currentMode = StateManager.getState('transferState.mode');
        const currentSplitCount = StateManager.getState('transferState.splitCount');
        
        StateManager.resetTransferState();
        StateManager.setState('transferState.mode', currentMode);
        StateManager.setState('transferState.splitCount', currentSplitCount);
        
        // Clear input manager state
        if (window.TransferInputManager) {
            TransferInputManager.clearInputs();
        }
    }

    // Preview split operation
    function previewSplit() {
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const splitCount = StateManager.getState('transferState.splitCount');
        
        if (!sourceContainer || !sourceContainer.data) {
            return null;
        }
        
        // Calculate total tissue count from source container
        const totalTissueCount = sourceContainer.data.totalSamples; // This is now the correct tissue count
        const tissuesPerContainer = Math.floor(totalTissueCount / splitCount);
        const remainderTissues = totalTissueCount % splitCount;
        
        const preview = [];
        for (let i = 0; i < splitCount; i++) {
            const tissuesInThisContainer = tissuesPerContainer + (i < remainderTissues ? 1 : 0);
            preview.push({
                containerIndex: i + 1,
                sampleCount: tissuesInThisContainer
            });
        }
        
        return {
            totalSamples: totalTissueCount, // Now shows actual tissue count
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
