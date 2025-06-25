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
        // Update prompts and hints for recipe step
        UIUtils.updateContent('builderPrompt', 'Select or create a recipe for this media:');
        UIUtils.updateContent('builderHint', 'Choose a recipe or create a new one based on your media type');
        
        // Update input placeholder
        const input = document.getElementById('builderInput');
        if (input) {
            input.placeholder = 'Recipe will be auto-selected';
            input.value = '';
            input.style.display = 'none'; // Hide input for recipe step
        }
        
        // Show recipe options in the builder options area
        this.showRecipeOptions();
        
        // Update button text
        UIUtils.updateContent('builderNextBtn', 'Continue with Recipe →');
        
        console.log('Recipe step initialized within builder');
    },
    
    // Continue from recipe step (called by RecipeManager)
    continueFromRecipeStep: function(recipe) {
        // Store recipe data
        StateManager.setState('builderState.values.recipe', recipe.id);
        StateManager.setState('builderState.metadata.recipeName', recipe.name);
        
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
        
        // Create recipe form with recommended values
        optionsDiv.innerHTML = `
            <div class="recipe-form-container" style="margin: 20px 0;">
                <h4 style="margin-bottom: 15px; color: #2c3e50;">📝 Recipe for ${recipeType} Media (${mediaType})</h4>
                
                <div class="recommended-notice" style="background: #e3f2fd; border: 2px solid #2196f3; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
                    <h5 style="margin: 0 0 8px 0; color: #1976d2;">👨‍🔬 Recommended Values Auto-Populated</h5>
                    <p style="margin: 0; color: #1976d2; font-size: 0.9rem;">
                        These are the recommended values for <strong>${recipeType}</strong> media. You can adjust any values as needed for your specific requirements.
                    </p>
                </div>
                
                <div class="recipe-form" style="background: #f8f9fa; border-radius: 8px; padding: 20px; border: 1px solid #dee2e6;">
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group">
                            <label for="recipeVolume">Volume:</label>
                            <select id="recipeVolume" class="form-control" onchange="BuilderStepManager.updateRecipeAmounts()">
                                <option value="500mL">500mL</option>
                                <option value="1L" selected>1L</option>
                                <option value="2L">2L</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="recipeName">Recipe Name:</label>
                            <input type="text" id="recipeName" class="form-control" value="${recipeType} Recipe - ${new Date().toLocaleDateString()}" />
                        </div>
                    </div>
                    
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group">
                            <label for="recipeBasalSalt">Basal Salt:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <select id="recipeBasalSalt" class="form-control" style="flex: 1;" onchange="BuilderStepManager.updateRecipeAmounts()">
                                    <option value="M&S" selected>M&S</option>
                                    <option value="DKW">DKW</option>
                                </select>
                                <input type="number" id="recipeBasalSaltAmount" class="form-control" style="width: 80px;" step="0.01" /> g
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="recipeGellingAgent">Gelling Agent:</label>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <select id="recipeGellingAgent" class="form-control" style="flex: 1;" onchange="BuilderStepManager.updateRecipeAmounts()">
                                    <option value="Phytogel" selected>Phytogel</option>
                                    <option value="Agar">Agar</option>
                                </select>
                                <input type="number" id="recipeGellingAgentAmount" class="form-control" style="width: 80px;" step="0.01" /> g
                            </div>
                        </div>
                    </div>
                    
                    <h5 style="margin: 20px 0 10px 0; color: #2c3e50;">Pre-Autoclave Ingredients</h5>
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group">
                            <label for="recipeGamborgVitamin">Gamborg Vitamin:</label>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="number" id="recipeGamborgVitamin" class="form-control" step="0.01" /> g
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="recipeSucrose">Sucrose:</label>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="number" id="recipeSucrose" class="form-control" step="0.1" /> g
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="recipePPM">PPM:</label>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <input type="number" id="recipePPM" class="form-control" step="0.01" /> mL
                            </div>
                        </div>
                    </div>
                    
                    <h5 style="margin: 20px 0 10px 0; color: #2c3e50;">Post-Autoclave Additions</h5>
                    <div id="postAutoclaveAdditions">
                        <!-- Post-autoclave additions will be populated here -->
                    </div>
                    
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                        <div class="form-group">
                            <label for="recipePH">pH:</label>
                            <input type="number" id="recipePH" class="form-control" step="0.1" min="5.0" max="7.0" />
                        </div>
                        <div class="form-group">
                            <label for="recipeNotes">Notes (optional):</label>
                            <input type="text" id="recipeNotes" class="form-control" placeholder="Special instructions or modifications" />
                        </div>
                    </div>
                    
                    <div class="recipe-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="BuilderStepManager.resetRecipeValues()">
                            🔄 Reset to Recommended
                        </button>
                        <button class="btn btn-primary" onclick="BuilderStepManager.confirmRecipe()">
                            ✅ Use This Recipe
                        </button>
                    </div>
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
    }
};
