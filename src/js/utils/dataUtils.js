// Data Management and Utility Functions
// Lab Barcode Builder & Transfer System

window.DataUtils = {
    // Date formatting utilities
    formatDate: function(dateString) {
        if (dateString && dateString.length === 8) {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return `${month}/${day}/${year}`;
        }
        return dateString;
    },
    
    getCurrentDateString: function() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return year + month + day;
    },
    
    // Container ID utilities
    getNextContainerId: function() {
        // Update highest container ID from all existing containers
        window.appState.inventory.forEach(entry => {
            const containerId = parseInt(entry.containerId);
            if (!isNaN(containerId) && containerId > window.appState.highestContainerId) {
                window.appState.highestContainerId = containerId;
            }
        });
        
        // Also check current container being processed
        if (window.appState.currentContainer) {
            const currentId = parseInt(window.appState.currentContainer);
            if (!isNaN(currentId) && currentId > window.appState.highestContainerId) {
                window.appState.highestContainerId = currentId;
            }
        }
        
        // Return the next sequential ID
        return window.appState.highestContainerId + 1;
    },
    
    // Container lineage utilities
    getContainerLineage: function(containerId) {
        return window.appState.containerLineage[containerId] || [];
    },
    
    addToContainerLineage: function(containerId, parentId) {
        if (!window.appState.containerLineage[containerId]) {
            window.appState.containerLineage[containerId] = [];
        }
        
        // Add parent's lineage if it exists
        if (window.appState.containerLineage[parentId]) {
            window.appState.containerLineage[containerId] = [...window.appState.containerLineage[parentId]];
        }
        
        // Add the parent container
        window.appState.containerLineage[containerId].push(parentId);
    },
    
    // Validation utilities
    validateInput: function(step, value) {
        const validationRules = {
            container: /^\d+$/,
            owner: /^[A-Z]+$/i,
            strain: /^\d{1,5}$/,
            media: /^[A-Z]+$/i,
            stage: /^[1-9]$/,
            tissue: /^\d{1,2}$/,
            date: /^\d{8}$/
        };
        
        const rule = validationRules[step];
        if (!rule) return false;
        
        if (step === 'tissue') {
            const num = parseInt(value);
            return rule.test(value) && num > 0 && num <= 99;
        }
        
        return rule.test(value);
    },
    
    // Excel data persistence keys
    STORAGE_KEYS: {
        EXCEL_DATA: 'labScanner_excelData',
        EXCEL_METADATA: 'labScanner_excelMetadata'
    },
    
    // Load Excel data from localStorage if available
    loadSavedExcelData: function() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEYS.EXCEL_DATA);
            const savedMetadata = localStorage.getItem(this.STORAGE_KEYS.EXCEL_METADATA);
            
            if (savedData && savedMetadata) {
                const data = JSON.parse(savedData);
                const metadata = JSON.parse(savedMetadata);
                
                // Restore data to appState
                window.appState.strainsTable = data.strainsTable || {};
                window.appState.ownersTable = data.ownersTable || {};
                window.appState.stagesTable = data.stagesTable || {};
                window.appState.locationsTable = data.locationsTable || [];
                window.appState.mediaTypesTable = data.mediaTypesTable || {};
                window.appState.strainOwnerMapping = data.strainOwnerMapping || {};
                window.appState.isDataLoaded = true;
                
                console.log('=== EXCEL DATA LOADED FROM CACHE ===');
                console.log(`File: ${metadata.fileName}`);
                console.log(`Loaded: ${new Date(metadata.loadDate).toLocaleString()}`);
                console.log(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
                console.log(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
                console.log(`Stages: ${Object.keys(window.appState.stagesTable).length}`);
                
                return {
                    success: true,
                    metadata: metadata
                };
            }
            
            return { success: false, reason: 'No saved data found' };
        } catch (error) {
            console.error('Error loading saved Excel data:', error);
            return { success: false, reason: error.message };
        }
    },
    
    // Save Excel data to localStorage
    saveExcelData: function(fileName) {
        try {
            const dataToSave = {
                strainsTable: window.appState.strainsTable,
                ownersTable: window.appState.ownersTable,
                stagesTable: window.appState.stagesTable,
                locationsTable: window.appState.locationsTable,
                mediaTypesTable: window.appState.mediaTypesTable,
                strainOwnerMapping: window.appState.strainOwnerMapping || {}
            };
            
            const metadata = {
                fileName: fileName,
                loadDate: new Date().toISOString(),
                recordCounts: {
                    strains: Object.keys(window.appState.strainsTable).length,
                    owners: Object.keys(window.appState.ownersTable).length,
                    stages: Object.keys(window.appState.stagesTable).length,
                    locations: window.appState.locationsTable.length,
                    mediaTypes: Object.keys(window.appState.mediaTypesTable).length,
                    strainOwnerMappings: Object.keys(window.appState.strainOwnerMapping || {}).length
                }
            };
            
            localStorage.setItem(this.STORAGE_KEYS.EXCEL_DATA, JSON.stringify(dataToSave));
            localStorage.setItem(this.STORAGE_KEYS.EXCEL_METADATA, JSON.stringify(metadata));
            
            console.log('Excel data saved to localStorage');
            return true;
        } catch (error) {
            console.error('Error saving Excel data:', error);
            return false;
        }
    },
    
    // Clear saved Excel data
    clearSavedExcelData: function() {
        localStorage.removeItem(this.STORAGE_KEYS.EXCEL_DATA);
        localStorage.removeItem(this.STORAGE_KEYS.EXCEL_METADATA);
        console.log('Saved Excel data cleared');
    },
    
    // Get saved Excel metadata
    getSavedExcelMetadata: function() {
        try {
            const savedMetadata = localStorage.getItem(this.STORAGE_KEYS.EXCEL_METADATA);
            return savedMetadata ? JSON.parse(savedMetadata) : null;
        } catch (error) {
            console.error('Error getting saved Excel metadata:', error);
            return null;
        }
    },
    
    // Excel data processing utilities
    processExcelData: function(workbook, fileName = 'Unknown File') {
        try {
            this.loadStrains(workbook.Sheets['Strains']);
            this.loadOwners(workbook.Sheets['Owners']);
            this.loadStages(workbook.Sheets['Stages']);
            this.loadLocations(workbook.Sheets['Locations']);
            this.loadMediaTypes(workbook.Sheets['Media_Types']);
            this.loadStrainOwnerMapping(workbook.Sheets['Strain_Owner_Mapping'] || workbook.Sheets['Strain-Owner']);
            
            window.appState.isDataLoaded = true;
            
            // Save to localStorage for future use
            this.saveExcelData(fileName);
            
            console.log('=== EXCEL DATA LOADED ===');
            console.log(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
            console.log(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
            console.log(`Stages: ${Object.keys(window.appState.stagesTable).length}`);
            console.log(`Strain-Owner Mappings: ${Object.keys(window.appState.strainOwnerMapping || {}).length}`);
            
            return true;
        } catch (error) {
            console.error('Error processing Excel data:', error);
            return false;
        }
    },
    
    loadStrains: function(sheet) {
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet);
        data.forEach(row => {
            if (row['Strain ID'] && row['Strain']) {
                window.appState.strainsTable[parseInt(row['Strain ID'])] = row['Strain'];
            }
        });
    },
    
    loadOwners: function(sheet) {
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet);
        data.forEach(row => {
            if (row['Owner ID'] && row['Owner']) {
                window.appState.ownersTable[row['Owner ID']] = row['Owner'];
            }
        });
    },
    
    loadStages: function(sheet) {
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet);
        data.forEach(row => {
            if (row['Propogation Stages ID'] && row['Propogation Stages']) {
                window.appState.stagesTable[parseInt(row['Propogation Stages ID'])] = row['Propogation Stages'];
            }
        });
    },
    
    loadLocations: function(sheet) {
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet);
        window.appState.locationsTable = data.map(row => row['Locations']).filter(Boolean);
    },
    
    loadMediaTypes: function(sheet) {
        if (!sheet) return;
        const data = XLSX.utils.sheet_to_json(sheet);
        data.forEach(row => {
            if (row['Media ID'] && row['Media Type']) {
                window.appState.mediaTypesTable[row['Media ID']] = row['Media Type'];
            }
        });
    },
    
    // Load strain-to-owner mapping data
    loadStrainOwnerMapping: function(sheet) {
        if (!sheet) {
            console.log('No strain-owner mapping sheet found, using demo data');
            this.loadDemoStrainOwnerMapping();
            return;
        }
        
        console.log('Loading strain-to-owner mapping from Excel sheet');
        const data = XLSX.utils.sheet_to_json(sheet);
        
        window.appState.strainOwnerMapping = {};
        data.forEach(row => {
            // Try different possible column names
            const strainId = row['Strain ID'] || row['StrainID'] || row['Strain_ID'] || row['strain_id'];
            const ownerId = row['Owner ID'] || row['OwnerID'] || row['Owner_ID'] || row['owner_id'] || row['Owner'];
            
            if (strainId && ownerId) {
                const normalizedStrainId = parseInt(strainId).toString();
                window.appState.strainOwnerMapping[normalizedStrainId] = ownerId.toUpperCase();
            }
        });
        
        console.log('Strain-Owner mapping loaded:', window.appState.strainOwnerMapping);
    },
    
    // Load demo strain-to-owner mapping for testing
    loadDemoStrainOwnerMapping: function() {
        console.log('Loading demo strain-to-owner mapping data');
        
        // Try to load from the JSON file first
        this.loadJSONFallbackData();
        
        // If still no data, use minimal demo data
        if (!window.appState.strainOwnerMapping || Object.keys(window.appState.strainOwnerMapping).length === 0) {
            window.appState.strainOwnerMapping = {
                "1": "vibe",
                "2": "vibe",
                "3": "vibe",
                "4": "vibe",
                "5": "vibe",
                "10": "vibe",
                "13": "vibe",
                "22": "LWB",
                "23": "LWB",
                "68": "beau",
                "71": "jay"
            };
        }
        
        console.log('Demo strain-owner mapping loaded:', window.appState.strainOwnerMapping);
    },
    
    // Load JSON fallback data for development/testing
    loadJSONFallbackData: function() {
        var self = this;
        try {
            // Try to fetch the JSON file
            fetch('./strain_owner_mapping.json')
                .then(function(response) {
                    if (!response.ok) throw new Error('JSON file not found');
                    return response.json();
                })
                .then(function(data) {
                    console.log('Loading data from JSON file:', data);
                    
                    // Load strain-owner mapping
                    if (data.strainOwnerMapping) {
                        window.appState.strainOwnerMapping = data.strainOwnerMapping;
                        console.log('Strain-Owner mapping loaded from JSON:', Object.keys(data.strainOwnerMapping).length, 'entries');
                    }
                    
                    // Load strain names if available
                    if (data.strainNameMapping) {
                        window.appState.strainsTable = data.strainNameMapping;
                        console.log('Strain names loaded from JSON:', Object.keys(data.strainNameMapping).length, 'entries');
                    }
                    
                    // Load owner names if available
                    if (data.ownerNameMapping) {
                        window.appState.ownersTable = data.ownerNameMapping;
                        console.log('Owner names loaded from JSON:', Object.keys(data.ownerNameMapping).length, 'entries');
                    }
                    
                    // Load media types if available
                    if (data.mediaTypeMapping) {
                        window.appState.mediaTypesTable = data.mediaTypeMapping;
                        console.log('Media types loaded from JSON:', Object.keys(data.mediaTypeMapping).length, 'entries');
                    }
                    
                    // Mark data as loaded
                    window.appState.isDataLoaded = true;
                    
                    // Update UI to show JSON data is loaded
                    if (window.UIUtils) {
                        window.UIUtils.updateDataStatus(true, 'strain_owner_mapping.json (fallback)', false);
                    }
                    
                    // Trigger any data loaded callbacks
                    self.triggerDataLoadedCallbacks();
                })
                .catch(function(error) {
                    console.log('JSON fallback file not available:', error.message);
                    // If JSON fails, use minimal fallback data
                    self.loadMinimalFallbackData();
                });
        } catch (error) {
            console.log('Could not load JSON fallback data:', error.message);
            // If JSON fails, use minimal fallback data
            this.loadMinimalFallbackData();
        }
    },
    
    // Load minimal fallback data for testing
    loadMinimalFallbackData: function() {
        console.log('Loading minimal fallback data...');
        
        // Set basic strain data
        window.appState.strainsTable = {
            "1": "Test Strain 1",
            "2": "Test Strain 2",
            "13": "Guava Tart",
            "22": "Test Strain 22",
            "23": "Test Strain 23"
        };
        
        // Set basic owner data
        window.appState.ownersTable = {
            "LW": "Luke Wilson",
            "JR": "John Doe",
            "vibe": "Vibe Owner",
            "beau": "Beau Owner",
            "jay": "Jay Owner"
        };
        
        // Set basic media types
        window.appState.mediaTypesTable = {
            "MS": "MS Media",
            "PDA": "PDA Media",
            "MEA": "MEA Media"
        };
        
        // Set strain-owner mapping
        window.appState.strainOwnerMapping = {
            "1": "vibe",
            "2": "vibe",
            "13": "vibe",
            "22": "LW",
            "23": "LW"
        };
        
        // Mark data as loaded
        window.appState.isDataLoaded = true;
        
        console.log('Minimal fallback data loaded successfully');
        
        // Trigger any data loaded callbacks
        this.triggerDataLoadedCallbacks();
    },
    
    // Callback system for data loading
    dataLoadedCallbacks: [],
    
    onDataLoaded: function(callback) {
        if (window.appState.isDataLoaded) {
            // Data is already loaded, execute callback immediately
            callback();
        } else {
            // Add to callbacks to execute when data is loaded
            this.dataLoadedCallbacks.push(callback);
        }
    },
    
    triggerDataLoadedCallbacks: function() {
        console.log('Triggering data loaded callbacks:', this.dataLoadedCallbacks.length);
        this.dataLoadedCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in data loaded callback:', error);
            }
        });
        // Clear callbacks after executing them
        this.dataLoadedCallbacks = [];
    },

    /**
     * Load strain-owner mapping with cloud sync support
     * Tries OneDriveSync first, then falls back to local JSON, then minimal fallback
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Result object with source and success status
     */
    loadStrainOwnerMappingWithCloud: async function(options = {}) {
        console.log('DataUtils: Loading strain-owner mapping with cloud sync support...');

        const nonBlocking = options.nonBlocking !== false; // Default to non-blocking

        // Check if authenticated and OneDriveSync is available
        if (window.AuthManager && window.AuthManager.isSignedIn() && window.OneDriveSync) {
            console.log('DataUtils: Attempting cloud sync...');

            try {
                const result = await window.OneDriveSync.manualSync();

                if (result.success) {
                    console.log('DataUtils: Cloud sync successful');

                    // Mark data as loaded
                    window.appState.isDataLoaded = true;

                    // Update UI
                    if (window.UIUtils) {
                        window.UIUtils.updateDataStatus(true, 'Cloud (OneDrive/SharePoint)', false);
                    }

                    // Trigger callbacks
                    this.triggerDataLoadedCallbacks();

                    return { source: 'cloud', success: true };
                }
            } catch (error) {
                console.warn('DataUtils: Cloud sync failed, falling back to local JSON:', error);
            }
        } else {
            console.log('DataUtils: Cloud sync not available (not authenticated or OneDriveSync not initialized)');
        }

        // Fall back to local JSON
        console.log('DataUtils: Attempting local JSON fallback...');
        try {
            await this.loadJSONFallbackDataAsync();
            return { source: 'local-json', success: true };
        } catch (error) {
            console.warn('DataUtils: Local JSON fallback failed, using minimal fallback:', error);
        }

        // Last resort: minimal fallback
        console.log('DataUtils: Using minimal fallback data');
        this.loadMinimalFallbackData();
        return { source: 'minimal', success: true };
    },

    /**
     * Async version of loadJSONFallbackData for use in loadStrainOwnerMappingWithCloud
     * @returns {Promise<void>}
     */
    loadJSONFallbackDataAsync: function() {
        const self = this;
        return new Promise((resolve, reject) => {
            fetch('./strain_owner_mapping.json')
                .then(function(response) {
                    if (!response.ok) throw new Error('JSON file not found');
                    return response.json();
                })
                .then(function(data) {
                    console.log('Loading data from JSON file:', data);

                    // Load strain-owner mapping
                    if (data.strainOwnerMapping) {
                        window.appState.strainOwnerMapping = data.strainOwnerMapping;
                        console.log('Strain-Owner mapping loaded from JSON:', Object.keys(data.strainOwnerMapping).length, 'entries');
                    }

                    // Load strain names if available
                    if (data.strainNameMapping) {
                        window.appState.strainsTable = data.strainNameMapping;
                        console.log('Strain names loaded from JSON:', Object.keys(data.strainNameMapping).length, 'entries');
                    }

                    // Load owner names if available
                    if (data.ownerNameMapping) {
                        window.appState.ownersTable = data.ownerNameMapping;
                        console.log('Owner names loaded from JSON:', Object.keys(data.ownerNameMapping).length, 'entries');
                    }

                    // Load media types if available
                    if (data.mediaTypeMapping) {
                        window.appState.mediaTypesTable = data.mediaTypeMapping;
                        console.log('Media types loaded from JSON:', Object.keys(data.mediaTypeMapping).length, 'entries');
                    }

                    // Mark data as loaded
                    window.appState.isDataLoaded = true;

                    // Update UI to show JSON data is loaded
                    if (window.UIUtils) {
                        window.UIUtils.updateDataStatus(true, 'strain_owner_mapping.json (fallback)', false);
                    }

                    // Trigger any data loaded callbacks
                    self.triggerDataLoadedCallbacks();

                    resolve();
                })
                .catch(function(error) {
                    console.log('JSON fallback file not available:', error.message);
                    reject(error);
                });
        });
    },

    /**
     * Enable periodic cloud refresh
     * Starts auto-refresh when cloud sync is available
     */
    enablePeriodicRefresh: function() {
        console.log('DataUtils: Enabling periodic cloud refresh...');

        if (window.OneDriveSync && window.AuthManager && window.AuthManager.isSignedIn()) {
            window.OneDriveSync.startAutoRefresh();
            console.log('DataUtils: Periodic refresh enabled');
        } else {
            console.log('DataUtils: Periodic refresh not available (OneDriveSync not initialized or not authenticated)');
        }
    },

    /**
     * Subscribe to strain-owner mapping updates from cloud sync
     */
    subscribeToCloudUpdates: function() {
        console.log('DataUtils: Subscribing to cloud updates...');

        window.addEventListener('strainOwnerMapping:updated', (event) => {
            console.log('DataUtils: Received strainOwnerMapping:updated event:', event.detail);

            const { source, ts } = event.detail;

            // Update UI to reflect the update
            if (window.UIUtils && source === 'cloud') {
                const syncDate = new Date(ts);
                window.UIUtils.updateDataStatus(true, `Cloud (synced ${syncDate.toLocaleTimeString()})`, false);
            }

            // Trigger any dependent updates
            this.triggerDataLoadedCallbacks();

            // Show notification
            if (window.NotificationSystem && source === 'cloud') {
                window.NotificationSystem.info('📁 Data refreshed from cloud');
            }
        });

        console.log('DataUtils: Subscribed to cloud updates');
    }
};
