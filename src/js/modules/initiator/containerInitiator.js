/**
 * Container Initiator Module
 * Allows quick creation of new containers with minimal input
 * Integrates with inventory management system
 */

window.ContainerInitiator = (function() {
    'use strict';

    // Private state
    let currentContainerId = null;
    let initialized = false;
    
    /**
     * Initialize the container initiator
     */
    function initialize() {
        try {
            console.log('🚀 ContainerInitiator module initializing...');
            
            // Check if StateManager is available
            if (!window.StateManager) {
                console.error('❌ StateManager not available!');
                return;
            }
            
            // Check if necessary global state exists
            if (!window.appState) {
                console.error('❌ window.appState not available!');
                return;
            }
            
            // Check if the necessary DOM elements exist
            const initiatorInput = document.getElementById('initiatorInput');
            const initiateBtn = document.getElementById('initiateBtn');
            const initiatorPrompt = document.getElementById('initiatorPrompt');
            const initiatorHint = document.getElementById('initiatorHint');
            const initiatorSummary = document.getElementById('initiatorSummary');
            const initiatorFeedback = document.getElementById('initiatorFeedback');
            
            console.log('🔍 DOM element check:');
            console.log('  initiatorInput:', !!initiatorInput, initiatorInput);
            console.log('  initiateBtn:', !!initiateBtn, initiateBtn);
            console.log('  initiatorPrompt:', !!initiatorPrompt, initiatorPrompt);
            console.log('  initiatorHint:', !!initiatorHint, initiatorHint);
            console.log('  initiatorSummary:', !!initiatorSummary, initiatorSummary);
            console.log('  initiatorFeedback:', !!initiatorFeedback, initiatorFeedback);
            
            // Check if critical elements are missing
            if (!initiatorInput || !initiateBtn) {
                console.error('❌ Critical DOM elements missing! Cannot initialize ContainerInitiator');
                console.error('  Missing initiatorInput:', !initiatorInput);
                console.error('  Missing initiateBtn:', !initiateBtn);
                return;
            }
            
            // Initialize state
            console.log('📊 Initializing initiator state...');
            const initialState = {
                currentStep: 'owner',
                owner: null,
                strain: null,
                media: null
            };
            
            try {
                StateManager.setState('initiatorState', initialState);
                console.log('📊 Initial state set:', StateManager.getState('initiatorState'));
            } catch (stateError) {
                console.error('❌ Error setting initial state:', stateError);
                return;
            }
            
            // Setup event listeners
            try {
                setupEventListeners();
            } catch (listenerError) {
                console.error('❌ Error setting up event listeners:', listenerError);
                return;
            }
            
            // Get the highest container ID for reference
            try {
                updateNextAvailableId();
            } catch (idError) {
                console.error('❌ Error updating container ID:', idError);
            }
            
            // Check data loading status
            console.log('📋 Checking data loading status...');
            console.log('  isDataLoaded:', window.appState.isDataLoaded);
            console.log('  inventory length:', window.appState.inventory?.length || 0);
            console.log('  ownersTable keys:', Object.keys(window.appState.ownersTable || {}));
            console.log('  strainsTable keys:', Object.keys(window.appState.strainsTable || {}));
            
            // Check if data is loaded, and if not, disable inputs
            if (!window.appState.isDataLoaded) {
                console.log('⏳ Data not loaded, disabling inputs and starting poll...');
                try {
                    disableInitiatorInputs('Waiting for data to load...');
                    // Start a polling loop to check when data is loaded
                    checkDataLoadedStatus();
                } catch (disableError) {
                    console.error('❌ Error disabling inputs:', disableError);
                }
            } else {
                console.log('✅ Data is loaded, enabling inputs...');
                try {
                    enableInitiatorInputs();
                } catch (enableError) {
                    console.error('❌ Error enabling inputs:', enableError);
                }
            }
            
            initialized = true;
            console.log('🚀 ContainerInitiator module initialized successfully');
            
        } catch (error) {
            console.error('❌ Fatal error initializing ContainerInitiator:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    /**
     * Check if data has been loaded, and enable inputs when it is
     */
    function checkDataLoadedStatus() {
        if (window.appState.isDataLoaded) {
            console.log('Data is now loaded, enabling initiator inputs');
            enableInitiatorInputs();
            return;
        }
        
        // Check again in 500ms
        setTimeout(checkDataLoadedStatus, 500);
    }
    
    /**
     * Set up event listeners for the initiator
     */
    function setupEventListeners() {
        console.log('🔧 Setting up Container Initiator event listeners...');
        
        const initiatorInput = document.getElementById('initiatorInput');
        if (initiatorInput) {
            console.log('✅ Found initiatorInput element, adding keypress listener');
            initiatorInput.addEventListener('keypress', function(e) {
                console.log('🔵 Keypress detected:', e.key);
                if (e.key === 'Enter') {
                    console.log('🔵 Enter key pressed, calling handleInitiatorInput');
                    handleInitiatorInput();
                }
            });
        } else {
            console.error('❌ initiatorInput element not found!');
        }
        
        const initiateBtn = document.getElementById('initiateBtn');
        if (initiateBtn) {
            console.log('✅ Found initiateBtn element, adding click listener');
            initiateBtn.addEventListener('click', function() {
                console.log('🔵 Button clicked, calling handleInitiatorInput');
                handleInitiatorInput();
            });
        } else {
            console.error('❌ initiateBtn element not found!');
        }
        
        console.log('🔧 Container Initiator event listeners setup complete');
    }
    
    /**
     * Disable initiator inputs while data is loading
     */
    function disableInitiatorInputs(message) {
        const input = document.getElementById('initiatorInput');
        const button = document.getElementById('initiateBtn');
        
        if (input) input.disabled = true;
        if (button) button.disabled = true;
        
        // Show loading message
        showFeedback(message, 'info');
    }
    
    /**
     * Enable initiator inputs after data is loaded
     */
    function enableInitiatorInputs() {
        const input = document.getElementById('initiatorInput');
        const button = document.getElementById('initiateBtn');
        
        if (input) input.disabled = false;
        if (button) button.disabled = false;
        
        // Reset to initial state and show ready message
        resetInitiator();
    }
    
    /**
     * Handle the initiator input
     */
    function handleInitiatorInput() {
        console.log('🔵 handleInitiatorInput called');
        
        const currentStep = StateManager.getState('initiatorState.currentStep');
        const inputValue = document.getElementById('initiatorInput')?.value?.trim();
        
        console.log('Current step:', currentStep);
        console.log('Input value:', inputValue);
        console.log('Current state:', StateManager.getState('initiatorState'));
        
        switch (currentStep) {
            case 'owner':
                console.log('Processing owner input...');
                processOwnerInput();
                break;
            case 'strain':
                console.log('Processing strain input...');
                processStrainInput();
                break;
            case 'media':
                console.log('Processing media input...');
                processMediaInput();
                break;
            case 'stage':
                console.log('Processing stage input...');
                processStageInput();
                break;
            case 'tissue':
                console.log('Processing tissue input...');
                processTissueInput();
                break;
            case 'date':
                console.log('Processing date input...');
                processDateInput();
                break;
            default:
                console.log('Invalid step, resetting initiator');
                // Reset to first step if invalid state
                resetInitiator();
        }
    }
    
    /**
     * Process owner input
     */
    function processOwnerInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input) {
            showFeedback('Please enter a valid owner ID', 'error');
            return;
        }
        
        // Check if owner exists in data
        if (window.appState.isDataLoaded) {
            const ownersTable = window.appState.ownersTable;
            const ownerExists = Object.keys(ownersTable).some(key => 
                key.toLowerCase() === input.toLowerCase());
            
            if (!ownerExists) {
                showFeedback(`Owner "${input}" not found in reference data`, 'warning');
                // Continue anyway since we can create new owners
            }
        }
        
        // Store the owner and move to strain step
        StateManager.setState('initiatorState.owner', input.toUpperCase());
        moveToStep('strain');
        
        // Update UI
        updateInitiatorUI();
        showFeedback(`Owner set to: ${input.toUpperCase()}`, 'success');
    }
    
    /**
     * Process strain input
     */
    function processStrainInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input) {
            showFeedback('Please enter a valid strain ID', 'error');
            return;
        }
        
        // Check if strain exists in data
        if (window.appState.isDataLoaded) {
            const strainsTable = window.appState.strainsTable;
            const strainExists = Object.keys(strainsTable).some(key => 
                key === input);
            
            if (!strainExists) {
                showFeedback(`Strain "${input}" not found in reference data`, 'warning');
                // Continue anyway since we can create new strains
            }
        }
        
        // Store the strain and move to media step
        StateManager.setState('initiatorState.strain', input);
        moveToStep('media');
        
        // Update UI
        updateInitiatorUI();
        showFeedback(`Strain set to: ${input}`, 'success');
    }
    
    /**
     * Process media input
     */
    function processMediaInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input && input !== '') {
            showFeedback('Invalid media type', 'error');
            return;
        }
        
        // Media is optional, check if it exists but don't require it
        if (input && window.appState.isDataLoaded) {
            const mediaTypesTable = window.appState.mediaTypesTable;
            const mediaExists = Object.keys(mediaTypesTable).some(key => 
                key.toLowerCase() === input.toLowerCase());
            
            if (!mediaExists) {
                showFeedback(`Media "${input}" not found in reference data`, 'warning');
                // Continue anyway since we can create new media types
            }
        }
        
        // Store the media (or empty string if none)
        StateManager.setState('initiatorState.media', input ? input.toUpperCase() : '');
        
        // Move to next step (stage)
        moveToStep('stage');
        updateInitiatorUI();
        showFeedback(`Media set to: ${input || 'None'}`, 'success');
    }
    
    /**
     * Process stage input
     */
    function processStageInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input) {
            showFeedback('Please enter a valid stage (1-9)', 'error');
            return;
        }
        
        if (!input.match(/^[1-9]$/)) {
            showFeedback('Stage must be a single digit between 1 and 9', 'error');
            return;
        }
        
        StateManager.setState('initiatorState.stage', input.toUpperCase());
        moveToStep('tissue');
        updateInitiatorUI();
        showFeedback(`Stage set to: ${input}`, 'success');
    }
    
    /**
     * Process tissue input
     */
    function processTissueInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input) {
            showFeedback('Please enter a valid tissue count', 'error');
            return;
        }
        
        if (!input.match(/^\d{1,2}$/) || parseInt(input) <= 0 || parseInt(input) > 99) {
            showFeedback('Tissue count must be between 1 and 99', 'error');
            return;
        }
        
        StateManager.setState('initiatorState.tissue', input);
        moveToStep('date');
        updateInitiatorUI();
        showFeedback(`Tissue count set to: ${input}`, 'success');
    }
    
    /**
     * Process date input
     */
    function processDateInput() {
        const input = document.getElementById('initiatorInput').value.trim();
        
        if (!input) {
            showFeedback('Please enter a valid date', 'error');
            return;
        }
        
        if (!input.match(/^\d{8}$/)) {
            showFeedback('Date must be in YYYYMMDD format', 'error');
            return;
        }
        
        StateManager.setState('initiatorState.date', input);
        
        // All fields collected - generate container and complete inventory entry
        generateContainer();
    }
    
    /**
     * Generate a new container with the provided information
     */
    function generateContainer() {
        // Get the owner, strain, and media from state
        const owner = StateManager.getState('initiatorState.owner');
        const strain = StateManager.getState('initiatorState.strain');
        const media = StateManager.getState('initiatorState.media');
        
        if (!owner || !strain) {
            showFeedback('Missing required information (owner and strain)', 'error');
            return;
        }
        
        // Get the next available container ID
        updateNextAvailableId();
        
        // Create new container with today's date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Resolve owner and strain names from reference data
        let ownerName = owner;
        let strainName = 'Unknown Strain';
        let mediaName = media || null;
        
        // Look up owner name from reference data
        if (window.appState.isDataLoaded && window.appState.ownersTable) {
            // Handle both Excel format {id: name} and object format {id: {name: "name"}}
            const ownerData = window.appState.ownersTable[owner];
            if (typeof ownerData === 'string') {
                // Excel format: {"LW": "Luke Wilson"}
                ownerName = ownerData;
            } else if (ownerData && ownerData.name) {
                // Object format: {"LW": {name: "Luke Wilson"}}
                ownerName = ownerData.name;
            }
        }
        
        // Look up strain name from reference data
        if (window.appState.isDataLoaded && window.appState.strainsTable) {
            // Handle both Excel format {id: name} and object format {id: {name: "name"}}
            const strainData = window.appState.strainsTable[strain];
            if (typeof strainData === 'string') {
                // Excel format: {"13": "Guava Tart"}
                strainName = strainData;
            } else if (strainData && strainData.name) {
                // Object format: {"13": {name: "Guava Tart"}}
                strainName = strainData.name;
            }
        }
        
        // Look up media name from reference data
        if (media && window.appState.isDataLoaded && window.appState.mediaTypesTable) {
            // Handle both Excel format {id: name} and object format {id: {name: "name"}}
            const mediaData = window.appState.mediaTypesTable[media];
            if (typeof mediaData === 'string') {
                // Excel format: {"MS": "MS Media"}
                mediaName = mediaData;
            } else if (mediaData && mediaData.name) {
                // Object format: {"MS": {name: "MS Media"}}
                mediaName = mediaData.name;
            }
        }
        
        // Get additional fields from initiator state
        const stage = StateManager.getState('initiatorState.stage');
        const tissue = StateManager.getState('initiatorState.tissue');
        const dateRaw = StateManager.getState('initiatorState.date');
        
        if (!stage || !tissue || !dateRaw) {
            showFeedback('Missing required information (stage, tissue, date)', 'error');
            return;
        }
        
        // Resolve stage name from reference data
        let stageName = `Stage ${stage}`;
        if (window.appState.isDataLoaded && window.appState.stagesTable) {
            const stageData = window.appState.stagesTable[parseInt(stage)];
            if (stageData) {
                stageName = stageData;
            }
        }
        
        // Format date if helper is available
        const formattedDate = (window.DataUtils && typeof DataUtils.formatDate === 'function')
            ? DataUtils.formatDate(dateRaw)
            : dateRaw;
        
        // Build the barcode string (owner + strain + media + stage + tissue + date)
        const barcodeString = 
            owner +
            strain +
            (media || '') +
            stage +
            tissue +
            dateRaw;
        
        // Create container entry with resolved names for display (always Complete)
        const newContainer = {
            timestamp: new Date(),
            containerId: currentContainerId,
            containerLineage: null,
            sampleBarcode: barcodeString,
            barcode: barcodeString,
            barcodeType: 'CODE128',
            barcodeMetadata: null,
            strain: strainName,
            strainId: strain,
            owner: ownerName,
            ownerId: owner,
            stage: stageName,
            stageId: stage,
            media: mediaName || 'Unknown',
            mediaType: mediaName || 'Unknown',
            mediaId: media || null,
            tissueCount: tissue,
            date: formattedDate,
            status: 'Complete'
        };
        
        // Add to inventory using StateManager to ensure proper tracking
        window.appState.inventory.unshift(newContainer); // Add to beginning for visibility
        
        // Update highest container ID
        if (parseInt(currentContainerId) > window.appState.highestContainerId) {
            window.appState.highestContainerId = parseInt(currentContainerId);
        }
        
        // Increment session counter
        window.appState.sessionCounter++;
        
        // Update UI
        updateContainerConfirmation(newContainer);
        
        // Update stats
        UIUtils.updateStats();
        
        // Update inventory table display (builder now removed; use InventoryTableManager if available)
        if (window.InventoryTableManager && typeof window.InventoryTableManager.rebuildTable === 'function') {
            window.InventoryTableManager.rebuildTable();
        } else if (window.BuilderBarcodeGenerator && typeof window.BuilderBarcodeGenerator.updateInventoryTable === 'function') {
            // Fallback for legacy support
            window.BuilderBarcodeGenerator.updateInventoryTable();
        }
        
        // Persist to localStorage immediately
        if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
            window.InventoryManager.saveToLocalStorage();
        }
        
        // Show success message
        showFeedback(`Container ${currentContainerId} created successfully!`, 'success');
        
        // Reset initiator for next use
        setTimeout(() => {
            resetInitiator();
        }, 3000);
    }
    
    /**
     * Update the UI for container confirmation
     */
    function updateContainerConfirmation(container) {
        const confirmationElement = document.getElementById('initiatorConfirmation');
        if (!confirmationElement) return;
        
        // Show the confirmation
        confirmationElement.style.display = 'block';
        
        // Update confirmation details using the ID fields since display fields are null
        document.getElementById('confirmContainerId').textContent = container.containerId;
        document.getElementById('confirmOwner').textContent = container.ownerId; // Use ownerId
        document.getElementById('confirmStrain').textContent = container.strainId; // Use strainId
        document.getElementById('confirmMedia').textContent = container.mediaId || 'Not specified'; // Use mediaId
        document.getElementById('confirmDate').textContent = container.date;
    }
    
    /**
     * Update the initiator UI based on current step
     */
    function updateInitiatorUI() {
        const currentStep = StateManager.getState('initiatorState.currentStep');
        const input = document.getElementById('initiatorInput');
        const prompt = document.getElementById('initiatorPrompt');
        const hint = document.getElementById('initiatorHint');
        
        if (!input || !prompt || !hint) return;
        
        // Clear input field
        input.value = '';
        
        // Update prompt and hint based on step
        switch (currentStep) {
            case 'owner':
                prompt.textContent = 'Enter Owner ID:';
                hint.textContent = 'Type the owner identifier (e.g., LW, JR)';
                break;
            case 'strain':
                prompt.textContent = 'Enter Strain ID:';
                hint.textContent = 'Type the strain number (e.g., 00001)';
                break;
            case 'media':
                prompt.textContent = 'Enter Media Type (optional):';
                hint.textContent = 'Type the media code or leave blank';
                break;
        }
        
        // Focus on input
        input.focus();
        
        // Update status summary
        updateStatusSummary();
    }
    
    /**
     * Update status summary display
     */
    function updateStatusSummary() {
        const summaryElement = document.getElementById('initiatorSummary');
        if (!summaryElement) return;
        
        const owner = StateManager.getState('initiatorState.owner') || '-';
        const strain = StateManager.getState('initiatorState.strain') || '-';
        const media = StateManager.getState('initiatorState.media') || '-';
        const stage = StateManager.getState('initiatorState.stage') || '-';
        const tissue = StateManager.getState('initiatorState.tissue') || '-';
        const date = StateManager.getState('initiatorState.date') || '-';
        
        summaryElement.innerHTML = `
            <div class="status-item">👤 Owner: <strong>${owner}</strong></div>
            <div class="status-item">🧬 Strain: <strong>${strain}</strong></div>
            <div class="status-item">🧪 Media: <strong>${media}</strong></div>
            <div class="status-item">🌱 Stage: <strong>${stage}</strong></div>
            <div class="status-item">🔢 Tissue: <strong>${tissue}</strong></div>
            <div class="status-item">📅 Date: <strong>${date}</strong></div>
            <div class="status-item">📦 Next ID: <strong>${currentContainerId || '-'}</strong></div>
        `;
    }
    
    /**
     * Move to a specific step
     */
    function moveToStep(step) {
        StateManager.setState('initiatorState.currentStep', step);
    }
    
    /**
     * Update the next available container ID
     */
    function updateNextAvailableId() {
        // Get highest ID from inventory
        let highestId = 0;
        
        if (window.appState.inventory && window.appState.inventory.length > 0) {
            window.appState.inventory.forEach(item => {
                const id = parseInt(item.containerId);
                if (!isNaN(id) && id > highestId) {
                    highestId = id;
                }
            });
        }
        
        // Set next available ID
        currentContainerId = (highestId + 1).toString();
        
        // Update UI
        updateStatusSummary();
    }
    
    /**
     * Show feedback message
     */
    function showFeedback(message, type = 'info') {
        try {
            console.log(`📢 Feedback: [${type.toUpperCase()}] ${message}`);
            
            const feedbackElement = document.getElementById('initiatorFeedback');
            if (feedbackElement) {
                // Remove existing classes
                feedbackElement.classList.remove('success', 'error', 'warning', 'info');
                
                // Add appropriate class
                feedbackElement.classList.add(type);
                
                // Set message
                feedbackElement.textContent = message;
            } else {
                console.warn('⚠️ initiatorFeedback element not found');
            }
            
            // Also use notification system if available
            if (window.NotificationSystem && typeof window.NotificationSystem[type] === 'function') {
                switch (type) {
                    case 'success':
                        NotificationSystem.success(message);
                        break;
                    case 'error':
                        NotificationSystem.error(message);
                        break;
                    case 'warning':
                        NotificationSystem.warning(message);
                        break;
                    default:
                        NotificationSystem.info(message);
                }
            } else {
                console.warn('⚠️ NotificationSystem not available or missing method:', type);
            }
        } catch (error) {
            console.error('❌ Error in showFeedback:', error);
        }
    }
    
    /**
     * Reset the initiator to initial state
     */
    function resetInitiator() {
        // Clear state
        StateManager.setState('initiatorState', {
            currentStep: 'owner',
            owner: null,
            strain: null,
            media: null,
            stage: null,
            tissue: null,
            date: null
        });
        
        // Hide confirmation
        const confirmationElement = document.getElementById('initiatorConfirmation');
        if (confirmationElement) {
            confirmationElement.style.display = 'none';
        }
        
        // Update UI
        updateInitiatorUI();
        
        // Update next available ID
        updateNextAvailableId();
        
        // Show ready message
        showFeedback('Ready to initiate a new container', 'info');
    }
    
    // Public API
    return {
        initialize: initialize,
        resetInitiator: resetInitiator,
        updateNextAvailableId: updateNextAvailableId,
        handleInitiatorInput: handleInitiatorInput
    };
})();
