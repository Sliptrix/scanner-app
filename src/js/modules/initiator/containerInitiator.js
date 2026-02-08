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
    const STEPS = ['qr', 'owner', 'strain', 'media', 'stage', 'tissue', 'date', 'location'];
    
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
                currentStep: 'qr',
                qrExcelRow: null,
                prePopulatedContainerId: null,
                owner: null,
                strain: null,
                media: null,
                stage: null,
                tissue: null,
                date: null,
                location: null,
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
            updateNextAvailableId();
            enableInitiatorInputs();
            return;
        }
        
        // Check again in 500ms
        setTimeout(checkDataLoadedStatus, 500);
    }
    
    /**
     * Set up event listeners for the initiator
     */
    // Autocomplete state
    let autocompleteSelectedIndex = -1;
    let autocompleteResults = [];

    function setupEventListeners() {
        console.log('🔧 Setting up Container Initiator event listeners...');

        const initiatorInput = document.getElementById('initiatorInput');
        if (initiatorInput) {
            console.log('✅ Found initiatorInput element, adding keypress listener');
            initiatorInput.addEventListener('keypress', function(e) {
                console.log('🔵 Keypress detected:', e.key);
                if (e.key === 'Enter') {
                    // If autocomplete is open and an item is selected, use that
                    if (autocompleteSelectedIndex >= 0 && autocompleteResults.length > 0) {
                        selectAutocompleteItem(autocompleteSelectedIndex);
                        e.preventDefault();
                        return;
                    }
                    console.log('🔵 Enter key pressed, calling handleInitiatorInput');
                    handleInitiatorInput();
                }
            });

            // Add input event for autocomplete (owner and strain lookup)
            initiatorInput.addEventListener('input', function(e) {
                const currentStep = StateManager.getState('initiatorState.currentStep');
                if (currentStep === 'owner') {
                    showOwnerAutocomplete(e.target.value);
                } else if (currentStep === 'strain') {
                    showStrainAutocomplete(e.target.value);
                } else {
                    hideAutocomplete();
                }
            });

            // Handle arrow keys for autocomplete navigation
            initiatorInput.addEventListener('keydown', function(e) {
                const autocompleteEl = document.getElementById('strainAutocomplete');
                if (!autocompleteEl || autocompleteEl.style.display === 'none') return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    autocompleteSelectedIndex = Math.min(autocompleteSelectedIndex + 1, autocompleteResults.length - 1);
                    updateAutocompleteSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    autocompleteSelectedIndex = Math.max(autocompleteSelectedIndex - 1, 0);
                    updateAutocompleteSelection();
                } else if (e.key === 'Escape') {
                    hideAutocomplete();
                }
            });

            // Hide autocomplete when clicking outside
            document.addEventListener('click', function(e) {
                if (!e.target.closest('#initiatorInput') && !e.target.closest('#strainAutocomplete')) {
                    hideAutocomplete();
                }
            });
        } else {
            console.error('❌ initiatorInput element not found!');
        }

        // Create autocomplete container if it doesn't exist
        createAutocompleteContainer();
        
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
     * Create the autocomplete dropdown container
     */
    function createAutocompleteContainer() {
        if (document.getElementById('strainAutocomplete')) return;

        const inputGroup = document.querySelector('#initiatorInput')?.parentElement;
        if (!inputGroup) return;

        // Make the parent position relative for absolute positioning
        inputGroup.style.position = 'relative';

        const autocompleteDiv = document.createElement('div');
        autocompleteDiv.id = 'strainAutocomplete';
        autocompleteDiv.className = 'strain-autocomplete';
        autocompleteDiv.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 300px;
            overflow-y: auto;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            z-index: 1000;
            display: none;
        `;
        inputGroup.appendChild(autocompleteDiv);
    }

    /**
     * Show owner autocomplete suggestions
     * @param {string} query - User input to filter owners
     */
    function showOwnerAutocomplete(query) {
        const autocompleteEl = document.getElementById('strainAutocomplete');
        if (!autocompleteEl) return;

        if (!query || query.length < 1) {
            hideAutocomplete();
            return;
        }

        // Get all owners from lookup service
        if (!window.InventoryLookupService || !window.InventoryLookupService.isInitialized()) {
            hideAutocomplete();
            return;
        }

        const allOwners = window.InventoryLookupService.getAllOwners();
        if (!allOwners || allOwners.length === 0) {
            hideAutocomplete();
            return;
        }

        // Filter owners by query (match code, name, or alternates)
        const queryLower = query.toLowerCase();
        autocompleteResults = allOwners.filter(owner => {
            const codeMatch = owner.code && owner.code.toLowerCase().includes(queryLower);
            const nameMatch = owner.name && owner.name.toLowerCase().includes(queryLower);
            // Also check alternate names
            const alternatesMatch = owner.alternates && owner.alternates.some(alt =>
                alt && alt.toLowerCase().includes(queryLower)
            );
            return codeMatch || nameMatch || alternatesMatch;
        }).slice(0, 15); // Limit to 15 results

        if (autocompleteResults.length === 0) {
            hideAutocomplete();
            return;
        }

        // Mark these as owner results for selectAutocompleteItem
        autocompleteResults.forEach(r => r._type = 'owner');

        // Render results
        autocompleteEl.innerHTML = autocompleteResults.map((owner, index) => {
            const isSelected = index === autocompleteSelectedIndex;
            const alternates = owner.alternates && owner.alternates.length > 0
                ? `Also known as: ${owner.alternates.join(', ')}`
                : '';
            return `
                <div class="autocomplete-item ${isSelected ? 'selected' : ''}"
                     data-index="${index}"
                     style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #eee; ${isSelected ? 'background: #e3f2fd;' : ''}">
                    <div style="font-weight: 600; color: #333;">${owner.code} - ${owner.name}</div>
                    <div style="font-size: 0.85em; color: #666;">${alternates || `Owner Code: ${owner.code}`}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        autocompleteEl.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                selectAutocompleteItem(parseInt(this.dataset.index));
            });
            item.addEventListener('mouseenter', function() {
                autocompleteSelectedIndex = parseInt(this.dataset.index);
                updateAutocompleteSelection();
            });
        });

        autocompleteEl.style.display = 'block';
        autocompleteSelectedIndex = -1;
    }

    /**
     * Show strain autocomplete suggestions
     * Filters by selected owner if one is chosen
     * @param {string} query - User input to filter strains
     */
    function showStrainAutocomplete(query) {
        const autocompleteEl = document.getElementById('strainAutocomplete');
        if (!autocompleteEl) return;

        if (!query || query.length < 1) {
            hideAutocomplete();
            return;
        }

        // Get all strains from lookup service
        if (!window.InventoryLookupService || !window.InventoryLookupService.isInitialized()) {
            hideAutocomplete();
            return;
        }

        // Get the selected owner to filter strains
        const selectedOwner = StateManager.getState('initiatorState.owner');

        // Get strains - filtered by owner if one is selected
        let allStrains;
        if (selectedOwner) {
            // Get only strains belonging to the selected owner
            allStrains = window.InventoryLookupService.getStrainsByOwner(selectedOwner);
            console.log(`Filtering strains for owner ${selectedOwner}: found ${allStrains.length} strains`);
        } else {
            // No owner selected, show all strains
            allStrains = window.InventoryLookupService.getAllStrains();
        }

        if (!allStrains || allStrains.length === 0) {
            // Show "no strains" message if owner has no strains
            if (selectedOwner) {
                autocompleteEl.innerHTML = `
                    <div style="padding: 10px 12px; color: #666; font-style: italic;">
                        No strains found for owner ${selectedOwner}
                    </div>
                `;
                autocompleteEl.style.display = 'block';
            } else {
                hideAutocomplete();
            }
            return;
        }

        // Filter strains by query (match ID, name, or abbreviation)
        const queryLower = query.toLowerCase();
        autocompleteResults = allStrains.filter(strain => {
            const idMatch = strain.id && strain.id.toString().includes(queryLower);
            const nameMatch = strain.name && strain.name.toLowerCase().includes(queryLower);
            const abbrMatch = strain.abbreviation && strain.abbreviation.toLowerCase().includes(queryLower);
            return idMatch || nameMatch || abbrMatch;
        }).slice(0, 15); // Limit to 15 results

        // Mark these as strain results for selectAutocompleteItem
        autocompleteResults.forEach(r => r._type = 'strain');

        if (autocompleteResults.length === 0) {
            // Show helpful message when no matches
            autocompleteEl.innerHTML = `
                <div style="padding: 10px 12px; color: #666; font-style: italic;">
                    No matching strains found${selectedOwner ? ` for owner ${selectedOwner}` : ''}
                </div>
            `;
            autocompleteEl.style.display = 'block';
            return;
        }

        // Render results with owner info
        autocompleteEl.innerHTML = autocompleteResults.map((strain, index) => {
            const abbr = strain.abbreviation ? `[${strain.abbreviation}]` : '';
            const owners = strain.owners && strain.owners.length > 0 ? strain.owners.join(', ') : 'No owner';
            const isSelected = index === autocompleteSelectedIndex;
            return `
                <div class="autocomplete-item ${isSelected ? 'selected' : ''}"
                     data-index="${index}"
                     style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #eee; ${isSelected ? 'background: #e3f2fd;' : ''}">
                    <div style="font-weight: 600; color: #333;">#${strain.id} - ${strain.name}</div>
                    <div style="font-size: 0.85em; color: #666;">
                        ${abbr || 'No abbreviation'}
                        <span style="color: #059669; margin-left: 8px;">Owner: ${owners}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        autocompleteEl.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                selectAutocompleteItem(parseInt(this.dataset.index));
            });
            item.addEventListener('mouseenter', function() {
                autocompleteSelectedIndex = parseInt(this.dataset.index);
                updateAutocompleteSelection();
            });
        });

        autocompleteEl.style.display = 'block';
        autocompleteSelectedIndex = -1;
    }

    /**
     * Hide the autocomplete dropdown
     */
    function hideAutocomplete() {
        const autocompleteEl = document.getElementById('strainAutocomplete');
        if (autocompleteEl) {
            autocompleteEl.style.display = 'none';
            autocompleteEl.innerHTML = '';
        }
        autocompleteSelectedIndex = -1;
        autocompleteResults = [];
    }

    /**
     * Update the visual selection in autocomplete
     */
    function updateAutocompleteSelection() {
        const autocompleteEl = document.getElementById('strainAutocomplete');
        if (!autocompleteEl) return;

        autocompleteEl.querySelectorAll('.autocomplete-item').forEach((item, index) => {
            if (index === autocompleteSelectedIndex) {
                item.classList.add('selected');
                item.style.background = '#e3f2fd';
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
                item.style.background = '';
            }
        });
    }

    /**
     * Select an autocomplete item and fill the input
     * Handles both owner and strain selections based on item type
     * @param {number} index - Index of selected item
     */
    function selectAutocompleteItem(index) {
        if (index < 0 || index >= autocompleteResults.length) return;

        const item = autocompleteResults[index];
        const input = document.getElementById('initiatorInput');
        if (!input || !item) return;

        // Check the type of result (owner or strain)
        if (item._type === 'owner') {
            // Owner selection
            input.value = item.code;
            hideAutocomplete();
            showFeedback(`Selected owner: ${item.code} (${item.name})`, 'success');
        } else {
            // Strain selection (default)
            input.value = item.id;
            hideAutocomplete();
            // Show feedback with full strain info
            const abbr = item.abbreviation ? ` [${item.abbreviation}]` : '';
            const owners = item.owners && item.owners.length > 0 ? ` | Owners: ${item.owners.join(', ')}` : '';
            showFeedback(`Selected: #${item.id} ${item.name}${abbr}${owners}`, 'success');
        }
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
            case 'qr':
                console.log('Processing QR scan input...');
                processQrInput();
                break;
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
            case 'location':
                console.log('Processing location input...');
                processLocationInput();
                break;
            default:
                console.log('Invalid step, resetting initiator');
                // Reset to first step if invalid state
                resetInitiator();
        }
    }
    
    /**
     * Process QR code scan input (first step).
     * User scans a pre-printed QR label. The app parses the QR ID
     * and verifies it exists in the pool and is unassigned.
     */
    function processQrInput() {
        const input = document.getElementById('initiatorInput').value.trim();

        if (!input) {
            showFeedback('Please scan or enter a QR code', 'error');
            return;
        }

        if (!window.QRCodeService) {
            showFeedback('QR Code Service not available', 'error');
            return;
        }

        const excelRow = QRCodeService.parseQrInput(input);
        if (!excelRow) {
            showFeedback('Invalid QR code. Expected format: Excel URL with Active_Inventory!A{row}, A{row}, or a row number', 'error');
            return;
        }

        const poolEntry = QRCodeService.lookupByRow(excelRow);
        if (!poolEntry) {
            showFeedback(`QR code ID #${excelRow} not found in pool. Generate a batch first.`, 'error');
            return;
        }

        if (poolEntry.assignedContainerId) {
            showFeedback(`QR code ID #${excelRow} is already assigned to container ${poolEntry.assignedContainerId}`, 'error');
            return;
        }

        // Store the Excel row and pre-populated Container_ID for later use
        StateManager.setState('initiatorState.qrExcelRow', excelRow);
        if (poolEntry.containerId) {
            StateManager.setState('initiatorState.prePopulatedContainerId', poolEntry.containerId);
            currentContainerId = poolEntry.containerId;
        }
        moveToStep('owner');
        updateInitiatorUI();

        const displayId = poolEntry.containerId || `#${excelRow}`;
        showFeedback(`QR code ID: ${displayId} selected`, 'success');
    }

    /**
     * Process owner input
     * Uses InventoryLookupService to resolve any input format (code, name, or alternate)
     */
    function processOwnerInput() {
        const input = document.getElementById('initiatorInput').value.trim();

        if (!input) {
            showFeedback('Please enter a valid owner (code, name, or alternate)', 'error');
            return;
        }

        // Use InventoryLookupService if available
        let resolvedOwner = null;
        let ownerDisplay = input.toUpperCase();

        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const ownerData = window.InventoryLookupService.resolveOwner(input);
            if (ownerData) {
                resolvedOwner = ownerData.code;
                ownerDisplay = ownerData.code;
                const ownerName = ownerData.name || ownerData.code;
                showFeedback(`Owner resolved: ${input} → ${ownerData.code} (${ownerName})`, 'success');
            } else {
                // Not found in lookup - BLOCK progression
                showFeedback(`ERROR: Owner "${input}" not recognized. Please enter a valid owner code, name, or alternate from the HQ workbook.`, 'error');
                return; // Do not proceed
            }
        } else {
            // Fallback to legacy behavior - require match in reference data
            if (window.appState.isDataLoaded) {
                const ownersTable = window.appState.ownersTable;
                const ownerExists = Object.keys(ownersTable).some(key =>
                    key.toLowerCase() === input.toLowerCase());

                if (!ownerExists) {
                    showFeedback(`ERROR: Owner "${input}" not found in reference data. Cannot proceed.`, 'error');
                    return; // Do not proceed
                }
            }
            resolvedOwner = input.toUpperCase();
        }

        // Store the resolved owner and move to strain step
        StateManager.setState('initiatorState.owner', resolvedOwner);
        moveToStep('strain');

        // Update UI
        updateInitiatorUI();
    }
    
    /**
     * Process strain input
     * Uses InventoryLookupService to resolve any input format (ID, abbreviation, or name)
     */
    function processStrainInput() {
        const input = document.getElementById('initiatorInput').value.trim();

        if (!input) {
            showFeedback('Please enter a valid strain (ID, abbreviation, or name)', 'error');
            return;
        }

        // DEBUG: Log current state of strain data
        console.log('=== STRAIN LOOKUP DEBUG ===');
        console.log('Input:', input);
        console.log('appState.isDataLoaded:', window.appState?.isDataLoaded);
        console.log('appState.strainsTable:', window.appState?.strainsTable);
        console.log('strainsTable keys:', Object.keys(window.appState?.strainsTable || {}));
        console.log('InventoryLookupService available:', !!window.InventoryLookupService);
        console.log('InventoryLookupService initialized:', window.InventoryLookupService?.isInitialized?.());

        // Get all strains from lookup service for debugging
        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const allStrains = window.InventoryLookupService.getAllStrains();
            console.log('All strains from LookupService:', allStrains);
        }

        // Use InventoryLookupService if available
        let resolvedStrainId = null;
        let strainName = null;

        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const strainData = window.InventoryLookupService.resolveStrain(input);
            console.log('resolveStrain result for input "' + input + '":', strainData);

            if (strainData) {
                resolvedStrainId = strainData.id;
                strainName = strainData.name;
                const abbr = strainData.abbreviation ? ` [${strainData.abbreviation}]` : '';
                showFeedback(`Strain resolved: ${input} → #${strainData.id} ${strainData.name}${abbr}`, 'success');
            } else {
                // Not found in lookup - show debug info and available strains
                const allStrains = window.InventoryLookupService.getAllStrains();
                const availableIds = allStrains.map(s => s.id).slice(0, 20).join(', ');
                console.error(`Strain "${input}" not found. Available strain IDs (first 20):`, availableIds);
                showFeedback(`ERROR: Strain "${input}" not recognized. Available IDs: ${availableIds || 'none loaded'}. Check console for details.`, 'error');
                return; // Do not proceed
            }
        } else {
            // Fallback to legacy behavior - require match in reference data
            if (window.appState.isDataLoaded) {
                const strainsTable = window.appState.strainsTable;
                const strainExists = Object.keys(strainsTable).some(key =>
                    key === input);

                if (!strainExists) {
                    showFeedback(`ERROR: Strain "${input}" not found in reference data. Cannot proceed.`, 'error');
                    return; // Do not proceed
                }
            }
            resolvedStrainId = input;
        }

        // Store the resolved strain ID and move to media step
        StateManager.setState('initiatorState.strain', resolvedStrainId);

        // Also store the resolved strain name for display purposes
        if (strainName) {
            StateManager.setState('initiatorState.strainName', strainName);
        }

        moveToStep('media');

        // Update UI
        updateInitiatorUI();
    }
    
    /**
     * Process media input
     * Uses InventoryLookupService to resolve any input format (code or name)
     */
    function processMediaInput() {
        const rawInput = document.getElementById('initiatorInput').value.trim();
        const upperInput = rawInput.toUpperCase();

        // Treat empty, NA, N/A, NONE as "no media" selections
        const isNoMedia = !rawInput || upperInput === 'NA' || upperInput === 'N/A' || upperInput === 'NONE';

        if (isNoMedia) {
            // Explicitly store N/A so the user can see that no media is present
            StateManager.setState('initiatorState.media', 'N/A');
            StateManager.setState('initiatorState.mediaName', 'N/A');
            moveToStep('stage');
            updateInitiatorUI();
            showFeedback('Media set to: N/A (no media present)', 'success');
            return;
        }

        // Use InventoryLookupService if available
        let resolvedMediaCode = null;
        let mediaName = null;

        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const mediaData = window.InventoryLookupService.resolveMediaType(rawInput);
            if (mediaData) {
                resolvedMediaCode = mediaData.code;
                mediaName = mediaData.name;
                showFeedback(`Media resolved: ${rawInput} → ${mediaData.code} (${mediaData.name})`, 'success');
            } else {
                // Not found in lookup - BLOCK progression
                showFeedback(`ERROR: Media "${rawInput}" not recognized. Please enter a valid media code or name from the HQ workbook, or type "N/A" for no media.`, 'error');
                return; // Do not proceed
            }
        } else {
            // Fallback to legacy behavior - require match in reference data
            if (window.appState.isDataLoaded) {
                const mediaTypesTable = window.appState.mediaTypesTable;
                const mediaExists = Object.keys(mediaTypesTable).some(key =>
                    key.toLowerCase() === upperInput.toLowerCase());

                if (!mediaExists) {
                    showFeedback(`ERROR: Media "${rawInput}" not found in reference data. Cannot proceed.`, 'error');
                    return; // Do not proceed
                }
            }
            resolvedMediaCode = upperInput;
        }

        // Store the resolved media code
        StateManager.setState('initiatorState.media', resolvedMediaCode);

        // Also store the resolved media name for display purposes
        if (mediaName) {
            StateManager.setState('initiatorState.mediaName', mediaName);
        }

        // Check for available media batches
        if (window.MediaBatchManager && mediaName) {
            const availableBatches = MediaBatchManager.getAvailableBatches(mediaName);
            if (availableBatches.length > 0) {
                // Show batch info in feedback
                const batchInfo = availableBatches.map(b =>
                    `${b.id} (${b.availableContainers} containers)`
                ).join(', ');
                showFeedback(`Media: ${mediaName}. Available batches: ${batchInfo}`, 'info');

                // Store first available batch as default (can be changed later)
                StateManager.setState('initiatorState.mediaBatchId', availableBatches[0].id);
            }
        }

        // Move to next step (stage)
        moveToStep('stage');
        updateInitiatorUI();
    }
    
    /**
     * Process stage input
     * Uses InventoryLookupService to resolve any input format (ID or name)
     */
    function processStageInput() {
        const input = document.getElementById('initiatorInput').value.trim();

        if (!input) {
            showFeedback('Please enter a valid stage (ID or name)', 'error');
            return;
        }

        // Use InventoryLookupService if available
        let resolvedStageId = null;
        let stageName = null;

        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const stageData = window.InventoryLookupService.resolveStage(input);
            if (stageData) {
                resolvedStageId = stageData.id;
                stageName = stageData.name;
                showFeedback(`Stage resolved: ${input} → ${stageData.id} (${stageData.name})`, 'success');
            } else {
                // Not found in lookup - BLOCK progression
                showFeedback(`ERROR: Stage "${input}" not recognized. Please enter a valid stage ID (1-9) or name (e.g., "In Vitro", "Rooted") from the HQ workbook.`, 'error');
                return; // Do not proceed
            }
        } else {
            // Fallback to legacy behavior - only accept numeric IDs
            if (!input.match(/^[1-9]$/)) {
                showFeedback(`ERROR: Stage must be a single digit between 1 and 9. Cannot proceed.`, 'error');
                return;
            }
            resolvedStageId = input;
        }

        // Store the resolved stage ID
        StateManager.setState('initiatorState.stage', resolvedStageId);

        // Also store the resolved stage name for display purposes
        if (stageName) {
            StateManager.setState('initiatorState.stageName', stageName);
        }

        moveToStep('tissue');
        updateInitiatorUI();
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

        // Move to location step (optional step before container creation)
        moveToStep('location');
        updateInitiatorUI();
        showFeedback(`Date set to: ${input}. Select a location below or skip, then click "Create Container".`, 'success');
    }

    /**
     * Process location input
     * Location is optional - user can skip by pressing Enter with empty input
     */
    function processLocationInput() {
        const input = document.getElementById('initiatorInput').value.trim();

        // Location is optional, so empty input is allowed
        if (input) {
            // Validate against known locations if lookup service is available
            if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
                const resolvedLocation = window.InventoryLookupService.resolveLocation(input);
                if (resolvedLocation) {
                    StateManager.setState('initiatorState.location', resolvedLocation);
                    showFeedback(`Location resolved: ${input} → ${resolvedLocation}`, 'success');
                } else {
                    // Not found in lookup - use input as-is (custom location)
                    StateManager.setState('initiatorState.location', input);
                    showFeedback(`Custom location set: ${input}`, 'info');
                }
            } else {
                // No lookup service - use input as-is
                StateManager.setState('initiatorState.location', input);
                showFeedback(`Location set to: ${input}`, 'success');
            }
        } else {
            // Skip location - set to null
            StateManager.setState('initiatorState.location', null);
            showFeedback('Location skipped. Creating container...', 'info');
        }

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
        
        // Use pre-populated Container_ID from QR pool if available, otherwise auto-generate
        const prePopulatedId = StateManager.getState('initiatorState.prePopulatedContainerId');
        if (prePopulatedId) {
            currentContainerId = prePopulatedId;
        } else {
            updateNextAvailableId();
        }
        
        // Create new container with today's date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Resolve owner and strain names from reference data
        let ownerName = owner;
        let strainName = 'Unknown Strain';
        // For no-media containers, display N/A explicitly
        // Otherwise, start with the already-resolved name from state (set during media input or recipe selection)
        const storedMediaName = StateManager.getState('initiatorState.mediaName');
        let mediaName = hasNoMedia ? 'N/A' : (storedMediaName || null);
        
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
        const location = StateManager.getState('initiatorState.location');
        const recipeId = StateManager.getState('initiatorState.recipeId');
        const recipeName = StateManager.getState('initiatorState.recipeName');

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
            recipeId: recipeId || null,
            recipeName: recipeName || null,
            location: location || null,
            tissueCount: tissue,
            date: formattedDate,
            status: 'Complete',
            notes: barcodeString  // Store barcode in notes for preservation
        };
        
        // Add to inventory using StateManager to ensure proper tracking
        window.appState.inventory.push(newContainer); // Append to end to match Excel row order

        // Log container creation via AuditService (Phase 3)
        if (window.AuditService) {
            AuditService.logContainerCreated(currentContainerId, {
                strain: strainName,
                owner: ownerName,
                stage: stageName,
                media: mediaName,
                location: location,
                tissueCount: tissue,
                date: formattedDate,
                metadata: {
                    qrExcelRow: qrExcelRow,
                    source: 'initiator'
                }
            });
        }

        // Add to LineageService (Phase 3)
        if (window.LineageService) {
            LineageService.addNode(currentContainerId, {
                strain: strainName,
                owner: ownerName,
                createdAt: new Date().toISOString()
            });
        }

        // Assign the scanned QR code to this container
        const qrExcelRow = StateManager.getState('initiatorState.qrExcelRow');
        if (qrExcelRow && window.QRCodeService) {
            const assigned = QRCodeService.assignRowToContainer(qrExcelRow, currentContainerId);
            if (assigned) {
                const poolEntry = QRCodeService.lookupByRow(qrExcelRow);
                newContainer.qrExcelRow = qrExcelRow;
                newContainer.qrExcelUrl = poolEntry ? poolEntry.excelUrl : null;
                newContainer.qrDataUrl = poolEntry ? poolEntry.dataUrl : null;
            }
        }

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

        // Sync to cloud - update the pre-populated row with all metadata including location
        if (window.OneDriveSync && window.OneDriveSync.updateRowByContainerId) {
            (async () => {
                try {
                    console.log(`ContainerInitiator: Syncing new container ${currentContainerId} to cloud...`);
                    const result = await window.OneDriveSync.updateRowByContainerId(currentContainerId, {
                        strain: strainName,
                        owner: ownerName,
                        stage: stageName,
                        location: location || '',
                        media: mediaName || '',
                        tissueCount: tissue,
                        date: formattedDate,
                        notes: barcodeString,
                        status: 'Complete'
                    });
                    if (result.success) {
                        console.log(`ContainerInitiator: Cloud sync successful for ${currentContainerId}`);
                    } else {
                        console.warn(`ContainerInitiator: Cloud sync failed for ${currentContainerId}`);
                    }
                } catch (err) {
                    console.error('ContainerInitiator: Error syncing to cloud:', err);
                }
            })();
        }

        // QR codes are pre-printed and assigned during the QR scan step.
        // No runtime QR generation needed.

        // Show success message
	showFeedback(`Container ${currentContainerId} created successfully! Resetting for next container...`, 'success');
        //showFeedback(`Container ${currentContainerId} created successfully!`, 'success');
        
        // po changing this:
	//Mark this initiator run as completed so additional "Next" presses
        // don't create more containers with the same metadata. The next
        // invocation of handleInitiatorInput() will reset the initiator to
        // start a fresh container.
	// so that app does this:
	// Mark this initiator run as completed temporarily
        try {
            StateManager.setState('initiatorState.completed', true);
        } catch (e) {
            console.warn('Failed to mark initiator state as completed:', e);
        }
        //po changed this because we don't need an additional click but can remove if a problem 
        // NOTE: Do not immediately reset the initiator so the user can see the QR/confirmation.
        // The user can start a new initiation explicitly when ready (pressing
        // Next again will reset for a new container instead of duplicating).
	// Auto-reset after 2 seconds to allow user to see confirmation, then prepare for next container
        setTimeout(() => {
            console.log('🔄 Auto-resetting initiator for next container...');
            resetInitiator();
        }, 2000);
    }
    
    /**
     * Update the UI for container confirmation
     */
    async function updateContainerConfirmation(container) {
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

        // Show assigned QR code info (QR is assigned at the start of the flow)
        const qrEl = document.getElementById('confirmQrCode');
        if (qrEl) {
            const qrRow = StateManager.getState('initiatorState.qrExcelRow');
            if (qrRow) {
                const poolEntry = window.QRCodeService ? window.QRCodeService.lookupByRow(qrRow) : null;
                const displayId = poolEntry?.containerId || `#${qrRow}`;
                qrEl.innerHTML = `
                    <div style="background: #d1fae5; border: 2px solid #059669; border-radius: 8px; padding: 12px; margin-top: 10px;">
                        <p style="margin: 0 0 4px 0; font-weight: 600; color: #065f46;">QR Code Assigned</p>
                        <p style="margin: 0; font-size: 0.85rem; color: #047857;">ID: ${displayId}</p>
                    </div>
                `;
            } else {
                qrEl.innerHTML = '';
            }
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
            backBtn.disabled = (currentStep === 'qr' || isCompleted);
        }
        
        // Update primary button label based on current step and completion state
        if (nextBtn) {
            if (isCompleted) {
                nextBtn.textContent = 'Start New Container';
            } else if (currentStep === 'location') {
                nextBtn.textContent = '✅ Create Container';
                nextBtn.style.background = '#059669'; // Green to indicate final action
            } else {
                nextBtn.textContent = 'Next Step';
                nextBtn.style.background = ''; // Reset to default
            }
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

        // Show location picker only on the location step
        const locationPicker = document.getElementById('initiatorLocationPicker');
        if (locationPicker) {
            const isLocationStep = currentStep === 'location';
            locationPicker.style.display = isLocationStep ? 'block' : 'none';

            // When entering location step, populate the dropdown
            if (isLocationStep) {
                populateLocationDropdown();
            }
        }
        
        // Update prompt and hint based on step
        switch (currentStep) {
            case 'qr':
                prompt.textContent = 'Scan QR Code Label:';
                hint.textContent = 'Scan a pre-printed QR label or select from generated batch below';
                break;
            case 'owner':
                prompt.textContent = 'Enter Owner ID:';
                hint.textContent = 'Start typing to search owners by code or name';
                break;
            case 'strain':
                prompt.textContent = 'Enter Strain ID:';
                hint.textContent = 'Start typing to search strains (filtered by selected owner)';
                break;
            case 'media':
                prompt.textContent = 'Enter Media Type (optional):';
                hint.textContent = 'Type media code, "N/A" for no media, or select a recipe below';
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
            case 'location':
                prompt.textContent = 'Enter Location (optional):';
                hint.textContent = 'Type location (e.g., Tent 1, 231 Top Shelf) or press Enter to skip';
                break;
            default:
                prompt.textContent = 'Enter value:';
                hint.textContent = 'Type the required value and press Enter';
        }
        
        // Show QR batch picker when on QR step
        showQrBatchPicker(currentStep === 'qr');

        // Show recipe picker when on media step
        showRecipePicker(currentStep === 'media');

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

        const qrExcelRow = StateManager.getState('initiatorState.qrExcelRow');
        const prePopulatedId = StateManager.getState('initiatorState.prePopulatedContainerId');
        const owner = StateManager.getState('initiatorState.owner') || '-';
        const strain = StateManager.getState('initiatorState.strain') || '-';
        const media = StateManager.getState('initiatorState.media') || '-';
        const stage = StateManager.getState('initiatorState.stage') || '-';
        const tissue = StateManager.getState('initiatorState.tissue') || '-';
        const date = StateManager.getState('initiatorState.date') || '-';
        const location = StateManager.getState('initiatorState.location') || '-';

        // Display container ID if available, otherwise show QR # format
        const qrDisplayId = prePopulatedId || (qrExcelRow ? `#${qrExcelRow}` : '-');

        summaryElement.innerHTML = `
            <div class="status-item">QR ID: <strong>${qrDisplayId}</strong></div>
            <div class="status-item">Owner: <strong>${owner}</strong></div>
            <div class="status-item">Strain: <strong>${strain}</strong></div>
            <div class="status-item">Media: <strong>${media}</strong></div>
            <div class="status-item">Stage: <strong>${stage}</strong></div>
            <div class="status-item">Tissue: <strong>${tissue}</strong></div>
            <div class="status-item">Date: <strong>${date}</strong></div>
            <div class="status-item">Location: <strong>${location}</strong></div>
            <div class="status-item">Next ID: <strong>${currentContainerId || '-'}</strong></div>
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
            showFeedback(`Date set to: ${formatted}. Press Next to set location.`, 'info');
        } catch (error) {
            console.error('❌ Error selecting quick date:', error);
        }
    }
    
    /**
     * Populate the location dropdown with available locations from HQ workbook
     */
    function populateLocationDropdown() {
        const select = document.getElementById('initiatorLocationSelect');
        if (!select) return;

        // Get locations from available sources
        let locations = [];
        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            locations = window.InventoryLookupService.getAllLocations();
        } else if (window.appState.locationsTable && window.appState.locationsTable.length > 0) {
            locations = window.appState.locationsTable;
        }

        // Build options HTML
        let optionsHtml = '<option value="">-- Select from HQ Locations --</option>';
        optionsHtml += '<option value="_skip_">Skip (no location)</option>';

        locations.forEach(loc => {
            optionsHtml += `<option value="${loc}">${loc}</option>`;
        });

        select.innerHTML = optionsHtml;

        // Pre-select current value if set
        const currentLocation = StateManager.getState('initiatorState.location');
        if (currentLocation) {
            select.value = currentLocation;
        }
    }

    /**
     * Quick-select location from dropdown
     * @param {string} location - Selected location value
     */
    function selectLocation(location) {
        try {
            const currentStep = StateManager.getState('initiatorState.currentStep');
            if (currentStep !== 'location') {
                // If somehow called on another step, force to location step first
                moveToStep('location');
                updateInitiatorUI();
            }

            const input = document.getElementById('initiatorInput');

            if (location === '_skip_') {
                // User chose to skip location
                if (input) input.value = '';
                StateManager.setState('initiatorState.location', null);
                updateStatusSummary();
                showFeedback('Location skipped. Click "Create Container" to finish.', 'info');
            } else if (location) {
                // User selected a location
                if (input) input.value = location;
                StateManager.setState('initiatorState.location', location);
                updateStatusSummary();
                showFeedback(`Location set to: ${location}. Click "Create Container" to finish.`, 'success');
            }
        } catch (error) {
            console.error('❌ Error selecting location:', error);
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
                showFeedback('Already at the first step (QR).', 'info');
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
                case 'qr':
                    previousValue = StateManager.getState('initiatorState.qrExcelRow');
                    break;
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
                case 'location':
                    previousValue = StateManager.getState('initiatorState.location');
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
            currentStep: 'qr',
            qrExcelRow: null,
            prePopulatedContainerId: null,
            owner: null,
            strain: null,
            media: null,
            stage: null,
            tissue: null,
            date: null,
            location: null,
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
    
    /**
     * Show/hide a visual picker of available QR codes from the generated batch.
     * Allows the user to click a QR code to select it instead of scanning.
     */
    function showQrBatchPicker(show) {
        let picker = document.getElementById('qrBatchPicker');

        if (!show) {
            if (picker) picker.style.display = 'none';
            return;
        }

        if (!window.QRCodeService) {
            console.warn('QRCodeService not available for picker');
            return;
        }

        // Force fresh read from localStorage
        const unassigned = QRCodeService.getUnassigned();
        console.log('showQrBatchPicker: Found', unassigned.length, 'unassigned QR codes');

        if (!picker) {
            // Create the picker container
            picker = document.createElement('div');
            picker.id = 'qrBatchPicker';
            picker.style.cssText = 'margin-top: 12px; max-height: 260px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f9fafb;';

            // Insert after the initiator input area
            const inputArea = document.getElementById('initiatorInput');
            if (inputArea && inputArea.parentElement) {
                inputArea.parentElement.parentElement.appendChild(picker);
            } else {
                // Fallback: try to find initiator section
                const initiatorSection = document.querySelector('.initiator-section, #containerInitiator');
                if (initiatorSection) {
                    initiatorSection.appendChild(picker);
                }
            }
        }

        picker.style.display = 'block';

        if (unassigned.length === 0) {
            picker.innerHTML = `
                <p style="color: #6b7280; font-size: 0.85rem; margin: 0;">
                    No QR codes available. Generate a batch first using the QR Code Pool section above.
                </p>
                <p style="color: #9ca3af; font-size: 0.75rem; margin: 8px 0 0 0;">
                    Make sure the backend server is running (npm run backend)
                </p>
            `;
            return;
        }

        let html = '<p style="margin: 0 0 8px; font-size: 0.85rem; font-weight: 600; color: #374151;">Or select from generated batch:</p>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px;">';
        unassigned.forEach(qr => {
            const displayId = qr.containerId || `#${qr.excelRow}`;
            html += `
                <div class="qr-batch-item" data-excel-row="${qr.excelRow}" style="text-align: center; padding: 8px; border: 2px solid #e2e8f0; border-radius: 8px; background: white; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <img src="${qr.dataUrl}" alt="ID ${displayId}" style="width: 90px; height: 90px;" />
                    <p style="margin: 4px 0 0; font-family: monospace; font-size: 0.9rem; font-weight: bold; color: #059669;">ID: ${displayId}</p>
                </div>`;
        });
        html += '</div>';
        picker.innerHTML = html;

        // Add click handlers
        picker.querySelectorAll('.qr-batch-item').forEach(item => {
            item.addEventListener('click', function() {
                const row = parseInt(this.getAttribute('data-excel-row'));
                if (!row) return;

                // Set the input value and process it
                const input = document.getElementById('initiatorInput');
                if (input) input.value = String(row);
                processQrInput();
            });
        });
    }

    /**
     * Show/hide a visual picker of available recipes.
     * Allows the user to click a recipe to select it for media type.
     */
    function showRecipePicker(show) {
        let picker = document.getElementById('recipePicker');

        if (!show) {
            if (picker) picker.style.display = 'none';
            return;
        }

        // Get recipes from RecipeStorage
        let recipes = [];
        if (window.RecipeStorage) {
            recipes = RecipeStorage.getAllRecipes() || [];
        }

        if (!picker) {
            // Create the picker container
            picker = document.createElement('div');
            picker.id = 'recipePicker';
            picker.style.cssText = 'margin-top: 12px; max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f0fdf4;';

            // Insert after the initiator input area
            const inputArea = document.getElementById('initiatorInput');
            if (inputArea && inputArea.parentElement) {
                inputArea.parentElement.parentElement.appendChild(picker);
            } else {
                const initiatorSection = document.querySelector('.initiator-section, #containerInitiator');
                if (initiatorSection) {
                    initiatorSection.appendChild(picker);
                }
            }
        }

        picker.style.display = 'block';

        if (recipes.length === 0) {
            picker.innerHTML = `
                <p style="color: #6b7280; font-size: 0.85rem; margin: 0;">
                    📋 No recipes available. Create recipes in the Media Lab section.
                </p>
                <p style="color: #9ca3af; font-size: 0.75rem; margin: 8px 0 0 0;">
                    Or type a media code manually above (e.g., "Initiation", "IA", "N/A")
                </p>
            `;
            return;
        }

        // Group recipes by media type
        const recipesByType = {};
        recipes.forEach(recipe => {
            const type = recipe.mediaType || 'Other';
            if (!recipesByType[type]) recipesByType[type] = [];
            recipesByType[type].push(recipe);
        });

        let html = '<p style="margin: 0 0 10px; font-size: 0.9rem; font-weight: 600; color: #166534;">🧪 Select a Recipe:</p>';

        // Add "N/A - No Media" option at the top
        html += `
            <div class="recipe-picker-item" data-media-code="N/A" data-recipe-id=""
                 style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; border: 2px solid #d1d5db; border-radius: 8px; background: #f3f4f6; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.borderColor='#6b7280'; this.style.background='#e5e7eb';"
                 onmouseout="this.style.borderColor='#d1d5db'; this.style.background='#f3f4f6';">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: #9ca3af; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="font-size: 18px;">⊘</span>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #374151;">N/A - No Media</div>
                    <div style="font-size: 0.75rem; color: #6b7280;">Skip media selection</div>
                </div>
            </div>
        `;

        // Add recipes grouped by type
        Object.keys(recipesByType).forEach(mediaType => {
            const typeRecipes = recipesByType[mediaType];
            const typeColor = getMediaTypeColor(mediaType);

            html += `<div style="margin-top: 12px; margin-bottom: 8px; font-size: 0.8rem; font-weight: 600; color: ${typeColor}; text-transform: uppercase; letter-spacing: 0.5px;">${mediaType}</div>`;

            typeRecipes.forEach(recipe => {
                // Get available batches for this recipe
                let batchInfo = '';
                let totalContainers = 0;
                if (window.MediaBatchManager) {
                    const batches = MediaBatchManager.getAvailableBatches(recipe.mediaType);
                    const recipeBatches = batches.filter(b => b.recipeId === recipe.id);
                    if (recipeBatches.length > 0) {
                        totalContainers = recipeBatches.reduce((sum, b) => sum + (b.availableContainers || 0), 0);
                        batchInfo = `${recipeBatches.length} batch(es), ${totalContainers} containers available`;
                    }
                }

                html += `
                    <div class="recipe-picker-item" data-media-code="${recipe.mediaType}" data-recipe-id="${recipe.id}" data-recipe-name="${recipe.name}"
                         style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; border: 2px solid #e2e8f0; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.borderColor='${typeColor}'; this.style.background='#f0fdf4';"
                         onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='white';">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: ${typeColor}; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                            <span style="color: white; font-size: 14px; font-weight: bold;">${recipe.mediaType?.substring(0,2) || '??'}</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1f2937;">${recipe.name}</div>
                            <div style="font-size: 0.75rem; color: #6b7280;">
                                ${recipe.volume || '1L'} • ${recipe.basalSalt?.type || 'N/A'} base
                                ${batchInfo ? ` • <span style="color: #059669;">${batchInfo}</span>` : ''}
                            </div>
                        </div>
                        ${totalContainers > 0 ? `<div style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">${totalContainers} avail</div>` : ''}
                    </div>
                `;
            });
        });

        picker.innerHTML = html;

        // Add click handlers
        picker.querySelectorAll('.recipe-picker-item').forEach(item => {
            item.addEventListener('click', function() {
                const mediaCode = this.getAttribute('data-media-code');
                const recipeId = this.getAttribute('data-recipe-id');
                const recipeName = this.getAttribute('data-recipe-name');

                selectRecipeForMedia(mediaCode, recipeId, recipeName);
            });
        });
    }

    /**
     * Get color for media type (for recipe picker)
     */
    function getMediaTypeColor(mediaType) {
        const colors = {
            'Initiation': '#059669',
            'Multiplication': '#2563eb',
            'Rooting': '#7c3aed',
            'IA': '#059669',
            'MA': '#2563eb',
            'RA': '#7c3aed'
        };
        return colors[mediaType] || '#6b7280';
    }

    /**
     * Handle recipe selection from picker
     */
    function selectRecipeForMedia(mediaCode, recipeId, recipeName) {
        const input = document.getElementById('initiatorInput');

        if (mediaCode === 'N/A') {
            // No media selected
            if (input) input.value = 'N/A';
            StateManager.setState('initiatorState.media', 'N/A');
            StateManager.setState('initiatorState.mediaName', 'N/A');
            StateManager.setState('initiatorState.recipeId', null);
            StateManager.setState('initiatorState.recipeName', null);

            // Hide the recipe picker
            showRecipePicker(false);

            moveToStep('stage');
            updateInitiatorUI();
            showFeedback('Media set to: N/A (no media)', 'success');
            return;
        }

        // Resolve the recipe mediaType (e.g., "Initiation") to a proper code and name
        // using InventoryLookupService, which maps names/codes to canonical {code, name}
        let resolvedCode = mediaCode;
        let resolvedName = mediaCode;

        if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
            const mediaData = InventoryLookupService.resolveMediaType(mediaCode);
            if (mediaData) {
                resolvedCode = mediaData.code;
                resolvedName = mediaData.name;
            }
        } else if (window.appState.isDataLoaded && window.appState.mediaTypesTable) {
            // Fallback: try direct lookup by code, then search by name
            const table = window.appState.mediaTypesTable;
            const upperCode = mediaCode.toUpperCase();
            if (table[upperCode]) {
                resolvedCode = upperCode;
                const entry = table[upperCode];
                resolvedName = typeof entry === 'string' ? entry : (entry && entry.name ? entry.name : mediaCode);
            } else {
                // Search by name match (e.g., "Initiation" -> find key "IA" with name "Initiation")
                for (const [key, val] of Object.entries(table)) {
                    const name = typeof val === 'string' ? val : (val && val.name ? val.name : '');
                    if (name.toLowerCase() === mediaCode.toLowerCase()) {
                        resolvedCode = key;
                        resolvedName = name;
                        break;
                    }
                }
            }
        }

        // Set the input value
        if (input) input.value = resolvedCode;

        // Store the resolved media code and name, plus recipe info
        StateManager.setState('initiatorState.media', resolvedCode);
        StateManager.setState('initiatorState.mediaName', resolvedName);
        StateManager.setState('initiatorState.recipeId', recipeId);
        StateManager.setState('initiatorState.recipeName', recipeName);

        // Check for available batches
        if (window.MediaBatchManager && recipeId) {
            const allBatches = MediaBatchManager.getAvailableBatches(resolvedCode);
            const recipeBatches = allBatches.filter(b => b.recipeId === recipeId);

            if (recipeBatches.length > 0) {
                // Auto-select the first available batch for this recipe
                StateManager.setState('initiatorState.mediaBatchId', recipeBatches[0].id);
                const totalContainers = recipeBatches.reduce((sum, b) => sum + (b.availableContainers || 0), 0);
                showFeedback(`Recipe: ${recipeName}. ${recipeBatches.length} batch(es) available with ${totalContainers} containers.`, 'success');
            } else {
                showFeedback(`Recipe: ${recipeName} selected. No prepared batches available.`, 'info');
            }
        } else {
            showFeedback(`Media: ${resolvedCode} - ${resolvedName} (${recipeName || 'custom'})`, 'success');
        }

        // Hide the recipe picker
        showRecipePicker(false);

        // Move to next step
        moveToStep('stage');
        updateInitiatorUI();
    }

    /**
     * Refresh the QR batch picker (call after generating new QR codes)
     * Always refreshes if the picker element exists, regardless of current step
     */
    function refreshQrPicker() {
        const picker = document.getElementById('qrBatchPicker');
        const currentStep = StateManager.getState('initiatorState.currentStep');

        // If we're on the QR step, refresh the picker
        if (currentStep === 'qr') {
            showQrBatchPicker(true);
        } else if (picker) {
            // If picker exists but we're on a different step,
            // still update it so it's ready when user goes back
            showQrBatchPicker(true);
        }

        console.log('QR Picker refreshed. Unassigned count:',
            window.QRCodeService ? QRCodeService.getUnassigned().length : 0);
    }

    // Public API
    return {
        initialize: initialize,
        resetInitiator: resetInitiator,
        updateNextAvailableId: updateNextAvailableId,
        handleInitiatorInput: handleInitiatorInput,
        goToPreviousStep: goToPreviousStep,
        selectQuickDate: selectQuickDate,
        selectLocation: selectLocation,
        refreshQrPicker: refreshQrPicker
    };
})();
