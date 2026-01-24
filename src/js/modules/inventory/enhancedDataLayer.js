/**
 * LONE WOLF BIOTECH - ENHANCED INVENTORY DATA LAYER
 * Adapted from Google Apps Script backend structure for client-side use
 * Compatible with existing OneDrive sync and SheetJS Excel handling
 * 
 * Data Schema (mapped from Enhanced_Plant_Inventory_System-2.xlsx):
 * - Active_Inventory: Asset_ID, Strain_Name, Stage_Name, Location, Owner_Code, Media_Batch_ID, Date_Created
 * - Ref_Strains: Strain_ID, Name
 * - Ref_Stages: Stage_ID, Name
 * - Ref_Locations: Location_ID, Name
 * - Ref_Owners: Owner_Code, Name
 * - Media_Batch_Log: Batch_ID, Recipe_Name, Date_Created, Created_By
 */

const EnhancedDataLayer = (function() {
    'use strict';

    // =========================================================================
    // DATA STORE - Mirrors Gemini's Google Sheets structure
    // =========================================================================
    const dataStore = {
        inventory: [],
        strains: [],
        stages: [],
        locations: [],
        owners: [],
        media_batches: []
    };

    // Schema definitions for validation and sheet creation
    const SCHEMAS = {
        Active_Inventory: ['Asset_ID', 'Strain_Name', 'Stage_Name', 'Location', 'Owner_Code', 'Media_Batch_ID', 'Date_Created', 'Sample_Count', 'Status', 'Lineage', 'Notes'],
        Ref_Strains: ['Strain_ID', 'Name', 'Owner_Code', 'Genetics_Type', 'Date_Added'],
        Ref_Stages: ['Stage_ID', 'Name', 'Description', 'Order'],
        Ref_Locations: ['Location_ID', 'Name', 'Zone', 'Capacity'],
        Ref_Owners: ['Owner_Code', 'Name', 'Email', 'Company'],
        Media_Batch_Log: ['Batch_ID', 'Recipe_Name', 'Date_Created', 'Created_By', 'Volume', 'pH', 'Notes']
    };

    // =========================================================================
    // UTILITY FUNCTIONS - Adapted from Gemini's helper functions
    // =========================================================================

    /**
     * Normalize headers - converts to lowercase with underscores
     * Mirrors Gemini's header normalization logic
     */
    function normalizeHeader(header) {
        return header.toString().toLowerCase().replace(/ /g, '_').trim();
    }

    /**
     * Format date consistently - handles Date objects and strings
     * Mirrors Gemini's date handling in getData()
     */
    function formatDate(value) {
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        if (typeof value === 'string' && value.includes('T')) {
            return value.split('T')[0];
        }
        return value || new Date().toISOString().split('T')[0];
    }

    /**
     * Generate unique ID with prefix
     */
    function generateId(prefix = 'ID') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}${random}`;
    }

    // =========================================================================
    // DATA RETRIEVAL - Mirrors Gemini's getData() function
    // =========================================================================

    /**
     * Get all data from store - equivalent to Gemini's getData()
     * Returns structured object with all reference tables
     */
    function getData() {
        return {
            inventory: [...dataStore.inventory],
            strains: [...dataStore.strains],
            stages: [...dataStore.stages],
            locations: [...dataStore.locations],
            owners: [...dataStore.owners],
            media_batches: [...dataStore.media_batches]
        };
    }

    /**
     * Parse sheet data from Excel workbook - equivalent to Gemini's getSheetData()
     * @param {Object} workbook - SheetJS workbook object
     * @param {string} sheetName - Name of the sheet to parse
     * @returns {Array} Array of row objects with normalized headers
     */
    function getSheetData(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
            console.warn(`Sheet "${sheetName}" not found in workbook`);
            return [];
        }

        // Convert to JSON with header row
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (rawData.length < 2) {
            console.warn(`Sheet "${sheetName}" has insufficient data`);
            return [];
        }

        // Extract and normalize headers
        const headers = rawData[0].map(h => normalizeHeader(h));
        
        // Map rows to objects
        return rawData.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                let value = row[index];
                
                // Handle dates gracefully (mirrors Gemini's date handling)
                if (value instanceof Date) {
                    obj[header] = formatDate(value);
                } else {
                    obj[header] = value !== undefined ? value : '';
                }
            });
            return obj;
        }).filter(obj => {
            // Filter out empty rows
            return Object.values(obj).some(v => v !== '' && v !== undefined);
        });
    }

    /**
     * Load all data from Excel workbook
     * @param {Object} workbook - SheetJS workbook object
     */
    function loadFromWorkbook(workbook) {
        // Map sheet names to data store keys
        const sheetMappings = {
            'Active_Inventory': 'inventory',
            'Ref_Strains': 'strains',
            'Ref_Stages': 'stages',
            'Ref_Locations': 'locations',
            'Ref_Owners': 'owners',
            'Media_Batch_Log': 'media_batches'
        };

        // Also support alternative sheet names from original app
        const alternativeMappings = {
            'Inventory': 'inventory',
            'Strains': 'strains',
            'Stages': 'stages',
            'Locations': 'locations',
            'Owners': 'owners',
            'Media': 'media_batches',
            'owners': 'owners',
            'strains': 'strains'
        };

        const allMappings = { ...sheetMappings, ...alternativeMappings };

        Object.entries(allMappings).forEach(([sheetName, storeKey]) => {
            const data = getSheetData(workbook, sheetName);
            if (data.length > 0) {
                dataStore[storeKey] = data;
                console.log(`Loaded ${data.length} records from ${sheetName}`);
            }
        });

        // Emit event for UI updates
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('enhancedDataLoaded', { 
                detail: getData() 
            }));
        }

        return getData();
    }

    // =========================================================================
    // DATA SAVING - Mirrors Gemini's saveItem() function
    // =========================================================================

    /**
     * Save or update inventory item - equivalent to Gemini's saveItem()
     * @param {Object} item - Item to save with required fields
     * @returns {Object} Result object with success status
     */
    function saveItem(item) {
        try {
            // Validate required fields
            if (!item.asset_id) {
                // Generate new Asset ID if not provided
                item.asset_id = generateId('LWB');
            }

            // Normalize the item data
            const normalizedItem = {
                asset_id: item.asset_id,
                strain_name: item.strain_name || item.strain || '',
                stage_name: item.stage_name || item.stage || '',
                location: item.location || '',
                owner_code: item.owner_code || item.owner || '',
                media_batch_id: item.media_batch_id || item.media || '',
                date_created: formatDate(item.date_created || item.date || new Date()),
                sample_count: item.sample_count || item.count || 1,
                status: item.status || 'Active',
                lineage: item.lineage || '',
                notes: item.notes || ''
            };

            // Find existing item by Asset ID
            const existingIndex = dataStore.inventory.findIndex(
                inv => inv.asset_id === normalizedItem.asset_id
            );

            if (existingIndex >= 0) {
                // Update existing row
                dataStore.inventory[existingIndex] = normalizedItem;
                console.log(`Updated inventory item: ${normalizedItem.asset_id}`);
            } else {
                // Append new row
                dataStore.inventory.push(normalizedItem);
                console.log(`Added new inventory item: ${normalizedItem.asset_id}`);
            }

            // Emit event for UI updates
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('inventoryUpdated', { 
                    detail: { item: normalizedItem, action: existingIndex >= 0 ? 'update' : 'add' }
                }));
            }

            return { success: true, item: normalizedItem };

        } catch (error) {
            console.error('Error saving item:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save multiple items in batch
     * @param {Array} items - Array of items to save
     * @returns {Object} Result with success count and errors
     */
    function saveItems(items) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        items.forEach((item, index) => {
            const result = saveItem(item);
            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({ index, error: result.error });
            }
        });

        return results;
    }

    /**
     * Delete inventory item by Asset ID
     * @param {string} assetId - Asset ID to delete
     * @returns {Object} Result object
     */
    function deleteItem(assetId) {
        const index = dataStore.inventory.findIndex(inv => inv.asset_id === assetId);
        
        if (index >= 0) {
            const removed = dataStore.inventory.splice(index, 1)[0];
            
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('inventoryUpdated', { 
                    detail: { item: removed, action: 'delete' }
                }));
            }
            
            return { success: true, item: removed };
        }
        
        return { success: false, error: 'Item not found' };
    }

    // =========================================================================
    // REFERENCE DATA MANAGEMENT
    // =========================================================================

    /**
     * Add or update strain reference
     */
    function saveStrain(strain) {
        const normalizedStrain = {
            strain_id: strain.strain_id || generateId('STR'),
            name: strain.name || '',
            owner_code: strain.owner_code || '',
            genetics_type: strain.genetics_type || 'Proprietary',
            date_added: formatDate(strain.date_added || new Date())
        };

        const existingIndex = dataStore.strains.findIndex(
            s => s.strain_id === normalizedStrain.strain_id || 
                 (s.name === normalizedStrain.name && s.owner_code === normalizedStrain.owner_code)
        );

        if (existingIndex >= 0) {
            dataStore.strains[existingIndex] = normalizedStrain;
        } else {
            dataStore.strains.push(normalizedStrain);
        }

        return { success: true, strain: normalizedStrain };
    }

    /**
     * Add or update owner reference
     */
    function saveOwner(owner) {
        const normalizedOwner = {
            owner_code: owner.owner_code || owner.code || generateId('OWN').substring(0, 4),
            name: owner.name || '',
            email: owner.email || '',
            company: owner.company || ''
        };

        const existingIndex = dataStore.owners.findIndex(
            o => o.owner_code === normalizedOwner.owner_code
        );

        if (existingIndex >= 0) {
            dataStore.owners[existingIndex] = normalizedOwner;
        } else {
            dataStore.owners.push(normalizedOwner);
        }

        return { success: true, owner: normalizedOwner };
    }

    /**
     * Add media batch record
     */
    function saveMediaBatch(batch) {
        const normalizedBatch = {
            batch_id: batch.batch_id || generateId('MB'),
            recipe_name: batch.recipe_name || '',
            date_created: formatDate(batch.date_created || new Date()),
            created_by: batch.created_by || '',
            volume: batch.volume || '',
            ph: batch.ph || 5.8,
            notes: batch.notes || ''
        };

        const existingIndex = dataStore.media_batches.findIndex(
            b => b.batch_id === normalizedBatch.batch_id
        );

        if (existingIndex >= 0) {
            dataStore.media_batches[existingIndex] = normalizedBatch;
        } else {
            dataStore.media_batches.push(normalizedBatch);
        }

        return { success: true, batch: normalizedBatch };
    }

    // =========================================================================
    // EXPORT TO EXCEL - Create workbook from data store
    // =========================================================================

    /**
     * Export data store to Excel workbook
     * @returns {Object} SheetJS workbook object
     */
    function exportToWorkbook() {
        const workbook = XLSX.utils.book_new();

        // Helper to create sheet from data
        const createSheet = (data, headers) => {
            if (data.length === 0) {
                return XLSX.utils.aoa_to_sheet([headers]);
            }
            
            const rows = data.map(item => 
                headers.map(h => item[normalizeHeader(h)] || '')
            );
            
            return XLSX.utils.aoa_to_sheet([headers, ...rows]);
        };

        // Create sheets for each data type
        XLSX.utils.book_append_sheet(
            workbook, 
            createSheet(dataStore.inventory, SCHEMAS.Active_Inventory),
            'Active_Inventory'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            createSheet(dataStore.strains, SCHEMAS.Ref_Strains),
            'Ref_Strains'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            createSheet(dataStore.stages, SCHEMAS.Ref_Stages),
            'Ref_Stages'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            createSheet(dataStore.locations, SCHEMAS.Ref_Locations),
            'Ref_Locations'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            createSheet(dataStore.owners, SCHEMAS.Ref_Owners),
            'Ref_Owners'
        );

        XLSX.utils.book_append_sheet(
            workbook,
            createSheet(dataStore.media_batches, SCHEMAS.Media_Batch_Log),
            'Media_Batch_Log'
        );

        return workbook;
    }

    /**
     * Download data as Excel file
     * @param {string} filename - Output filename
     */
    function downloadAsExcel(filename = 'LoneWolf_Inventory_Export.xlsx') {
        const workbook = exportToWorkbook();
        XLSX.writeFile(workbook, filename);
    }

    // =========================================================================
    // QUERY HELPERS - Enhanced search and filter functions
    // =========================================================================

    /**
     * Search inventory with filters
     * @param {Object} filters - Filter criteria
     * @returns {Array} Filtered inventory items
     */
    function searchInventory(filters = {}) {
        return dataStore.inventory.filter(item => {
            for (const [key, value] of Object.entries(filters)) {
                if (value === '' || value === undefined) continue;
                
                const itemValue = String(item[key] || '').toLowerCase();
                const searchValue = String(value).toLowerCase();
                
                if (!itemValue.includes(searchValue)) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Get inventory by owner
     */
    function getInventoryByOwner(ownerCode) {
        return dataStore.inventory.filter(item => 
            item.owner_code === ownerCode
        );
    }

    /**
     * Get inventory by strain
     */
    function getInventoryByStrain(strainName) {
        return dataStore.inventory.filter(item => 
            item.strain_name.toLowerCase().includes(strainName.toLowerCase())
        );
    }

    /**
     * Get inventory by date range
     */
    function getInventoryByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return dataStore.inventory.filter(item => {
            const itemDate = new Date(item.date_created);
            return itemDate >= start && itemDate <= end;
        });
    }

    /**
     * Get strains by owner
     */
    function getStrainsByOwner(ownerCode) {
        return dataStore.strains.filter(strain => 
            strain.owner_code === ownerCode
        );
    }

    /**
     * Lookup owner by code
     */
    function getOwner(ownerCode) {
        return dataStore.owners.find(o => o.owner_code === ownerCode);
    }

    /**
     * Lookup strain by ID or name
     */
    function getStrain(identifier) {
        return dataStore.strains.find(s => 
            s.strain_id === identifier || 
            s.name.toLowerCase() === identifier.toLowerCase()
        );
    }

    // =========================================================================
    // STATISTICS AND REPORTING
    // =========================================================================

    /**
     * Get inventory statistics
     */
    function getStats() {
        const inventory = dataStore.inventory;
        
        return {
            totalItems: inventory.length,
            totalSamples: inventory.reduce((sum, item) => sum + (parseInt(item.sample_count) || 0), 0),
            uniqueStrains: [...new Set(inventory.map(i => i.strain_name))].length,
            uniqueOwners: [...new Set(inventory.map(i => i.owner_code))].length,
            activeItems: inventory.filter(i => i.status === 'Active').length,
            byStage: inventory.reduce((acc, item) => {
                acc[item.stage_name] = (acc[item.stage_name] || 0) + 1;
                return acc;
            }, {}),
            byOwner: inventory.reduce((acc, item) => {
                acc[item.owner_code] = (acc[item.owner_code] || 0) + 1;
                return acc;
            }, {})
        };
    }

    // =========================================================================
    // INTEGRATION WITH EXISTING APP STATE
    // =========================================================================

    /**
     * Sync with existing AppState (if available)
     */
    function syncWithAppState() {
        if (typeof AppState !== 'undefined' && AppState.inventory) {
            // Convert existing inventory format to enhanced format
            AppState.inventory.forEach(item => {
                saveItem({
                    asset_id: item.containerId || item.container,
                    strain_name: item.strain,
                    stage_name: item.stage,
                    owner_code: item.owner,
                    media_batch_id: item.media,
                    date_created: item.date,
                    sample_count: item.count,
                    status: item.status,
                    lineage: item.lineage,
                    notes: item.notes
                });
            });

            // Sync owners
            if (AppState.excelData && AppState.excelData.owners) {
                AppState.excelData.owners.forEach(owner => {
                    saveOwner({
                        owner_code: owner.code || owner.Owner_Code,
                        name: owner.name || owner.Name,
                        email: owner.email,
                        company: owner.company
                    });
                });
            }

            // Sync strains
            if (AppState.excelData && AppState.excelData.strains) {
                AppState.excelData.strains.forEach(strain => {
                    saveStrain({
                        strain_id: strain.id || strain.Strain_ID,
                        name: strain.name || strain.Name,
                        owner_code: strain.ownerCode || strain.Owner_Code
                    });
                });
            }

            console.log('Synced with AppState');
        }
    }

    /**
     * Push changes back to AppState
     */
    function pushToAppState() {
        if (typeof AppState !== 'undefined') {
            // Convert enhanced format back to existing format
            AppState.inventory = dataStore.inventory.map(item => ({
                containerId: item.asset_id,
                container: item.asset_id,
                strain: item.strain_name,
                stage: item.stage_name,
                owner: item.owner_code,
                media: item.media_batch_id,
                date: item.date_created,
                count: item.sample_count,
                status: item.status,
                lineage: item.lineage,
                notes: item.notes
            }));

            console.log('Pushed to AppState');
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // Data retrieval (mirrors Gemini's getData)
        getData,
        getSheetData,
        loadFromWorkbook,

        // Data saving (mirrors Gemini's saveItem)
        saveItem,
        saveItems,
        deleteItem,

        // Reference data management
        saveStrain,
        saveOwner,
        saveMediaBatch,

        // Export functions
        exportToWorkbook,
        downloadAsExcel,

        // Query helpers
        searchInventory,
        getInventoryByOwner,
        getInventoryByStrain,
        getInventoryByDateRange,
        getStrainsByOwner,
        getOwner,
        getStrain,

        // Statistics
        getStats,

        // Integration
        syncWithAppState,
        pushToAppState,

        // Direct access to schemas
        SCHEMAS,

        // Utility functions
        generateId,
        formatDate,
        normalizeHeader
    };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedDataLayer;
}
