// Transfer Main Module - Phase 5: Container Transfer Feature
// Main coordinator for container transfer functionality including tissue splitting

window.ContainerTransfer = (function() {
    'use strict';

    // Initialize the transfer system
    function initialize() {
        console.log('ContainerTransfer module initializing...');
        
        // Initialize sub-modules
        if (window.TransferInputManager) {
            TransferInputManager.initialize();
        }
        
        if (window.TransferProcessor) {
            TransferProcessor.initialize();
        }
        
        // Setup initial state
        setupInitialState();
        
        // Setup UI event handlers
        setupUIHandlers();
        
        console.log('ContainerTransfer module initialized');
    }

    // Setup initial transfer state
    function setupInitialState() {
        // Ensure transfer state exists
        const transferState = StateManager.getState('transferState');
        if (!transferState) {
            StateManager.setState('transferState', {
                mode: 'single',
                splitCount: 2,
                sourceContainer: null,
                destContainer: null
            });
        }

        // Update UI to reflect current state
        updateModeDisplay();
        updateSplitCountDisplay();
        
        // Load and display transfer history
        if (window.TransferProcessor) {
            TransferProcessor.updateTransferHistoryDisplay();
        }
    }

    // Setup UI event handlers specific to transfer functionality
    function setupUIHandlers() {
        // Split count adjustment handlers are already in main.js
        // Preview updates for split mode
        setupSplitPreview();
    }

    // Setup split preview functionality
    function setupSplitPreview() {
        // Listen for split count changes to update preview
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.target.id === 'splitCount') {
                    updateSplitPreview();
                }
            });
        });

        const splitCountElement = document.getElementById('splitCount');
        if (splitCountElement) {
            observer.observe(splitCountElement, { childList: true, subtree: true });
        }
    }

    // Update split preview display
    function updateSplitPreview() {
        const previewElement = document.getElementById('splitPreview');
        const summaryElement = document.getElementById('splitSummary');
        const containersList = document.getElementById('newContainersList');
        
        if (!previewElement || !summaryElement || !containersList) {
            return;
        }

        const preview = TransferProcessor.previewSplit();
        
        if (!preview) {
            UIUtils.showElement('splitPreview', false);
            return;
        }

        // Show preview
        UIUtils.showElement('splitPreview', true);
        
        // Update summary
        summaryElement.innerHTML = `
            <div class="split-summary-content">
                <strong>${preview.totalSamples}</strong> samples will be divided into 
                <strong>${preview.splitCount}</strong> new containers
            </div>
        `;

        // Update containers list
        const containersHTML = preview.containers.map((container, index) => `
            <div class="new-container-item">
                <span class="container-label">Container ${StateManager.getState('highestContainerId') + index + 1}:</span>
                <span class="sample-count">${container.sampleCount} samples</span>
            </div>
        `).join('');

        containersList.innerHTML = `
            <div class="new-containers-header">New Containers:</div>
            ${containersHTML}
        `;
    }

    // Handle source container input (called from main.js)
    function handleSourceInput(containerId) {
        if (window.TransferInputManager) {
            const success = TransferInputManager.processSourceContainer(containerId);
            if (success) {
                updateSplitPreview();
            }
            return success;
        }
        return false;
    }

    // Handle destination container input (called from main.js)
    function handleDestInput(containerId) {
        if (window.TransferInputManager) {
            return TransferInputManager.processDestContainer(containerId);
        }
        return false;
    }

    // Process transfer (called from main.js)
    function processTransfer() {
        if (window.TransferProcessor) {
            return TransferProcessor.processTransfer();
        }
        return false;
    }

    // Handle transfer mode change (called from main.js)
    function handleModeChange(mode) {
        StateManager.setState('transferState.mode', mode);
        updateModeDisplay();
        
        // Clear destination when switching modes
        StateManager.setState('transferState.destContainer', null);
        UIUtils.clearInput('destContainerInput');
        UIUtils.updateContent('destContainerValue', '-');
        UIUtils.removeClass('destContainer', 'filled');
        
        // Update preview
        updateSplitPreview();
        
        // Update transfer button state
        if (window.TransferInputManager) {
            TransferInputManager.updateTransferButtonState();
        }
    }

    // Handle split count adjustment (called from main.js)
    function handleSplitCountChange(newCount) {
        StateManager.setState('transferState.splitCount', newCount);
        updateSplitCountDisplay();
        updateSplitPreview();
    }

    // Update mode display
    function updateModeDisplay() {
        const mode = StateManager.getState('transferState.mode');
        
        // Update UI elements
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
    }

    // Update split count display
    function updateSplitCountDisplay() {
        const splitCount = StateManager.getState('transferState.splitCount');
        UIUtils.updateContent('splitCount', splitCount);
        
        // Update button states
        const decreaseBtn = document.getElementById('decreaseBtn');
        const increaseBtn = document.getElementById('increaseBtn');
        
        if (decreaseBtn) decreaseBtn.disabled = splitCount <= 2;
        if (increaseBtn) increaseBtn.disabled = splitCount >= 10;
    }

    // Clear transfer (called from main.js)
    function clearTransfer() {
        // Reset transfer state but preserve mode
        const currentMode = StateManager.getState('transferState.mode');
        const currentSplitCount = StateManager.getState('transferState.splitCount');
        
        StateManager.resetTransferState();
        StateManager.setState('transferState.mode', currentMode);
        StateManager.setState('transferState.splitCount', currentSplitCount);
        
        // Clear input manager
        if (window.TransferInputManager) {
            TransferInputManager.clearInputs();
        }
        
        // Clear feedback
        const feedbackElement = document.getElementById('transferFeedback');
        if (feedbackElement) {
            feedbackElement.textContent = 'Transfer feedback will appear here';
            feedbackElement.className = 'scan-feedback';
        }
        
        // Hide split preview
        UIUtils.showElement('splitPreview', false);
        
        NotificationSystem.info('Transfer cleared');
    }

    // Switch to transfer mode (called when mode button is clicked)
    function activateTransferMode() {
        // Focus source input
        const sourceInput = document.getElementById('sourceContainerInput');
        if (sourceInput) {
            sourceInput.focus();
        }
        
        // Update split preview if in split mode
        updateSplitPreview();
    }

    // Validate transfer readiness
    function validateTransferReadiness() {
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const destContainer = StateManager.getState('transferState.destContainer');
        
        if (!sourceContainer || !sourceContainer.data) {
            return { valid: false, message: 'Source container must be specified and found in inventory' };
        }
        
        if (!destContainer || !destContainer.id) {
            return { valid: false, message: 'Destination container must be specified' };
        }
        
        const mode = StateManager.getState('transferState.mode');
        if (mode === 'single') {
            // For single mode, destination should exist
            if (!destContainer.exists) {
                return { valid: false, message: 'Destination container not found in inventory for single transfer' };
            }
        }
        
        return { valid: true, message: 'Transfer ready' };
    }

    // Get transfer summary for confirmation
    function getTransferSummary() {
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const destContainer = StateManager.getState('transferState.destContainer');
        const mode = StateManager.getState('transferState.mode');
        const splitCount = StateManager.getState('transferState.splitCount');
        
        if (!sourceContainer || !destContainer) {
            return null;
        }
        
        const summary = {
            sourceContainerId: sourceContainer.id,
            sourceSampleCount: sourceContainer.data ? sourceContainer.data.totalSamples : 0,
            mode: mode,
            destinationInfo: null
        };
        
        if (mode === 'single') {
            summary.destinationInfo = {
                containerId: destContainer.id,
                exists: destContainer.exists,
                currentSamples: destContainer.data ? destContainer.data.totalSamples : 0
            };
        } else {
            summary.destinationInfo = {
                splitCount: splitCount,
                newContainers: splitCount
            };
        }
        
        return summary;
    }

    // Public API
    return {
        initialize,
        handleSourceInput,
        handleDestInput,
        processTransfer,
        handleModeChange,
        handleSplitCountChange,
        clearTransfer,
        activateTransferMode,
        validateTransferReadiness,
        getTransferSummary,
        updateSplitPreview
    };

})();
