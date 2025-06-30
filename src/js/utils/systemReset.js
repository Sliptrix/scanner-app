/**
 * System Reset Utilities
 * Provides functions to clear localStorage and reset the application state
 */

window.SystemReset = {
    
    /**
     * Clear all localStorage data and reset the system
     */
    clearAllData() {
        console.log('🧹 Clearing all system data...');
        
        // List of localStorage keys used by the application
        const appKeys = [
            'labInventoryData',
            'labInventory',
            'labRecipes',
            'labRecipesBackup',
            'labTransferHistory',
            'labContainerLineage',
            'labExcelData',
            'labAppState'
        ];
        
        // Clear specific app keys
        appKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`Cleared: ${key}`);
        });
        
        // Reset application state
        this.resetAppState();
        
        // Reset UI elements
        this.resetUIElements();
        
        // Show confirmation
        if (window.UIUtils && window.UIUtils.showNotification) {
            window.UIUtils.showNotification('✅ System data cleared successfully', 'success');
        } else {
            alert('✅ System data cleared successfully');
        }
        
        console.log('🎉 System reset complete');
    },
    
    /**
     * Reset the application state to initial values
     */
    resetAppState() {
        if (window.appState) {
            window.appState.inventory = [];
            window.appState.sessionCounter = 0;
            window.appState.highestContainerId = 0;
            window.appState.transferHistory = [];
            window.appState.containerLineage = {};
            
            // Reset builder state
            if (window.StateManager) {
                window.StateManager.resetBuilderState();
                window.StateManager.resetTransferState();
            }
        }
    },
    
    /**
     * Reset UI elements to initial state
     */
    resetUIElements() {
        // Reset stats display
        const statsElements = {
            'totalProcessed': '0',
            'uniqueStrains': '0', 
            'sessionCount': '0',
            'currentMode': 'Builder'
        };
        
        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
        
        // Clear inventory table
        const inventoryTableBody = document.getElementById('inventoryTableBody');
        if (inventoryTableBody) {
            inventoryTableBody.innerHTML = '';
        }
        
        // Reset feedback areas
        const feedbackElements = ['builderFeedback', 'transferFeedback'];
        feedbackElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'System reset - ready for new operations';
                element.style.color = '#28a745';
            }
        });
        
        // Reset input fields
        const inputElements = ['builderInput', 'sourceContainerInput'];
        inputElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });
    },
    
    /**
     * Clear only inventory data (keeps recipes and other settings)
     */
    clearInventoryOnly() {
        console.log('🧹 Clearing inventory data only...');
        
        const inventoryKeys = [
            'labInventoryData',
            'labInventory',
            'labTransferHistory',
            'labContainerLineage'
        ];
        
        inventoryKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`Cleared: ${key}`);
        });
        
        // Reset only inventory-related state
        if (window.appState) {
            window.appState.inventory = [];
            window.appState.sessionCounter = 0;
            window.appState.highestContainerId = 0;
            window.appState.transferHistory = [];
            window.appState.containerLineage = {};
        }
        
        this.resetUIElements();
        
        if (window.UIUtils && window.UIUtils.showNotification) {
            window.UIUtils.showNotification('✅ Inventory cleared successfully', 'success');
        } else {
            alert('✅ Inventory cleared successfully');
        }
    },
    
    /**
     * Show confirmation dialog before clearing data
     */
    confirmClearAllData() {
        const confirmed = confirm(
            '⚠️ WARNING: This will permanently delete all stored data including:\n\n' +
            '• All container inventory\n' +
            '• Transfer history\n' +
            '• Recipe data\n' +
            '• Excel data\n' +
            '• Application settings\n\n' +
            'Are you sure you want to continue?'
        );
        
        if (confirmed) {
            this.clearAllData();
        }
    },
    
    /**
     * Show confirmation dialog before clearing inventory only
     */
    confirmClearInventory() {
        const confirmed = confirm(
            '⚠️ This will delete all inventory data including:\n\n' +
            '• All containers\n' +
            '• Transfer history\n' +
            '• Container lineage\n\n' +
            'Recipes and Excel data will be preserved.\n\n' +
            'Are you sure you want to continue?'
        );
        
        if (confirmed) {
            this.clearInventoryOnly();
        }
    },
    
    /**
     * Diagnostic function to show what's stored
     */
    showStoredData() {
        console.log('📊 Current localStorage contents:');
        
        const appKeys = [
            'labInventoryData',
            'labInventory', 
            'labRecipes',
            'labRecipesBackup',
            'labTransferHistory',
            'labContainerLineage'
        ];
        
        appKeys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`${key}:`, parsed);
                } catch (e) {
                    console.log(`${key}:`, data);
                }
            } else {
                console.log(`${key}: (not set)`);
            }
        });
        
        // Show current app state
        if (window.appState) {
            console.log('Current appState:', window.appState);
        }
    }
};

// Add keyboard shortcut for system reset (Ctrl+Shift+R)
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        window.SystemReset.confirmClearAllData();
    }
});

console.log('SystemReset utilities loaded. Use SystemReset.clearAllData() to reset everything.');
