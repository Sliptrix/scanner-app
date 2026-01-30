/**
 * Media Lab UI Module
 * Handles all UI interactions for the media lab section
 * Integrates recipe management and batch tracking
 */

window.MediaLabUI = (function() {
    'use strict';

    let currentBatchId = null;
    let isProcessing = false; // Lock to prevent double-clicks

    /**
     * Initialize the media lab UI
     */
    function initialize() {
        console.log('MediaLabUI initializing...');

        // Initialize batch manager
        if (window.MediaBatchManager) {
            MediaBatchManager.initialize();
        }

        // Refresh stats and batch list
        refreshBatchStats();
        refreshBatchList();

        // Set up event listeners
        setupEventListeners();

        console.log('MediaLabUI initialized');
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Listen for recipe saves to suggest batch creation
        document.addEventListener('recipeSaved', (e) => {
            const recipe = e.detail;
            if (confirm(`Recipe "${recipe.name}" saved. Would you like to start a new batch with this recipe?`)) {
                showNewBatchModal(recipe.id);
            }
        });
    }

    /**
     * Refresh batch statistics display
     */
    function refreshBatchStats() {
        if (!window.MediaBatchManager) return;

        const stats = MediaBatchManager.getBatchStats();

        const statReady = document.getElementById('statReady');
        const statInPrep = document.getElementById('statInPrep');
        const statExpiring = document.getElementById('statExpiring');
        const statContainers = document.getElementById('statContainers');

        if (statReady) statReady.textContent = stats.ready + stats.inUse;
        if (statInPrep) statInPrep.textContent = stats.inPrep;
        if (statExpiring) statExpiring.textContent = stats.expiringSoon;
        if (statContainers) statContainers.textContent = stats.totalContainersAvailable;

        // Add warning styling if batches are expiring soon
        if (statExpiring && stats.expiringSoon > 0) {
            statExpiring.parentElement.style.animation = 'pulse 2s infinite';
        }
    }

    /**
     * Refresh the batch list display
     */
    function refreshBatchList() {
        if (!window.MediaBatchManager) return;

        const container = document.getElementById('activeBatchList');
        if (!container) return;

        const batches = MediaBatchManager.getAllBatches();

        // Sort: in_prep first, then ready/in_use, then by expiry date
        batches.sort((a, b) => {
            const statusOrder = {
                'in_prep': 0,
                'ready': 1,
                'in_use': 2,
                'depleted': 3,
                'expired': 4,
                'discarded': 5
            };

            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }

            return new Date(a.expiryDate) - new Date(b.expiryDate);
        });

        if (batches.length === 0) {
            container.innerHTML = `
                <p style="color: #666; text-align: center; padding: 20px;">
                    No batches yet. Start a new batch to begin tracking.
                </p>
            `;
            return;
        }

        container.innerHTML = batches.map(batch => renderBatchCard(batch)).join('');
    }

    /**
     * Render a batch card
     */
    function renderBatchCard(batch) {
        const statusColors = {
            'in_prep': '#f57c00',
            'ready': '#2e7d32',
            'in_use': '#1976d2',
            'depleted': '#9e9e9e',
            'expired': '#c62828',
            'discarded': '#616161'
        };

        const statusLabels = {
            'in_prep': '🔧 In Preparation',
            'ready': '✅ Ready',
            'in_use': '📦 In Use',
            'depleted': '📭 Depleted',
            'expired': '⏰ Expired',
            'discarded': '🗑️ Discarded'
        };

        const expiryDate = new Date(batch.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

        const completedSteps = batch.prepSteps.filter(s => s.completed).length;
        const totalSteps = batch.prepSteps.length;
        const progressPercent = (completedSteps / totalSteps) * 100;

        return `
            <div class="batch-card" style="border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <strong style="font-size: 1.1em;">${batch.id}</strong>
                        <span style="margin-left: 10px; color: ${statusColors[batch.status]}; font-weight: 600;">
                            ${statusLabels[batch.status]}
                        </span>
                    </div>
                    <div>
                        ${batch.status === 'in_prep' ? `
                            <button class="btn btn-sm btn-primary" onclick="MediaLabUI.continuePrepFlow('${batch.id}')">
                                Continue Prep
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="MediaLabUI.viewBatchDetails('${batch.id}')">
                            View Details
                        </button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9em;">
                    <div><strong>Recipe:</strong> ${batch.recipeName}</div>
                    <div><strong>Media Type:</strong> ${batch.mediaType}</div>
                    <div><strong>Volume:</strong> ${batch.volume}</div>
                    <div><strong>Prepared:</strong> ${new Date(batch.prepDate).toLocaleDateString()}</div>
                    <div style="color: ${isExpiringSoon ? '#c62828' : 'inherit'};">
                        <strong>Expires:</strong> ${expiryDate.toLocaleDateString()}
                        ${isExpiringSoon ? ` (${daysUntilExpiry} days!)` : ''}
                    </div>
                    <div><strong>Containers:</strong> ${batch.availableContainers} / ${batch.totalContainers}</div>
                </div>

                ${batch.status === 'in_prep' ? `
                    <div style="margin-top: 10px;">
                        <div style="background: #e9ecef; border-radius: 4px; height: 8px; overflow: hidden;">
                            <div style="background: #1976d2; height: 100%; width: ${progressPercent}%;"></div>
                        </div>
                        <div style="font-size: 0.8em; color: #666; margin-top: 5px;">
                            ${completedSteps}/${totalSteps} steps complete
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show new batch modal
     */
    function showNewBatchModal(preselectedRecipeId = null) {
        // Prevent opening multiple modals
        if (document.getElementById('newBatchModal')) {
            console.log('New batch modal already open');
            return;
        }

        // Get available recipes
        let recipes = [];
        if (window.RecipeStorage) {
            recipes = RecipeStorage.getAllRecipes();
        }

        const recipeOptions = recipes.map(r => `
            <option value="${r.id}" ${r.id === preselectedRecipeId ? 'selected' : ''}>
                ${r.name} (${r.mediaType} - ${r.volume})
            </option>
        `).join('');

        const modalHTML = `
            <div id="newBatchModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                <div class="modal-content" style="background: white; border-radius: 12px; padding: 25px; max-width: 500px; width: 90%;">
                    <h3 style="margin-bottom: 20px; color: #2c3e50;">🧫 Start New Media Batch</h3>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Recipe:</label>
                        <select id="batchRecipeSelect" class="form-control" style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;">
                            <option value="">-- Select a Recipe --</option>
                            ${recipeOptions}
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Prepared By:</label>
                        <input type="text" id="batchPreparedBy" class="form-control" placeholder="Your name or initials"
                               style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Number of Containers:</label>
                        <input type="number" id="batchContainerCount" class="form-control" min="1" max="100" value="10"
                               style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Expiry Days:</label>
                        <input type="number" id="batchExpiryDays" class="form-control" min="7" max="90" value="30"
                               style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;">
                        <small style="color: #666;">Default: 30 days</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: 600;">Notes (optional):</label>
                        <textarea id="batchNotes" class="form-control" rows="2" placeholder="Any special notes for this batch"
                                  style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px;"></textarea>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="MediaLabUI.closeModal()">Cancel</button>
                        <button id="startBatchBtn" class="btn btn-primary" onclick="MediaLabUI.createNewBatch()">Start Batch</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Close any open modal
     */
    function closeModal() {
        const modal = document.getElementById('newBatchModal');
        if (modal) modal.remove();

        const detailModal = document.getElementById('batchDetailModal');
        if (detailModal) detailModal.remove();

        const prepModal = document.getElementById('prepFlowModal');
        if (prepModal) prepModal.remove();
    }

    /**
     * Create a new batch from the modal form
     */
    function createNewBatch() {
        // Prevent double-clicks
        if (isProcessing) {
            console.log('Batch creation already in progress');
            return;
        }

        const recipeId = document.getElementById('batchRecipeSelect')?.value;
        const preparedBy = document.getElementById('batchPreparedBy')?.value?.trim() || 'Unknown';
        const containerCount = parseInt(document.getElementById('batchContainerCount')?.value) || 10;
        const expiryDays = parseInt(document.getElementById('batchExpiryDays')?.value) || 30;
        const notes = document.getElementById('batchNotes')?.value?.trim() || '';

        if (!recipeId) {
            UIUtils.showNotification('Please select a recipe', 'warning');
            return;
        }

        // Set processing lock
        isProcessing = true;

        // Disable the button to provide visual feedback
        const startBtn = document.getElementById('startBatchBtn');
        const originalBtnText = startBtn?.textContent || 'Start Batch';

        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Creating...';
            startBtn.style.background = '#6c757d';
        }

        // Helper to reset button state
        function resetButton() {
            const btn = document.getElementById('startBatchBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText;
                btn.style.background = '';
            }
            isProcessing = false;
        }

        // Helper to show success
        function showSuccess(batch) {
            // Update button to show success briefly
            if (startBtn) {
                startBtn.textContent = '✅ Created!';
                startBtn.style.background = '#28a745';
            }

            // Show success notification
            UIUtils.showNotification(`✅ Batch ${batch.id} created successfully!`, 'success');

            // Close modal after brief delay to show success
            setTimeout(() => {
                closeModal();
                refreshBatchStats();
                refreshBatchList();
                isProcessing = false;

                // Ask if they want to start the prep flow
                if (confirm('Batch created! Would you like to start the preparation workflow?')) {
                    continuePrepFlow(batch.id);
                }
            }, 500);
        }

        try {
            const batch = MediaBatchManager.createBatch(recipeId, {
                preparedBy,
                containerCount,
                expiryDays,
                notes
            });

            if (batch) {
                showSuccess(batch);
            } else {
                throw new Error('Batch creation returned empty result');
            }

        } catch (error) {
            console.error('Failed to create batch:', error);
            UIUtils.showNotification('Failed to create batch: ' + error.message, 'error');
            resetButton();
        }
    }

    /**
     * Show batch details
     */
    function viewBatchDetails(batchId) {
        const batch = MediaBatchManager.getBatch(batchId);
        if (!batch) {
            UIUtils.showNotification('Batch not found', 'error');
            return;
        }

        const modalHTML = `
            <div id="batchDetailModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                <div class="modal-content" style="background: white; border-radius: 12px; padding: 25px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin-bottom: 20px; color: #2c3e50;">📋 Batch Details: ${batch.id}</h3>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div><strong>Recipe:</strong> ${batch.recipeName}</div>
                        <div><strong>Media Type:</strong> ${batch.mediaType}</div>
                        <div><strong>Volume:</strong> ${batch.volume}</div>
                        <div><strong>Status:</strong> ${batch.status}</div>
                        <div><strong>Prepared By:</strong> ${batch.preparedBy}</div>
                        <div><strong>Prep Date:</strong> ${new Date(batch.prepDate).toLocaleDateString()}</div>
                        <div><strong>Expiry Date:</strong> ${new Date(batch.expiryDate).toLocaleDateString()}</div>
                        <div><strong>Containers:</strong> ${batch.availableContainers}/${batch.totalContainers} available</div>
                    </div>

                    <h4 style="margin-bottom: 10px;">Preparation Steps</h4>
                    <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        ${batch.prepSteps.map(step => `
                            <div style="display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <span style="margin-right: 10px; font-size: 1.2em;">
                                    ${step.completed ? '✅' : '⬜'}
                                </span>
                                <div>
                                    <strong>${step.name}</strong>
                                    ${step.completed ? `<span style="color: #666; font-size: 0.9em;"> - Completed ${new Date(step.completedAt).toLocaleString()}</span>` : ''}
                                    ${step.notes ? `<div style="color: #666; font-size: 0.9em;">${step.notes}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    ${batch.notes ? `<div style="margin-bottom: 20px;"><strong>Notes:</strong> ${batch.notes}</div>` : ''}

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        ${batch.status !== 'depleted' && batch.status !== 'expired' && batch.status !== 'discarded' ? `
                            <button class="btn btn-warning" onclick="MediaLabUI.discardBatch('${batch.id}')">
                                🗑️ Discard Batch
                            </button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="MediaLabUI.deleteBatch('${batch.id}')">
                            ❌ Delete Record
                        </button>
                        <button class="btn btn-secondary" onclick="MediaLabUI.closeModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Continue preparation flow for a batch - Full wizard view
     */
    function continuePrepFlow(batchId) {
        currentBatchId = batchId;
        const batch = MediaBatchManager.getBatch(batchId);
        if (!batch) {
            UIUtils.showNotification('Batch not found', 'error');
            return;
        }

        // Get the recipe data for ingredient amounts
        let recipe = null;
        if (window.RecipeStorage && batch.recipeId) {
            recipe = RecipeStorage.loadRecipe(batch.recipeId);
        }

        showPrepWizard(batch, recipe);
    }

    /**
     * Generate ingredient list HTML for a step
     */
    function getStepIngredients(stepId, recipe, batch) {
        const volume = batch?.volume || '1L';

        // Handle cases where recipe is not available
        if (!recipe) {
            switch (stepId) {
                case 'weigh':
                    return '<p class="step-tip">⚠️ Recipe data not available. Check your recipe for ingredient amounts.</p>';
                case 'dissolve':
                    return `<p>Add distilled water (${volume}) and mix ingredients thoroughly.</p>`;
                case 'post_autoclave':
                    return '<p>Check recipe for post-autoclave additions.</p>';
                case 'pour':
                case 'label':
                case 'ph_adjust':
                case 'autoclave':
                case 'cool':
                    break; // These don't need recipe data
                default:
                    return '';
            }
        }

        const scale = volume === '500mL' ? 0.5 : volume === '2L' ? 2.0 : 1.0;

        switch (stepId) {
            case 'weigh':
                return `
                    <div class="ingredient-checklist">
                        <div class="ingredient-item">
                            <span class="ingredient-name">${recipe?.basalSalt?.type || 'Basal Salt'}</span>
                            <span class="ingredient-amount">${(recipe?.basalSalt?.amount || 0).toFixed(2)}g</span>
                        </div>
                        <div class="ingredient-item">
                            <span class="ingredient-name">${recipe?.gellingAgent?.type || 'Gelling Agent'}</span>
                            <span class="ingredient-amount">${(recipe?.gellingAgent?.amount || 0).toFixed(2)}g</span>
                        </div>
                        <div class="ingredient-item">
                            <span class="ingredient-name">Gamborg Vitamin</span>
                            <span class="ingredient-amount">${(recipe?.preAutoclave?.gamborgVitamin || 0).toFixed(2)}g</span>
                        </div>
                        <div class="ingredient-item">
                            <span class="ingredient-name">Sucrose</span>
                            <span class="ingredient-amount">${(recipe?.preAutoclave?.sucrose || 0).toFixed(1)}g</span>
                        </div>
                    </div>
                `;

            case 'dissolve':
                return `
                    <div class="ingredient-checklist">
                        <div class="ingredient-item">
                            <span class="ingredient-name">Distilled Water</span>
                            <span class="ingredient-amount">${volume}</span>
                        </div>
                        <div class="ingredient-item">
                            <span class="ingredient-name">PPM</span>
                            <span class="ingredient-amount">${(recipe?.preAutoclave?.ppm || 0).toFixed(2)}mL</span>
                        </div>
                    </div>
                    <p class="step-tip">💡 Add dry ingredients slowly while stirring</p>
                `;

            case 'ph_adjust':
                return `
                    <div class="target-value">
                        <span class="target-label">Target pH Range</span>
                        <span class="target-number">5.7 - 6.0</span>
                    </div>
                    <p class="step-tip">💡 Use pH meter. Adjust with NaOH (up) or HCl (down)</p>
                `;

            case 'autoclave':
                return `
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">Temperature</span>
                            <span class="setting-value">120°C</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Duration</span>
                            <span class="setting-value">20 min</span>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Pressure</span>
                            <span class="setting-value">WITH</span>
                        </div>
                    </div>
                `;

            case 'cool':
                return `
                    <div class="target-value">
                        <span class="target-label">Cool To</span>
                        <span class="target-number">55°C</span>
                    </div>
                    <p class="step-tip">⚠️ Must cool before adding post-autoclave ingredients</p>
                `;

            case 'post_autoclave':
                if (!recipe?.postAutoclave || recipe.postAutoclave.length === 0) {
                    return '<p>No post-autoclave additions for this recipe</p>';
                }
                return `
                    <div class="ingredient-checklist">
                        ${recipe.postAutoclave.map(item => `
                            <div class="ingredient-item">
                                <span class="ingredient-name">${item.name || 'Unknown'}</span>
                                <span class="ingredient-amount">${item.amount || 0}${item.unit || ''}</span>
                                ${item.range ? `<span class="ingredient-range">${item.range}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    <p class="step-tip">⚠️ Add ingredients at 55°C or below</p>
                `;

            case 'pour':
                return `
                    <div class="target-value">
                        <span class="target-label">Containers</span>
                        <span class="target-number">${batch?.totalContainers || 'N/A'}</span>
                    </div>
                    <p class="step-tip">💡 Work quickly in sterile conditions</p>
                `;

            case 'label':
                return `
                    <div class="batch-label-info">
                        <div><strong>Batch:</strong> ${batch?.id || 'N/A'}</div>
                        <div><strong>Media:</strong> ${batch?.mediaType || 'N/A'}</div>
                        <div><strong>Date:</strong> ${batch?.prepDate ? new Date(batch.prepDate).toLocaleDateString() : 'N/A'}</div>
                        <div><strong>Expires:</strong> ${batch?.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                `;

            default:
                return '';
        }
    }

    /**
     * Show the full preparation wizard
     */
    function showPrepWizard(batch, recipe) {
        // Close any existing modal
        closeModal();

        const completedCount = batch.prepSteps.filter(s => s.completed).length;
        const progressPercent = (completedCount / batch.prepSteps.length) * 100;

        const modalHTML = `
            <div id="prepFlowModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 20px;">
                <div class="prep-wizard" style="background: white; border-radius: 12px; max-width: 700px; width: 100%; margin: 20px auto;">
                    <!-- Header -->
                    <div class="prep-wizard-header" style="background: linear-gradient(135deg, #1976d2, #1565c0); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h2 style="margin: 0 0 5px 0;">🧫 ${batch.recipeName}</h2>
                                <div style="opacity: 0.9; font-size: 0.9em;">
                                    Batch ${batch.id} • ${batch.volume} • ${batch.mediaType}
                                </div>
                            </div>
                            <button onclick="MediaLabUI.closeModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 1.2em;">✕</button>
                        </div>
                        <!-- Progress bar -->
                        <div style="margin-top: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 5px;">
                                <span>${completedCount} of ${batch.prepSteps.length} steps complete</span>
                                <span>${Math.round(progressPercent)}%</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.3); border-radius: 4px; height: 8px; overflow: hidden;">
                                <div id="prepProgressBar" style="background: #4caf50; height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Steps Container -->
                    <div class="prep-steps-container" style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                        ${batch.prepSteps.map((step, index) => `
                            <div class="prep-step ${step.completed ? 'completed' : ''} ${!step.completed && index === completedCount ? 'current' : ''}"
                                 id="prepStep_${step.id}"
                                 style="border: 2px solid ${step.completed ? '#4caf50' : index === completedCount ? '#1976d2' : '#e0e0e0'};
                                        border-radius: 8px; margin-bottom: 12px; overflow: hidden;
                                        background: ${step.completed ? '#f1f8e9' : 'white'};
                                        opacity: ${step.completed ? '0.8' : '1'};">

                                <!-- Step Header - Clickable to toggle -->
                                <div class="step-header"
                                     onclick="MediaLabUI.toggleStep('${step.id}')"
                                     style="padding: 15px; cursor: pointer; display: flex; align-items: center; gap: 12px;
                                            background: ${step.completed ? '#c8e6c9' : index === completedCount ? '#e3f2fd' : '#fafafa'};">

                                    <!-- Checkbox -->
                                    <div class="step-checkbox"
                                         onclick="event.stopPropagation(); MediaLabUI.quickCompleteStep('${batch.id}', '${step.id}')"
                                         style="width: 28px; height: 28px; border-radius: 50%;
                                                border: 2px solid ${step.completed ? '#4caf50' : '#bdbdbd'};
                                                background: ${step.completed ? '#4caf50' : 'white'};
                                                display: flex; align-items: center; justify-content: center;
                                                cursor: pointer; flex-shrink: 0; transition: all 0.2s;">
                                        ${step.completed ? '<span style="color: white; font-size: 16px;">✓</span>' : `<span style="color: #bdbdbd; font-size: 14px;">${index + 1}</span>`}
                                    </div>

                                    <!-- Step Title -->
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: ${step.completed ? '#2e7d32' : '#333'};">
                                            ${step.name}
                                        </div>
                                        <div style="font-size: 0.85em; color: #666;">
                                            ${step.description}
                                        </div>
                                    </div>

                                    <!-- Expand Arrow -->
                                    <div class="step-arrow" id="arrow_${step.id}" style="color: #999; transition: transform 0.2s;">
                                        ${index === completedCount && !step.completed ? '▼' : '▶'}
                                    </div>
                                </div>

                                <!-- Step Details - Expandable -->
                                <div class="step-details" id="details_${step.id}"
                                     style="padding: ${index === completedCount && !step.completed ? '15px' : '0 15px'};
                                            max-height: ${index === completedCount && !step.completed ? '500px' : '0'};
                                            overflow: hidden; transition: all 0.3s ease;
                                            border-top: ${index === completedCount && !step.completed ? '1px solid #e0e0e0' : 'none'};">

                                    <!-- Ingredient/Instructions Content -->
                                    <div class="step-content" style="margin-bottom: 15px;">
                                        ${getStepIngredients(step.id, recipe, batch)}
                                    </div>

                                    ${step.id === 'ph_adjust' ? `
                                        <div class="inline-input" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                            <label style="font-weight: 500;">Measured pH:</label>
                                            <input type="number" id="input_ph_${batch.id}" step="0.1" min="5" max="7" placeholder="5.8"
                                                   style="width: 80px; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                                        </div>
                                    ` : ''}

                                    ${step.completed ? `
                                        <div style="color: #2e7d32; font-size: 0.85em;">
                                            ✓ Completed ${step.completedAt ? new Date(step.completedAt).toLocaleString() : ''}
                                            ${step.notes ? `<br><em>"${step.notes}"</em>` : ''}
                                        </div>
                                    ` : `
                                        <button class="btn btn-success"
                                                onclick="MediaLabUI.quickCompleteStep('${batch.id}', '${step.id}')"
                                                style="width: 100%; padding: 12px; font-size: 1em;">
                                            ✓ Mark Complete
                                        </button>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Footer -->
                    <div style="padding: 15px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <div style="color: #666; font-size: 0.9em;">
                            ${completedCount === batch.prepSteps.length
                                ? '🎉 All steps complete!'
                                : `Next: ${batch.prepSteps[completedCount]?.name || 'Complete'}`}
                        </div>
                        <button class="btn btn-primary" onclick="MediaLabUI.closeModal()" style="padding: 10px 20px;">
                            ${completedCount === batch.prepSteps.length ? 'Finish' : 'Save & Close'}
                        </button>
                    </div>
                </div>
            </div>

            <style>
                .ingredient-checklist { display: flex; flex-direction: column; gap: 8px; }
                .ingredient-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f5f5f5; border-radius: 6px; }
                .ingredient-name { font-weight: 500; color: #333; }
                .ingredient-amount { font-weight: 700; color: #1976d2; font-size: 1.1em; }
                .ingredient-range { font-size: 0.85em; color: #666; margin-left: 8px; }
                .step-tip { margin: 10px 0 0 0; padding: 10px; background: #fff8e1; border-radius: 6px; font-size: 0.9em; color: #f57c00; }
                .target-value { text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px; }
                .target-label { display: block; font-size: 0.9em; color: #666; margin-bottom: 5px; }
                .target-number { display: block; font-size: 2em; font-weight: 700; color: #1976d2; }
                .settings-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .setting-item { text-align: center; padding: 12px; background: #f5f5f5; border-radius: 6px; }
                .setting-label { display: block; font-size: 0.85em; color: #666; }
                .setting-value { display: block; font-size: 1.2em; font-weight: 700; color: #333; }
                .batch-label-info { background: #f5f5f5; padding: 15px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .prep-step.current { box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3); }
                .step-checkbox:hover { transform: scale(1.1); }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Toggle step details expansion
     */
    function toggleStep(stepId) {
        const details = document.getElementById(`details_${stepId}`);
        const arrow = document.getElementById(`arrow_${stepId}`);

        if (!details) return;

        const isExpanded = details.style.maxHeight !== '0px';

        if (isExpanded) {
            details.style.maxHeight = '0';
            details.style.padding = '0 15px';
            details.style.borderTop = 'none';
            if (arrow) arrow.textContent = '▶';
        } else {
            details.style.maxHeight = '500px';
            details.style.padding = '15px';
            details.style.borderTop = '1px solid #e0e0e0';
            if (arrow) arrow.textContent = '▼';
        }
    }

    /**
     * Quick complete a step (checkbox click or button)
     */
    function quickCompleteStep(batchId, stepId) {
        const batch = MediaBatchManager.getBatch(batchId);
        if (!batch) return;

        const step = batch.prepSteps.find(s => s.id === stepId);
        if (!step || step.completed) return;

        // Collect any measurements for this step
        let notes = '';

        if (stepId === 'ph_adjust') {
            const phInput = document.getElementById(`input_ph_${batchId}`);
            if (phInput && phInput.value) {
                const phValue = parseFloat(phInput.value);
                batch.actualMeasurements = batch.actualMeasurements || {};
                batch.actualMeasurements.phMeasured = phValue;
                MediaBatchManager.updateBatch(batchId, { actualMeasurements: batch.actualMeasurements });
                notes = `pH: ${phValue}`;
            }
        }

        // Show immediate visual feedback BEFORE saving
        const stepElement = document.getElementById(`prepStep_${stepId}`);
        const checkboxEl = stepElement?.querySelector('.step-checkbox');
        const detailsEl = document.getElementById(`details_${stepId}`);

        if (stepElement) {
            // Immediately update the visual appearance
            stepElement.style.border = '2px solid #4caf50';
            stepElement.style.background = '#f1f8e9';
            stepElement.style.opacity = '0.9';
            stepElement.classList.add('completed');
            stepElement.classList.remove('current');

            // Update header background
            const header = stepElement.querySelector('.step-header');
            if (header) {
                header.style.background = '#c8e6c9';
            }

            // Update checkbox to show checkmark
            if (checkboxEl) {
                checkboxEl.style.border = '2px solid #4caf50';
                checkboxEl.style.background = '#4caf50';
                checkboxEl.innerHTML = '<span style="color: white; font-size: 16px;">✓</span>';
            }

            // Collapse details and show completion message
            if (detailsEl) {
                detailsEl.innerHTML = `
                    <div style="padding: 15px; text-align: center; color: #2e7d32;">
                        <span style="font-size: 1.5em;">✅</span>
                        <div style="font-weight: 600; margin-top: 5px;">Step Complete!</div>
                        <div style="font-size: 0.85em; color: #666;">${new Date().toLocaleTimeString()}</div>
                    </div>
                `;
                detailsEl.style.maxHeight = '100px';
                detailsEl.style.padding = '0';
                detailsEl.style.borderTop = '1px solid #c8e6c9';
            }

            // Update arrow
            const arrow = document.getElementById(`arrow_${stepId}`);
            if (arrow) arrow.textContent = '▶';
        }

        // Update progress bar immediately
        const completedCount = batch.prepSteps.filter(s => s.completed).length + 1;
        const totalSteps = batch.prepSteps.length;
        const progressPercent = (completedCount / totalSteps) * 100;
        const progressBar = document.getElementById('prepProgressBar');
        if (progressBar) {
            progressBar.style.width = `${progressPercent}%`;
        }

        try {
            MediaBatchManager.completeStep(batchId, stepId, notes);

            // Refresh the wizard view after a brief delay to show completion
            const updatedBatch = MediaBatchManager.getBatch(batchId);

            // Check if all steps are complete
            const allComplete = updatedBatch.prepSteps.every(s => s.completed);

            if (allComplete) {
                // All steps done - show celebration and close after delay
                setTimeout(() => {
                    closeModal();
                    UIUtils.showNotification('🎉 All steps complete! Batch is ready for use.', 'success');
                    refreshBatchStats();
                    refreshBatchList();
                }, 800);
            } else {
                // Find and expand the next step after a brief delay
                setTimeout(() => {
                    const nextStep = updatedBatch.prepSteps.find(s => !s.completed);
                    if (nextStep) {
                        // Collapse the completed step
                        if (detailsEl) {
                            detailsEl.style.maxHeight = '0';
                            detailsEl.style.padding = '0 15px';
                        }

                        // Expand and highlight the next step
                        const nextStepEl = document.getElementById(`prepStep_${nextStep.id}`);
                        const nextDetailsEl = document.getElementById(`details_${nextStep.id}`);
                        const nextArrow = document.getElementById(`arrow_${nextStep.id}`);

                        if (nextStepEl) {
                            nextStepEl.style.border = '2px solid #1976d2';
                            nextStepEl.style.boxShadow = '0 2px 8px rgba(25, 118, 210, 0.3)';
                            nextStepEl.classList.add('current');

                            const nextHeader = nextStepEl.querySelector('.step-header');
                            if (nextHeader) {
                                nextHeader.style.background = '#e3f2fd';
                            }
                        }

                        if (nextDetailsEl) {
                            nextDetailsEl.style.maxHeight = '500px';
                            nextDetailsEl.style.padding = '15px';
                            nextDetailsEl.style.borderTop = '1px solid #e0e0e0';
                        }

                        if (nextArrow) {
                            nextArrow.textContent = '▼';
                        }

                        // Scroll the next step into view
                        nextStepEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Update the footer text
                        const footerText = document.querySelector('.prep-wizard > div:last-child > div:first-child');
                        if (footerText) {
                            footerText.textContent = `Next: ${nextStep.name}`;
                        }

                        // Update progress text in header
                        const headerProgress = document.querySelector('.prep-wizard-header');
                        if (headerProgress) {
                            const progressText = headerProgress.querySelector('span');
                            if (progressText) {
                                progressText.textContent = `${completedCount} of ${totalSteps} steps complete`;
                            }
                        }
                    }
                }, 600);
            }

        } catch (error) {
            console.error('Failed to complete step:', error);
            UIUtils.showNotification('Failed to complete step: ' + error.message, 'error');

            // Revert visual changes on error
            if (stepElement) {
                stepElement.style.border = '2px solid #1976d2';
                stepElement.style.background = 'white';
                stepElement.style.opacity = '1';
            }
        }
    }

    /**
     * Complete the current preparation step
     */
    function completeCurrentStep(batchId, stepId) {
        const notes = document.getElementById('stepNotes')?.value?.trim() || '';

        // Collect any additional measurements
        const batch = MediaBatchManager.getBatch(batchId);
        const updates = {};

        if (stepId === 'ph_adjust') {
            const phValue = parseFloat(document.getElementById('stepPhValue')?.value);
            if (phValue) {
                batch.actualMeasurements.phMeasured = phValue;
                updates.actualMeasurements = batch.actualMeasurements;
            }
        }

        if (stepId === 'autoclave') {
            const temp = parseFloat(document.getElementById('stepAutoclaveTemp')?.value);
            const time = parseInt(document.getElementById('stepAutoclaveTime')?.value);
            if (temp) batch.actualMeasurements.autoclaveTemp = temp;
            if (time) batch.actualMeasurements.autoclaveTime = time;
            updates.actualMeasurements = batch.actualMeasurements;
        }

        if (stepId === 'cool') {
            const coolTemp = parseFloat(document.getElementById('stepCoolTemp')?.value);
            if (coolTemp) batch.actualMeasurements.coolTemp = coolTemp;
            updates.actualMeasurements = batch.actualMeasurements;
        }

        try {
            // Update measurements first if any
            if (Object.keys(updates).length > 0) {
                MediaBatchManager.updateBatch(batchId, updates);
            }

            // Complete the step
            const updatedBatch = MediaBatchManager.completeStep(batchId, stepId, notes);

            closeModal();

            // Check if there are more steps
            const nextStep = updatedBatch.prepSteps.find(s => !s.completed);
            if (nextStep) {
                continuePrepFlow(batchId);
            } else {
                UIUtils.showNotification('🎉 All preparation steps complete! Batch is ready for use.', 'success');
                refreshBatchStats();
                refreshBatchList();
            }

        } catch (error) {
            console.error('Failed to complete step:', error);
            UIUtils.showNotification('Failed to complete step: ' + error.message, 'error');
        }
    }

    /**
     * Discard a batch
     */
    function discardBatch(batchId) {
        const reason = prompt('Reason for discarding this batch:');
        if (reason === null) return; // Cancelled

        try {
            MediaBatchManager.discardBatch(batchId, reason);
            closeModal();
            refreshBatchStats();
            refreshBatchList();
            UIUtils.showNotification('Batch discarded', 'success');
        } catch (error) {
            UIUtils.showNotification('Failed to discard batch: ' + error.message, 'error');
        }
    }

    /**
     * Delete a batch record
     */
    function deleteBatch(batchId) {
        if (!confirm('Are you sure you want to permanently delete this batch record?')) {
            return;
        }

        try {
            MediaBatchManager.deleteBatch(batchId);
            closeModal();
            refreshBatchStats();
            refreshBatchList();
        } catch (error) {
            UIUtils.showNotification('Failed to delete batch: ' + error.message, 'error');
        }
    }

    /**
     * Get available batches for container initiator
     */
    function getAvailableBatchesForMedia(mediaType) {
        if (!window.MediaBatchManager) return [];
        return MediaBatchManager.getAvailableBatches(mediaType);
    }

    // Public API
    return {
        initialize,
        refreshBatchStats,
        refreshBatchList,
        showNewBatchModal,
        closeModal,
        createNewBatch,
        viewBatchDetails,
        continuePrepFlow,
        completeCurrentStep,
        toggleStep,
        quickCompleteStep,
        discardBatch,
        deleteBatch,
        getAvailableBatchesForMedia
    };
})();
