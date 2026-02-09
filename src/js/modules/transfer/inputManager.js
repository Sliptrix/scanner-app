// Transfer Input Manager - Phase 5: Container Transfer Feature
// Handles source container input, discard controls, and transfer preview

window.TransferInputManager = (function() {
    'use strict';

    // Configuration
    const config = {
        minContainerId: 1,
        maxContainerId: 999999,
        containerIdPattern: /^\d{1,6}$/
    };

    function initialize() {
        console.log('TransferInputManager initialized');
        setupEventListeners();
    }

    function setupEventListeners() {
        const sourceInput = document.getElementById('sourceContainerInput');
        if (sourceInput) {
            sourceInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const val = this.value.trim();
                    if (val) processSourceContainer(val);
                }
            });
            sourceInput.addEventListener('blur', function() {
                const val = this.value.trim();
                if (val) processSourceContainer(val);
            });
        }
    }

    // Process source container
    function processSourceContainer(containerId) {
        if (!validateContainerId(containerId)) return false;

        const containerData = findContainerInInventory(containerId);
        if (!containerData) {
            NotificationSystem.error(`Container ${containerId} not found in inventory`);
            return false;
        }

        StateManager.setState('transferState.sourceContainer', {
            id: containerId,
            data: containerData
        });

        // Reset discard state
        StateManager.setState('transferState.discardCount', 0);
        StateManager.setState('transferState.discardReason', '');

        // Set default split count to 1
        StateManager.setState('transferState.splitCount', 1);

        // Show source info
        const sourceInfo = document.getElementById('sourceInfo');
        const valueEl = document.getElementById('sourceContainerValue');
        const summaryEl = document.getElementById('sourceSummary');
        const countEl = document.getElementById('sourceSampleCountNumber');

        if (sourceInfo) sourceInfo.style.display = 'block';
        if (valueEl) valueEl.textContent = `Container ${containerId}`;
        if (summaryEl) {
            summaryEl.textContent = `${containerData.owner} | ${containerData.strains.join(', ')} | ${containerData.stage}`;
        }
        if (countEl) countEl.textContent = containerData.totalSamples;

        // Show step 2
        const step2 = document.getElementById('transferStep2');
        if (step2) step2.style.display = 'block';

        // Update split count display
        const splitCountEl = document.getElementById('splitCount');
        if (splitCountEl) splitCountEl.textContent = '1';

        // Populate plant data dropdowns
        showPlantDataUpdatePanel(containerData);

        // Show smart suggestions
        displaySmartSuggestions(containerData);

        // Update preview
        updateTransferPreview();
        updateTransferButtonState();

        NotificationSystem.success(`Source container ${containerId} loaded (${containerData.totalSamples} tissues)`);
        return true;
    }

    // Validate container ID format
    function validateContainerId(containerId) {
        const id = String(containerId).trim();
        if (!id) {
            NotificationSystem.error('Container ID cannot be empty');
            return false;
        }
        if (!config.containerIdPattern.test(id)) {
            NotificationSystem.error('Container ID must be 1-6 digits');
            return false;
        }
        return true;
    }

    // Find container in inventory
    function findContainerInInventory(containerId) {
        const inventory = StateManager.getState('inventory');
        const numericId = parseInt(containerId);
        const containers = inventory.filter(item =>
            item.containerId === containerId ||
            item.containerId === numericId ||
            parseInt(item.containerId) === numericId
        );

        if (containers.length === 0) return null;

        let totalTissueCount = 0;
        containers.forEach(item => {
            totalTissueCount += parseInt(item.tissueCount) || 1;
        });

        return {
            containerId: containerId,
            totalSamples: totalTissueCount,
            barcodeEntries: containers.length,
            strains: [...new Set(containers.map(c => c.strain || 'Unknown'))],
            samples: containers,
            owner: containers[0]?.owner || 'Unknown',
            stage: containers[0]?.stage || 'Unknown',
            media: containers[0]?.media || containers[0]?.mediaType || 'Unknown'
        };
    }

    // Display smart split suggestions
    function displaySmartSuggestions(containerData) {
        const suggestionsEl = document.getElementById('smartSuggestions');
        if (!suggestionsEl) return;

        const total = containerData.totalSamples;
        if (total < 2) {
            suggestionsEl.style.display = 'none';
            return;
        }

        const buttons = [];
        [1, 2, 3, 4].forEach(n => {
            if (n <= total) {
                const perContainer = Math.ceil((total) / n);
                buttons.push(`<button onclick="window.ContainerTransfer.applySuggestion(${n})" style="padding: 6px 14px; border: 1px solid #93c5fd; border-radius: 6px; background: white; cursor: pointer; font-size: 0.85rem;">${n === 1 ? '1 container' : n + '-way'} (${perContainer}/ea)</button>`);
            }
        });

        if (total > 1 && total <= 10) {
            buttons.push(`<button onclick="window.ContainerTransfer.applySuggestion(${total})" style="padding: 6px 14px; border: 1px solid #93c5fd; border-radius: 6px; background: white; cursor: pointer; font-size: 0.85rem;">1 per container</button>`);
        }

        suggestionsEl.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">${buttons.join('')}</div>`;
        suggestionsEl.style.display = 'block';
    }

    // Update the live transfer preview
    function updateTransferPreview() {
        const previewEl = document.getElementById('transferPreview');
        if (!previewEl) return;

        const source = StateManager.getState('transferState.sourceContainer');
        if (!source || !source.data) {
            previewEl.style.display = 'none';
            return;
        }

        const total = source.data.totalSamples;
        const splitCount = StateManager.getState('transferState.splitCount') || 1;
        const discardCount = StateManager.getState('transferState.discardCount') || 0;
        const transferable = total - discardCount;

        if (transferable <= 0) {
            previewEl.innerHTML = '<span style="color: #dc2626; font-weight: 600;">Cannot discard all tissues</span>';
            previewEl.style.display = 'block';
            return;
        }

        const perContainer = Math.floor(transferable / splitCount);
        const remainder = transferable % splitCount;
        const distribution = remainder > 0
            ? `${perContainer}-${perContainer + 1} tissues each`
            : `${perContainer} tissues each`;

        let html = `<strong>${total}</strong> tissues`;
        if (discardCount > 0) {
            html += ` → <span style="color: #dc2626;"><strong>${discardCount}</strong> discarded</span>`;
        }
        html += ` → <strong>${splitCount}</strong> new container${splitCount > 1 ? 's' : ''} (${distribution})`;

        previewEl.innerHTML = html;
        previewEl.style.display = 'block';
    }

    // Update transfer button state
    function updateTransferButtonState() {
        const transferBtn = document.getElementById('transferBtn');
        const source = StateManager.getState('transferState.sourceContainer');

        if (transferBtn) {
            const canTransfer = source && source.data;
            transferBtn.disabled = !canTransfer;

            if (canTransfer) {
                const splitCount = StateManager.getState('transferState.splitCount') || 1;
                const discardCount = StateManager.getState('transferState.discardCount') || 0;
                let label = `Create ${splitCount} Container${splitCount > 1 ? 's' : ''}`;
                if (discardCount > 0) label += ` + Discard ${discardCount}`;
                transferBtn.textContent = label;
            } else {
                transferBtn.textContent = 'Process Transfer';
            }
        }
    }

    // SECURITY: Sanitize helper for dropdown options
    function sanitizeForOption(str) {
        if (!str) return '';
        return String(str).replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
    }

    // Populate stage dropdown
    function populateStageOptions(currentStage) {
        const stageSelect = document.getElementById('updateStage');
        if (!stageSelect) return;

        // SECURITY: Sanitize stage name before inserting into HTML
        const safeStage = sanitizeForOption(currentStage);
        stageSelect.innerHTML = `<option value="keep-same">Keep Same (${safeStage})</option>`;
        const stagesData = StateManager.getState('stagesTable');
        if (stagesData && typeof stagesData === 'object') {
            Object.entries(stagesData).forEach(([key, value]) => {
                if (value !== currentStage) {
                    const safeKey = sanitizeForOption(key);
                    const safeValue = sanitizeForOption(value);
                    stageSelect.innerHTML += `<option value="${safeKey}">${safeValue}</option>`;
                }
            });
        }
    }

    // Populate media dropdown
    function populateMediaOptions(currentMedia) {
        const mediaSelect = document.getElementById('updateMedia');
        if (!mediaSelect) return;

        // SECURITY: Sanitize media name before inserting into HTML
        const safeMedia = sanitizeForOption(currentMedia);
        mediaSelect.innerHTML = `<option value="keep-same">Keep Same (${safeMedia})</option>`;
        const mediaData = StateManager.getState('mediaTable');
        if (mediaData && typeof mediaData === 'object') {
            Object.entries(mediaData).forEach(([key, value]) => {
                if (value !== currentMedia) {
                    const safeKey = sanitizeForOption(key);
                    const safeValue = sanitizeForOption(value);
                    mediaSelect.innerHTML += `<option value="${safeKey}">${safeValue}</option>`;
                }
            });
        }
    }

    // Show plant data update panel
    function showPlantDataUpdatePanel(containerData) {
        const firstSample = containerData.samples[0];
        populateStageOptions(firstSample.stage);
        populateMediaOptions(firstSample.mediaType || firstSample.media);

        const dateInput = document.getElementById('updateDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        const notesInput = document.getElementById('updateNotes');
        if (notesInput) notesInput.value = '';
    }

    // Get updated plant data
    function getUpdatedPlantData() {
        const stageSelect = document.getElementById('updateStage');
        const mediaSelect = document.getElementById('updateMedia');
        const dateInput = document.getElementById('updateDate');
        const notesInput = document.getElementById('updateNotes');

        const updates = {};

        if (stageSelect && stageSelect.value !== 'keep-same') {
            const stagesData = StateManager.getState('stagesTable');
            updates.stage = stagesData[stageSelect.value];
            updates.stageId = stageSelect.value;
        }

        if (mediaSelect && mediaSelect.value !== 'keep-same') {
            const mediaData = StateManager.getState('mediaTable');
            updates.mediaType = mediaData[mediaSelect.value];
            updates.mediaId = mediaSelect.value;
        }

        if (dateInput && dateInput.value) {
            updates.date = dateInput.value;
        }

        if (notesInput && notesInput.value.trim()) {
            updates.notes = notesInput.value.trim();
        }

        return updates;
    }

    // Update workflow step (kept for compatibility)
    function updateWorkflowStep(activeStep) {
        // No-op in new UI — steps are shown/hidden directly
    }

    // Clear all inputs
    function clearInputs() {
        const sourceInput = document.getElementById('sourceContainerInput');
        if (sourceInput) sourceInput.value = '';

        const sourceInfo = document.getElementById('sourceInfo');
        if (sourceInfo) sourceInfo.style.display = 'none';

        const step2 = document.getElementById('transferStep2');
        if (step2) step2.style.display = 'none';

        const discardToggle = document.getElementById('discardToggle');
        if (discardToggle) discardToggle.checked = false;

        const discardPanel = document.getElementById('discardPanel');
        if (discardPanel) discardPanel.style.display = 'none';

        const discardCountEl = document.getElementById('discardCount');
        if (discardCountEl) discardCountEl.textContent = '0';

        const discardReasonEl = document.getElementById('discardReason');
        if (discardReasonEl) discardReasonEl.value = '';

        const previewEl = document.getElementById('transferPreview');
        if (previewEl) previewEl.style.display = 'none';

        StateManager.setState('transferState.sourceContainer', null);
        StateManager.setState('transferState.discardCount', 0);
        StateManager.setState('transferState.discardReason', '');

        updateTransferButtonState();
    }

    // Public API
    return {
        initialize,
        processSourceContainer,
        validateContainerId,
        findContainerInInventory,
        clearInputs,
        updateTransferButtonState,
        getUpdatedPlantData,
        updateWorkflowStep,
        updateTransferPreview
    };

})();
