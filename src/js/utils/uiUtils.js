// UI Management and DOM Utilities
// Lab Barcode Builder & Transfer System

window.UIUtils = {
    // Mode switching functionality
    switchMode: function(mode) {
        window.appState.mode = mode;
        
        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Find the correct button and activate it
        const modeButtons = document.querySelectorAll('.mode-btn');
        if (mode === 'builder' && modeButtons[0]) {
            modeButtons[0].classList.add('active');
        } else if (mode === 'transfer' && modeButtons[1]) {
            modeButtons[1].classList.add('active');
        }
        
        // Show/hide sections based on mode
        const builderSection = document.getElementById('builderSection');
        const transferSection = document.getElementById('transferSection');
        
        if (builderSection) {
            builderSection.classList.toggle('active', mode === 'builder');
        }
        if (transferSection) {
            transferSection.classList.toggle('active', mode === 'transfer');
        }
        
        // Update current mode display
        const currentModeElement = document.getElementById('currentMode');
        if (currentModeElement) {
            currentModeElement.textContent = mode === 'builder' ? 'Builder' : 'Transfer';
        }
        
        console.log(`Mode switched to: ${mode}`);
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
    updateDataStatus: function(loaded = false, filename = null) {
        const dataStatus = document.getElementById('dataStatus');
        if (!dataStatus) return;
        
        if (loaded) {
            dataStatus.classList.add('loaded');
            dataStatus.innerHTML = `
                <span>✅ Excel data loaded: ${Object.keys(window.appState.strainsTable).length} strains, ${Object.keys(window.appState.ownersTable).length} owners</span>
                ${filename ? `<span style="font-size: 0.8rem;">File: ${filename}</span>` : ''}
            `;
        } else {
            dataStatus.classList.remove('loaded');
            dataStatus.innerHTML = `
                <span>❌ Excel data not loaded</span>
                <button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">Load Excel File</button>
            `;
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
            'destContainerInput'
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
        // Keep input focused based on current mode
        setInterval(() => {
            if (window.appState.mode === 'builder' && document.activeElement.id !== 'builderInput') {
                const builderInput = document.getElementById('builderInput');
                if (builderInput) builderInput.focus();
            } else if (window.appState.mode === 'transfer') {
                const transferState = window.appState.transferState;
                if (!transferState.source && document.activeElement.id !== 'sourceContainerInput') {
                    this.focusTransferInput('sourceContainerInput');
                } else if (transferState.source && !transferState.destination && transferState.mode === 'single' && document.activeElement.id !== 'destContainerInput') {
                    this.focusTransferInput('destContainerInput');
                }
            }
        }, 2000);
    },
    
    // Rebuild inventory table (Phase 6 compatibility)
    rebuildInventoryTable: function() {
        if (window.InventoryTableManager && typeof window.InventoryTableManager.rebuildTable === 'function') {
            window.InventoryTableManager.rebuildTable();
        } else {
            // Fallback for basic table rebuild
            console.log('InventoryTableManager not available, using fallback');
        }
    }
};
