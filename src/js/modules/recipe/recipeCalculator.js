/**
 * Recipe Calculator Module
 * Auto-populates recommended values based on media type (I, M, R)
 * Allows technician customization while preserving workflow efficiency
 */

window.RecipeCalculator = (function() {
    'use strict';
    
    // Recommended values for each media type (base amounts for 1L)
    const MEDIA_TEMPLATES = {
        'Initiation': {
            basalSalt: { type: 'M&S', amount: 4.4 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'µL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'µL/L' }
            ],
            pH: 5.8,
            notes: 'Autoclave at 120°C with pressure for 20mins, cool to 55°C before adding post-autoclave ingredients'
        },
        'Multiplication': {
            basalSalt: { type: 'M&S', amount: 4.4 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'µL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'µL/L' },
                { name: 'Gibberellic Acid', amount: 100, unit: 'µL' }
            ],
            pH: 5.8,
            notes: 'Autoclave at 120°C with pressure for 20mins, cool to 55°C before adding post-autoclave ingredients'
        },
        'Rooting': {
            basalSalt: { type: 'M&S', amount: 4.4 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: {
                gamborgVitamin: 1.0,
                sucrose: 30.0,
                ppm: 1.0
            },
            postAutoclave: [
                { name: 'IBA', amount: 5, unit: 'µL', note: '2-5µL range' },
                { name: 'NAA', amount: 2, unit: 'µL' },
                { name: 'AgNO3', amount: 40, unit: 'µL' },
                { name: 'Sodium Metacylitate', amount: 6, unit: 'mL' }
            ],
            pH: 5.8,
            notes: 'Autoclave at 120°C with pressure for 20mins, cool to 55°C before adding post-autoclave ingredients'
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
        // Media type change handler - auto-populate when media type changes
        const mediaTypeSelect = document.getElementById('mediaType');
        if (mediaTypeSelect) {
            mediaTypeSelect.addEventListener('change', autoPopulateRecipe);
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
            phInput.value = template.pH;
        }
        
        // Auto-populate post-autoclave additions
        currentPostAutoclaveAdditions = template.postAutoclave.map(item => ({
            ...item,
            amount: scale === 1 ? item.amount : (item.amount * scale).toFixed(item.unit === 'µL' ? 0 : 2)
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
     * Updates basal salt amount when manually changed
     */
    function updateBasalSaltAmount() {
        // This can be used for manual adjustments if needed
        const input = document.getElementById('basalSaltAmount');
        if (input) {
            updateInputVisualState(input, false);
        }
    }

    /**
     * Updates gelling agent amount when manually changed
     */
    function updateGellingAmount() {
        // This can be used for manual adjustments if needed
        const input = document.getElementById('gellingAgentAmount');
        if (input) {
            updateInputVisualState(input, false);
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
        }

        if (!recipe.volume) {
            errors.push('Volume is required');
        }

        // Validate amounts
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
