/**
 * LONE WOLF BIOTECH - DATA LAYER INTEGRATION BRIDGE
 * Connects EnhancedDataLayer with existing OneDrive sync and UI components
 * 
 * This module bridges the gap between:
 * - EnhancedDataLayer (Gemini's backend structure)
 * - Existing OneDriveSync module
 * - Existing UI components (Inventory table, Transfer, etc.)
 */

const DataLayerBridge = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        // AUTO-SYNC DISABLED: we no longer push to cloud on a timer to avoid
        // accidentally overwriting the primary SharePoint workbook.
        autoSync: false,
        syncInterval: 30000, // 30 seconds (unused while autoSync is false)
        oneDriveFolder: 'LoneWolf_Inventory',
        // Logical export name only; actual cloud upload is currently disabled.
        fileName: 'LoneWolf_Inventory_Export.xlsx'
    };

    let syncTimer = null;
    let isInitialized = false;

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize the data layer bridge
     */
    async function initialize() {
        if (isInitialized) {
            console.log('DataLayerBridge already initialized');
            return;
        }

        console.log('Initializing DataLayerBridge...');

        // Listen for file uploads
        setupFileUploadListener();

        // Listen for inventory updates
        setupInventoryListeners();

        // Sync with existing AppState if available
        if (typeof AppState !== 'undefined') {
            EnhancedDataLayer.syncWithAppState();
        }

        // Start auto-sync if enabled
        if (CONFIG.autoSync && typeof OneDriveSync !== 'undefined') {
            startAutoSync();
        }

        isInitialized = true;
        console.log('DataLayerBridge initialized successfully');
    }

    // =========================================================================
    // FILE UPLOAD HANDLING
    // =========================================================================

    /**
     * Setup listener for Excel file uploads
     */
    function setupFileUploadListener() {
        const fileInput = document.getElementById('fileInput');
        
        if (fileInput) {
            // Remove existing listeners to avoid duplicates
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);

            newFileInput.addEventListener('change', async function(e) {
                const file = e.target.files[0];
                if (file) {
                    await handleFileUpload(file);
                }
            });
        }

        // Also support drag and drop on upload area
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('drop', async function(e) {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                    await handleFileUpload(file);
                }
            });

            uploadArea.addEventListener('dragover', function(e) {
                e.preventDefault();
            });
        }
    }

    /**
     * Handle Excel file upload and parse with EnhancedDataLayer
     */
    async function handleFileUpload(file) {
        try {
            showNotification('Loading Excel file...', 'info');

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            // Load data into EnhancedDataLayer
            const loadedData = EnhancedDataLayer.loadFromWorkbook(workbook);

            // Update existing AppState for backward compatibility
            if (typeof AppState !== 'undefined') {
                // Map to existing format
                AppState.excelData = {
                    owners: loadedData.owners.map(o => ({
                        code: o.owner_code,
                        name: o.name,
                        email: o.email,
                        company: o.company
                    })),
                    strains: loadedData.strains.map(s => ({
                        id: s.strain_id,
                        name: s.name,
                        ownerCode: s.owner_code
                    })),
                    stages: loadedData.stages.map(s => ({
                        id: s.stage_id,
                        name: s.name
                    })),
                    locations: loadedData.locations,
                    media: loadedData.media_batches
                };

                AppState.dataLoaded = true;
            }

            // Update UI
            updateDataStatus(true, loadedData);
            updateInventoryTable(loadedData.inventory);
            updateStats(EnhancedDataLayer.getStats());

            showNotification(`Loaded ${loadedData.inventory.length} inventory items`, 'success');

        } catch (error) {
            console.error('Error loading file:', error);
            showNotification('Error loading file: ' + error.message, 'error');
        }
    }

    // =========================================================================
    // INVENTORY LISTENERS
    // =========================================================================

    /**
     * Setup listeners for inventory changes
     */
    function setupInventoryListeners() {
        // Listen for EnhancedDataLayer events
        window.addEventListener('inventoryUpdated', function(e) {
            if (!e.detail) return;
            const { item, action } = e.detail;
            
            // Push to AppState for backward compatibility
            EnhancedDataLayer.pushToAppState();
            
            // Update UI
            if (action === 'add' || action === 'update') {
                updateInventoryRow(item);
            } else if (action === 'delete') {
                removeInventoryRow(item.asset_id);
            }
            
            // Update stats
            updateStats(EnhancedDataLayer.getStats());
        });

        window.addEventListener('enhancedDataLoaded', function(e) {
            if (!e.detail) return;
            const data = e.detail;
            updateInventoryTable(data.inventory);
            updateStats(EnhancedDataLayer.getStats());
        });
    }

    // =========================================================================
    // UI UPDATE FUNCTIONS
    // =========================================================================

    /**
     * Update data status indicator
     */
    function updateDataStatus(loaded, data) {
        const statusEl = document.getElementById('dataStatus');
        if (statusEl) {
            if (loaded) {
                statusEl.innerHTML = `
                    <span>✅ Data loaded: ${data.inventory.length} items, ${data.owners.length} owners, ${data.strains.length} strains</span>
                    <button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">Reload</button>
                    <button class="btn btn-info" onclick="DataLayerBridge.exportData()">📤 Export</button>
                `;
            } else {
                statusEl.innerHTML = `
                    <span>❌ Excel data not loaded</span>
                    <button class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">Load Excel File</button>
                `;
            }
        }
    }

    /**
     * Update inventory table with enhanced data
     */
    function updateInventoryTable(inventoryData) {
        const tableBody = document.getElementById('inventoryTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        inventoryData.forEach(item => {
            const row = createInventoryRow(item);
            tableBody.appendChild(row);
        });
    }

    /**
     * Create table row for inventory item
     */
    function createInventoryRow(item) {
        const row = document.createElement('tr');
        row.dataset.assetId = item.asset_id;
        
        const statusClass = item.status === 'Active' ? 'status-active' : 
                           item.status === 'Transferred' ? 'status-transferred' : 'status-inactive';
        
        row.innerHTML = `
            <td><code>${item.asset_id || '-'}</code></td>
            <td>${item.lineage || '-'}</td>
            <td><code>${item.asset_id || '-'}</code></td>
            <td>${item.strain_name || '-'}</td>
            <td>${item.owner_code || '-'}</td>
            <td>${item.stage_name || '-'}</td>
            <td>${item.media_batch_id || '-'}</td>
            <td>${item.sample_count || 1}</td>
            <td>${item.date_created || '-'}</td>
            <td><span class="status-badge ${statusClass}">${item.status || 'Active'}</span></td>
        `;

        // Add click handler for editing
        row.addEventListener('dblclick', () => editInventoryItem(item.asset_id));
        
        return row;
    }

    /**
     * Update single inventory row
     */
    function updateInventoryRow(item) {
        const tableBody = document.getElementById('inventoryTableBody');
        if (!tableBody) return;

        const existingRow = tableBody.querySelector(`tr[data-asset-id="${item.asset_id}"]`);
        const newRow = createInventoryRow(item);

        if (existingRow) {
            existingRow.replaceWith(newRow);
        } else {
            tableBody.insertBefore(newRow, tableBody.firstChild);
        }
    }

    /**
     * Remove inventory row
     */
    function removeInventoryRow(assetId) {
        const tableBody = document.getElementById('inventoryTableBody');
        if (!tableBody) return;

        const row = tableBody.querySelector(`tr[data-asset-id="${assetId}"]`);
        if (row) {
            row.remove();
        }
    }

    /**
     * Update statistics display
     */
    function updateStats(stats) {
        const elements = {
            'totalProcessed': stats.totalItems,
            'uniqueStrains': stats.uniqueStrains,
            'sessionCount': stats.activeItems,
            'currentMode': document.getElementById('currentMode')?.textContent || 'Builder'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && typeof value !== 'object') {
                el.textContent = value;
            }
        });
    }

    // =========================================================================
    // INVENTORY OPERATIONS
    // =========================================================================

    /**
     * Add new inventory item from existing app flow
     * Bridges the gap between old format and new format
     */
    function addInventoryItem(oldFormatItem) {
        return EnhancedDataLayer.saveItem({
            asset_id: oldFormatItem.containerId || oldFormatItem.container,
            strain_name: oldFormatItem.strain,
            stage_name: oldFormatItem.stage,
            location: oldFormatItem.location,
            owner_code: oldFormatItem.owner,
            media_batch_id: oldFormatItem.media,
            date_created: oldFormatItem.date,
            sample_count: oldFormatItem.count || oldFormatItem.tissueCount,
            status: oldFormatItem.status || 'Active',
            lineage: oldFormatItem.lineage,
            notes: oldFormatItem.notes
        });
    }

    /**
     * Edit inventory item
     */
    function editInventoryItem(assetId) {
        const data = EnhancedDataLayer.getData();
        const item = data.inventory.find(i => i.asset_id === assetId);
        
        if (!item) {
            showNotification('Item not found', 'error');
            return;
        }

        // Create edit modal or use existing edit functionality
        const modal = createEditModal(item);
        document.body.appendChild(modal);
    }

    /**
     * Create edit modal for inventory item
     */
    function createEditModal(item) {
        const modal = document.createElement('div');
        modal.className = 'edit-modal-overlay';
        modal.innerHTML = `
            <div class="edit-modal">
                <h3>Edit Inventory Item</h3>
                <form id="editItemForm">
                    <div class="form-group">
                        <label>Asset ID</label>
                        <input type="text" name="asset_id" value="${item.asset_id}" readonly>
                    </div>
                    <div class="form-group">
                        <label>Strain Name</label>
                        <input type="text" name="strain_name" value="${item.strain_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Stage</label>
                        <input type="text" name="stage_name" value="${item.stage_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Owner Code</label>
                        <input type="text" name="owner_code" value="${item.owner_code || ''}">
                    </div>
                    <div class="form-group">
                        <label>Sample Count</label>
                        <input type="number" name="sample_count" value="${item.sample_count || 1}">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="Active" ${item.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Transferred" ${item.status === 'Transferred' ? 'selected' : ''}>Transferred</option>
                            <option value="Archived" ${item.status === 'Archived' ? 'selected' : ''}>Archived</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea name="notes">${item.notes || ''}</textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn btn-primary">Save</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.edit-modal-overlay').remove()">Cancel</button>
                        <button type="button" class="btn btn-danger" onclick="DataLayerBridge.deleteItem('${item.asset_id}')">Delete</button>
                    </div>
                </form>
            </div>
        `;

        // Handle form submission
        modal.querySelector('#editItemForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const updatedItem = Object.fromEntries(formData.entries());
            
            EnhancedDataLayer.saveItem(updatedItem);
            modal.remove();
            showNotification('Item updated successfully', 'success');
        });

        return modal;
    }

    /**
     * Delete inventory item with confirmation
     */
    function deleteItem(assetId) {
        if (confirm(`Are you sure you want to delete item ${assetId}?`)) {
            const result = EnhancedDataLayer.deleteItem(assetId);
            if (result.success) {
                showNotification('Item deleted successfully', 'success');
                document.querySelector('.edit-modal-overlay')?.remove();
            } else {
                showNotification('Error deleting item: ' + result.error, 'error');
            }
        }
    }

    // =========================================================================
    // ONEDRIVE SYNC INTEGRATION
    // =========================================================================

    /**
     * "Sync" inventory out of the app WITHOUT touching the primary SharePoint workbook.
     *
     * For safety, this now only exports a local Excel file using EnhancedDataLayer.
     * Cloud overwrite via OneDriveSync.uploadFile is intentionally disabled.
     */
    async function syncToCloud() {
        try {
            showNotification('Exporting inventory snapshot (local file)...', 'info');

            // Export current data to a local Excel file only
            const today = new Date().toISOString().split('T')[0];
            const filename = `LoneWolf_Inventory_Export_${today}.xlsx`;
            EnhancedDataLayer.downloadAsExcel(filename);

            updateSyncStatus('Last local export: ' + new Date().toLocaleTimeString());
            showNotification(`Exported inventory to local Excel file: ${filename}`, 'success');

        } catch (error) {
            console.error('Local export error:', error);
            showNotification('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Load data from OneDrive
     */
    async function syncFromCloud() {
        if (typeof OneDriveSync === 'undefined') {
            showNotification('OneDrive sync not available', 'warning');
            return;
        }

        try {
            showNotification('Loading from cloud...', 'info');

            // Download file from OneDrive
            const fileData = await OneDriveSync.downloadFile(CONFIG.fileName);
            
            if (fileData) {
                const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
                EnhancedDataLayer.loadFromWorkbook(workbook);

                updateSyncStatus('Last synced: ' + new Date().toLocaleTimeString());
                showNotification('Loaded from cloud successfully', 'success');
            } else {
                showNotification('No cloud data found', 'warning');
            }

        } catch (error) {
            console.error('Cloud load error:', error);
            showNotification('Cloud load failed: ' + error.message, 'error');
        }
    }

    /**
     * Start automatic sync timer
     */
    function startAutoSync() {
        if (syncTimer) {
            clearInterval(syncTimer);
        }

        syncTimer = setInterval(async () => {
            if (typeof OneDriveSync !== 'undefined' && OneDriveSync.isAuthenticated()) {
                await syncToCloud();
            }
        }, CONFIG.syncInterval);
    }

    /**
     * Stop automatic sync
     */
    function stopAutoSync() {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
    }

    /**
     * Update sync status display
     */
    function updateSyncStatus(message) {
        const statusEl = document.getElementById('cloud-sync-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    // =========================================================================
    // EXPORT FUNCTIONS
    // =========================================================================

    /**
     * Export data to Excel file
     */
    function exportData() {
        EnhancedDataLayer.downloadAsExcel(
            `LoneWolf_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`
        );
        showNotification('Data exported successfully', 'success');
    }

    /**
     * Export data to JSON
     */
    function exportJSON() {
        const data = EnhancedDataLayer.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `LoneWolf_Inventory_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('JSON exported successfully', 'success');
    }

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /**
     * Show notification (uses existing notification system if available)
     */
    function showNotification(message, type = 'info') {
        if (typeof Notifications !== 'undefined' && Notifications.show) {
            Notifications.show(message, type);
        } else {
            // Fallback notification
            const notification = document.getElementById('notification');
            if (notification) {
                notification.textContent = message;
                notification.className = `notification ${type}`;
                notification.style.display = 'block';
                
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 3000);
            } else {
                console.log(`[${type}] ${message}`);
            }
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Initialization
        initialize,
        
        // File handling
        handleFileUpload,
        
        // Inventory operations
        addInventoryItem,
        editInventoryItem,
        deleteItem,
        
        // Cloud sync
        syncToCloud,
        syncFromCloud,
        startAutoSync,
        stopAutoSync,
        
        // Export
        exportData,
        exportJSON,
        
        // UI updates
        updateInventoryTable,
        updateStats,
        
        // Configuration
        CONFIG
    };

})();

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DataLayerBridge.initialize());
    } else {
        DataLayerBridge.initialize();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLayerBridge;
}
