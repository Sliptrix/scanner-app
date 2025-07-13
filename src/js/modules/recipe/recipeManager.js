/**
 * Recipe Manager Module
 * Main coordinator for all recipe functionality
 * Integrates recipe system with barcode builder and inventory
 */

window.RecipeManager = (function() {
    'use strict';

    // State management
    let currentRecipe = null;
    let isRecipeStepActive = false;
    let recipeMode = 'new'; // 'new' or 'existing'
    let currentTemplate = 'Initiation';
    let originalValues = {};
    let wizardContainer = null;

    // Volume scaling factors
    const VOLUME_SCALES = { '500mL': 0.5, '1L': 1.0, '2L': 2.0 };

    // Recipe templates from the wizard - based on exact specifications
    const TEMPLATES = {
        'Initiation': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'μL' }
            ],
            pH: 5.8,
            instructions: {
                preAutoclave: 'pH the media before AUTOCLAVE to 5.7-6.0',
                autoclave: 'Autoclave at 120°C WITH Pressure for 20 mins',
                postAutoclave: 'Media Cools to 55°C before adding post-autoclave ingredients'
            }
        },
        'Multiplication': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
            postAutoclave: [
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Meta-Topolin', amount: 500, unit: 'μL' },
                { name: 'Gibberellic Acid', amount: 100, unit: 'μL' }
            ],
            pH: 5.8,
            instructions: {
                preAutoclave: 'pH the media before AUTOCLAVE to 5.7-6.0',
                autoclave: 'Autoclave at 120°C WITH Pressure for 20 mins',
                postAutoclave: 'Media Cools to 55°C before adding post-autoclave ingredients'
            }
        },
        'Rooting': {
            basalSalt: { type: 'M&S', amount: 4.48 },
            gellingAgent: { type: 'Phytogel', amount: 2.3 },
            preAutoclave: { gamborgVitamin: 1.0, sucrose: 30.0, ppm: 1.0 },
            postAutoclave: [
                { name: 'IBA', amount: 5, unit: 'μL', range: '2-5' },
                { name: 'NAA', amount: 2, unit: 'μL' },
                { name: 'AgNO3', amount: 40, unit: 'μL' },
                { name: 'Sodium Metacylitate', amount: 6, unit: 'mL' }
            ],
            pH: 5.8,
            instructions: {
                preAutoclave: 'pH the media before AUTOCLAVE to 5.7-6.0',
                autoclave: 'Autoclave at 120°C WITH Pressure for 20 mins',
                postAutoclave: 'Media Cools to 55°C before adding post-autoclave ingredients'
            }
        }
    };

    /**
     * Initialize the recipe manager
     */
    function initialize() {
        console.log('RecipeManager initializing...');
        
        // Initialize sub-modules
        if (window.RecipeCalculator) {
            RecipeCalculator.initialize();
        }
        
        if (window.RecipeStorage) {
            RecipeStorage.initialize();
        }
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('RecipeManager initialized');
    }

    /**
     * Setup recipe UI components
     */
    function setupRecipeUI() {
        // Check if recipe section already exists
        if (document.getElementById('recipeSection')) {
            return;
        }

        // Create recipe section HTML
        const recipeHTML = `
            <div class="recipe-section" id="recipeSection" style="display: none;">
                <h3 style="margin-bottom: 15px; color: #2c3e50;">🧪 Recipe Selection</h3>
                
                <div class="recipe-mode-selector" style="margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button id="newRecipeBtn" class="mode-btn active" onclick="RecipeManager.setRecipeMode('new')">
                            ➕ Create New Recipe
                        </button>
                        <button id="existingRecipeBtn" class="mode-btn" onclick="RecipeManager.setRecipeMode('existing')">
                            📋 Use Existing Recipe
                        </button>
                    </div>
                </div>

                <!-- New Recipe Form -->
                <div id="newRecipeForm" class="recipe-form">
                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label for="mediaType">Media Type:</label>
                            <select id="mediaType" class="form-control" onchange="RecipeManager.loadTemplate(this.value)">
                                <option value="Initiation">Initiation</option>
                                <option value="Multiplication">Multiplication</option>
                                <option value="Rooting">Rooting</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="volume">Volume:</label>
                            <select id="volume" class="form-control">
                                <option value="500mL">500mL</option>
                                <option value="1L" selected>1L</option>
                                <option value="2L">2L</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="basalSalt">Basal Salt:</label>
                            <select id="basalSalt" class="form-control">
                                <option value="M&S" selected>M&S</option>
                                <option value="DKW">DKW</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="basalSaltAmount">Amount (g):</label>
                            <input type="number" id="basalSaltAmount" class="form-control" step="0.01" min="0">
                        </div>
                        
                        <div class="form-group">
                            <label for="gellingAgent">Gelling Agent:</label>
                            <select id="gellingAgent" class="form-control">
                                <option value="Phytogel" selected>Phytogel</option>
                                <option value="Agar">Agar</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="gellingAgentAmount">Amount (g):</label>
                            <input type="number" id="gellingAgentAmount" class="form-control" step="0.01" min="0">
                        </div>
                    </div>

                    <div class="ingredients-section">
                        <h4>Pre-Autoclave Ingredients</h4>
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div class="form-group">
                                <label for="gamborgVitamin">Gamborg Vitamin (g):</label>
                                <input type="number" id="gamborgVitamin" class="form-control" step="0.01" min="0">
                            </div>
                            
                            <div class="form-group">
                                <label for="sucrose">Sucrose (g):</label>
                                <input type="number" id="sucrose" class="form-control" step="0.01" min="0">
                            </div>
                            
                            <div class="form-group">
                                <label for="ppm">PPM (mL):</label>
                                <input type="number" id="ppm" class="form-control" step="0.01" min="0">
                            </div>
                        </div>
                    </div>

                    <div class="post-autoclave-section">
                        <h4>Post-Autoclave Additions</h4>
                        <div id="postAutoclaveList" class="ingredients-list">
                            <!-- Post-autoclave ingredients will be populated here -->
                        </div>
                    </div>

                    <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label for="phValue">pH:</label>
                            <input type="number" id="phValue" class="form-control" step="0.01" min="5" max="7" value="5.8">
                        </div>
                    </div>

                    <div class="recipe-metadata">
                        <div class="form-group">
                            <label for="recipeName">Recipe Name:</label>
                            <input type="text" id="recipeName" class="form-control" placeholder="Enter a name for this recipe">
                        </div>
                        
                        <div class="form-group">
                            <label for="recipeNotes">Notes (optional):</label>
                            <textarea id="recipeNotes" class="form-control" rows="3" placeholder="Add any notes about this recipe"></textarea>
                        </div>
                    </div>
                </div>

                <!-- Existing Recipe Form -->
                <div id="existingRecipeForm" class="recipe-form" style="display: none;">
                    <div class="recipe-search" style="margin-bottom: 15px;">
                        <input type="text" id="recipeSearch" class="form-control" placeholder="Search recipes..." style="margin-bottom: 10px;">
                        <div class="quick-filters" style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <button class="filter-btn" onclick="RecipeManager.filterRecipes('recent')">Recent</button>
                            <button class="filter-btn" onclick="RecipeManager.filterRecipes('popular')">Popular</button>
                            <button class="filter-btn" onclick="RecipeManager.filterRecipes('Initiation')">Initiation</button>
                            <button class="filter-btn" onclick="RecipeManager.filterRecipes('Multiplication')">Multiplication</button>
                            <button class="filter-btn" onclick="RecipeManager.filterRecipes('Rooting')">Rooting</button>
                        </div>
                    </div>
                    
                    <div class="recipe-list" id="recipeList" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;">
                        <!-- Recipe list will be populated here -->
                    </div>
                    
                    <div id="recipePreview" class="recipe-preview" style="margin-top: 15px; display: none;">
                        <!-- Selected recipe preview will be shown here -->
                    </div>
                </div>

                <div class="recipe-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: space-between;">
                    <div>
                        <button id="saveRecipeBtn" class="btn btn-secondary" onclick="RecipeManager.saveCurrentRecipe()" style="display: none;">
                            💾 Save Recipe
                        </button>
                        <button id="importRecipeBtn" class="btn btn-secondary" onclick="RecipeManager.showImportDialog()">
                            📥 Import Recipes
                        </button>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="RecipeManager.confirmRecipeSelection()">
                            ✅ Use This Recipe
                        </button>
                        <button class="btn btn-secondary" onclick="RecipeManager.cancelRecipeSelection()">
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Find the builder section and add recipe section after it
        const builderSection = document.getElementById('builderSection');
        if (builderSection) {
            builderSection.insertAdjacentHTML('afterend', recipeHTML);
        }

        // Add CSS for recipe components
        addRecipeCSS();
    }

    /**
     * Add CSS styles for recipe components
     */
    function addRecipeCSS() {
        const cssId = 'recipe-styles';
        if (document.getElementById(cssId)) {
            return; // CSS already added
        }

        const css = `
            .recipe-section {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .recipe-form {
                background: white;
                border-radius: 6px;
                padding: 20px;
                border: 1px solid #e9ecef;
            }
            
            .form-group {
                margin-bottom: 15px;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #495057;
            }
            
            .form-control {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .form-control:focus {
                border-color: #80bdff;
                outline: 0;
                box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
            }
            
            .mode-btn {
                padding: 10px 20px;
                border: 2px solid #007bff;
                background: white;
                color: #007bff;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .mode-btn.active,
            .mode-btn:hover {
                background: #007bff;
                color: white;
            }
            
            .filter-btn {
                padding: 6px 12px;
                border: 1px solid #6c757d;
                background: white;
                color: #6c757d;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            
            .filter-btn:hover,
            .filter-btn.active {
                background: #6c757d;
                color: white;
            }
            
            .recipe-item {
                padding: 12px;
                border-bottom: 1px solid #eee;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            
            .recipe-item:hover {
                background: #f8f9fa;
            }
            
            .recipe-item.selected {
                background: #e3f2fd;
                border-color: #2196f3;
            }
            
            .recipe-item h5 {
                margin: 0 0 5px 0;
                color: #333;
            }
            
            .recipe-item .recipe-meta {
                font-size: 12px;
                color: #666;
            }
            
            .ingredient-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 4px;
            }
            
            .ingredient-label {
                min-width: 120px;
                font-weight: 600;
                color: #495057;
            }
            
            .input-with-unit {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .ingredient-input {
                width: 80px;
                padding: 4px 8px;
                border: 1px solid #ced4da;
                border-radius: 4px;
            }
            
            .input-unit {
                font-size: 12px;
                color: #6c757d;
                min-width: 25px;
            }
            
            .ingredient-range {
                font-size: 11px;
                color: #28a745;
                font-style: italic;
            }
            
            .recipe-preview {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 15px;
            }
        `;

        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Recipe search
        const searchInput = document.getElementById('recipeSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                if (query.length >= 2 || query.length === 0) {
                    searchRecipes(query);
                }
            });
        }

        // Initialize calculator if form elements exist
        if (document.getElementById('volume')) {
            // Trigger initial calculation
            setTimeout(() => {
                if (window.RecipeCalculator) {
                    RecipeCalculator.updateVolumeAmounts();
                }
            }, 100);
        }
    }

    /**
     * Show the recipe step in barcode builder
     */
    function showRecipeStep() {
        isRecipeStepActive = true;
        
        // Hide builder section
        const builderSection = document.getElementById('builderSection');
        if (builderSection) {
            builderSection.style.display = 'none';
        }
        
        // Show recipe section
        const recipeSection = document.getElementById('recipeSection');
        if (recipeSection) {
            recipeSection.style.display = 'block';
        }
        
        // Load recipes for existing recipe mode
        if (recipeMode === 'existing') {
            loadRecipeList();
        }
        
        // Auto-populate recommended values for new recipe mode
        if (recipeMode === 'new' && window.RecipeCalculator) {
            // Initialize the calculator to populate default values
            setTimeout(() => {
                if (window.RecipeCalculator.autoPopulateRecipe) {
                    window.RecipeCalculator.autoPopulateRecipe();
                }
            }, 200);
        }
        
        // Setup dynamic event listeners for form elements
        setTimeout(() => {
            setupDynamicEventListeners();
            // Load initial template
            loadTemplate('Initiation');
        }, 300);
        
        // Update builder feedback
        updateBuilderFeedback('Select or create a recipe for this media');
    }

    /**
     * Hide the recipe step
     */
    function hideRecipeStep() {
        isRecipeStepActive = false;
        
        // Show builder section
        const builderSection = document.getElementById('builderSection');
        if (builderSection) {
            builderSection.style.display = 'block';
        }
        
        // Hide recipe section
        const recipeSection = document.getElementById('recipeSection');
        if (recipeSection) {
            recipeSection.style.display = 'none';
        }
    }

    /**
     * Set recipe mode (new or existing)
     */
    function setRecipeMode(mode) {
        recipeMode = mode;
        
        // Update button states
        const newBtn = document.getElementById('newRecipeBtn');
        const existingBtn = document.getElementById('existingRecipeBtn');
        
        if (newBtn && existingBtn) {
            newBtn.classList.toggle('active', mode === 'new');
            existingBtn.classList.toggle('active', mode === 'existing');
        }
        
        // Show/hide appropriate forms
        const newForm = document.getElementById('newRecipeForm');
        const existingForm = document.getElementById('existingRecipeForm');
        
        if (newForm && existingForm) {
            newForm.style.display = mode === 'new' ? 'block' : 'none';
            existingForm.style.display = mode === 'existing' ? 'block' : 'none';
        }
        
        // Show/hide save button
        const saveBtn = document.getElementById('saveRecipeBtn');
        if (saveBtn) {
            saveBtn.style.display = mode === 'new' ? 'inline-block' : 'none';
        }
        
        // Load recipe list if switching to existing mode
        if (mode === 'existing') {
            loadRecipeList();
        }
    }

    /**
     * Load and display recipe list
     */
    function loadRecipeList(recipes = null) {
        if (!window.RecipeStorage) {
            console.error('RecipeStorage not available');
            return;
        }
        
        const recipeList = document.getElementById('recipeList');
        if (!recipeList) return;
        
        const recipesToShow = recipes || RecipeStorage.getAllRecipes();
        
        if (recipesToShow.length === 0) {
            recipeList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #6c757d;">
                    <p>No recipes found.</p>
                    <button class="btn btn-primary" onclick="RecipeManager.setRecipeMode('new')">
                        Create Your First Recipe
                    </button>
                </div>
            `;
            return;
        }
        
        recipeList.innerHTML = recipesToShow.map(recipe => `
            <div class="recipe-item" onclick="RecipeManager.selectRecipe('${recipe.id}')">
                <h5>${recipe.name}</h5>
                <div class="recipe-meta">
                    ${recipe.mediaType} • ${recipe.volume} • ${recipe.basalSalt.type} + ${recipe.gellingAgent.type}
                    ${recipe.isTemplate ? ' • <span style="color: #007bff;">Default Template</span>' : ''}
                    ${recipe.lastUsed ? ` • Last used: ${new Date(recipe.lastUsed).toLocaleDateString()}` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Search recipes
     */
    function searchRecipes(query) {
        if (!window.RecipeStorage) return;
        
        if (!query.trim()) {
            loadRecipeList();
            return;
        }
        
        const results = RecipeStorage.searchRecipes(query);
        loadRecipeList(results);
    }

    /**
     * Filter recipes by criteria
     */
    function filterRecipes(filter) {
        if (!window.RecipeStorage) return;
        
        let recipes;
        
        switch (filter) {
            case 'recent':
                recipes = RecipeStorage.getRecentRecipes(10);
                break;
            case 'popular':
                recipes = RecipeStorage.getPopularRecipes(10);
                break;
            case 'Initiation':
            case 'Multiplication':
            case 'Rooting':
                recipes = RecipeStorage.getRecipesByMediaType(filter);
                break;
            default:
                recipes = RecipeStorage.getAllRecipes();
        }
        
        loadRecipeList(recipes);
    }

    /**
     * Select a recipe from the list
     */
    function selectRecipe(recipeId) {
        if (!window.RecipeStorage) return;
        
        const recipe = RecipeStorage.loadRecipe(recipeId);
        if (!recipe) return;
        
        currentRecipe = recipe;
        
        // Update visual selection
        document.querySelectorAll('.recipe-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        event.target.closest('.recipe-item').classList.add('selected');
        
        // Show recipe preview
        showRecipePreview(recipe);
        
        // Load recipe into form for editing
        if (window.RecipeCalculator) {
            RecipeCalculator.loadRecipeIntoForm(recipe);
        }
    }

    /**
     * Show recipe preview
     */
    function showRecipePreview(recipe) {
        const previewDiv = document.getElementById('recipePreview');
        if (!previewDiv) return;
        
        previewDiv.style.display = 'block';
        previewDiv.innerHTML = `
            <h4>${recipe.name}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h5>Basic Information</h5>
                    <p><strong>Media Type:</strong> ${recipe.mediaType}</p>
                    <p><strong>Volume:</strong> ${recipe.volume}</p>
                    <p><strong>Basal Salt:</strong> ${recipe.basalSalt.type} (${recipe.basalSalt.amount}g)</p>
                    <p><strong>Gelling Agent:</strong> ${recipe.gellingAgent.type} (${recipe.gellingAgent.amount}g)</p>
                    <p><strong>pH:</strong> ${recipe.pH}</p>
                </div>
                <div>
                    <h5>Pre-Autoclave Ingredients</h5>
                    <p><strong>Gamborg Vitamin:</strong> ${recipe.preAutoclave.gamborgVitamin}g</p>
                    <p><strong>Sucrose:</strong> ${recipe.preAutoclave.sucrose}g</p>
                    <p><strong>PPM:</strong> ${recipe.preAutoclave.ppm}mL</p>
                    
                    <h5>Post-Autoclave Additions</h5>
                    ${recipe.postAutoclave.map(item => 
                        `<p><strong>${item.name}:</strong> ${item.amount}${item.unit}</p>`
                    ).join('')}
                </div>
            </div>
            ${recipe.notes ? `<div style="margin-top: 15px;"><h5>Notes</h5><p>${recipe.notes}</p></div>` : ''}
        `;
    }

    /**
     * Save current recipe
     */
    function saveCurrentRecipe() {
        if (!window.RecipeCalculator || !window.RecipeStorage) return;
        
        const recipeName = document.getElementById('recipeName')?.value?.trim();
        if (!recipeName) {
            UIUtils.showNotification('Please enter a recipe name', 'warning');
            return;
        }
        
        const recipeData = RecipeCalculator.getCurrentRecipeData();
        recipeData.name = recipeName;
        recipeData.notes = document.getElementById('recipeNotes')?.value?.trim() || '';
        
        try {
            const recipeId = RecipeStorage.saveRecipe(recipeData);
            currentRecipe = { ...recipeData, id: recipeId };
            UIUtils.showNotification(`Recipe "${recipeName}" saved successfully`, 'success');
            
            // Refresh recipe list if in existing mode
            if (recipeMode === 'existing') {
                loadRecipeList();
            }
        } catch (error) {
            UIUtils.showNotification(`Failed to save recipe: ${error.message}`, 'error');
        }
    }

    /**
     * Confirm recipe selection and proceed
     */
    function confirmRecipeSelection() {
        if (recipeMode === 'new') {
            // For new recipes, get current form data
            if (!window.RecipeCalculator) return;
            
            currentRecipe = RecipeCalculator.getCurrentRecipeData();
            currentRecipe.name = document.getElementById('recipeName')?.value?.trim() || 'Unnamed Recipe';
            currentRecipe.notes = document.getElementById('recipeNotes')?.value?.trim() || '';
        }
        
        if (!currentRecipe) {
            UIUtils.showNotification('Please select or create a recipe', 'warning');
            return;
        }
        
        // Add recipe to builder data
        StateManager.setState('builderData.recipe', currentRecipe);
        
        // Hide recipe step and continue builder
        hideRecipeStep();
        
        // Continue via step manager
        if (window.BuilderStepManager) {
            BuilderStepManager.continueFromRecipeStep(currentRecipe);
        } else if (window.BarcodeBuilder) {
            BarcodeBuilder.nextStep();
        }
        
        UIUtils.showNotification(`Recipe "${currentRecipe.name}" selected`, 'success');
    }

    /**
     * Cancel recipe selection
     */
    function cancelRecipeSelection() {
        hideRecipeStep();
        currentRecipe = null;
        
        // Go back to previous builder step
        if (window.BarcodeBuilder) {
            BarcodeBuilder.previousStep();
        }
    }

    /**
     * Show import dialog
     */
    function showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonData = e.target.result;
                        if (window.RecipeStorage) {
                            const result = RecipeStorage.importRecipes(jsonData, {
                                allowDuplicates: false,
                                updateExisting: true
                            });
                            
                            // Refresh recipe list
                            loadRecipeList();
                        }
                    } catch (error) {
                        UIUtils.showNotification(`Import failed: ${error.message}`, 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }

    /**
     * Update builder feedback
     */
    function updateBuilderFeedback(message) {
        const feedback = document.getElementById('builderFeedback');
        if (feedback) {
            feedback.textContent = message;
        }
    }

    /**
     * Get current recipe
     */
    function getCurrentRecipe() {
        return currentRecipe;
    }

    /**
     * Check if recipe step is active
     */
    function isRecipeActive() {
        return isRecipeStepActive;
    }

    /**
     * Load template based on media type
     */
    function loadTemplate(mediaType) {
        currentTemplate = mediaType;
        const template = TEMPLATES[mediaType];
        
        if (!template) {
            console.warn('Template not found for media type:', mediaType);
            return;
        }
        
        // Store original values if first time loading
        if (Object.keys(originalValues).length === 0) {
            captureOriginalValues();
        }
        
        // Update basal salt
        const basalSalt = document.getElementById('basalSalt');
        const basalSaltAmount = document.getElementById('basalSaltAmount');
        if (basalSalt && basalSaltAmount) {
            basalSalt.value = template.basalSalt.type;
            basalSaltAmount.value = template.basalSalt.amount;
        }
        
        // Update gelling agent
        const gellingAgent = document.getElementById('gellingAgent');
        const gellingAgentAmount = document.getElementById('gellingAgentAmount');
        if (gellingAgent && gellingAgentAmount) {
            gellingAgent.value = template.gellingAgent.type;
            gellingAgentAmount.value = template.gellingAgent.amount;
        }
        
        // Update pre-autoclave ingredients
        const gamborgVitamin = document.getElementById('gamborgVitamin');
        const sucrose = document.getElementById('sucrose');
        const ppm = document.getElementById('ppm');
        
        if (gamborgVitamin) gamborgVitamin.value = template.preAutoclave.gamborgVitamin;
        if (sucrose) sucrose.value = template.preAutoclave.sucrose;
        if (ppm) ppm.value = template.preAutoclave.ppm;
        
        // Update pH
        const phValue = document.getElementById('phValue');
        if (phValue) phValue.value = template.pH;
        
        // Update post-autoclave additions
        updatePostAutoclaveList(template.postAutoclave);
        
        // Trigger volume scaling if needed
        const volume = document.getElementById('volume');
        if (volume && window.RecipeCalculator) {
            RecipeCalculator.updateVolumeAmounts();
        }
        
        console.log('Template loaded:', mediaType, template);
    }
    
    /**
     * Capture original values for restoration
     */
    function captureOriginalValues() {
        const fields = ['basalSaltAmount', 'gellingAgentAmount', 'gamborgVitamin', 'sucrose', 'ppm'];
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                originalValues[fieldId] = element.value;
            }
        });
    }
    
    /**
     * Update post-autoclave additions list
     */
    function updatePostAutoclaveList(postAutoclaveItems) {
        const container = document.getElementById('postAutoclaveList');
        if (!container || !postAutoclaveItems) return;
        
        container.innerHTML = postAutoclaveItems.map((item, index) => `
            <div class="ingredient-row">
                <div class="ingredient-label">${item.name}:</div>
                <div class="input-with-unit">
                    <input type="number" 
                           id="postAutoclave_${index}" 
                           class="ingredient-input" 
                           value="${item.amount}" 
                           step="0.01" 
                           min="0"
                           onchange="RecipeManager.updatePostAutoclaveAmount(${index}, this.value)">
                    <span class="input-unit">${item.unit}</span>
                    ${item.range ? `<span class="ingredient-range">(${item.range}${item.unit})</span>` : ''}
                </div>
            </div>
        `).join('');
        
        // Store current post-autoclave data
        currentPostAutoclaveItems = [...postAutoclaveItems];
    }
    
    /**
     * Update post-autoclave amount
     */
    function updatePostAutoclaveAmount(index, newAmount) {
        if (currentPostAutoclaveItems && currentPostAutoclaveItems[index]) {
            currentPostAutoclaveItems[index].amount = parseFloat(newAmount) || 0;
            console.log('Updated post-autoclave item:', currentPostAutoclaveItems[index]);
        }
    }
    
    /**
     * Setup dynamic event listeners for form elements
     */
    function setupDynamicEventListeners() {
        // Volume change listener
        const volumeSelect = document.getElementById('volume');
        if (volumeSelect) {
            volumeSelect.addEventListener('change', function() {
                if (window.RecipeCalculator) {
                    RecipeCalculator.updateVolumeAmounts();
                }
            });
        }
        
        // Basal salt change listener
        const basalSaltSelect = document.getElementById('basalSalt');
        if (basalSaltSelect) {
            basalSaltSelect.addEventListener('change', function() {
                updateBasalSaltAmount(this.value);
            });
        }
        
        // Gelling agent change listener
        const gellingAgentSelect = document.getElementById('gellingAgent');
        if (gellingAgentSelect) {
            gellingAgentSelect.addEventListener('change', function() {
                updateGellingAgentAmount(this.value);
            });
        }
    }
    
    /**
     * Update basal salt amount based on type
     */
    function updateBasalSaltAmount(saltType) {
        const amountInput = document.getElementById('basalSaltAmount');
        if (!amountInput) return;
        
        // Default amounts for different salt types
        const defaultAmounts = {
            'M&S': 4.48,
            'DKW': 5.32
        };
        
        const baseAmount = defaultAmounts[saltType] || 4.48;
        const volume = document.getElementById('volume')?.value || '1L';
        const scale = VOLUME_SCALES[volume] || 1.0;
        
        amountInput.value = (baseAmount * scale).toFixed(2);
        console.log('Updated basal salt amount:', saltType, amountInput.value);
    }
    
    /**
     * Update gelling agent amount based on type
     */
    function updateGellingAgentAmount(agentType) {
        const amountInput = document.getElementById('gellingAgentAmount');
        if (!amountInput) return;
        
        // Default amounts for different gelling agents
        const defaultAmounts = {
            'Phytogel': 2.3,
            'Agar': 8.0
        };
        
        const baseAmount = defaultAmounts[agentType] || 2.3;
        const volume = document.getElementById('volume')?.value || '1L';
        const scale = VOLUME_SCALES[volume] || 1.0;
        
        amountInput.value = (baseAmount * scale).toFixed(2);
        console.log('Updated gelling agent amount:', agentType, amountInput.value);
    }
    
    // Store current post-autoclave items
    let currentPostAutoclaveItems = [];

    // Public API
    return {
        initialize,
        setupRecipeUI,
        showRecipeStep,
        hideRecipeStep,
        setRecipeMode,
        searchRecipes,
        filterRecipes,
        selectRecipe,
        saveCurrentRecipe,
        confirmRecipeSelection,
        cancelRecipeSelection,
        showImportDialog,
        getCurrentRecipe,
        isRecipeActive,
        loadTemplate,
        updatePostAutoclaveAmount,
        setupDynamicEventListeners
    };
})();
