// Barcode Builder Step Management
// Lab Barcode Builder & Transfer System

window.BuilderStepManager = {
    // Step configuration and prompts
    getStepConfig: function(step) {
        const configs = {
            container: {
                prompt: 'Enter or scan the Container ID:',
                hint: 'Scan or type the container number',
                placeholder: 'e.g., 1234',
                validation: /^\d+$/,
                options: []
            },
            owner: {
                prompt: 'Select or scan the Owner ID:',
                hint: 'Choose from the list below or scan/type the ID',
                placeholder: 'e.g., LW, J, etc.',
                validation: /^[A-Z]+$/i,
                options: 'owners'
            },
            strain: {
                prompt: 'Select or scan the Strain:',
                hint: 'Choose from the list or enter the strain ID (5 digits)',
                placeholder: 'e.g., 00001',
                validation: /^\d{1,5}$/,
                options: 'strains'
            },
            media: {
                prompt: 'Select or scan the Media Type:',
                hint: 'Choose from the list below or scan/type the media code',
                placeholder: 'e.g., IA, MA, etc.',
                validation: /^[A-Z]+$/i,
                options: 'media'
            },
            recipe: {
                prompt: 'Select or create a recipe for this media:',
                hint: 'Recipe creation is mandatory for traceability',
                placeholder: 'Recipe selection required',
                validation: /^.+$/,
                options: 'recipe'
            },
            stage: {
                prompt: 'Select the Propagation Stage:',
                hint: 'Choose the current stage (1-9)',
                placeholder: 'e.g., 1',
                validation: /^[1-9]$/,
                options: 'stages'
            },
            tissue: {
                prompt: 'Enter the Tissue Count:',
                hint: 'How many tissue samples? (1-99)',
                placeholder: 'e.g., 15',
                validation: /^\d{1,2}$/,
                options: 'tissue_counts'
            },
            date: {
                prompt: 'Enter or select the Date:',
                hint: 'Format: YYYYMMDD or use today\'s date',
                placeholder: 'e.g., 20250622',
                validation: /^\d{8}$/,
                options: 'dates'
            }
        };
        
        return configs[step] || null;
    },
    
    // Update the UI for the current step
    updateStep: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        const stepConfig = this.getStepConfig(stepName);
        
        if (!stepConfig) return;
        
        // Special handling for recipe step
        if (stepName === 'recipe') {
            this.handleRecipeStep();
            return;
        }
        
        // Update prompts and hints
        UIUtils.updateContent('builderPrompt', stepConfig.prompt);
        UIUtils.updateContent('builderHint', stepConfig.hint);
        
        // Update input placeholder
        const input = document.getElementById('builderInput');
        if (input) {
            input.placeholder = stepConfig.placeholder;
            input.value = '';
        }
        
        // Populate options
        this.populateOptions(stepName, stepConfig);
        
        // Update button text
        const isLastStep = currentStep === window.appState.builderState.steps.length - 1;
        UIUtils.updateContent('builderNextBtn', isLastStep ? 'Generate Barcode' : 'Next Step →');
        
        // Focus input
        UIUtils.focusBuilderInput();
        
        // Update live preview
        this.updateFieldPreview();
        
        // Set up real-time input monitoring for live preview
        this.setupRealTimePreview();
        
        console.log(`Builder step updated: ${stepName} (${currentStep + 1}/${window.appState.builderState.steps.length})`);
    },
    
    // Populate options based on step type
    populateOptions: function(stepName, stepConfig) {
        const optionsDiv = document.getElementById('builderOptions');
        if (!optionsDiv) return;
        
        optionsDiv.innerHTML = '';
        
        let options = [];
        
        switch(stepConfig.options) {
            case 'owners':
                options = Object.entries(window.appState.ownersTable).map(([id, name]) => ({
                    value: id,
                    display: `${name} (${id})`
                }));
                break;
                
            case 'strains':
                // Show first 20 strains as options
                options = Object.entries(window.appState.strainsTable).slice(0, 20).map(([id, name]) => ({
                    value: id.padStart(5, '0'),
                    display: `${name} (${id.padStart(5, '0')})`
                }));
                break;
                
            case 'media':
                options = Object.entries(window.appState.mediaTypesTable).map(([id, name]) => ({
                    value: id,
                    display: `${name} (${id})`
                }));
                break;
                
            case 'stages':
                options = Object.entries(window.appState.stagesTable).map(([id, name]) => ({
                    value: id,
                    display: `${name} (Stage ${id})`
                }));
                break;
                
            case 'tissue_counts':
                // Common tissue counts
                options = [1, 5, 10, 15, 20, 25, 30, 50].map(count => ({
                    value: count.toString(),
                    display: `${count} samples`
                }));
                break;
                
            case 'dates':
                // Today and recent dates
                const today = new Date();
                options = [];
                for (let i = 0; i < 7; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
                    options.push({
                        value: dateStr,
                        display: i === 0 ? 'Today' : date.toLocaleDateString()
                    });
                }
                break;
        }
        
        // Create option buttons
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = option.display;
            btn.onclick = () => this.selectOption(option.value);
            optionsDiv.appendChild(btn);
        });
    },
    
    // Handle option selection
    selectOption: function(value) {
        const input = document.getElementById('builderInput');
        if (input) {
            input.value = value;
            this.validateAndProceed();
        }
    },
    
    // Validate current input and proceed to next step
    validateAndProceed: function() {
        const input = document.getElementById('builderInput').value.trim();
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        
        if (!input) {
            NotificationSystem.showBuilderFeedback('Please enter a value', 'error');
            return false;
        }
        
        // Validate format
        if (!DataUtils.validateInput(stepName, input)) {
            NotificationSystem.showBuilderFeedback(`Invalid format for ${stepName}`, 'error');
            return false;
        }
        
        // Store the value and metadata
        this.storeStepValue(stepName, input);
        
        // Show success feedback
        NotificationSystem.showBuilderFeedback(`✅ ${stepName} set: ${input}`, 'success');
        
        // Clear the input field for next entry
        UIUtils.clearInput('builderInput');
        
        // Move to next step
        setTimeout(() => {
            this.nextStep();
        }, 300);
        
        return true;
    },
    
    // Store step value and associated metadata
    storeStepValue: function(stepName, input) {
        const processedValue = stepName === 'container' ? input : input.toUpperCase();
        
        // Store the value
        StateManager.setState(`builderState.values.${stepName}`, processedValue);
        
        // Store metadata if available
        switch(stepName) {
            case 'owner':
                StateManager.setState('builderState.metadata.ownerName', 
                    window.appState.ownersTable[input] || input);
                break;
                
            case 'strain':
                const strainId = input.padStart(5, '0');
                StateManager.setState('builderState.values.strain', strainId);
                StateManager.setState('builderState.metadata.strainName', 
                    window.appState.strainsTable[parseInt(strainId)] || 'Unknown Strain');
                
                // Auto-populate owner from strain-to-owner mapping
                this.autoPopulateOwnerFromStrain(strainId);
                break;
                
            case 'media':
                StateManager.setState('builderState.metadata.mediaName', 
                    window.appState.mediaTypesTable[input] || input);
                break;
                
            case 'stage':
                StateManager.setState('builderState.metadata.stageName', 
                    window.appState.stagesTable[parseInt(input)] || `Stage ${input}`);
                break;
        }
        
        // Update the live preview after storing the value
        this.updateFieldPreview();
    },
    
    // Move to next step
    nextStep: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        
        // Mark current step as completed
        this.updateProgressStep(stepName, 'completed');
        
        // Move to next step
        StateManager.setState('builderState.currentStep', currentStep + 1);
        
        if (currentStep + 1 < window.appState.builderState.steps.length) {
            // Update to next step
            const nextStepName = window.appState.builderState.steps[currentStep + 1];
            this.updateProgressStep(nextStepName, 'active');
            this.updateStep();
        } else {
            // Generate barcode
            BuilderBarcodeGenerator.generateBarcode();
        }
    },
    
    // Update progress step visual state
    updateProgressStep: function(stepName, state) {
        const stepElement = document.getElementById(`step-${stepName}`);
        if (!stepElement) return;
        
        // Remove all state classes
        stepElement.classList.remove('active', 'completed');
        
        // Add new state
        if (state) {
            stepElement.classList.add(state);
        }
    },
    
    // Reset builder to first step
    reset: function() {
        // Reset state
        StateManager.resetBuilderState();
        
        // Reset UI
        window.appState.builderState.steps.forEach((stepName, index) => {
            if (index === 0) {
                this.updateProgressStep(stepName, 'active');
            } else {
                this.updateProgressStep(stepName, null);
            }
        });
        
        // Hide generated barcode
        UIUtils.showElement('generatedBarcode', false);
        
        // Update to first step
        this.updateStep();
        
        // Reset the field preview
        this.resetFieldPreview();
        
        NotificationSystem.info('Builder reset to first step');
    },
    
    // Handle manual input (when user types and presses Enter)
    handleInput: function() {
        const input = document.getElementById('builderInput').value.trim();
        if (input) {
            this.validateAndProceed();
        }
    },
    
    // Handle "Next Step" button click
    handleNextButton: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        
        // Special handling for recipe step
        if (stepName === 'recipe') {
            if (!window.appState.builderState.values.recipe) {
                NotificationSystem.showBuilderFeedback('Please select or create a recipe', 'error');
                return;
            }
            this.nextStep();
            return;
        }
        
        // If there's input that hasn't been processed, validate it first
        const currentInput = document.getElementById('builderInput').value.trim();
        
        if (currentInput && !window.appState.builderState.values[stepName]) {
            this.validateAndProceed();
            return;
        }
        
        // If empty and value not set, show error
        if (!window.appState.builderState.values[stepName]) {
            NotificationSystem.showBuilderFeedback('Please complete this step', 'error');
            return;
        }
        
        // Move to next step
        this.nextStep();
    },
    
    // Handle recipe step specially
    handleRecipeStep: function() {
        console.log('🧪 Starting recipe step...');
        console.log('RecipeManager available:', !!window.RecipeManager);
        
        if (!window.RecipeManager) {
            console.error('RecipeManager not available - waiting for initialization');
            setTimeout(() => this.handleRecipeStep(), 100);
            return;
        }
        
        console.log('RecipeManager methods:', Object.keys(window.RecipeManager));
        
        // Always use the new Recipe Manager wizard
        this.setupRecipeWizard();
        
        // Show the recipe step
        window.RecipeManager.showRecipeStep();
        
        // Hide the builder input since we're using the recipe wizard
        const input = document.getElementById('builderInput');
        if (input) {
            input.style.display = 'none';
        }
        
        // Hide the options area since we're using the recipe wizard
        const optionsDiv = document.getElementById('builderOptions');
        if (optionsDiv) {
            optionsDiv.style.display = 'none';
        }
        
        // Update button text
        UIUtils.updateContent('builderNextBtn', 'Continue with Recipe →');
        
        console.log('✅ Recipe step initialized with new Recipe Manager wizard');
    },
    
    // Setup the recipe wizard UI
    setupRecipeWizard: function() {
        // Check if RecipeManager needs to initialize its UI
        if (!document.getElementById('recipeSection')) {
            console.log('Setting up Recipe Manager UI...');
            
            // Call the setupRecipeUI function from RecipeManager
            if (window.RecipeManager && typeof window.RecipeManager.setupRecipeUI === 'function') {
                window.RecipeManager.setupRecipeUI();
            } else {
                console.warn('RecipeManager.setupRecipeUI not available');
            }
        }
    },
    
    // Continue from recipe step (called by RecipeManager)
    continueFromRecipeStep: function(recipe) {
        // Debug logging
        console.log('🔧 continueFromRecipeStep called with recipe:', recipe);
        console.log('🔧 Current builder state before recipe update:', JSON.stringify(window.appState.builderState.values, null, 2));
        
        // Store recipe data
        StateManager.setState('builderState.values.recipe', recipe.id);
        StateManager.setState('builderState.metadata.recipeName', recipe.name);
        
        // Debug logging after update
        console.log('🔧 Builder state after recipe update:', JSON.stringify(window.appState.builderState.values, null, 2));
        
        // Show success feedback
        NotificationSystem.showBuilderFeedback(`✅ Recipe selected: ${recipe.name}`, 'success');
        
        // Show input again for next step
        const input = document.getElementById('builderInput');
        if (input) {
            input.style.display = 'block';
        }
        
        // Move to next step
        setTimeout(() => {
            this.nextStep();
        }, 500);
    },
    
    // Show recipe options in the builder options area
    showRecipeOptions: function() {
        const optionsDiv = document.getElementById('builderOptions');
        if (!optionsDiv) return;
        
        const mediaType = window.appState.builderState.values.media;
        
        // Map media codes to recipe types
        const mediaToRecipeMap = {
            'IA': 'Initiation',
            'MA': 'Multiplication', 
            'RA': 'Rooting',
            'I': 'Initiation',
            'M': 'Multiplication',
            'R': 'Rooting'
        };
        
        const recipeType = mediaToRecipeMap[mediaType] || 'Initiation';
        
        // Create modern recipe wizard
        optionsDiv.innerHTML = `
            <div class="recipe-wizard" style="max-width: 100%; margin: 10px 0;">
                <!-- Header -->
                <div class="wizard-header">
                    <h3 style="margin: 0; color: #2c3e50; display: flex; align-items: center; gap: 10px;">
                        <span>🧪</span> ${recipeType} Recipe Setup
                        <span style="font-size: 0.8rem; background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px;">${mediaType}</span>
                    </h3>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 0.9rem;">Quick setup with recommended values</p>
                </div>

                <!-- Quick Setup Panel -->
                <div class="quick-setup-panel">
                    <div class="setup-row">
                        <div class="setup-item">
                            <label>Volume</label>
                            <select id="recipeVolume" class="setup-select" onchange="BuilderStepManager.updateRecipeAmounts()">
                                <option value="500mL">500mL</option>
                                <option value="1L" selected>1L</option>
                                <option value="2L">2L</option>
                            </select>
                        </div>
                        <div class="setup-item">
                            <label>Base Type</label>
                            <select id="recipeBasalSalt" class="setup-select" onchange="BuilderStepManager.updateBasalSaltAmount()">
                                <option value="M&S" selected>M&S Media</option>
                                <option value="DKW">DKW Media</option>
                            </select>
                        </div>
                        <div class="setup-item">
                            <label>Gelling Agent</label>
                            <select id="recipeGellingAgent" class="setup-select" onchange="BuilderStepManager.updateGellingAgentAmount()">
                                <option value="Phytogel" selected>Phytogel</option>
                                <option value="Agar">Agar</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Ingredient Summary -->
                <div class="ingredients-summary">
                    <h4 style="margin: 0 0 10px 0; color: #495057; font-size: 1rem;">📋 Ingredient List</h4>
                    <div class="ingredient-grid">
                        <div class="ingredient-card base">
                            <div class="ingredient-name">Base Media</div>
                            <div class="ingredient-amount" id="basalSaltDisplay">M&S: 4.48g</div>
                        </div>
                        <div class="ingredient-card gelling">
                            <div class="ingredient-name">Gelling Agent</div>
                            <div class="ingredient-amount" id="gellingAgentDisplay">Phytogel: 2.3g</div>
                        </div>
                        <div class="ingredient-card vitamin">
                            <div class="ingredient-name">Gamborg Vitamin</div>
                            <div class="ingredient-amount" id="gamborgDisplay">1.0g</div>
                        </div>
                        <div class="ingredient-card sugar">
                            <div class="ingredient-name">Sucrose</div>
                            <div class="ingredient-amount" id="sucroseDisplay">30.0g</div>
                        </div>
                        <div class="ingredient-card additive">
                            <div class="ingredient-name">PPM</div>
                            <div class="ingredient-amount" id="ppmDisplay">1.0mL</div>
                        </div>
                        <div class="ingredient-card ph">
                            <div class="ingredient-name">Target pH</div>
                            <div class="ingredient-amount" id="phDisplay">5.8</div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Options (Collapsible) -->
                <div class="advanced-options" style="margin-top: 15px;">
                    <div class="advanced-toggle" onclick="BuilderStepManager.toggleAdvancedOptions()" style="cursor: pointer; padding: 10px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; color: #495057;">🔧 Advanced Options</span>
                        <span id="advancedToggleIcon" style="color: #6c757d;">▼</span>
                    </div>
                    <div id="advancedContent" style="display: none; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px;">
                        <div class="advanced-grid">
                            <div class="advanced-item">
                                <label>Recipe Name</label>
                                <input type="text" id="recipeName" class="advanced-input" value="${recipeType} Recipe - ${new Date().toLocaleDateString()}" />
                            </div>
                            <div class="advanced-item">
                                <label>Custom Notes</label>
                                <input type="text" id="recipeNotes" class="advanced-input" placeholder="Special instructions..." />
                            </div>
                        </div>
                        <div id="postAutoclaveSection" style="margin-top: 15px;">
                            <h5 style="margin: 0 0 10px 0; color: #495057; font-size: 0.9rem;">Post-Autoclave Additions</h5>
                            <div id="postAutoclaveAdditions" class="post-autoclave-list">
                                <!-- Will be populated -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="recipe-actions">
                    <button class="action-btn secondary" onclick="BuilderStepManager.resetRecipeValues()">
                        🔄 Reset
                    </button>
                    <button class="action-btn primary" onclick="BuilderStepManager.confirmRecipe()">
                        ✅ Use This Recipe
                    </button>
                </div>

                <!-- Hidden inputs for form data -->
                <div style="display: none;">
                    <input type="number" id="recipeBasalSaltAmount" />
                    <input type="number" id="recipeGellingAgentAmount" />
                    <input type="number" id="recipeGamborgVitamin" />
                    <input type="number" id="recipeSucrose" />
                    <input type="number" id="recipePPM" />
                    <input type="number" id="recipePH" />
                </div>
            </div>
        `;
        
        // Auto-populate recommended values
        this.populateRecommendedValues(recipeType);
        
        // Add CSS for recipe form
        this.addRecipeFormCSS();
    },
    
    // Add CSS for recipe selection
    addRecipeSelectionCSS: function() {
        const cssId = 'recipe-selection-styles';
        if (document.getElementById(cssId)) return;
        
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
            .recipe-mode-btn {
                padding: 8px 16px;
                border: 2px solid #007bff;
                background: white;
                color: #007bff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .recipe-mode-btn.active,
            .recipe-mode-btn:hover {
                background: #007bff;
                color: white;
            }
            
            .recipe-mode-content {
                padding: 15px;
                background: #f8f9fa;
                border-radius: 6px;
                border: 1px solid #e9ecef;
            }
        `;
        document.head.appendChild(style);
    },
    
    // Select recipe mode
    selectRecipeMode: function(mode) {
        // Update button states
        document.querySelectorAll('.recipe-mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Show/hide content
        document.querySelectorAll('.recipe-mode-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const modeContent = document.getElementById(`recipe${mode.charAt(0).toUpperCase() + mode.slice(1)}Mode`);
        if (modeContent) {
            modeContent.style.display = 'block';
        }
    },
    
    // Note: The old auto-select functions have been removed since the recipe step
    // now shows a comprehensive form with recommended values that users can adjust.
    
    // Populate recommended values based on media type
    populateRecommendedValues: function(recipeType) {
        // Get the template data from global MEDIA_TEMPLATES or fallback to simple values
        const templates = window.MEDIA_TEMPLATES || {
            'Initiation': {
                basalSalt: { type: 'M&S', amount: 4.4 },
                gellingAgent: { type: 'Phytogel', amount: 2.3 },
                preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
                postAutoclave: [
                    { name: 'AgNO3', amount: 40, unit: 'µL' },
                    { name: 'Meta-Topolin', amount: 500, unit: 'µL/L' }
                ],
                pH: 5.8
            },
            'Multiplication': {
                basalSalt: { type: 'M&S', amount: 4.4 },
                gellingAgent: { type: 'Phytogel', amount: 2.3 },
                preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
                postAutoclave: [
                    { name: 'AgNO3', amount: 40, unit: 'µL' },
                    { name: 'Meta-Topolin', amount: 500, unit: 'µL/L' },
                    { name: 'Gibberellic Acid', amount: 100, unit: 'µL' }
                ],
                pH: 5.8
            },
            'Rooting': {
                basalSalt: { type: 'M&S', amount: 4.4 },
                gellingAgent: { type: 'Phytogel', amount: 2.3 },
                preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
                postAutoclave: [
                    { name: 'IBA', amount: 5, unit: 'µL', note: '2-5µL range' },
                    { name: 'NAA', amount: 2, unit: 'µL' },
                    { name: 'AgNO3', amount: 40, unit: 'µL' },
                    { name: 'Sodium Metacylitate', amount: 6, unit: 'mL' }
                ],
                pH: 5.8
            }
        };
        
        const template = templates[recipeType] || templates['Initiation'];
        const volume = document.getElementById('recipeVolume')?.value || '1L';
        const scale = { '500mL': 0.5, '1L': 1.0, '2L': 2.0 }[volume] || 1.0;
        
        // Populate basic fields
        this.setFieldValue('recipeBasalSalt', template.basalSalt.type);
        this.setFieldValue('recipeBasalSaltAmount', (template.basalSalt.amount * scale).toFixed(2));
        this.setFieldValue('recipeGellingAgent', template.gellingAgent.type);
        this.setFieldValue('recipeGellingAgentAmount', (template.gellingAgent.amount * scale).toFixed(2));
        
        // Populate pre-autoclave ingredients
        this.setFieldValue('recipeGamborgVitamin', (template.preAutoclave.gamborgVitamin * scale).toFixed(2));
        this.setFieldValue('recipeSucrose', (template.preAutoclave.sucrose * scale).toFixed(1));
        this.setFieldValue('recipePPM', (template.preAutoclave.ppm * scale).toFixed(2));
        
        // Populate pH
        this.setFieldValue('recipePH', template.pH);
        
        // Populate post-autoclave additions
        this.populatePostAutoclaveAdditions(template.postAutoclave, scale);
        
        console.log(`Populated recommended values for ${recipeType} at ${volume} scale`);
    },
    
    // Helper to set field value safely
    setFieldValue: function(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
        }
    },
    
    // Populate post-autoclave additions
    populatePostAutoclaveAdditions: function(additions, scale) {
        const container = document.getElementById('postAutoclaveAdditions');
        if (!container || !additions) return;
        
        container.innerHTML = additions.map((addition, index) => {
            const scaledAmount = scale === 1 ? addition.amount : (addition.amount * scale).toFixed(addition.unit === 'µL' ? 0 : 2);
            return `
                <div class="form-group" style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                    <label style="min-width: 150px; margin: 0;">${addition.name}:</label>
                    <input type="number" id="postAutoclave${index}" class="form-control" style="width: 80px;" 
                           value="${scaledAmount}" step="${addition.unit === 'µL' ? '1' : '0.01'}" />
                    <span style="min-width: 40px;">${addition.unit}</span>
                    ${addition.note ? `<span style="font-size: 0.8rem; color: #666;">${addition.note}</span>` : ''}
                </div>
            `;
        }).join('');
    },
    
    // Update recipe amounts when volume or ingredients change
    updateRecipeAmounts: function() {
        const mediaType = window.appState.builderState.values.media;
        const mediaToRecipeMap = {
            'IA': 'Initiation', 'MA': 'Multiplication', 'RA': 'Rooting',
            'I': 'Initiation', 'M': 'Multiplication', 'R': 'Rooting'
        };
        const recipeType = mediaToRecipeMap[mediaType] || 'Initiation';
        
        // Re-populate with new scale
        this.populateRecommendedValues(recipeType);
    },
    
    // Reset recipe values to recommended
    resetRecipeValues: function() {
        const mediaType = window.appState.builderState.values.media;
        const mediaToRecipeMap = {
            'IA': 'Initiation', 'MA': 'Multiplication', 'RA': 'Rooting',
            'I': 'Initiation', 'M': 'Multiplication', 'R': 'Rooting'
        };
        const recipeType = mediaToRecipeMap[mediaType] || 'Initiation';
        
        // Reset to default volume
        this.setFieldValue('recipeVolume', '1L');
        this.populateRecommendedValues(recipeType);
        
        NotificationSystem.showBuilderFeedback('✅ Recipe values reset to recommended defaults', 'success');
    },
    
    // Confirm recipe and continue to next step
    confirmRecipe: function() {
        // Collect all recipe data
        const recipeData = {
            id: `recipe_${Date.now()}`,
            name: document.getElementById('recipeName')?.value || 'Unnamed Recipe',
            volume: document.getElementById('recipeVolume')?.value || '1L',
            basalSalt: {
                type: document.getElementById('recipeBasalSalt')?.value || 'M&S',
                amount: parseFloat(document.getElementById('recipeBasalSaltAmount')?.value) || 0
            },
            gellingAgent: {
                type: document.getElementById('recipeGellingAgent')?.value || 'Phytogel',
                amount: parseFloat(document.getElementById('recipeGellingAgentAmount')?.value) || 0
            },
            preAutoclave: {
                gamborgVitamin: parseFloat(document.getElementById('recipeGamborgVitamin')?.value) || 0,
                sucrose: parseFloat(document.getElementById('recipeSucrose')?.value) || 0,
                ppm: parseFloat(document.getElementById('recipePPM')?.value) || 0
            },
            pH: parseFloat(document.getElementById('recipePH')?.value) || 5.8,
            notes: document.getElementById('recipeNotes')?.value || '',
            createdDate: new Date().toISOString(),
            isCustom: true
        };
        
        // Collect post-autoclave additions
        const postAutoclaveInputs = document.querySelectorAll('[id^="postAutoclave"]');
        recipeData.postAutoclave = Array.from(postAutoclaveInputs).map((input, index) => ({
            name: input.previousElementSibling?.textContent?.replace(':', '') || `Addition ${index + 1}`,
            amount: parseFloat(input.value) || 0,
            unit: input.nextElementSibling?.textContent || 'µL'
        }));
        
        // Validate required fields
        if (!recipeData.name.trim()) {
            NotificationSystem.showBuilderFeedback('Please enter a recipe name', 'error');
            document.getElementById('recipeName')?.focus();
            return;
        }
        
        if (recipeData.basalSalt.amount <= 0) {
            NotificationSystem.showBuilderFeedback('Please enter a valid basal salt amount', 'error');
            document.getElementById('recipeBasalSaltAmount')?.focus();
            return;
        }
        
        // Continue with this recipe
        this.continueFromRecipeStep(recipeData);
    },
    
    // Toggle advanced options in recipe wizard
    toggleAdvancedOptions: function() {
        const content = document.getElementById('advancedContent');
        const icon = document.getElementById('advancedToggleIcon');
        
        if (content && icon) {
            if (content.style.display === 'none' || !content.style.display) {
                content.style.display = 'block';
                icon.textContent = '▲';
            } else {
                content.style.display = 'none';
                icon.textContent = '▼';
            }
        }
    },
    
    // Update basal salt amount when type is changed
    updateBasalSaltAmount: function() {
        const basalSaltSelect = document.getElementById('recipeBasalSalt');
        const basalSaltAmountInput = document.getElementById('recipeBasalSaltAmount');
        const volumeSelect = document.getElementById('recipeVolume');
        
        if (basalSaltSelect && basalSaltAmountInput && volumeSelect) {
            const selectedType = basalSaltSelect.value;
            const volume = volumeSelect.value;
            
            // Define recommended amounts for different basal salts (per 1L)
            const basalSaltAmounts = {
                'M&S': 4.48,
                'DKW': 5.32
            };
            
            // Define volume scales
            const volumeScales = {
                '500mL': 0.5,
                '1L': 1.0,
                '2L': 2.0
            };
            
            const scale = volumeScales[volume] || 1;
            const baseAmount = basalSaltAmounts[selectedType] || 4.48;
            
            // Update the amount based on the selected type
            basalSaltAmountInput.value = (baseAmount * scale).toFixed(2);
            
            // Visual feedback
            basalSaltAmountInput.style.borderColor = '#28a745';
            basalSaltAmountInput.style.backgroundColor = '#f8fff9';
            
            console.log(`Updated basal salt amount for ${selectedType}: ${basalSaltAmountInput.value}g`);
            NotificationSystem.showBuilderFeedback(`✅ Updated ${selectedType} amount to ${basalSaltAmountInput.value}g`, 'success');
        }
    },

    // Update gelling agent amount when type is changed
    updateGellingAgentAmount: function() {
        const gellingAgentSelect = document.getElementById('recipeGellingAgent');
        const gellingAgentAmountInput = document.getElementById('recipeGellingAgentAmount');
        const volumeSelect = document.getElementById('recipeVolume');
        
        if (gellingAgentSelect && gellingAgentAmountInput && volumeSelect) {
            const selectedType = gellingAgentSelect.value;
            const volume = volumeSelect.value;
            
            // Define recommended amounts for different gelling agents (per 1L)
            const gellingAgentAmounts = {
                'Phytogel': 2.3,
                'Agar': 8.0
            };
            
            // Define volume scales
            const volumeScales = {
                '500mL': 0.5,
                '1L': 1.0,
                '2L': 2.0
            };
            
            const scale = volumeScales[volume] || 1;
            const baseAmount = gellingAgentAmounts[selectedType] || 2.3;
            
            // Update the amount based on the selected type
            gellingAgentAmountInput.value = (baseAmount * scale).toFixed(2);
            
            // Visual feedback
            gellingAgentAmountInput.style.borderColor = '#28a745';
            gellingAgentAmountInput.style.backgroundColor = '#f8fff9';
            
            console.log(`Updated gelling agent amount for ${selectedType}: ${gellingAgentAmountInput.value}g`);
            NotificationSystem.showBuilderFeedback(`✅ Updated ${selectedType} amount to ${gellingAgentAmountInput.value}g`, 'success');
        }
    },
    
    // Add CSS for recipe form
    addRecipeFormCSS: function() {
        const cssId = 'recipe-form-styles';
        if (document.getElementById(cssId)) return;
        
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
            .recipe-form-container {
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #495057;
                font-size: 14px;
            }
            
            .form-control {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 14px;
                transition: border-color 0.15s ease-in-out;
            }
            
            .form-control:focus {
                border-color: #80bdff;
                outline: 0;
                box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
            }
            
            .form-control:focus {
                border-color: #80bdff;
                outline: 0;
                box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
            }
            
            .form-row {
                margin-bottom: 15px;
            }
            
            .recommended-notice {
                animation: fadeIn 0.3s ease-in;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    },
    
    // Auto-populate owner field when strain is selected (strain-to-owner mapping)
    autoPopulateOwnerFromStrain: function(strainId) {
        // Check if we have strain-to-owner mapping data
        if (!window.appState.strainOwnerMapping) {
            console.log('No strain-to-owner mapping data available');
            return;
        }
        
        const normalizedStrainId = parseInt(strainId).toString();
        const ownerCode = window.appState.strainOwnerMapping[normalizedStrainId];
        
        if (ownerCode) {
            const ownerName = window.appState.ownersTable[ownerCode] || ownerCode;
            
            // Check if we're currently on the owner step or have already passed it
            const currentStep = window.appState.builderState.currentStep;
            const ownerStepIndex = window.appState.builderState.steps.indexOf('owner');
            
            if (currentStep > ownerStepIndex) {
                // We've already passed the owner step, auto-populate it
                StateManager.setState('builderState.values.owner', ownerCode);
                StateManager.setState('builderState.metadata.ownerName', ownerName);
                
                NotificationSystem.showBuilderFeedback(
                    `🧬 Owner auto-populated: ${ownerName} (${ownerCode}) from strain ${normalizedStrainId}`,
                    'success'
                );
                
                console.log(`Auto-populated owner ${ownerCode} (${ownerName}) for strain ${normalizedStrainId}`);
            } else if (currentStep === ownerStepIndex) {
                // We're currently on the owner step, show suggestion
                const builderHint = document.getElementById('builderHint');
                if (builderHint) {
                    builderHint.innerHTML = `
                        <div style="background: #e8f4f8; border-left: 4px solid #0066cc; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <strong>🧬 Strain-Owner Mapping Found:</strong><br>
                            Strain ${normalizedStrainId} is typically owned by <strong>${ownerName} (${ownerCode})</strong><br>
                            <button class="btn btn-sm btn-primary" onclick="BuilderStepManager.applyOwnerSuggestion('${ownerCode}')" style="margin-top: 8px;">
                                Use ${ownerCode} →
                            </button>
                        </div>
                        ${this.getStepConfig('owner').hint}
                    `;
                }
                
                // Pre-fill the input field
                const input = document.getElementById('builderInput');
                if (input && !input.value) {
                    input.value = ownerCode;
                    input.style.background = '#e8f4f8';
                    input.style.borderColor = '#0066cc';
                }
                
                console.log(`Suggested owner ${ownerCode} for strain ${normalizedStrainId}`);
            }
        } else {
            console.log(`No owner mapping found for strain ${normalizedStrainId}`);
            
            // Show warning if no mapping exists
            if (window.appState.builderState.currentStep === window.appState.builderState.steps.indexOf('owner')) {
                const builderHint = document.getElementById('builderHint');
                if (builderHint) {
                    builderHint.innerHTML = `
                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px;">
                            <strong>⚠️ No Owner Mapping:</strong><br>
                            No automatic owner mapping found for strain ${normalizedStrainId}. Please select the owner manually.
                        </div>
                        ${this.getStepConfig('owner').hint}
                    `;
                }
            }
        }
    },
    
    // Apply suggested owner from strain-to-owner mapping
    applyOwnerSuggestion: function(ownerCode) {
        const input = document.getElementById('builderInput');
        if (input) {
            input.value = ownerCode;
            input.style.background = '#e8f4f8';
            input.style.borderColor = '#0066cc';
            
            // Immediately validate and proceed
            setTimeout(() => {
                this.validateAndProceed();
            }, 100);
        }
    },

    // Update field preview with current values
    updateFieldPreview: function() {
        const compactStatus = document.getElementById('barcodeStatusCompact');
        const values = window.appState.builderState.values;

        // Toggle display based on values
        if (Object.values(values).some(value => value)) {
            compactStatus.style.display = 'block';
            compactStatus.classList.add('active');

            // Update composite string in main display
            const statusComposite = document.getElementById('statusComposite');
            if (statusComposite) {
                const barcodeFields = ['owner', 'strain', 'media', 'stage', 'tissue', 'date'];
                const compositeString = barcodeFields.map(field => values[field] || '').join('');
                statusComposite.textContent = compositeString || 'Building...';
            }

            // Update detail fields
            for (const field in values) {
                const detailElement = document.getElementById(`detail-${field}`);
                if (detailElement) {
                    const value = values[field];
                    detailElement.textContent = value || '-';
                    detailElement.parentElement.style.opacity = value ? '1' : '0.5';
                }
            }
        } else {
            compactStatus.style.display = 'none';
            compactStatus.classList.remove('active');
        }
    },

    // Set up real-time preview monitoring
    setupRealTimePreview: function() {
        const input = document.getElementById('builderInput');
        if (!input) return;

        // Remove existing listener to avoid duplicates
        input.removeEventListener('input', this.handleRealtimeInput);
        
        // Add input listener for real-time updates
        input.addEventListener('input', this.handleRealtimeInput.bind(this));
        
        // Update current field highlighting
        this.updateCurrentFieldHighlight();
    },

    // Handle real-time input changes
    handleRealtimeInput: function(event) {
        const input = event.target.value.trim();
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        
        // Create a temporary values object with current input
        const tempValues = { ...window.appState.builderState.values };
        if (input) {
            const processedValue = stepName === 'container' ? input : input.toUpperCase();
            tempValues[stepName] = processedValue;
        }
        
        // Update preview with temporary values
        this.updateFieldPreviewWithValues(tempValues);
    },

    // Update preview with specific values (for real-time updates)
    updateFieldPreviewWithValues: function(values) {
        const previewElement = document.getElementById('barcodeFieldPreview');
        
        // Toggle display based on values
        if (Object.values(values).some(value => value)) {
            previewElement.style.display = 'block';

            // Update each field in preview
            for (const field in values) {
                const valueElement = document.getElementById(`preview-${field}-value`);
                if (valueElement) {
                    const value = values[field];
                    valueElement.textContent = value || '-';
                    valueElement.className = value ? 'field-value filled' : 'field-value empty';
                }
            }

            // Update composite string (for barcode fields only)
            const compositeElement = document.getElementById('compositeStringPreview');
            if (compositeElement) {
                const barcodeFields = ['owner', 'strain', 'media', 'stage', 'tissue', 'date'];
                const compositeString = barcodeFields.map(field => values[field] || '').join('');
                compositeElement.textContent = compositeString || '-';
                compositeElement.className = compositeString ? 'composite-value building' : 'composite-value empty';
            }
        } else {
            previewElement.style.display = 'none';
        }
    },

    // Update current field highlighting
    updateCurrentFieldHighlight: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        
        // Remove current highlighting from all fields
        document.querySelectorAll('.preview-field').forEach(field => {
            field.classList.remove('current');
        });
        
        // Add current highlighting to active field
        const currentField = document.getElementById(`preview-${stepName}`);
        if (currentField) {
            currentField.classList.add('current');
        }
    },

    // Reset field preview to initial state
    resetFieldPreview: function() {
        const previewElement = document.getElementById('barcodeFieldPreview');
        if (previewElement) {
            previewElement.style.display = 'none';
        }
        
        // Reset all field values
        const fieldNames = ['container', 'owner', 'strain', 'media', 'recipe', 'stage', 'tissue', 'date'];
        fieldNames.forEach(fieldName => {
            const valueElement = document.getElementById(`preview-${fieldName}-value`);
            if (valueElement) {
                valueElement.textContent = '-';
                valueElement.className = 'field-value empty';
            }
            
            const fieldElement = document.getElementById(`preview-${fieldName}`);
            if (fieldElement) {
                fieldElement.classList.remove('current', 'filled');
            }
        });
        
        // Reset composite string
        const compositeElement = document.getElementById('compositeStringPreview');
        if (compositeElement) {
            compositeElement.textContent = '-';
            compositeElement.className = 'composite-value empty';
        }
    },

    // Navigate to a specific step (for clickable step navigation)
    goToStep: function(stepIndex) {
        const currentStep = window.appState.builderState.currentStep;
        const totalSteps = window.appState.builderState.steps.length;
        
        // Validate step index
        if (stepIndex < 0 || stepIndex >= totalSteps) {
            console.warn(`Invalid step index: ${stepIndex}`);
            return;
        }
        
        // Can only go back to completed steps or current step
        if (stepIndex > currentStep) {
            NotificationSystem.showBuilderFeedback('Complete current step before proceeding', 'warning');
            return;
        }
        
        const stepName = window.appState.builderState.steps[stepIndex];
        const currentValue = window.appState.builderState.values[stepName];
        
        // Show confirmation if going back to a completed step
        if (stepIndex < currentStep && currentValue) {
            const confirmEdit = confirm(`Do you want to edit the ${stepName} field?\n\nCurrent value: ${currentValue}\n\nClick OK to edit or Cancel to stay on current step.`);
            if (!confirmEdit) {
                return;
            }
        }
        
        // Update current step
        StateManager.setState('builderState.currentStep', stepIndex);
        
        // Update all step visual states
        this.updateAllStepStates();
        
        // Update the step UI
        this.updateStep();
        
        // Pre-fill input with current value if editing
        if (currentValue) {
            const input = document.getElementById('builderInput');
            if (input) {
                input.value = currentValue;
                input.style.background = '#fff3cd';
                input.style.borderColor = '#ffc107';
                
                // Show editing feedback
                NotificationSystem.showBuilderFeedback(
                    `📝 Editing ${stepName}: ${currentValue}\nEnter new value or press Next to keep current value`,
                    'info'
                );
            }
        }
        
        // Log navigation
        console.log(`Navigated to step ${stepIndex + 1}: ${stepName}`);
    },
    
    // Update all step visual states based on current progress
    updateAllStepStates: function() {
        const currentStep = window.appState.builderState.currentStep;
        const values = window.appState.builderState.values;
        
        window.appState.builderState.steps.forEach((stepName, index) => {
            const stepElement = document.getElementById(`step-${stepName}`);
            if (!stepElement) return;
            
            // Remove all state classes
            stepElement.classList.remove('active', 'completed');
            
            if (index === currentStep) {
                // Current step
                stepElement.classList.add('active');
            } else if (index < currentStep && values[stepName]) {
                // Completed step with value
                stepElement.classList.add('completed');
            }
            
            // Add tooltip data for clickable feedback
            const circle = stepElement.querySelector('.progress-circle');
            if (circle) {
                if (index === currentStep) {
                    circle.setAttribute('data-tooltip', 'Current step');
                } else if (index < currentStep && values[stepName]) {
                    circle.setAttribute('data-tooltip', `Click to edit ${stepName}`);
                } else if (index > currentStep) {
                    circle.setAttribute('data-tooltip', 'Complete current step first');
                } else {
                    circle.setAttribute('data-tooltip', `Click to set ${stepName}`);
                }
            }
        });
    }

};
