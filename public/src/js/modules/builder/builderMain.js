// Main Barcode Builder Module
// Lab Barcode Builder & Transfer System

window.BarcodeBuilder = {
    // Initialize the builder module
    initialize: function() {
        console.log('Initializing Barcode Builder module...');
        
        // Set up initial step
        BuilderStepManager.updateStep();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        console.log('Barcode Builder module initialized');
    },
    
    // Setup event handlers for builder functionality
    setupEventHandlers: function() {
        // Builder input Enter key handler
        const builderInput = document.getElementById('builderInput');
        if (builderInput) {
            // Remove existing listeners to avoid duplicates
            builderInput.removeEventListener('keypress', this.handleKeyPress);
            builderInput.addEventListener('keypress', this.handleKeyPress.bind(this));
        }
        
        console.log('Builder event handlers setup');
    },
    
    // Handle keypress events in builder input
    handleKeyPress: function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            BuilderStepManager.handleInput();
        }
    },
    
    // Start a new barcode building session
    startNewSession: function() {
        // Reset builder state
        BuilderStepManager.reset();
        
        // Ensure Excel data is loaded
        if (!window.appState.isDataLoaded) {
            NotificationSystem.error('Please load Excel data before building barcodes');
            return false;
        }
        
        NotificationSystem.info('Starting new barcode building session');
        return true;
    },
    
    // Handle next step button click
    nextStep: function() {
        BuilderStepManager.handleNextButton();
    },
    
    // Handle reset button click
    reset: function() {
        BuilderStepManager.reset();
    },
    
    // Handle save barcode button click
    saveBarcode: function() {
        return BuilderBarcodeGenerator.saveToInventory();
    },
    
    // Get current step information
    getCurrentStepInfo: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        const totalSteps = window.appState.builderState.steps.length;
        
        return {
            step: currentStep + 1,
            stepName: stepName,
            totalSteps: totalSteps,
            isLastStep: currentStep === totalSteps - 1,
            values: { ...window.appState.builderState.values },
            metadata: { ...window.appState.builderState.metadata }
        };
    },
    
    // Check if builder is ready to generate barcode
    isReadyToGenerate: function() {
        const values = window.appState.builderState.values;
        const requiredFields = ['container', 'owner', 'strain', 'media', 'recipe', 'stage', 'tissue', 'date'];
        
        return requiredFields.every(field => values[field]);
    },
    
    // Get validation status for current step
    getValidationStatus: function() {
        const currentStep = window.appState.builderState.currentStep;
        const stepName = window.appState.builderState.steps[currentStep];
        const input = document.getElementById('builderInput')?.value?.trim();
        
        if (!input) {
            return { valid: false, message: 'Please enter a value' };
        }
        
        if (!DataUtils.validateInput(stepName, input)) {
            return { valid: false, message: `Invalid format for ${stepName}` };
        }
        
        return { valid: true, message: 'Valid input' };
    },
    
    // Auto-complete functionality based on Excel data
    getAutoCompleteOptions: function(stepName, partial) {
        if (!partial || partial.length < 1) return [];
        
        const maxOptions = 10;
        partial = partial.toLowerCase();
        
        switch(stepName) {
            case 'owner':
                return Object.entries(window.appState.ownersTable)
                    .filter(([id, name]) => 
                        id.toLowerCase().includes(partial) || 
                        name.toLowerCase().includes(partial)
                    )
                    .slice(0, maxOptions)
                    .map(([id, name]) => ({ value: id, display: `${name} (${id})` }));
                    
            case 'strain':
                return Object.entries(window.appState.strainsTable)
                    .filter(([id, name]) => 
                        id.includes(partial) || 
                        name.toLowerCase().includes(partial)
                    )
                    .slice(0, maxOptions)
                    .map(([id, name]) => ({ 
                        value: id.padStart(5, '0'), 
                        display: `${name} (${id.padStart(5, '0')})` 
                    }));
                    
            case 'media':
                return Object.entries(window.appState.mediaTypesTable)
                    .filter(([id, name]) => 
                        id.toLowerCase().includes(partial) || 
                        name.toLowerCase().includes(partial)
                    )
                    .slice(0, maxOptions)
                    .map(([id, name]) => ({ value: id, display: `${name} (${id})` }));
                    
            default:
                return [];
        }
    },
    
    // Export current builder state for debugging
    exportState: function() {
        return {
            currentStep: window.appState.builderState.currentStep,
            steps: window.appState.builderState.steps,
            values: window.appState.builderState.values,
            metadata: window.appState.builderState.metadata,
            isDataLoaded: window.appState.isDataLoaded,
            stepInfo: this.getCurrentStepInfo(),
            readyToGenerate: this.isReadyToGenerate()
        };
    }
};

// Legacy global functions for HTML onclick compatibility
window.nextBuilderStep = function() {
    BarcodeBuilder.nextStep();
};

window.resetBuilder = function() {
    BarcodeBuilder.reset();
};

window.useGeneratedBarcode = function() {
    BarcodeBuilder.saveBarcode();
};
