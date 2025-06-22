// Transfer Input Manager - Phase 5: Container Transfer Feature
// Handles source and destination container input validation and processing

window.TransferInputManager = (function() {
    'use strict';

    // Configuration
    const config = {
        minContainerId: 1,
        maxContainerId: 99999,
        containerIdPattern: /^\d{1,5}$/
    };

    // Initialize the input manager
    function initialize() {
        console.log('TransferInputManager initialized');
        setupEventListeners();
    }

    // Setup event listeners for transfer inputs
    function setupEventListeners() {
        const sourceInput = document.getElementById('sourceContainerInput');
        const destInput = document.getElementById('destContainerInput');

        if (sourceInput) {
            sourceInput.addEventListener('blur', validateSourceInput);
            sourceInput.addEventListener('input', handleSourceInputChange);
        }

        if (destInput) {
            destInput.addEventListener('blur', validateDestInput);
            destInput.addEventListener('input', handleDestInputChange);
        }
    }

    // Handle source container input processing
    function processSourceContainer(containerId) {
        if (!validateContainerId(containerId)) {
            return false;
        }

        // Look up container in inventory
        const containerData = findContainerInInventory(containerId);
        
        if (!containerData) {
            NotificationSystem.error(`Container ${containerId} not found in inventory`);
            updateSourceDisplay(containerId, null);
            return false;
        }

        // Update state and UI
        StateManager.setState('transferState.sourceContainer', {
            id: containerId,
            data: containerData
        });

        updateSourceDisplay(containerId, containerData);
        
        // Trigger smart suggestions display if in split mode
        const transferMode = StateManager.getState('transferState.mode');
        if (transferMode === 'split' && window.ContainerTransfer) {
            ContainerTransfer.updateSplitPreview();
        }
        
        NotificationSystem.success(`Source container ${containerId} loaded`);
        
        // Focus destination input if empty
        const destInput = document.getElementById('destContainerInput');
        if (destInput && !destInput.value.trim()) {
            destInput.focus();
        }

        return true;
    }

    // Handle destination container input processing
    function processDestContainer(containerId) {
        if (!validateContainerId(containerId)) {
            return false;
        }

        // Check if destination already exists (for single mode)
        const transferMode = StateManager.getState('transferState.mode');
        const existingContainer = findContainerInInventory(containerId);
        
        if (transferMode === 'single') {
            if (!existingContainer) {
                NotificationSystem.error(`Destination container ${containerId} not found in inventory`);
                return false;
            }
        }

        // Update state and UI
        StateManager.setState('transferState.destContainer', {
            id: containerId,
            exists: !!existingContainer,
            data: existingContainer
        });

        updateDestDisplay(containerId, existingContainer, transferMode);
        NotificationSystem.success(`Destination container ${containerId} set`);

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
            NotificationSystem.error('Container ID must be 1-5 digits');
            return false;
        }

        const numId = parseInt(id);
        if (numId < config.minContainerId || numId > config.maxContainerId) {
            NotificationSystem.error(`Container ID must be between ${config.minContainerId} and ${config.maxContainerId}`);
            return false;
        }

        return true;
    }

    // Find container data in inventory
    function findContainerInInventory(containerId) {
        const inventory = StateManager.getState('inventory');
        const containers = inventory.filter(item => item.containerId === containerId);
        
        if (containers.length === 0) {
            return null;
        }

        // Group samples by strain for summary
        const strainGroups = {};
        containers.forEach(item => {
            const strain = item.strain || 'Unknown';
            if (!strainGroups[strain]) {
                strainGroups[strain] = [];
            }
            strainGroups[strain].push(item);
        });

        return {
            containerId: containerId,
            totalSamples: containers.length,
            strains: Object.keys(strainGroups),
            strainGroups: strainGroups,
            samples: containers,
            owner: containers[0]?.owner || 'Unknown',
            stage: containers[0]?.stage || 'Unknown',
            media: containers[0]?.media || 'Unknown'
        };
    }

    // Update source container display
    function updateSourceDisplay(containerId, containerData) {
        const valueElement = document.getElementById('sourceContainerValue');
        const summaryElement = document.getElementById('sourceSummary');
        const containerElement = document.getElementById('sourceContainer');

        if (valueElement) {
            valueElement.textContent = containerId;
        }

        if (containerData) {
            if (summaryElement) {
                summaryElement.innerHTML = `
                    <strong>${containerData.totalSamples}</strong> samples | 
                    <strong>${containerData.strains.length}</strong> strain(s) | 
                    Owner: <strong>${containerData.owner}</strong>
                `;
            }
            
            // Show prominent sample count
            const sampleCountElement = document.getElementById('sourceSampleCount');
            const sampleCountNumberElement = document.getElementById('sourceSampleCountNumber');
            if (sampleCountElement && sampleCountNumberElement) {
                sampleCountNumberElement.textContent = containerData.totalSamples;
                sampleCountElement.style.display = 'block';
            }
            
            UIUtils.addClass('sourceContainer', 'filled');
        } else {
            if (summaryElement) {
                summaryElement.textContent = 'Container not found in inventory';
            }
            
            // Hide sample count display
            const sampleCountElement = document.getElementById('sourceSampleCount');
            if (sampleCountElement) {
                sampleCountElement.style.display = 'none';
            }
            
            UIUtils.removeClass('sourceContainer', 'filled');
        }

        // Update transfer button state
        updateTransferButtonState();
    }

    // Update destination container display
    function updateDestDisplay(containerId, containerData, transferMode) {
        const valueElement = document.getElementById('destContainerValue');
        const summaryElement = document.getElementById('destSummary');

        if (valueElement) {
            valueElement.textContent = containerId;
        }

        if (transferMode === 'single') {
            if (containerData) {
                if (summaryElement) {
                    summaryElement.innerHTML = `
                        Existing: <strong>${containerData.totalSamples}</strong> samples | 
                        <strong>${containerData.strains.length}</strong> strain(s)
                    `;
                }
            } else {
                if (summaryElement) {
                    summaryElement.textContent = 'New container will be created';
                }
            }
        } else {
            // Split mode
            const splitCount = StateManager.getState('transferState.splitCount');
            if (summaryElement) {
                summaryElement.innerHTML = `Split into <strong>${splitCount}</strong> new containers`;
            }
        }

        UIUtils.addClass('destContainer', 'filled');
        updateTransferButtonState();
    }

    // Update transfer button enabled state
    function updateTransferButtonState() {
        const transferBtn = document.getElementById('transferBtn');
        const sourceContainer = StateManager.getState('transferState.sourceContainer');
        const destContainer = StateManager.getState('transferState.destContainer');
        const transferMode = StateManager.getState('transferState.mode');

        if (transferBtn) {
            let canTransfer = false;
            
            if (sourceContainer && sourceContainer.data) {
                if (transferMode === 'split') {
                    // Split mode only requires source container
                    canTransfer = true;
                } else {
                    // Single mode requires both source and destination
                    canTransfer = destContainer && destContainer.id;
                }
            }
            
            transferBtn.disabled = !canTransfer;
        }

        // Update single transfer count
        const singleCountElement = document.getElementById('singleTransferCount');
        if (singleCountElement && sourceContainer && sourceContainer.data) {
            singleCountElement.textContent = sourceContainer.data.totalSamples;
        }
    }

    // Event handlers
    function handleSourceInputChange(e) {
        // Clear previous state on input change
        StateManager.setState('transferState.sourceContainer', null);
        updateTransferButtonState();
    }

    function handleDestInputChange(e) {
        // Clear previous state on input change
        StateManager.setState('transferState.destContainer', null);
        updateTransferButtonState();
    }

    function validateSourceInput(e) {
        const input = e.target.value.trim();
        if (input) {
            processSourceContainer(input);
        }
    }

    function validateDestInput(e) {
        const input = e.target.value.trim();
        if (input) {
            processDestContainer(input);
        }
    }

    // Clear all transfer inputs
    function clearInputs() {
        UIUtils.clearInput('sourceContainerInput');
        UIUtils.clearInput('destContainerInput');
        StateManager.setState('transferState.sourceContainer', null);
        StateManager.setState('transferState.destContainer', null);
        
        updateSourceDisplay('-', null);
        updateDestDisplay('-', null, 'single');
        
        UIUtils.removeClass('sourceContainer', 'filled');
        UIUtils.removeClass('destContainer', 'filled');
        
        updateTransferButtonState();
    }

    // Public API
    return {
        initialize,
        processSourceContainer,
        processDestContainer,
        validateContainerId,
        findContainerInInventory,
        clearInputs,
        updateTransferButtonState
    };

})();
