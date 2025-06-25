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
        
        // Create recipe selection UI
        optionsDiv.innerHTML = `
            <div class="recipe-selection" style="margin: 20px 0;">
                <h4 style="margin-bottom: 15px; color: #2c3e50;">📝 Recipe Selection</h4>
                
                <div class="recipe-modes" style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <button class="recipe-mode-btn active" onclick="BuilderStepManager.selectRecipeMode('auto')">
                        🎯 Auto-Select Recipe
                    </button>
                    <button class="recipe-mode-btn" onclick="BuilderStepManager.selectRecipeMode('create')">
                        ➕ Create New Recipe
                    </button>
                    <button class="recipe-mode-btn" onclick="BuilderStepManager.selectRecipeMode('existing')">
                        📋 Use Existing Recipe
                    </button>
                </div>
                
                <div id="recipeAutoMode" class="recipe-mode-content" style="display: block;">
                    <p style="color: #495057; margin-bottom: 15px; font-size: 0.9rem;">
                        🎯 A recommended recipe will be automatically selected based on your media type: <strong>${mediaType || 'Unknown'}</strong>
                    </p>
                    <button class="btn btn-primary" onclick="BuilderStepManager.autoSelectRecipe()">
                        Auto-Select Recipe for ${mediaType || 'Media'}
                    </button>
                </div>
                
                <div id="recipeCreateMode" class="recipe-mode-content" style="display: none;">
                    <p style="color: #495057; margin-bottom: 15px; font-size: 0.9rem;">
                        ➕ Create a new custom recipe for this specific batch
                    </p>
                    <button class="btn btn-success" onclick="BuilderStepManager.createNewRecipe()">
                        Create New Recipe
                    </button>
                </div>
                
                <div id="recipeExistingMode" class="recipe-mode-content" style="display: none;">
                    <p style="color: #495057; margin-bottom: 15px; font-size: 0.9rem;">
                        📋 Choose from previously saved recipes
                    </p>
                    <button class="btn btn-secondary" onclick="BuilderStepManager.selectExistingRecipe()">
                        Browse Saved Recipes
                    </button>
                </div>
            </div>
        `;
        
        // Add CSS for recipe selection
        this.addRecipeSelectionCSS();
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
    
    // Auto-select recipe based on media type
    autoSelectRecipe: function() {
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
        
        // Create a basic recipe
        const autoRecipe = {
            id: `auto_${Date.now()}`,
            name: `Auto-Selected ${recipeType} Recipe`,
            mediaType: recipeType,
            volume: '1L',
            notes: `Auto-generated recipe for ${mediaType} media`,
            isAutoGenerated: true
        };
        
        // Continue with this recipe
        this.continueFromRecipeStep(autoRecipe);
    },
    
    // Create new recipe
    createNewRecipe: function() {
        const mediaType = window.appState.builderState.values.media;
        
        // For now, create a simple new recipe
        const newRecipe = {
            id: `custom_${Date.now()}`,
            name: `Custom Recipe for ${mediaType}`,
            mediaType: mediaType,
            volume: '1L',
            notes: 'Custom recipe created during barcode generation',
            isCustom: true
        };
        
        this.continueFromRecipeStep(newRecipe);
    },
    
    // Select existing recipe
    selectExistingRecipe: function() {
        // For now, create a placeholder existing recipe
        const existingRecipe = {
            id: `existing_${Date.now()}`,
            name: 'Standard Lab Recipe',
            mediaType: 'Standard',
            volume: '1L',
            notes: 'Previously saved lab recipe',
            isExisting: true
        };
        
        this.continueFromRecipeStep(existingRecipe);
    }
};
