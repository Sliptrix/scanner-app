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
        const destContainer = StateManager.getState('transferState.destContainer');

        if (!sourceContainer || !destContainer) {
            NotificationSystem.error('Both source and destination containers must be specified');
            return false;
        }

        if (!sourceContainer.data || !sourceContainer.data.samples) {
            NotificationSystem.error('Source container has no samples to transfer');
            return false;
        }

        try {
            let result;
            if (transferMode === 'single') {
                result = processSingleTransfer(sourceContainer, destContainer);
            } else {
                result = processSplitTransfer(sourceContainer, destContainer);
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

    // Process single container transfer
    function processSingleTransfer(sourceContainer, destContainer) {
        const samples = sourceContainer.data.samples;
        const destContainerId = destContainer.id;
        
        // Create new container ID if destination doesn't exist
        let finalDestId = destContainerId;
        if (!destContainer.exists) {
            finalDestId = ensureContainerExists(destContainerId);
        }

        // Transfer all samples to destination
        const transferredSamples = samples.map(sample => ({
            ...sample,
            containerId: finalDestId,
            transferDate: new Date().toISOString(),
            transferSource: sourceContainer.id,
            transferType: 'single'
        }));

        return {
            success: true,
            type: 'single',
            sourceContainerId: sourceContainer.id,
            destinationContainers: [finalDestId],
            transferredSamples: transferredSamples,
            samplesTransferred: samples.length,
            message: `Successfully transferred ${samples.length} samples from container ${sourceContainer.id} to container ${finalDestId}`
        };
    }

    // Process split transfer (tissue splitting)
    function processSplitTransfer(sourceContainer, destContainer) {
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
        const samplesPerContainer = Math.floor(samples.length / containerIds.length);
        const remainderSamples = samples.length % containerIds.length;

        let sampleIndex = 0;
        
        containerIds.forEach((containerId, containerIndex) => {
            // Calculate how many samples this container gets
            const samplesForThisContainer = samplesPerContainer + (containerIndex < remainderSamples ? 1 : 0);
            
            // Assign samples to this container
            for (let i = 0; i < samplesForThisContainer; i++) {
                if (sampleIndex < samples.length) {
                    const sample = samples[sampleIndex];
                    distributedSamples.push({
                        ...sample,
                        containerId: containerId,
                        transferDate: new Date().toISOString(),
                        transferSource: sourceId,
                        transferType: 'split',
                        originalSampleIndex: sampleIndex
                    });
                    sampleIndex++;
                }
            }
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
        
        // Remove samples from source container
        const filteredInventory = currentInventory.filter(item => 
            item.containerId !== transferResult.sourceContainerId
        );
        
        // Add transferred samples to inventory
        const newInventory = [...filteredInventory, ...transferResult.transferredSamples];
        
        // Update state
        StateManager.setState('inventory', newInventory);
        
        // Update lineage tracking
        updateContainerLineage(transferResult);
        
        // Rebuild inventory table
        UIUtils.rebuildInventoryTable();
        
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
        
        const samples = sourceContainer.data.samples;
        const samplesPerContainer = Math.floor(samples.length / splitCount);
        const remainderSamples = samples.length % splitCount;
        
        const preview = [];
        for (let i = 0; i < splitCount; i++) {
            const samplesInThisContainer = samplesPerContainer + (i < remainderSamples ? 1 : 0);
            preview.push({
                containerIndex: i + 1,
                sampleCount: samplesInThisContainer
            });
        }
        
        return {
            totalSamples: samples.length,
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
