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
    
    // Ordered list of initiator steps for navigation
    const STEPS = ['owner', 'strain', 'media', 'stage', 'tissue', 'date'];
    
    /**
     * Initialize the container initiator
     */
    function initialize() {
        // Prevent re-initialization (which would add duplicate event listeners)
        if (initialized) {
            console.log('✅ ContainerInitiator already initialized, skipping...');
            return;
        }

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
                media: null,
                stage: null,
                tissue: null,
                date: null,
                // Marks whether the current container has been fully created
                completed: false
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

        const backBtn = document.getElementById('initiatorBackBtn');
        if (backBtn) {
            console.log('✅ Found initiatorBackBtn element, adding click listener');
            backBtn.addEventListener('click', function() {
                console.log('🔵 Back button clicked, going to previous step');
                goToPreviousStep();
            });
        } else {
            console.warn('⚠️ initiatorBackBtn element not found; back navigation disabled');
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
        const isCompleted = StateManager.getState('initiatorState.completed');
        const inputValue = document.getElementById('initiatorInput')?.value?.trim();
        
        console.log('Current step:', currentStep);
        console.log('Input value:', inputValue);
        console.log('Current state:', StateManager.getState('initiatorState'));
        
        // If the current container flow has already completed, treat "Next" as
        // an explicit request to start a brand new container instead of
        // generating another entry with the same metadata.
        if (isCompleted) {
            console.log('✅ Initiator flow already completed; resetting for next container.');
            resetInitiator();
            return;
        }
        
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
        const rawInput = document.getElementById('initiatorInput').value.trim();
        const upperInput = rawInput.toUpperCase();
        
        // Treat empty, NA, N/A, NONE as "no media" selections
        const isNoMedia = !rawInput || upperInput === 'NA' || upperInput === 'N/A' || upperInput === 'NONE';
        
        if (isNoMedia) {
            // Explicitly store N/A so the user can see that no media is present
            StateManager.setState('initiatorState.media', 'N/A');
            moveToStep('stage');
            updateInitiatorUI();
            showFeedback('Media set to: N/A (no media present)', 'success');
            return;
        }
        
        // Media is optional, check if it exists but don't require it
        if (window.appState.isDataLoaded) {
            const mediaTypesTable = window.appState.mediaTypesTable;
            const mediaExists = Object.keys(mediaTypesTable).some(key => 
                key.toLowerCase() === upperInput.toLowerCase());
            
            if (!mediaExists) {
                showFeedback(`Media "${rawInput}" not found in reference data`, 'warning');
                // Continue anyway since we can create new media types
            }
        }
        
        // Store the media code
        StateManager.setState('initiatorState.media', upperInput);
        
        // Move to next step (stage)
        moveToStep('stage');
        updateInitiatorUI();
        showFeedback(`Media set to: ${rawInput}`, 'success');
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
        // Defensive guard: if this initiator flow has already completed,
        // do not generate another container with the same metadata.
        const alreadyCompleted = StateManager.getState('initiatorState.completed');
        if (alreadyCompleted) {
            console.warn('generateContainer() called after initiator completion; ignoring to prevent duplicate entry');
            showFeedback('Current container already created. Press "Start New Container" to begin a new initiation.', 'info');
            return;
        }

        // Get the owner, strain, and media from state
        const owner = StateManager.getState('initiatorState.owner');
        const strain = StateManager.getState('initiatorState.strain');
        const mediaRaw = StateManager.getState('initiatorState.media');
        const mediaUpper = mediaRaw ? mediaRaw.toUpperCase() : null;
        const hasNoMedia = !mediaUpper || mediaUpper === 'N/A';
        
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
        // For no-media containers, display N/A explicitly
        let mediaName = hasNoMedia ? 'N/A' : null;
        
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
        
        // Look up media name from reference data when media is present
        if (!hasNoMedia && mediaUpper && window.appState.isDataLoaded && window.appState.mediaTypesTable) {
            // Handle both Excel format {id: name} and object format {id: {name: "name"}}
            const mediaData = window.appState.mediaTypesTable[mediaUpper];
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
        
        // Build barcode using the shared Code128BarcodeGenerator so format is consistent
        let barcodeResult = null;
        let barcodeString = null;

        // Map media for barcode encoding: use a safe code when no media is present
        const mediaCodeForBarcode = hasNoMedia ? 'NM' : mediaUpper; // "NM" = No Media

        if (window.Code128BarcodeGenerator) {
            try {
                barcodeResult = Code128BarcodeGenerator.generateCode128Barcode({
                    owner: owner,
                    strain: strain,
                    media: mediaCodeForBarcode,
                    stage: stage,
                    tissue: tissue,
                    date: dateRaw
                });

                if (barcodeResult && barcodeResult.success && barcodeResult.data) {
                    barcodeString = barcodeResult.data;
                }
            } catch (e) {
                console.warn('Code128BarcodeGenerator failed in ContainerInitiator, falling back:', e);
            }
        }

        // Fallback: simple concatenation if enhanced generator is unavailable
        if (!barcodeString) {
            barcodeString = owner + strain + (mediaUpper || '') + stage + tissue + dateRaw;
        }
        
        // Create container entry with resolved names for display (always Complete)
        const newContainer = {
            timestamp: new Date(),
            containerId: currentContainerId,
            containerLineage: null,
            sampleBarcode: barcodeString,
            barcode: barcodeString,
            barcodeType: 'CODE128',
            barcodeMetadata: barcodeResult && barcodeResult.success ? (barcodeResult.metadata || null) : null,
            strain: strainName,
            strainId: strain,
            owner: ownerName,
            ownerId: owner,
            stage: stageName,
            stageId: stage,
            media: mediaName || 'Unknown',
            mediaType: mediaName || 'Unknown',
            mediaId: hasNoMedia ? null : mediaUpper,
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
        
        // If we have a successful barcodeResult and QR service, kick off QR generation
        if (barcodeResult && barcodeResult.success && window.QRCodeService) {
            QRCodeService.createForBarcode(barcodeResult, currentContainerId)
                .then(qrMeta => {
                    if (!qrMeta) {
                        console.warn('QR code generation returned null - backend may not be running');
                        return;
                    }

                    try {
                        // Attach QR metadata to container entry and update confirmation UI
                        newContainer.barcodeMetadata = newContainer.barcodeMetadata || {};
                        newContainer.barcodeMetadata.qrCode = {
                            dataUrl: qrMeta.dataUrl,
                            destinationUrl: qrMeta.destinationUrl,
                            shortCode: qrMeta.shortCode,
                            imageFormat: qrMeta.imageFormat
                        };

                        // Also persist top-level QR fields for easier export/sync
                        if (qrMeta.destinationUrl) {
                            newContainer.qrDestinationUrl = qrMeta.destinationUrl;
                        }
                        if (qrMeta.shortCode) {
                            newContainer.qrShortCode = qrMeta.shortCode;
                        }

                        // Update the corresponding inventory entry (it was just unshifted to index 0)
                        const latest = window.appState.inventory[0];
                        if (latest && latest.containerId === newContainer.containerId) {
                            latest.barcodeMetadata = newContainer.barcodeMetadata;
                            if (newContainer.qrDestinationUrl) {
                                latest.qrDestinationUrl = newContainer.qrDestinationUrl;
                            }
                            if (newContainer.qrShortCode) {
                                latest.qrShortCode = newContainer.qrShortCode;
                            }
                        }

                        // Update confirmation QR preview
                        const qrEl = document.getElementById('confirmQrCode');
                        if (qrEl && qrMeta.dataUrl) {
                            qrEl.innerHTML = `<img src="${qrMeta.dataUrl}" alt="QR Code" style="max-width: 120px; height: auto;" /><p style="margin-top: 8px; font-size: 0.85rem; color: #6b7280;">Scan to view: ${qrMeta.shortCode}</p>`;
                        }

                        // Persist updated container with QR metadata
                        if (window.InventoryManager && typeof window.InventoryManager.saveToLocalStorage === 'function') {
                            window.InventoryManager.saveToLocalStorage();
                        }
                    } catch (err) {
                        console.warn('Failed to attach QR metadata for initiated container:', err);
                    }
                })
                .catch(err => {
                    console.warn('QR code generation failed for initiated container:', err);
                });
        }
        
        // Show success message
        showFeedback(`Container ${currentContainerId} created successfully!`, 'success');
        
        // Mark this initiator run as completed so additional "Next" presses
        // don't create more containers with the same metadata. The next
        // invocation of handleInitiatorInput() will reset the initiator to
        // start a fresh container.
        try {
            StateManager.setState('initiatorState.completed', true);
        } catch (e) {
            console.warn('Failed to mark initiator state as completed:', e);
        }
        
        // NOTE: Do not immediately reset the initiator so the user can see the QR/confirmation.
        // The user can start a new initiation explicitly when ready (pressing
        // Next again will reset for a new container instead of duplicating).
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
        document.getElementById('confirmBarcode').textContent = container.barcode || container.sampleBarcode || '';

        // Show QR code generation instructions
        const qrEl = document.getElementById('confirmQrCode');
        if (qrEl) {
            const qrUrl = `${window.location.origin}?c=${container.containerId}`;
            qrEl.innerHTML = `
                <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; padding: 12px; margin-top: 10px;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e;">📱 Create QR Code:</p>
                    <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #78350f;">Visit <a href="https://app.qr-code-generator.com" target="_blank" style="color: #059669; text-decoration: underline;">qr-code-generator.com</a></p>
                    <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #78350f;">Use this URL:</p>
                    <input type="text" value="${qrUrl}" readonly onclick="this.select()" style="width: 100%; padding: 6px; font-size: 0.8rem; font-family: monospace; border: 1px solid #d97706; border-radius: 4px; background: white;">
                    <p style="margin: 8px 0 0 0; font-size: 0.75rem; color: #78350f; font-style: italic;">Click the URL to copy. When scanned, the QR code will show this container's details.</p>
                </div>
            `;
        }
    }
    
    /**
     * Update the initiator UI based on current step
     */
    function updateInitiatorUI() {
        const currentStep = StateManager.getState('initiatorState.currentStep');
        const isCompleted = StateManager.getState('initiatorState.completed');
        const input = document.getElementById('initiatorInput');
        const prompt = document.getElementById('initiatorPrompt');
        const hint = document.getElementById('initiatorHint');
        const backBtn = document.getElementById('initiatorBackBtn');
        const dateShortcuts = document.getElementById('initiatorDateShortcuts');
        const yesterdayBtn = document.getElementById('initiatorDateYesterdayBtn');
        const todayBtn = document.getElementById('initiatorDateTodayBtn');
        const tomorrowBtn = document.getElementById('initiatorDateTomorrowBtn');
        const nextBtn = document.getElementById('initiateBtn');
        
        if (!input || !prompt || !hint) return;
        
        // Clear input field unless we've already completed the flow
        if (!isCompleted) {
            input.value = '';
        }
        
        // Enable/disable back button based on current step
        if (backBtn) {
            backBtn.disabled = (currentStep === 'owner' || isCompleted);
        }
        
        // Update primary button label based on completion state
        if (nextBtn) {
            nextBtn.textContent = isCompleted ? 'Start New Container' : 'Next Step';
        }
        
        // Show quick date buttons only on the date step
        if (dateShortcuts) {
            const isDateStep = currentStep === 'date';
            dateShortcuts.style.display = isDateStep ? 'flex' : 'none';

            // When entering date step, update button labels to numeric dates
            if (isDateStep && yesterdayBtn && todayBtn && tomorrowBtn) {
                const today = new Date();

                const todayDate = new Date(today);
                const yesterdayDate = new Date(today);
                const tomorrowDate = new Date(today);
                yesterdayDate.setDate(todayDate.getDate() - 1);
                tomorrowDate.setDate(todayDate.getDate() + 1);

                yesterdayBtn.textContent = formatDateYYYYMMDD(yesterdayDate);
                todayBtn.textContent = formatDateYYYYMMDD(todayDate);
                tomorrowBtn.textContent = formatDateYYYYMMDD(tomorrowDate);
            }
        }
        
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
                hint.textContent = 'Type the media code, "N/A" if no media, or leave blank';
                break;
            case 'stage':
                prompt.textContent = 'Enter Stage (1-9):';
                hint.textContent = 'Type a single digit between 1 and 9 for growth stage';
                break;
            case 'tissue':
                prompt.textContent = 'Enter Tissue Count:';
                hint.textContent = 'Type the number of tissue samples (1-99)';
                break;
            case 'date':
                prompt.textContent = 'Enter Date (YYYYMMDD):';
                hint.textContent = 'Type the date in YYYYMMDD format, e.g., 20250106';
                break;
            default:
                prompt.textContent = 'Enter value:';
                hint.textContent = 'Type the required value and press Enter';
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
     * Helper: format Date -> YYYYMMDD
     */
    function formatDateYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
    
    /**
     * Quick-select date for date step: -1 = yesterday, 0 = today, 1 = tomorrow
     * Fills the input and state, but still requires the user to press Next/Enter
     * so behavior is consistent whether the date is typed or clicked.
     */
    function selectQuickDate(offsetDays) {
        try {
            const currentStep = StateManager.getState('initiatorState.currentStep');
            if (currentStep !== 'date') {
                // If somehow clicked on another step, force to date step first
                moveToStep('date');
                updateInitiatorUI();
            }
            
            const base = new Date();
            base.setDate(base.getDate() + offsetDays);
            const formatted = formatDateYYYYMMDD(base);
            
            const input = document.getElementById('initiatorInput');
            if (input) {
                input.value = formatted;
            }
            
            // Store in state so the summary reflects the selection
            StateManager.setState('initiatorState.date', formatted);
            updateStatusSummary();
            showFeedback(`Date set to: ${formatted}. Press Next to create the container.`, 'info');
        } catch (error) {
            console.error('❌ Error selecting quick date:', error);
        }
    }
    
    /**
     * Navigate to the previous step, allowing corrections
     */
    function goToPreviousStep() {
        try {
            const currentStep = StateManager.getState('initiatorState.currentStep');
            const currentIndex = STEPS.indexOf(currentStep);

            if (currentIndex <= 0) {
                showFeedback('Already at the first step (Owner).', 'info');
                return;
            }

            const previousStep = STEPS[currentIndex - 1];
            StateManager.setState('initiatorState.currentStep', previousStep);

            // Refresh prompts and summary
            updateInitiatorUI();

            const input = document.getElementById('initiatorInput');
            if (!input) return;

            // Pre-fill input with existing value for that step, if any
            let previousValue = null;
            switch (previousStep) {
                case 'owner':
                    previousValue = StateManager.getState('initiatorState.owner');
                    break;
                case 'strain':
                    previousValue = StateManager.getState('initiatorState.strain');
                    break;
                case 'media':
                    previousValue = StateManager.getState('initiatorState.media');
                    break;
                case 'stage':
                    previousValue = StateManager.getState('initiatorState.stage');
                    break;
                case 'tissue':
                    previousValue = StateManager.getState('initiatorState.tissue');
                    break;
                case 'date':
                    previousValue = StateManager.getState('initiatorState.date');
                    break;
            }

            if (previousValue !== null && previousValue !== undefined) {
                input.value = previousValue;
            }

            input.focus();
            showFeedback(`Moved back to ${previousStep} step. Update the value and press Enter to continue.`, 'info');
        } catch (error) {
            console.error('❌ Error navigating to previous step:', error);
        }
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
            date: null,
            completed: false
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
        handleInitiatorInput: handleInitiatorInput,
        goToPreviousStep: goToPreviousStep,
        selectQuickDate: selectQuickDate
    };
})();
