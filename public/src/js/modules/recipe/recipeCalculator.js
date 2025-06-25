/**
 * Recipe Calculator Module
 * Handles all recipe calculations and amount updates
 * Preserves original recipe integrity while allowing customization
 * Extracted and adapted from Media Maker project
 */

import { 
    BASE_AMOUNTS, 
    POST_AUTOCLAVE_DEFAULTS, 
    INGREDIENT_UNITS, 
    VALIDATION_RANGES,
    AUTOCLAVE_DEFAULTS,
    PH_DEFAULTS
} from './mediaData.js';

window.RecipeCalculator = (function() {
    'use strict';

    // State management
    let currentPostAutoclaveAdditions = [...POST_AUTOCLAVE_DEFAULTS['Initiation']];
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
        // Volume change handler
        const volumeSelect = document.getElementById('volume');
        if (volumeSelect) {
            volumeSelect.addEventListener('change', updateVolumeAmounts);
        }

        // Media type change handler
        const mediaTypeSelect = document.getElementById('mediaType');
        if (mediaTypeSelect) {
            mediaTypeSelect.addEventListener('change', updatePostAutoclaveAdditions);
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

        // Input change handlers for edit tracking
        const trackableInputs = [
            'basalSaltAmount', 'gellingAgentAmount', 'gamborgVitamin', 
            'sucrose', 'ppm', 'phValue'
        ];
        
        trackableInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', (e) => {
                    trackInputEdit(inputId, e.target.value);
                });
            }
        });
    }

    /**
     * Updates basal salt amount based on current volume selection
     */
    function updateBasalSaltAmount() {
        const volume = document.getElementById('volume')?.value;
        const basalSalt = document.getElementById('basalSalt')?.value;
        
        if (!volume || !basalSalt) return null;
        
        const amount = BASE_AMOUNTS[volume][basalSalt];
        const input = document.getElementById('basalSaltAmount');
        
        if (input) {
            input.value = amount;
            // Store as original value for edit tracking
            originalValues.set('basalSaltAmount', amount);
            updateInputVisualState(input, true);
        }
        
        return amount;
    }

    /**
     * Updates gelling agent amount based on current selections
     */
    function updateGellingAmount() {
        const volume = document.getElementById('volume')?.value;
        const gellingAgent = document.getElementById('gellingAgent')?.value?.toLowerCase();
        
        if (!volume || !gellingAgent) return null;
        
        const amount = BASE_AMOUNTS[volume][gellingAgent];
        const input = document.getElementById('gellingAgentAmount');
        
        if (input) {
            input.value = amount;
            // Store as original value for edit tracking
            originalValues.set('gellingAgentAmount', amount);
            updateInputVisualState(input, true);
        }
        
        return amount;
    }

    /**
     * Updates all volume-dependent amounts when volume changes
     */
    function updateVolumeAmounts() {
        const volume = document.getElementById('volume')?.value;
        
        if (!volume) return null;
        
        const amounts = BASE_AMOUNTS[volume];
        
        // Update pre-autoclave amounts
        updateBasalSaltAmount();
        
        // Update other pre-autoclave ingredients
        const gamborgInput = document.getElementById('gamborgVitamin');
        if (gamborgInput) {
            gamborgInput.value = amounts.gamborgVitamin;
            originalValues.set('gamborgVitamin', amounts.gamborgVitamin);
            updateInputVisualState(gamborgInput, true);
        }
        
        const sucroseInput = document.getElementById('sucrose');
        if (sucroseInput) {
            sucroseInput.value = amounts.sucrose;
            originalValues.set('sucrose', amounts.sucrose);
            updateInputVisualState(sucroseInput, true);
        }
        
        const ppmInput = document.getElementById('ppm');
        if (ppmInput) {
            ppmInput.value = amounts.ppm;
            originalValues.set('ppm', amounts.ppm);
            updateInputVisualState(ppmInput, true);
        }
        
        updateGellingAmount();
        
        // Update post-autoclave amounts
        updatePostAutoclaveAdditions();
        
        return amounts;
    }

    /**
     * Updates post-autoclave additions based on media type and volume
     */
    function updatePostAutoclaveAdditions() {
        const mediaType = document.getElementById('mediaType')?.value;
        const volume = document.getElementById('volume')?.value;
        
        if (!mediaType || !volume) return [];
        
        const amounts = BASE_AMOUNTS[volume];
        
        currentPostAutoclaveAdditions = POST_AUTOCLAVE_DEFAULTS[mediaType].map(item => ({
            ...item,
            amount: amounts[item.key] || item.amount
        }));
        
        renderPostAutoclaveAdditions();
        return currentPostAutoclaveAdditions;
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
        const baseAmount = BASE_AMOUNTS[volume]?.[ingredient];
        
        if (!baseAmount) {
            return {
                isValid: true,
                isRecommended: false,
                recommendation: null,
                message: 'No recommendation available'
            };
        }
        
        return {
            isValid: true,
            isRecommended: amount == baseAmount,
            recommendation: baseAmount,
            message: amount != baseAmount ? `Recommended: ${baseAmount}` : 'Using recommended amount'
        };
    }

    /**
     * Gets the recommended amount for an ingredient at a specific volume
     */
    function getRecommendedAmount(ingredient, volume) {
        return BASE_AMOUNTS[volume]?.[ingredient] || null;
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
            pH: parseFloat(document.getElementById('phValue')?.value) || PH_DEFAULTS.value,
            autoclaveConditions: {
                temperature: AUTOCLAVE_DEFAULTS.temperature,
                time: AUTOCLAVE_DEFAULTS.time,
                coolTo: AUTOCLAVE_DEFAULTS.coolTo
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
            document.getElementById('phValue').value = recipe.pH || PH_DEFAULTS.value;
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
            const pHRange = VALIDATION_RANGES.pH;
            if (recipe.pH < pHRange.min || recipe.pH > pHRange.max) {
                errors.push(`pH must be between ${pHRange.min} and ${pHRange.max}`);
            } else if (recipe.pH < pHRange.recommended.min || recipe.pH > pHRange.recommended.max) {
                warnings.push(`pH outside recommended range (${pHRange.recommended.min}-${pHRange.recommended.max})`);
            }
        }

        // Validate autoclave conditions
        if (recipe.autoclaveConditions) {
            const tempRange = VALIDATION_RANGES.autoclaveTemp;
            const timeRange = VALIDATION_RANGES.autoclaveTime;

            if (recipe.autoclaveConditions.temperature < tempRange.min || 
                recipe.autoclaveConditions.temperature > tempRange.max) {
                errors.push(`Autoclave temperature must be between ${tempRange.min}°C and ${tempRange.max}°C`);
            }

            if (recipe.autoclaveConditions.time < timeRange.min || 
                recipe.autoclaveConditions.time > timeRange.max) {
                errors.push(`Autoclave time must be between ${timeRange.min} and ${timeRange.max} minutes`);
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
