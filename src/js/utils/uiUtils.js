// UI Management and DOM Utilities
// Lab Barcode Builder & Transfer System

window.UIUtils = {
    /**
     * Sanitize a string to prevent XSS attacks
     * CRITICAL FIX: Use this before inserting user data into innerHTML
     * @param {string} str - The string to sanitize
     * @returns {string} - Sanitized string safe for innerHTML
     */
    sanitize: function(str) {
        if (str === null || str === undefined) {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    /**
     * Sanitize an object's string values for safe HTML display
     * @param {Object} obj - Object with string values to sanitize
     * @returns {Object} - New object with sanitized values
     */
    sanitizeObject: function(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (typeof value === 'string') {
                    sanitized[key] = this.sanitize(value);
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeObject(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    },

    // Mode switching functionality
    switchMode: function(mode) {
        Logger.debug('Switching mode:', window.appState.mode, '→', mode);
        
        // Clear any cross-contamination before switching
        if (mode === 'builder') {
            Logger.debug('Entering BUILDER mode - Transfer and Initiator functions disabled');
            // Clear any transfer state that might cause conflicts
            StateManager.resetTransferState();
            StateManager.resetInitiatorState();
        } else if (mode === 'transfer') {
            Logger.debug('Entering TRANSFER mode - Builder and Initiator functions disabled');
            // Clear any builder state that might cause conflicts
            if (window.appState.currentContainer) {
                Logger.debug('Clearing builder state before entering transfer mode');
                window.appState.currentContainer = null;
                window.appState.currentSample = null;
                window.appState.currentMetadata = null;
                window.appState.currentBarcodeResult = null;
                window.appState.currentBarcodeIsSaved = false;
            }
            StateManager.resetInitiatorState();
        } else if (mode === 'initiator') {
            Logger.debug('Entering INITIATOR mode - Builder and Transfer functions disabled');
            // Clear any builder or transfer state that might cause conflicts
            if (window.appState.currentContainer) {
                Logger.debug('Clearing builder state before entering initiator mode');
                window.appState.currentContainer = null;
                window.appState.currentSample = null;
                window.appState.currentMetadata = null;
                window.appState.currentBarcodeResult = null;
                window.appState.currentBarcodeIsSaved = false;
            }
            StateManager.resetTransferState();
            StateManager.resetInitiatorState();
        } else if (mode === 'intake') {
            Logger.debug('Entering INTAKE mode - Other functions disabled');
            // Clear any state from other modes
            if (window.appState.currentContainer) {
                window.appState.currentContainer = null;
                window.appState.currentSample = null;
                window.appState.currentMetadata = null;
                window.appState.currentBarcodeResult = null;
                window.appState.currentBarcodeIsSaved = false;
            }
            StateManager.resetTransferState();
            StateManager.resetInitiatorState();
        } else if (mode === 'recipes') {
            Logger.debug('Entering RECIPE MANAGER mode - Recipe creation and management');
            // Initialize recipe manager if needed
            if (window.RecipeManager && window.RecipeManager.initializeStandalone) {
                window.RecipeManager.initializeStandalone();
            }
        } else if (mode === 'dashboard') {
            Logger.debug('Entering DASHBOARD mode - Overview display');
            // Update dashboard metrics
            if (window.DashboardManager) {
                window.DashboardManager.updateDashboard();
            }
        } else if (mode === 'reference') {
            Logger.debug('Entering REFERENCE DATA mode - Data management');
        } else if (mode === 'builder') {
            Logger.debug('Returning to BUILDER mode - Refreshing recipe dropdown');
            // Refresh recipe dropdown when returning from Recipe Manager
            setTimeout(() => {
                if (window.BuilderStepManager && window.BuilderStepManager.refreshRecipeDropdown) {
                    window.BuilderStepManager.refreshRecipeDropdown();
                }
            }, 100);
        }

        window.appState.mode = mode;

        // Update top-level mode buttons - scope to .mode-selector to avoid recipe/internal buttons
        document.querySelectorAll('.mode-selector .mode-btn').forEach(btn => {
            const btnMode = btn.getAttribute('data-mode');
            if (btnMode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Show/hide sections based on mode
        const dashboardSection = document.getElementById('dashboardSection');
        const intakeSection = document.getElementById('intakeSection');
        const builderSection = document.getElementById('builderSection');
        const transferSection = document.getElementById('transferSection');
        const initiatorSection = document.getElementById('initiatorSection');
        const recipeSection = document.getElementById('recipeSection');
        const inventorySection = document.getElementById('inventorySection');
        const referenceSection = document.getElementById('referenceSection');

        if (dashboardSection) {
            dashboardSection.classList.toggle('active', mode === 'dashboard');
        }
        if (intakeSection) {
            intakeSection.classList.toggle('active', mode === 'intake');
        }
        if (builderSection) {
            builderSection.classList.toggle('active', mode === 'builder');
        }
        if (transferSection) {
            transferSection.classList.toggle('active', mode === 'transfer');
        }
        if (initiatorSection) {
            initiatorSection.classList.toggle('active', mode === 'initiator');
        }
        if (recipeSection) {
            recipeSection.classList.toggle('active', mode === 'recipes');
        }
        if (inventorySection) {
            inventorySection.classList.toggle('active', mode === 'inventory');
        }
        if (referenceSection) {
            referenceSection.classList.toggle('active', mode === 'reference');
        }

        // Media Batch Tracking only visible on dashboard and recipes (Media Lab) pages
        const batchSection = document.getElementById('batchSection');
        if (batchSection) {
            batchSection.classList.toggle('active', mode === 'dashboard' || mode === 'recipes');
        }

        // Update sidebar nav items
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
            const btnMode = btn.getAttribute('data-mode');
            if (btnMode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update page title
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            let titleText = 'Dashboard';
            if (mode === 'intake') titleText = 'Lab Intake';
            else if (mode === 'transfer') titleText = 'Container Transfer';
            else if (mode === 'initiator') titleText = 'Initiate Container';
            else if (mode === 'recipes') titleText = 'Media Lab';
            else if (mode === 'inventory') titleText = 'Active Inventory';
            else if (mode === 'reference') titleText = 'Reference Data';
            else if (mode === 'builder') titleText = 'Barcode Builder';
            pageTitle.textContent = titleText;
        }

        // Update current mode display (legacy)
        const currentModeElement = document.getElementById('currentMode');
        if (currentModeElement) {
            let modeText = 'Builder';
            if (mode === 'dashboard') modeText = 'Dashboard';
            else if (mode === 'intake') modeText = 'Intake';
            else if (mode === 'transfer') modeText = 'Transfer';
            else if (mode === 'initiator') modeText = 'Initiator';
            else if (mode === 'recipes') modeText = 'Recipes';
            else if (mode === 'inventory') modeText = 'Inventory';
            else if (mode === 'reference') modeText = 'Reference';
            currentModeElement.textContent = modeText;
        }
        
        Logger.debug(`Mode switched to: ${mode}`);
    },
    
    // Stats grid updates
    updateStats: function() {
        const totalProcessed = document.getElementById('totalProcessed');
        const uniqueStrains = document.getElementById('uniqueStrains');
        const sessionCount = document.getElementById('sessionCount');
        
        if (totalProcessed) {
            totalProcessed.textContent = window.appState.inventory.length;
        }
        
        if (sessionCount) {
            sessionCount.textContent = window.appState.sessionCounter;
        }
        
        if (uniqueStrains) {
            const uniqueStrainSet = new Set(window.appState.inventory.map(entry => entry.strain));
            uniqueStrains.textContent = uniqueStrainSet.size;
        }
    },
    
    // File upload UI management
    updateDataStatus: function(loaded = false, filename = null, fromCache = false) {
        // Update data loading banner
        const banner = document.getElementById('dataLoadingBanner');
        if (banner) {
            banner.style.display = loaded ? 'none' : 'block';
        }

        // Update data stats
        if (loaded) {
            const strainsCount = Object.keys(window.appState.strainsTable || {}).length;
            const ownersCount = Object.keys(window.appState.ownersTable || {}).length;
            const mediaCount = Object.keys(window.appState.mediaTypesTable || {}).length;

            const dataStatsEl = document.getElementById('dataStats');
            const dataStatusText = document.getElementById('dataStatusText');

            if (dataStatusText) {
                const cacheIndicator = fromCache ? '📁' : '✅';
                const sourceText = fromCache ? ' (from cache)' : filename ? ` (${filename})` : '';
                dataStatusText.textContent = `${cacheIndicator} Data loaded${sourceText}`;
                dataStatusText.style.color = '#10b981';
            }

            if (dataStatsEl) {
                dataStatsEl.style.display = 'block';
                const strainsCountEl = document.getElementById('strainsCount');
                const ownersCountEl = document.getElementById('ownersCount');
                const mediaCountEl = document.getElementById('mediaCount');

                if (strainsCountEl) strainsCountEl.textContent = strainsCount;
                if (ownersCountEl) ownersCountEl.textContent = ownersCount;
                if (mediaCountEl) mediaCountEl.textContent = mediaCount;
            }

            // Notify other modules that data is available
            Logger.debug('Reference data loaded:', { strainsCount, ownersCount, mediaCount });
        } else {
            const dataStatusText = document.getElementById('dataStatusText');
            const dataStatsEl = document.getElementById('dataStats');

            if (dataStatusText) {
                dataStatusText.textContent = '❌ Excel data not loaded';
                dataStatusText.style.color = '#ef4444';
            }

            if (dataStatsEl) {
                dataStatsEl.style.display = 'none';
            }
        }
    },
    
    // Focus management
    focusBuilderInput: function() {
        setTimeout(() => {
            const builderInput = document.getElementById('builderInput');
            if (builderInput) {
                builderInput.focus();
            }
        }, 100);
    },
    
    focusTransferInput: function(inputId = 'sourceContainerInput') {
        setTimeout(() => {
            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
            }
        }, 100);
    },
    
    focusInitiatorInput: function() {
        setTimeout(() => {
            const input = document.getElementById('initiatorInput');
            if (input) {
                input.focus();
            }
        }, 100);
    },
    
    // Form utilities
    clearInput: function(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
        }
    },
    
    clearAllInputs: function() {
        const inputs = [
            'builderInput',
            'sourceContainerInput',
            'destContainerInput',
            'initiatorInput'
        ];
        
        inputs.forEach(id => this.clearInput(id));
    },
    
    // Show/hide elements
    showElement: function(elementId, show = true) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    },
    
    toggleElement: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const isVisible = element.style.display !== 'none';
            element.style.display = isVisible ? 'none' : 'block';
        }
    },
    
    // Class management
    addClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add(className);
        }
    },
    
    removeClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove(className);
        }
    },
    
    toggleClass: function(elementId, className) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.toggle(className);
        }
    },
    
    // Content updates
    updateContent: function(elementId, content) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = content;
        }
    },
    
    updateHTML: function(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    },
    
    // Setup focus management for the application
    setupFocusManagement: function() {
        // Remove aggressive focus management that causes cursor jumping
        // Only focus on user-initiated actions, not automatic intervals
        Logger.debug('Focus management setup - using manual focus only');
    },
    
    // Rebuild inventory table (Phase 6 compatibility)
    rebuildInventoryTable: function() {
        if (window.InventoryTableManager && typeof window.InventoryTableManager.rebuildTable === 'function') {
            window.InventoryTableManager.rebuildTable();
        } else {
            // Fallback for basic table rebuild
            Logger.debug('InventoryTableManager not available, using fallback');
        }
    }
};
