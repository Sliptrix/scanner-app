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
        console.log('ContainerInitiator module initializing...');
        
        // Setup event listeners
        setupEventListeners();
        
        // Get the highest container ID for reference
        updateNextAvailableId();
        
        initialized = true;
        console.log('ContainerInitiator module initialized');
    }
    
    /**
     * Set up event listeners for the initiator
     */
    function setupEventListeners() {
        const initiatorInput = document.getElementById('initiatorInput');
        if (initiatorInput) {
            initiatorInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleInitiatorInput();
                }
            });
        }
        
        const initiateBtn = document.getElementById('initiateBtn');
        if (initiateBtn) {
            initiateBtn.addEventListener('click', function() {
                handleInitiatorInput();
            });
        }
    }
    
    /**
     * Handle the initiator input
     */
    function handleInitiatorInput() {
        const currentStep = StateManager.getState('initiatorState.currentStep');
        
        switch (currentStep) {
            case 'owner':
                processOwnerInput();
                break;
            case 'strain':
                processStrainInput();
                break;
            case 'media':
                processMediaInput();
                break;
            default:
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
        
        // Generate the container
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
        
        // Create container entry
        const newContainer = {
            containerId: currentContainerId,
            owner: owner,
            strain: strain,
            media: media || 'N/A',
            stage: '1', // Default to stage 1 for new containers
            tissue: '1',  // Default to 1 tissue
            date: dateString,
            status: 'active',
            notes: 'Created via Container Initiator'
        };
        
        // Add to inventory
        window.appState.inventory.push(newContainer);
        
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
        
        // Update confirmation details
        document.getElementById('confirmContainerId').textContent = container.containerId;
        document.getElementById('confirmOwner').textContent = container.owner;
        document.getElementById('confirmStrain').textContent = container.strain;
        document.getElementById('confirmMedia').textContent = container.media;
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
        
        summaryElement.innerHTML = `
            <div class="status-item">👤 Owner: <strong>${owner}</strong></div>
            <div class="status-item">🧬 Strain: <strong>${strain}</strong></div>
            <div class="status-item">🧪 Media: <strong>${media}</strong></div>
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
        const feedbackElement = document.getElementById('initiatorFeedback');
        if (!feedbackElement) return;
        
        // Remove existing classes
        feedbackElement.classList.remove('success', 'error', 'warning', 'info');
        
        // Add appropriate class
        feedbackElement.classList.add(type);
        
        // Set message
        feedbackElement.textContent = message;
        
        // Also use notification system
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
            media: null
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
