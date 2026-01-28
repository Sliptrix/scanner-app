// Transfer Main Module - Phase 5: Container Transfer Feature
// Main coordinator for container transfer functionality

window.ContainerTransfer = (function() {
    'use strict';

    function initialize() {
        console.log('ContainerTransfer module initializing...');

        if (window.TransferInputManager) {
            TransferInputManager.initialize();
        }
        if (window.TransferProcessor) {
            TransferProcessor.initialize();
        }

        setupInitialState();
        console.log('ContainerTransfer module initialized');
    }

    function setupInitialState() {
        const transferState = StateManager.getState('transferState');
        if (!transferState) {
            StateManager.setState('transferState', {
                mode: 'single',
                splitCount: 1,
                sourceContainer: null,
                discardCount: 0,
                discardReason: ''
            });
        }

        if (window.TransferProcessor) {
            TransferProcessor.updateTransferHistoryDisplay();
        }
    }

    function handleSourceInput(containerId) {
        if (window.TransferInputManager) {
            return TransferInputManager.processSourceContainer(containerId);
        }
        return false;
    }

    function processTransfer() {
        if (window.TransferProcessor) {
            return TransferProcessor.processTransfer();
        }
        return false;
    }

    function handleModeChange(mode) {
        StateManager.setState('transferState.mode', mode);
        if (window.TransferInputManager) {
            TransferInputManager.updateTransferPreview();
            TransferInputManager.updateTransferButtonState();
        }
    }

    function handleSplitCountChange(newCount) {
        StateManager.setState('transferState.splitCount', newCount);

        const splitCountEl = document.getElementById('splitCount');
        if (splitCountEl) splitCountEl.textContent = newCount;

        const decreaseBtn = document.getElementById('decreaseBtn');
        const increaseBtn = document.getElementById('increaseBtn');
        if (decreaseBtn) decreaseBtn.disabled = newCount <= 1;
        if (increaseBtn) increaseBtn.disabled = newCount >= 10;

        if (window.TransferInputManager) {
            TransferInputManager.updateTransferPreview();
            TransferInputManager.updateTransferButtonState();
        }
    }

    function clearTransfer() {
        StateManager.resetTransferState();
        StateManager.setState('transferState.splitCount', 1);
        StateManager.setState('transferState.discardCount', 0);
        StateManager.setState('transferState.discardReason', '');

        if (window.TransferInputManager) {
            TransferInputManager.clearInputs();
        }

        const feedbackEl = document.getElementById('transferFeedback');
        if (feedbackEl) {
            feedbackEl.textContent = 'Scan a source container to begin';
            feedbackEl.className = 'scan-feedback';
        }

        NotificationSystem.info('Transfer cleared');
    }

    function activateTransferMode() {
        const sourceInput = document.getElementById('sourceContainerInput');
        if (sourceInput) sourceInput.focus();
    }

    function applySuggestion(count) {
        handleSplitCountChange(count);
        NotificationSystem.info(`Set to ${count} container${count > 1 ? 's' : ''}`);
    }

    window.applySuggestion = applySuggestion;

    return {
        initialize,
        handleSourceInput,
        processTransfer,
        handleModeChange,
        handleSplitCountChange,
        clearTransfer,
        activateTransferMode,
        applySuggestion
    };

})();
