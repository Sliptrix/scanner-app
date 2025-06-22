// Inventory Main Module - Phase 6: Inventory Management
// Main coordinator for all inventory management functionality

window.InventoryManager = (function() {
    'use strict';

    // Configuration
    const config = {
        autoSaveInterval: 30000, // 30 seconds
        maxInventorySize: 10000,
        backupThreshold: 100 // Create backup every 100 entries
    };

    // State
    let autoSaveTimer = null;
    let lastBackupCount = 0;

    // Initialize the inventory management system
    function initialize() {
        console.log('InventoryManager initializing...');
        
        // Initialize sub-modules
        if (window.InventoryTableManager) {
            InventoryTableManager.initialize();
        }
        
        if (window.DataExportManager) {
            DataExportManager.initialize();
        }
        
        // Setup auto-save functionality
        setupAutoSave();
        
        // Setup data validation
        setupDataValidation();
        
        // Setup UI enhancements
        setupUIEnhancements();
        
        // Initialize from existing data
        initializeFromExistingData();
        
        console.log('InventoryManager initialized');
    }

    // Setup auto-save functionality
    function setupAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
        
        autoSaveTimer = setInterval(() => {
            saveToLocalStorage();
            checkBackupThreshold();
        }, config.autoSaveInterval);
        
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            saveToLocalStorage();
        });
    }

    // Setup data validation
    function setupDataValidation() {
        // Monitor inventory changes
        const originalSetState = StateManager.setState;
        StateManager.setState = function(path, value) {
            // Call original method
            originalSetState.call(this, path, value);
            
            // If inventory was updated, validate and process
            if (path === 'inventory') {
                validateInventoryData(value);
                updateStats();
                
                if (window.InventoryTableManager) {
                    InventoryTableManager.rebuildTable();
                }
            }
        };
    }

    // Setup UI enhancements
    function setupUIEnhancements() {
        // Add inventory management controls
        addInventoryControls();
        
        // Enhance clear inventory button
        enhanceClearInventoryButton();
        
        // Add statistics dashboard
        enhanceStatsDashboard();
    }

    // Add inventory management controls
    function addInventoryControls() {
        const inventorySection = document.querySelector('.inventory-section');
        if (!inventorySection) return;

        const headerDiv = inventorySection.querySelector('div');
        if (!headerDiv) return;

        // Add advanced controls
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'inventoryControls';
        controlsContainer.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 8px;
            border: 1px solid #dee2e6;
        `;
        
        controlsContainer.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: space-between;">
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <button onclick="InventoryManager.validateAllData()" 
                            style="background: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                        🔍 Validate Data
                    </button>
                    <button onclick="InventoryManager.optimizeStorage()" 
                            style="background: #6f42c1; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                        ⚡ Optimize
                    </button>
                    <button onclick="DataExportManager.quickExport()" 
                            style="background: #fd7e14; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                        ⚡ Quick Export
                    </button>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span id="autoSaveStatus" style="font-size: 0.85rem; color: #6c757d;">
                        💾 Auto-save: Active
                    </span>
                    <span id="inventoryHealth" style="font-size: 0.85rem; padding: 2px 8px; border-radius: 12px; background: #d4edda; color: #155724;">
                        ✅ Healthy
                    </span>
                </div>
            </div>
        `;

        headerDiv.parentNode.insertBefore(controlsContainer, headerDiv.nextSibling);
    }

    // Enhance clear inventory button
    function enhanceClearInventoryButton() {
        const clearBtn = document.querySelector('button[onclick="clearInventory()"]');
        if (clearBtn) {
            clearBtn.onclick = () => showClearInventoryDialog();
            clearBtn.innerHTML = '🗑️ Clear Inventory';
        }
    }

    // Enhance stats dashboard
    function enhanceStatsDashboard() {
        // Add detailed stats tooltip on hover
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            card.addEventListener('mouseenter', () => showDetailedStats(card, index));
            card.addEventListener('mouseleave', () => hideDetailedStats());
        });
    }

    // Initialize from existing data
    function initializeFromExistingData() {
        loadFromLocalStorage();
        updateStats();
        validateAllData();
    }

    // Save inventory to local storage
    function saveToLocalStorage() {
        try {
            const state = {
                inventory: StateManager.getState('inventory') || [],
                transferHistory: StateManager.getState('transferHistory') || [],
                containerLineage: StateManager.getState('containerLineage') || {},
                highestContainerId: StateManager.getState('highestContainerId') || 0,
                lastSaved: new Date().toISOString()
            };
            
            localStorage.setItem('labInventoryData', JSON.stringify(state));
            updateAutoSaveStatus('saved');
            
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            updateAutoSaveStatus('error');
        }
    }

    // Load inventory from local storage
    function loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('labInventoryData');
            if (savedData) {
                const state = JSON.parse(savedData);
                
                StateManager.setState('inventory', state.inventory || []);
                StateManager.setState('transferHistory', state.transferHistory || []);
                StateManager.setState('containerLineage', state.containerLineage || {});
                StateManager.setState('highestContainerId', state.highestContainerId || 0);
                
                console.log('Loaded inventory data from localStorage');
                NotificationSystem.info(`Loaded ${state.inventory.length} inventory entries from previous session`);
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            NotificationSystem.warning('Could not load previous session data');
        }
    }

    // Check if backup threshold reached
    function checkBackupThreshold() {
        const currentCount = (StateManager.getState('inventory') || []).length;
        if (currentCount - lastBackupCount >= config.backupThreshold) {
            createBackup();
            lastBackupCount = currentCount;
        }
    }

    // Create backup
    function createBackup() {
        try {
            const backupData = {
                inventory: StateManager.getState('inventory') || [],
                transferHistory: StateManager.getState('transferHistory') || [],
                containerLineage: StateManager.getState('containerLineage') || {},
                highestContainerId: StateManager.getState('highestContainerId') || 0,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            const backupKey = `labInventoryBackup_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            // Keep only last 5 backups
            cleanupOldBackups();
            
            console.log('Backup created:', backupKey);
        } catch (error) {
            console.error('Backup creation failed:', error);
        }
    }

    // Cleanup old backups
    function cleanupOldBackups() {
        try {
            const backupKeys = Object.keys(localStorage)
                .filter(key => key.startsWith('labInventoryBackup_'))
                .sort()
                .reverse();
            
            // Remove backups beyond the last 5
            backupKeys.slice(5).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.error('Backup cleanup failed:', error);
        }
    }

    // Update auto-save status
    function updateAutoSaveStatus(status) {
        const statusElement = document.getElementById('autoSaveStatus');
        if (!statusElement) return;

        switch (status) {
            case 'saved':
                statusElement.innerHTML = '💾 Auto-save: Saved';
                statusElement.style.color = '#28a745';
                setTimeout(() => {
                    statusElement.innerHTML = '💾 Auto-save: Active';
                    statusElement.style.color = '#6c757d';
                }, 2000);
                break;
            case 'error':
                statusElement.innerHTML = '💾 Auto-save: Error';
                statusElement.style.color = '#dc3545';
                break;
        }
    }

    // Validate inventory data
    function validateInventoryData(inventory) {
        if (!Array.isArray(inventory)) {
            console.warn('Inventory data is not an array');
            return false;
        }

        const issues = [];
        const containerIds = new Set();
        
        inventory.forEach((item, index) => {
            // Check required fields
            if (!item.containerId) {
                issues.push(`Entry ${index}: Missing container ID`);
            } else if (containerIds.has(item.containerId)) {
                // Multiple entries with same container ID is normal for multiple samples
            } else {
                containerIds.add(item.containerId);
            }
            
            if (!item.date) {
                issues.push(`Entry ${index}: Missing date`);
            }
            
            if (!item.barcode) {
                issues.push(`Entry ${index}: Missing barcode`);
            }
        });

        updateInventoryHealth(issues.length === 0);
        
        if (issues.length > 0) {
            console.warn('Inventory validation issues:', issues);
        }
        
        return issues.length === 0;
    }

    // Update inventory health indicator
    function updateInventoryHealth(isHealthy) {
        const healthElement = document.getElementById('inventoryHealth');
        if (!healthElement) return;

        if (isHealthy) {
            healthElement.innerHTML = '✅ Healthy';
            healthElement.style.cssText = 'font-size: 0.85rem; padding: 2px 8px; border-radius: 12px; background: #d4edda; color: #155724;';
        } else {
            healthElement.innerHTML = '⚠️ Issues';
            healthElement.style.cssText = 'font-size: 0.85rem; padding: 2px 8px; border-radius: 12px; background: #fff3cd; color: #856404;';
        }
    }

    // Show clear inventory dialog
    function showClearInventoryDialog() {
        const inventory = StateManager.getState('inventory') || [];
        
        const dialogContent = `
            <div style="max-width: 500px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">
                <h3 style="margin-top: 0; color: #dc3545; text-align: center;">🗑️ Clear Inventory Data</h3>
                
                <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffeaa7;">
                    <strong>⚠️ Warning:</strong> This action will permanently delete all inventory data.
                </div>
                
                <div style="margin: 20px 0;">
                    <h4 style="color: #34495e; margin-bottom: 10px;">📊 Current Data:</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>${inventory.length}</strong> inventory entries</li>
                        <li><strong>${(StateManager.getState('transferHistory') || []).length}</strong> transfer records</li>
                        <li><strong>${Object.keys(StateManager.getState('containerLineage') || {}).length}</strong> lineage relationships</li>
                    </ul>
                </div>

                <div style="margin: 20px 0;">
                    <label style="display: flex; align-items: center; margin-bottom: 10px;">
                        <input type="checkbox" id="clearInventoryConfirm" style="margin-right: 8px;">
                        <span>I understand this action cannot be undone</span>
                    </label>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" id="createBackupBeforeClear" checked style="margin-right: 8px;">
                        <span>Create backup before clearing</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px;">
                    <button onclick="this.closest('[style*=\\"position: fixed\\"]').remove()" 
                            style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="InventoryManager.confirmClearInventory(this)" 
                            style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                        🗑️ Clear All Data
                    </button>
                </div>
            </div>
        `;

        // Create modal overlay
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
            z-index: 1000;
        `;
        modal.innerHTML = dialogContent;
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
    }

    // Confirm clear inventory
    function confirmClearInventory(button) {
        const confirmCheckbox = document.getElementById('clearInventoryConfirm');
        const backupCheckbox = document.getElementById('createBackupBeforeClear');
        
        if (!confirmCheckbox.checked) {
            NotificationSystem.error('Please confirm you understand this action cannot be undone');
            return;
        }

        if (backupCheckbox.checked) {
            createBackup();
        }

        // Clear all data
        StateManager.setState('inventory', []);
        StateManager.setState('transferHistory', []);
        StateManager.setState('containerLineage', {});
        StateManager.setState('highestContainerId', 0);
        StateManager.setState('sessionCounter', 0);

        // Update UI
        updateStats();
        if (window.InventoryTableManager) {
            InventoryTableManager.rebuildTable();
        }

        // Close dialog
        button.closest('[style*="position: fixed"]').remove();
        
        NotificationSystem.success('Inventory data cleared successfully');
    }

    // Validate all data
    function validateAllData() {
        const inventory = StateManager.getState('inventory') || [];
        const isValid = validateInventoryData(inventory);
        
        if (isValid) {
            NotificationSystem.success('All inventory data validated successfully');
        } else {
            NotificationSystem.warning('Inventory validation found some issues - check console for details');
        }
        
        return isValid;
    }

    // Optimize storage
    function optimizeStorage() {
        try {
            // Remove duplicate entries
            const inventory = StateManager.getState('inventory') || [];
            const uniqueInventory = [];
            const seen = new Set();
            
            inventory.forEach(item => {
                const key = `${item.containerId}_${item.barcode}_${item.date}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueInventory.push(item);
                }
            });
            
            const removedCount = inventory.length - uniqueInventory.length;
            
            if (removedCount > 0) {
                StateManager.setState('inventory', uniqueInventory);
                NotificationSystem.success(`Optimization complete: removed ${removedCount} duplicate entries`);
            } else {
                NotificationSystem.info('No optimization needed - data is already clean');
            }
            
            // Update stats and table
            updateStats();
            if (window.InventoryTableManager) {
                InventoryTableManager.rebuildTable();
            }
            
        } catch (error) {
            console.error('Storage optimization failed:', error);
            NotificationSystem.error('Storage optimization failed: ' + error.message);
        }
    }

    // Update statistics
    function updateStats() {
        if (window.UIUtils && typeof window.UIUtils.updateStats === 'function') {
            window.UIUtils.updateStats();
        }
    }

    // Show detailed stats (on hover)
    function showDetailedStats(card, index) {
        // Implementation for detailed stats tooltip
        // This would show additional information on hover
    }

    // Hide detailed stats
    function hideDetailedStats() {
        // Implementation for hiding detailed stats tooltip
    }

    // Add inventory entry
    function addInventoryEntry(entry) {
        const inventory = StateManager.getState('inventory') || [];
        
        // Validate entry
        if (!entry.containerId || !entry.barcode) {
            throw new Error('Invalid inventory entry: missing required fields');
        }
        
        // Add timestamp if not present
        if (!entry.date) {
            entry.date = new Date().toISOString();
        }
        
        // Add to inventory
        inventory.push(entry);
        StateManager.setState('inventory', inventory);
        
        console.log('Added inventory entry:', entry);
        return true;
    }

    // Remove inventory entries by container ID
    function removeInventoryEntries(containerId) {
        const inventory = StateManager.getState('inventory') || [];
        const filteredInventory = inventory.filter(item => item.containerId !== containerId);
        
        const removedCount = inventory.length - filteredInventory.length;
        StateManager.setState('inventory', filteredInventory);
        
        console.log(`Removed ${removedCount} entries for container ${containerId}`);
        return removedCount;
    }

    // Get inventory statistics
    function getInventoryStats() {
        const inventory = StateManager.getState('inventory') || [];
        const transferHistory = StateManager.getState('transferHistory') || [];
        
        return {
            totalEntries: inventory.length,
            uniqueContainers: new Set(inventory.map(item => item.containerId)).size,
            uniqueStrains: new Set(inventory.map(item => item.strain).filter(Boolean)).size,
            uniqueOwners: new Set(inventory.map(item => item.owner).filter(Boolean)).size,
            totalTransfers: transferHistory.length,
            splitTransfers: transferHistory.filter(t => t.type === 'split').length,
            singleTransfers: transferHistory.filter(t => t.type === 'single').length
        };
    }

    // Public API
    return {
        initialize,
        addInventoryEntry,
        removeInventoryEntries,
        validateAllData,
        optimizeStorage,
        confirmClearInventory,
        getInventoryStats,
        saveToLocalStorage,
        loadFromLocalStorage
    };

})();
