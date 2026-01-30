/**
 * Recipe Calculator Module
 * Auto-populates recommended values based on media type (I, M, R)
 * Allows technician customization while preserving workflow efficiency
 */

window.RecipeCalculator = (function() {
    'use strict';
    
    // Recommended amounts for different basal salts (per 1L)
    const BASAL_SALT_AMOUNTS = {
        'M&S': 4.48,
        'DKW': 3.9
    };
    
    // Recommended amounts for different gelling agents (per 1L)
    const GELLING_AGENT_AMOUNTS = {
        'Phytogel': 2.3,
        'Agar': 8.0
    };
    
    // Recommended values for each media type (base amounts for 1L)
    const MEDIA_TEMPLATES = {
        'Initiation': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'μL/L' }
            ],
            pH: { min: 5.7, max: 6.0, recommended: 5.8 },
            autoclaveConditions: {
                temperature: 120,
                pressure: true,
                time: 20,
                coolTo: 55
            },
            notes: 'pH the media before AUTOCLAVE to 5.7-6.0. Autoclave at 120°C WITH Pressure for 20mins. Media Cools to 55°C before adding post-autoclave ingredients.'
        },
        'Multiplication': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'μL/L' },
                { name: 'Gibberellic Acid', amount: 100, unit: 'μL' }
            ],
            pH: { min: 5.7, max: 6.0, recommended: 5.8 },
            autoclaveConditions: {
                temperature: 120,
                pressure: true,
                time: 20,
                coolTo: 55
            },
            notes: 'pH the media before AUTOCLAVE to 5.7-6.0. Autoclave at 120°C WITH Pressure for 20mins. Media Cools to 55°C before adding post-autoclave ingredients.'
        },
        'Rooting': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'IBA', amount: 2.5, unit: 'μL', note: '2-5μL range', range: '2-5' },
                { name: 'NAA', amount: 2, unit: 'μL' },
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Sodium Metacylitate', amount: 6, unit: 'mL' }
            ],
            pH: { min: 5.7, max: 6.0, recommended: 5.8 },
            autoclaveConditions: {
                temperature: 120,
                pressure: true,
                time: 20,
                coolTo: 55
            },
            notes: 'pH the media before AUTOCLAVE to 5.7-6.0. Autoclave at 120°C WITH Pressure for 20mins. Media Cools to 55°C before adding post-autoclave ingredients.'
        }
    };
    
    // Volume scaling factors
    const VOLUME_SCALES = {
        '500mL': 0.5,
        '1L': 1.0,
        '2L': 2.0
    };

    // State management
    let currentPostAutoclaveAdditions = [];
    let editedValues = new Map(); // Track which values have been edited
    let originalValues = new Map(); // Store original recommended values

    /**
     * Initialize the recipe calculator
     */
    function initialize() {
        console.log('RecipeCalculator initializing...');
        setupEventListeners();
        console.log('RecipeCalculator initialized');
    }

    /**
     * Setup event listeners for recipe form elements
     */
    function setupEventListeners() {
        // Check if listeners already set up
        const mediaTypeSelect = document.getElementById('mediaType');
        if (mediaTypeSelect && mediaTypeSelect._calculatorListenersSetup) {
            console.log('RecipeCalculator event listeners already setup, skipping...');
            return;
        }

        // Media type change handler - auto-populate when media type changes
        if (mediaTypeSelect) {
            mediaTypeSelect.addEventListener('change', autoPopulateRecipe);
            mediaTypeSelect._calculatorListenersSetup = true;
        }

        // Volume change handler
        const volumeSelect = document.getElementById('volume');
        if (volumeSelect) {
            volumeSelect.addEventListener('change', autoPopulateRecipe);
        }

        // Basal salt change handler
        const basalSaltSelect = document.getElementById('basalSalt');
        if (basalSaltSelect) {
            basalSaltSelect.addEventListener('change', updateBasalSaltAmount);
        }

        // Gelling agent change handler
        const gellingAgentSelect = document.getElementById('gellingAgent');
        if (gellingAgentSelect) {
            gellingAgentSelect.addEventListener('change', updateGellingAmount);
        }

        // Auto-populate on initial load
        setTimeout(() => {
            autoPopulateRecipe();
        }, 100);

        console.log('RecipeCalculator event listeners setup complete');
    }

    /**
     * Auto-populates entire recipe based on media type and volume
     */
    function autoPopulateRecipe() {
        const mediaType = document.getElementById('mediaType')?.value;
        const volume = document.getElementById('volume')?.value;
        
        if (!mediaType || !volume) return;
        
        const template = MEDIA_TEMPLATES[mediaType];
        if (!template) return;
        
        const scale = VOLUME_SCALES[volume];
        
        // Auto-populate basal salt
        const basalSaltSelect = document.getElementById('basalSalt');
        const basalSaltAmountInput = document.getElementById('basalSaltAmount');
        if (basalSaltSelect && basalSaltAmountInput) {
            basalSaltSelect.value = template.basalSalt.type;
            basalSaltAmountInput.value = (template.basalSalt.amount * scale).toFixed(2);
        }
        
        // Auto-populate gelling agent
        const gellingAgentSelect = document.getElementById('gellingAgent');
        const gellingAgentAmountInput = document.getElementById('gellingAgentAmount');
        if (gellingAgentSelect && gellingAgentAmountInput) {
            gellingAgentSelect.value = template.gellingAgent.type;
            gellingAgentAmountInput.value = (template.gellingAgent.amount * scale).toFixed(2);
        }
        
        // Auto-populate pre-autoclave ingredients
        const gamborgInput = document.getElementById('gamborgVitamin');
        if (gamborgInput) {
            gamborgInput.value = (template.preAutoclave.gamborgVitamin * scale).toFixed(2);
        }
        
        const sucroseInput = document.getElementById('sucrose');
        if (sucroseInput) {
            sucroseInput.value = (template.preAutoclave.sucrose * scale).toFixed(1);
        }
        
        const ppmInput = document.getElementById('ppm');
        if (ppmInput) {
            ppmInput.value = (template.preAutoclave.ppm * scale).toFixed(2);
        }
        
        // Auto-populate pH
        const phInput = document.getElementById('phValue');
        if (phInput) {
            phInput.value = typeof template.pH === 'object' ? template.pH.recommended : template.pH;
        }
        
        // Auto-populate post-autoclave additions
        currentPostAutoclaveAdditions = template.postAutoclave.map(item => ({
            ...item,
            amount: scale === 1 ? item.amount : (item.amount * scale).toFixed(item.unit === 'μL' ? 0 : 2)
        }));
        
        renderPostAutoclaveAdditions();
        
        // Auto-populate notes if available
        const notesInput = document.getElementById('recipeNotes');
        if (notesInput && template.notes) {
            notesInput.value = template.notes;
        }
        
        console.log(`Auto-populated ${mediaType} recipe for ${volume}`);
    }
    
    /**
     * Updates basal salt amount when type is changed
     */
    function updateBasalSaltAmount() {
        const basalSaltSelect = document.getElementById('basalSalt');
        const basalSaltAmountInput = document.getElementById('basalSaltAmount');
        const volumeSelect = document.getElementById('volume');
        
        if (basalSaltSelect && basalSaltAmountInput && volumeSelect) {
            const selectedType = basalSaltSelect.value;
            const volume = volumeSelect.value;
            const scale = VOLUME_SCALES[volume] || 1;
            const baseAmount = BASAL_SALT_AMOUNTS[selectedType] || 4.4;
            
            // Update the amount based on the selected type
            basalSaltAmountInput.value = (baseAmount * scale).toFixed(2);
            
            // Visual feedback that value has been updated to recommended
            updateInputVisualState(basalSaltAmountInput, true);
            
            console.log(`Updated basal salt amount for ${selectedType}: ${basalSaltAmountInput.value}g`);
        }
    }

    /**
     * Updates gelling agent amount when type is changed
     */
    function updateGellingAmount() {
        const gellingAgentSelect = document.getElementById('gellingAgent');
        const gellingAgentAmountInput = document.getElementById('gellingAgentAmount');
        const volumeSelect = document.getElementById('volume');
        
        if (gellingAgentSelect && gellingAgentAmountInput && volumeSelect) {
            const selectedType = gellingAgentSelect.value;
            const volume = volumeSelect.value;
            const scale = VOLUME_SCALES[volume] || 1;
            const baseAmount = GELLING_AGENT_AMOUNTS[selectedType] || 2.3;
            
            // Update the amount based on the selected type
            gellingAgentAmountInput.value = (baseAmount * scale).toFixed(2);
            
            // Visual feedback that value has been updated to recommended
            updateInputVisualState(gellingAgentAmountInput, true);
            
            console.log(`Updated gelling agent amount for ${selectedType}: ${gellingAgentAmountInput.value}g`);
        }
    }

    /**
     * This function is now replaced by autoPopulateRecipe
     * Kept for compatibility but delegates to autoPopulateRecipe
     */
    function updateVolumeAmounts() {
        autoPopulateRecipe();
    }

    /**
     * This function is now replaced by autoPopulateRecipe
     * Kept for compatibility but delegates to autoPopulateRecipe
     */
    function updatePostAutoclaveAdditions() {
        autoPopulateRecipe();
    }

    /**
     * Renders the post-autoclave additions in the DOM
     */
    function renderPostAutoclaveAdditions() {
        const container = document.getElementById('postAutoclaveList');
        if (!container) return;
        
        container.innerHTML = '';
        
        currentPostAutoclaveAdditions.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'ingredient-row';
            row.innerHTML = `
                <span class="ingredient-label">${item.name}:</span>
                <div class="input-with-unit">
                    <input type="number" class="ingredient-input" value="${item.amount}" 
                           step="any" min="0"
                           onchange="RecipeCalculator.updatePostAutoclaveAmount(${index}, this.value)">
                    <span class="input-unit">${item.unit}</span>
                </div>
                ${item.range ? `<span class="ingredient-range">${item.range}</span>` : ''}
            `;
            container.appendChild(row);
        });
    }

    /**
     * Updates a specific post-autoclave addition amount
     */
    function updatePostAutoclaveAmount(index, value) {
        if (index >= 0 && index < currentPostAutoclaveAdditions.length) {
            currentPostAutoclaveAdditions[index].amount = parseFloat(value) || 0;
        }
    }

    /**
     * Gets current post-autoclave additions
     */
    function getCurrentPostAutoclaveAdditions() {
        return currentPostAutoclaveAdditions;
    }

    /**
     * Validates if an amount is within recommended ranges
     */
    function validateAmount(ingredient, amount, volume) {
        const mediaType = document.getElementById('mediaType')?.value || 'Initiation';
        const template = MEDIA_TEMPLATES[mediaType];
        const scale = VOLUME_SCALES[volume] || 1;
        
        if (!template) {
            return {
                isValid: true,
                isRecommended: false,
                recommendation: null,
                message: 'No recommendation available'
            };
        }
        
        let recommendedAmount = null;
        
        // Get recommended amount based on ingredient type
        if (ingredient === 'basalSaltAmount') {
            recommendedAmount = template.basalSalt.amount * scale;
        } else if (ingredient === 'gellingAgentAmount') {
            recommendedAmount = template.gellingAgent.amount * scale;
        } else if (ingredient === 'gamborgVitamin') {
            recommendedAmount = template.preAutoclave.gamborgVitamin * scale;
        } else if (ingredient === 'sucrose') {
            recommendedAmount = template.preAutoclave.sucrose * scale;
        } else if (ingredient === 'ppm') {
            recommendedAmount = template.preAutoclave.ppm * scale;
        }
        
        if (recommendedAmount === null) {
            return {
                isValid: true,
                isRecommended: false,
                recommendation: null,
                message: 'No recommendation available'
            };
        }
        
        const tolerance = 0.01; // Allow small floating point differences
        const isRecommended = Math.abs(amount - recommendedAmount) <= tolerance;
        
        return {
            isValid: true,
            isRecommended,
            recommendation: recommendedAmount,
            message: isRecommended ? 'Using recommended amount' : `Recommended: ${recommendedAmount}`
        };
    }

    /**
     * Gets the recommended amount for an ingredient at a specific volume
     */
    function getRecommendedAmount(ingredient, volume) {
        const mediaType = document.getElementById('mediaType')?.value || 'Initiation';
        const template = MEDIA_TEMPLATES[mediaType];
        const scale = VOLUME_SCALES[volume] || 1;
        
        if (!template) return null;
        
        if (ingredient === 'basalSaltAmount') {
            return template.basalSalt.amount * scale;
        } else if (ingredient === 'gellingAgentAmount') {
            return template.gellingAgent.amount * scale;
        } else if (ingredient === 'gamborgVitamin') {
            return template.preAutoclave.gamborgVitamin * scale;
        } else if (ingredient === 'sucrose') {
            return template.preAutoclave.sucrose * scale;
        } else if (ingredient === 'ppm') {
            return template.preAutoclave.ppm * scale;
        }
        
        return null;
    }

    /**
     * Calculates scaling factor between volumes
     */
    function calculateScalingFactor(fromVolume, toVolume) {
        const volumes = {
            '500mL': 0.5,
            '1L': 1.0,
            '2L': 2.0
        };
        
        return volumes[toVolume] / volumes[fromVolume];
    }

    /**
     * Scales recipe from one volume to another
     */
    function scaleRecipe(recipe, newVolume) {
        if (recipe.volume === newVolume) {
            return recipe;
        }

        const scaleFactor = calculateScalingFactor(recipe.volume, newVolume);
        
        return {
            ...recipe,
            volume: newVolume,
            basalSalt: {
                ...recipe.basalSalt,
                amount: recipe.basalSalt.amount * scaleFactor
            },
            gellingAgent: {
                ...recipe.gellingAgent,
                amount: recipe.gellingAgent.amount * scaleFactor
            },
            preAutoclave: {
                gamborgVitamin: recipe.preAutoclave.gamborgVitamin * scaleFactor,
                sucrose: recipe.preAutoclave.sucrose * scaleFactor,
                ppm: recipe.preAutoclave.ppm * scaleFactor
            },
            postAutoclave: recipe.postAutoclave.map(item => ({
                ...item,
                amount: item.amount * scaleFactor
            }))
        };
    }

    /**
     * Marks an input as edited and stores original value
     */
    function markAsEdited(inputId, originalValue) {
        const input = document.getElementById(inputId);
        if (input) {
            originalValues.set(inputId, originalValue);
            editedValues.set(inputId, input.value);
            updateInputVisualState(input, false);
        }
    }

    /**
     * Tracks input edits for visual feedback
     */
    function trackInputEdit(inputId, value) {
        const originalValue = originalValues.get(inputId);
        const input = document.getElementById(inputId);
        
        if (originalValue && value != originalValue) {
            editedValues.set(inputId, value);
            updateInputVisualState(input, false);
        } else {
            editedValues.delete(inputId);
            updateInputVisualState(input, true);
        }
    }

    /**
     * Updates visual state of input to show if it's edited or original
     */
    function updateInputVisualState(input, isOriginal) {
        if (!input) return;
        
        if (isOriginal) {
            input.style.borderColor = '#28a745';
            input.style.backgroundColor = '#f8fff9';
            input.title = 'Using recommended amount';
        } else {
            input.style.borderColor = '#ffc107';
            input.style.backgroundColor = '#fffbf0';
            input.title = 'Custom amount (differs from recommendation)';
        }
    }

    /**
     * Restores recommended value for an input
     */
    function restoreRecommended(inputId) {
        const input = document.getElementById(inputId);
        const originalValue = originalValues.get(inputId);
        
        if (input && originalValue !== undefined) {
            input.value = originalValue;
            editedValues.delete(inputId);
            updateInputVisualState(input, true);
        }
    }

    /**
     * Gets current recipe data from form
     */
    function getCurrentRecipeData() {
        return {
            mediaType: document.getElementById('mediaType')?.value || 'Initiation',
            volume: document.getElementById('volume')?.value || '1L',
            basalSalt: {
                type: document.getElementById('basalSalt')?.value || 'M&S',
                amount: parseFloat(document.getElementById('basalSaltAmount')?.value) || 0
            },
            gellingAgent: {
                type: document.getElementById('gellingAgent')?.value || 'Phytogel',
                amount: parseFloat(document.getElementById('gellingAgentAmount')?.value) || 0
            },
            preAutoclave: {
                gamborgVitamin: parseFloat(document.getElementById('gamborgVitamin')?.value) || 0,
                sucrose: parseFloat(document.getElementById('sucrose')?.value) || 0,
                ppm: parseFloat(document.getElementById('ppm')?.value) || 0
            },
            postAutoclave: getCurrentPostAutoclaveAdditions(),
            pH: parseFloat(document.getElementById('phValue')?.value) || 5.8,
            autoclaveConditions: {
                temperature: 120,
                time: 20,
                coolTo: 55
            }
        };
    }

    /**
     * Loads recipe data into form
     */
    function loadRecipeIntoForm(recipe) {
        // Set basic fields
        if (document.getElementById('mediaType')) {
            document.getElementById('mediaType').value = recipe.mediaType || 'Initiation';
        }
        if (document.getElementById('volume')) {
            document.getElementById('volume').value = recipe.volume || '1L';
        }
        if (document.getElementById('basalSalt')) {
            document.getElementById('basalSalt').value = recipe.basalSalt?.type || 'M&S';
        }
        if (document.getElementById('basalSaltAmount')) {
            document.getElementById('basalSaltAmount').value = recipe.basalSalt?.amount || 0;
        }
        if (document.getElementById('gellingAgent')) {
            document.getElementById('gellingAgent').value = recipe.gellingAgent?.type || 'Phytogel';
        }
        if (document.getElementById('gellingAgentAmount')) {
            document.getElementById('gellingAgentAmount').value = recipe.gellingAgent?.amount || 0;
        }

        // Set pre-autoclave ingredients
        if (recipe.preAutoclave) {
            if (document.getElementById('gamborgVitamin')) {
                document.getElementById('gamborgVitamin').value = recipe.preAutoclave.gamborgVitamin || 0;
            }
            if (document.getElementById('sucrose')) {
                document.getElementById('sucrose').value = recipe.preAutoclave.sucrose || 0;
            }
            if (document.getElementById('ppm')) {
                document.getElementById('ppm').value = recipe.preAutoclave.ppm || 0;
            }
        }

        // Set pH
        if (document.getElementById('phValue')) {
            document.getElementById('phValue').value = recipe.pH || 5.8;
        }

        // Load post-autoclave additions
        if (recipe.postAutoclave) {
            currentPostAutoclaveAdditions = [...recipe.postAutoclave];
            renderPostAutoclaveAdditions();
        }

        // Clear edit tracking
        editedValues.clear();
        originalValues.clear();
    }

    /**
     * Validates a complete recipe
     * Includes validation against HQ workbook reference data when available
     */
    function validateRecipe(recipe) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!recipe.name || recipe.name.trim() === '') {
            errors.push('Recipe name is required');
        }

        if (!recipe.mediaType) {
            errors.push('Media type is required');
        } else {
            // Validate media type against HQ workbook
            const validMediaTypes = ['Initiation', 'Multiplication', 'Rooting', 'I', 'M', 'R'];
            if (!validMediaTypes.includes(recipe.mediaType)) {
                // Check against InventoryLookupService if available
                if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
                    const mediaData = window.InventoryLookupService.resolveMediaType(recipe.mediaType);
                    if (!mediaData) {
                        warnings.push(`Media type "${recipe.mediaType}" not found in HQ workbook reference data`);
                    }
                }
            }
        }

        if (!recipe.volume) {
            errors.push('Volume is required');
        } else {
            // Validate volume is one of the standard options
            const validVolumes = ['500mL', '1L', '2L'];
            if (!validVolumes.includes(recipe.volume)) {
                warnings.push(`Non-standard volume "${recipe.volume}" - recommended: 500mL, 1L, or 2L`);
            }
        }

        // Validate basal salt
        if (recipe.basalSalt) {
            if (!recipe.basalSalt.type) {
                errors.push('Basal salt type is required');
            }
            if (!recipe.basalSalt.amount || recipe.basalSalt.amount <= 0) {
                errors.push('Basal salt amount must be greater than 0');
            }
        } else {
            errors.push('Basal salt information is required');
        }

        // Validate gelling agent
        if (recipe.gellingAgent) {
            if (!recipe.gellingAgent.type) {
                errors.push('Gelling agent type is required');
            }
            if (!recipe.gellingAgent.amount || recipe.gellingAgent.amount <= 0) {
                errors.push('Gelling agent amount must be greater than 0');
            }
        } else {
            errors.push('Gelling agent information is required');
        }

        // Validate pre-autoclave ingredients
        if (recipe.preAutoclave) {
            if (recipe.preAutoclave.sucrose < 0) {
                errors.push('Sucrose amount cannot be negative');
            }
            if (recipe.preAutoclave.sucrose === 0) {
                warnings.push('Sucrose amount is 0 - is this intentional?');
            }
        }

        // Validate pH
        if (recipe.pH) {
            if (recipe.pH < 5.0 || recipe.pH > 7.0) {
                errors.push('pH must be between 5.0 and 7.0');
            } else if (recipe.pH < 5.6 || recipe.pH > 6.0) {
                warnings.push('pH outside recommended range (5.6-6.0)');
            }
        }

        // Validate autoclave conditions
        if (recipe.autoclaveConditions) {
            if (recipe.autoclaveConditions.temperature < 115 ||
                recipe.autoclaveConditions.temperature > 125) {
                errors.push('Autoclave temperature must be between 115°C and 125°C');
            }

            if (recipe.autoclaveConditions.time < 15 ||
                recipe.autoclaveConditions.time > 30) {
                errors.push('Autoclave time must be between 15 and 30 minutes');
            }
        }

        // Validate post-autoclave additions
        if (recipe.postAutoclave && Array.isArray(recipe.postAutoclave)) {
            recipe.postAutoclave.forEach((item, index) => {
                if (!item.name) {
                    errors.push(`Post-autoclave item ${index + 1} is missing a name`);
                }
                if (item.amount < 0) {
                    errors.push(`Post-autoclave item "${item.name}" has negative amount`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // Public API
    return {
        initialize,
        autoPopulateRecipe,
        updateBasalSaltAmount,
        updateGellingAmount,
        updateVolumeAmounts,
        updatePostAutoclaveAdditions,
        updatePostAutoclaveAmount,
        getCurrentPostAutoclaveAdditions,
        validateAmount,
        getRecommendedAmount,
        calculateScalingFactor,
        scaleRecipe,
        markAsEdited,
        restoreRecommended,
        getCurrentRecipeData,
        loadRecipeIntoForm,
        validateRecipe
    };
})();
