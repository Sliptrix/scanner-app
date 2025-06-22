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
        
        // Update summary with smart suggestions
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const smartSuggestions = generateSmartSuggestions(sourceContainer);
        
        summaryElement.innerHTML = `
            <div class="split-summary-content">
                <strong>${preview.totalSamples}</strong> samples will be divided into 
                <strong>${preview.splitCount}</strong> new containers
            </div>
            ${smartSuggestions.length > 0 ? `
                <div class="smart-suggestions">
                    <div class="suggestions-header">💡 Smart Suggestions:</div>
                    ${smartSuggestions.map(suggestion => `
                        <button class="suggestion-btn" onclick="applySuggestion(${suggestion.count})">
                            ${suggestion.label} (${suggestion.count} containers)
                        </button>
                    `).join('')}
                </div>
            ` : ''}
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
        const mode = StateManager.getState('transferState.mode');
        
        if (!sourceContainer || !sourceContainer.data) {
            return { valid: false, message: 'Source container must be specified and found in inventory' };
        }
        
        if (mode === 'single') {
            if (!destContainer || !destContainer.id) {
                return { valid: false, message: 'Destination container must be specified for single transfer' };
            }
            
            // For single mode, destination should exist
            if (!destContainer.exists) {
                return { valid: false, message: 'Destination container not found in inventory for single transfer' };
            }
        } else if (mode === 'split') {
            // Split mode only requires source container - destinations are auto-generated
            const splitCount = StateManager.getState('transferState.splitCount');
            if (!splitCount || splitCount < 2) {
                return { valid: false, message: 'Split count must be at least 2 for split transfer' };
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

    // Generate smart suggestions based on sample count
    function generateSmartSuggestions(sourceContainer) {
        if (!sourceContainer || !sourceContainer.data) {
            return [];
        }
        
        const totalSamples = sourceContainer.data.totalSamples;
        const suggestions = [];
        
        // Suggest equal distribution options
        if (totalSamples >= 2) {
            suggestions.push({ count: 2, label: '2-way split' });
        }
        if (totalSamples >= 3) {
            suggestions.push({ count: 3, label: '3-way split' });
        }
        if (totalSamples >= 4) {
            suggestions.push({ count: 4, label: '4-way split' });
        }
        
        // Suggest one container per sample (if reasonable)
        if (totalSamples > 1 && totalSamples <= 10) {
            suggestions.push({ count: totalSamples, label: '1 sample per container' });
        }
        
        // Suggest half split
        if (totalSamples >= 4 && totalSamples % 2 === 0) {
            suggestions.push({ count: totalSamples / 2, label: '2 samples per container' });
        }
        
        return suggestions.filter(s => s.count >= 2 && s.count <= 10);
    }
    
    // Apply a suggestion (called from UI)
    function applySuggestion(count) {
        StateManager.setState('transferState.splitCount', count);
        updateSplitCountDisplay();
        updateSplitPreview();
        NotificationSystem.info(`Split count set to ${count} containers`);
    }
    
    // Make applySuggestion available globally
    window.applySuggestion = applySuggestion;

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
        updateSplitPreview,
        generateSmartSuggestions,
        applySuggestion
    };

})();
