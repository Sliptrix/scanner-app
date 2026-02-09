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
    
    // Container ID utilities - PERF: Optimized to avoid full inventory scan
    // Track when we last recalculated to avoid redundant scans
    _lastInventoryLength: 0,
    _cachedHighestId: 0,
    
    getNextContainerId: function() {
        const inventory = window.appState.inventory;
        const currentLength = inventory.length;
        
        // PERF: Only scan if inventory has grown since last calculation
        if (currentLength !== this._lastInventoryLength || this._cachedHighestId === 0) {
            // Full scan only when necessary
            let highest = window.appState.highestContainerId || 0;
            
            for (let i = 0; i < currentLength; i++) {
                const containerId = parseInt(inventory[i].containerId);
                if (!isNaN(containerId) && containerId > highest) {
                    highest = containerId;
                }
            }
            
            this._cachedHighestId = highest;
            this._lastInventoryLength = currentLength;
            window.appState.highestContainerId = highest;
        }
        
        // Also check current container being processed
        if (window.appState.currentContainer) {
            const currentId = parseInt(window.appState.currentContainer);
            if (!isNaN(currentId) && currentId > this._cachedHighestId) {
                this._cachedHighestId = currentId;
                window.appState.highestContainerId = currentId;
            }
        }
        
        // Return the next sequential ID
        return this._cachedHighestId + 1;
    },
    
    // PERF: Invalidate cache when inventory changes significantly
    invalidateContainerIdCache: function() {
        this._lastInventoryLength = 0;
        this._cachedHighestId = 0;
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
    // CRITICAL FIX: Better handling of corrupted JSON data
    loadSavedExcelData: function() {
        try {
            const savedData = localStorage.getItem(this.STORAGE_KEYS.EXCEL_DATA);
            const savedMetadata = localStorage.getItem(this.STORAGE_KEYS.EXCEL_METADATA);

            if (savedData && savedMetadata) {
                let data, metadata;

                // Parse data with validation
                try {
                    data = JSON.parse(savedData);
                } catch (parseError) {
                    console.error('Corrupted Excel data in localStorage, clearing...', parseError);
                    localStorage.removeItem(this.STORAGE_KEYS.EXCEL_DATA);
                    NotificationSystem.warning('Cached Excel data was corrupted and has been cleared. Please reload your Excel file.');
                    return { success: false, reason: 'Corrupted data cleared', corrupted: true };
                }

                try {
                    metadata = JSON.parse(savedMetadata);
                } catch (parseError) {
                    console.error('Corrupted Excel metadata in localStorage, clearing...', parseError);
                    localStorage.removeItem(this.STORAGE_KEYS.EXCEL_METADATA);
                    NotificationSystem.warning('Cached Excel metadata was corrupted. Please reload your Excel file.');
                    return { success: false, reason: 'Corrupted metadata cleared', corrupted: true };
                }

                // Validate data structure before using
                if (!data || typeof data !== 'object') {
                    console.error('Invalid Excel data structure');
                    localStorage.removeItem(this.STORAGE_KEYS.EXCEL_DATA);
                    return { success: false, reason: 'Invalid data structure' };
                }

                // Restore data to appState
                window.appState.strainsTable = data.strainsTable || {};
                window.appState.ownersTable = data.ownersTable || {};
                window.appState.stagesTable = data.stagesTable || {};
                window.appState.locationsTable = data.locationsTable || [];
                window.appState.mediaTypesTable = data.mediaTypesTable || {};
                window.appState.strainOwnerMapping = data.strainOwnerMapping || {};
                window.appState.isDataLoaded = true;

                Logger.debug('=== EXCEL DATA LOADED FROM CACHE ===');
                Logger.debug(`File: ${metadata.fileName || 'Unknown'}`);
                Logger.debug(`Loaded: ${metadata.loadDate ? new Date(metadata.loadDate).toLocaleString() : 'Unknown'}`);
                Logger.debug(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
                Logger.debug(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
                Logger.debug(`Stages: ${Object.keys(window.appState.stagesTable).length}`);

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
            
            Logger.debug('Excel data saved to localStorage');
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
        Logger.debug('Saved Excel data cleared');
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
    
    // Helper: find a sheet by trying multiple name variants (exact match)
    _findSheet: function(workbook, names) {
        for (const name of names) {
            if (workbook.Sheets[name]) return workbook.Sheets[name];
        }
        return null;
    },

    // Helper: parse a sheet with title-row detection.
    // Some HQ workbook sheets have a title row before the header row.
    // We detect this by looking for a row where multiple cells match expected header names.
    _sheetToJsonSmart: function(sheet, expectedHeaders) {
        if (!sheet) return [];
        // First try array-of-arrays to detect header row
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        if (!aoa.length) return [];

        let headerRowIndex = 0;
        const lowerExpected = (expectedHeaders || []).map(h => h.toLowerCase().replace(/[_ ]/g, ''));

        // Search first 5 rows for the best header match
        if (lowerExpected.length > 0) {
            let bestScore = 0;
            for (let i = 0; i < Math.min(aoa.length, 5); i++) {
                const row = aoa[i];
                if (!Array.isArray(row)) continue;
                const score = row.filter(cell => {
                    if (!cell) return false;
                    const norm = String(cell).toLowerCase().replace(/[_ ]/g, '');
                    return lowerExpected.includes(norm);
                }).length;
                if (score > bestScore) {
                    bestScore = score;
                    headerRowIndex = i;
                }
            }
        }

        // Build objects from headerRowIndex
        const headerRow = aoa[headerRowIndex] || [];
        const dataRows = aoa.slice(headerRowIndex + 1);
        return dataRows.map(rowArr => {
            const obj = {};
            headerRow.forEach((h, idx) => {
                if (h) obj[String(h).trim()] = rowArr[idx];
            });
            return obj;
        }).filter(row => Object.keys(row).length > 0);
    },

    // Excel data processing utilities
    processExcelData: function(workbook, fileName = 'Unknown File') {
        try {
            // Use fallback sheet names for HQ workbook compatibility
            this.loadStrains(this._findSheet(workbook, ['Strains', 'Ref_Strains']));
            this.loadOwners(this._findSheet(workbook, ['Owners', 'Ref_Owners']));
            this.loadStages(this._findSheet(workbook, ['Stages', 'Ref_Stages']));
            this.loadLocations(this._findSheet(workbook, ['Locations', 'Ref_Locations']));
            this.loadMediaTypes(this._findSheet(workbook, ['Media_Types', 'Ref_Media_Types']));
            this.loadStrainOwnerMapping(this._findSheet(workbook, ['Strain_Owner_Mapping', 'Strain-Owner']));

            // Load strain abbreviations if available (for flexible input resolution)
            this.loadStrainAbbreviations(this._findSheet(workbook, ['Ref_Strains', 'Strains']));
            // Load owner alternates if available
            this.loadOwnerAlternates(this._findSheet(workbook, ['Ref_Owners', 'Owners']));

            // Load Active_Inventory if present (HQ workbook)
            this.loadActiveInventory(workbook);

            window.appState.isDataLoaded = true;

            // Save to localStorage for future use
            this.saveExcelData(fileName);

            Logger.debug('=== EXCEL DATA LOADED ===');
            Logger.debug(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
            Logger.debug(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
            Logger.debug(`Stages: ${Object.keys(window.appState.stagesTable).length}`);
            Logger.debug(`Strain-Owner Mappings: ${Object.keys(window.appState.strainOwnerMapping || {}).length}`);
            Logger.debug(`Inventory: ${window.appState.inventory ? window.appState.inventory.length : 0}`);

            // Rebuild InventoryLookupService with new data
            if (window.InventoryLookupService && window.InventoryLookupService.isInitialized()) {
                window.InventoryLookupService.rebuild();
                Logger.debug('InventoryLookupService rebuilt with new Excel data');
            } else if (window.InventoryLookupService) {
                window.InventoryLookupService.initialize();
                Logger.debug('InventoryLookupService initialized with Excel data');
            }

            return true;
        } catch (error) {
            console.error('Error processing Excel data:', error);
            return false;
        }
    },

    // Load strain abbreviations for flexible input resolution
    loadStrainAbbreviations: function(sheet) {
        if (!sheet) return;
        try {
            const data = XLSX.utils.sheet_to_json(sheet);
            const abbreviations = {};

            data.forEach(row => {
                // Try different column name variations
                const strainId = row['Strain ID'] || row['Strain_ID'] || row['StrainID'];
                const abbreviation = row['ABR'] || row['Abbreviation'] || row['Abbr'];

                if (strainId && abbreviation) {
                    abbreviations[String(strainId)] = String(abbreviation);
                }
            });

            // Load into InventoryLookupService if available
            if (window.InventoryLookupService && Object.keys(abbreviations).length > 0) {
                window.InventoryLookupService.loadAbbreviationData({
                    strainAbbreviations: abbreviations
                });
                Logger.debug(`Loaded ${Object.keys(abbreviations).length} strain abbreviations`);
            }
        } catch (error) {
            console.warn('Could not load strain abbreviations:', error.message);
        }
    },

    // Load owner alternate names for flexible input resolution
    loadOwnerAlternates: function(sheet) {
        if (!sheet) return;
        try {
            const data = XLSX.utils.sheet_to_json(sheet);
            const alternates = {};

            data.forEach(row => {
                // Try different column name variations (including HQ workbook format)
                const ownerCode = row['Owner ID'] || row['Owner_ID'] || row['OwnerID'] || row['Owner Code'] || row['Owner_Code'] || row['owner_code'];
                // FIX: Added 'Alternate_name' (singular) to match HQ workbook format
                const alt1 = row['Alternate_names'] || row['Alternate_name'] || row['Alt1'] || row['Alternate1'] || row['alternate_name'];
                const alt2 = row['Alt2'] || row['Alternate2'];

                if (ownerCode) {
                    const altList = [alt1, alt2].filter(Boolean);
                    if (altList.length > 0) {
                        alternates[String(ownerCode)] = altList;
                    }
                }
            });

            // Load into InventoryLookupService if available
            if (window.InventoryLookupService && Object.keys(alternates).length > 0) {
                window.InventoryLookupService.loadAbbreviationData({
                    ownerAlternates: alternates
                });
                Logger.debug(`Loaded ${Object.keys(alternates).length} owner alternate names`);
            }
        } catch (error) {
            console.warn('Could not load owner alternates:', error.message);
        }
    },
    
    loadStrains: function(sheet) {
        if (!sheet) return;
        const data = this._sheetToJsonSmart(sheet, ['Strain ID', 'Strain_ID', 'Strain', 'Strain_Name']);
        data.forEach(row => {
            const id = row['Strain ID'] || row['Strain_ID'] || row['StrainID'];
            const name = row['Strain'] || row['Strain_Name'] || row['StrainName'];
            if (id && name) {
                window.appState.strainsTable[parseInt(id)] = name;
            }
        });
    },
    
    loadOwners: function(sheet) {
        if (!sheet) return;
        const data = this._sheetToJsonSmart(sheet, ['Owner ID', 'Owner_Code', 'Owner', 'Owner_Name']);
        data.forEach(row => {
            const id = row['Owner ID'] || row['Owner_Code'] || row['OwnerID'];
            const name = row['Owner'] || row['Owner_Name'] || row['OwnerName'];
            if (id && name) {
                window.appState.ownersTable[id] = name;
            }
        });
    },
    
    loadStages: function(sheet) {
        if (!sheet) return;
        const data = this._sheetToJsonSmart(sheet, ['Propogation Stages ID', 'Stage_ID', 'Stage', 'Stage_Name']);
        data.forEach(row => {
            const id = row['Propogation Stages ID'] || row['Stage_ID'] || row['StageID'];
            const name = row['Propogation Stages'] || row['Stage_Name'] || row['StageName'] || row['Stage'];
            if (id && name) {
                window.appState.stagesTable[parseInt(id)] = name;
            }
        });
    },
    
    loadLocations: function(sheet) {
        if (!sheet) return;
        const data = this._sheetToJsonSmart(sheet, ['Locations', 'Location_Name', 'Location']);
        window.appState.locationsTable = data.map(row => 
            row['Locations'] || row['Location_Name'] || row['Location'] || row['LocationName']
        ).filter(Boolean);
    },
    
    loadMediaTypes: function(sheet) {
        if (!sheet) return;
        const data = this._sheetToJsonSmart(sheet, ['Media ID', 'Media_Code', 'Media Type', 'Media_Name']);
        data.forEach(row => {
            const id = row['Media ID'] || row['Media_Code'] || row['MediaID'];
            const name = row['Media Type'] || row['Media_Name'] || row['MediaType'];
            if (id && name) {
                window.appState.mediaTypesTable[id] = name;
            }
        });
    },

    // Load Active_Inventory from workbook (HQ workbook support)
    loadActiveInventory: function(workbook) {
        // Find Active_Inventory sheet
        const sheetName = workbook.SheetNames.find(n => 
            n.toLowerCase().replace(/[_ ]/g, '') === 'activeinventory'
        );
        if (!sheetName) return;

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;

        Logger.debug('Loading Active_Inventory sheet...');

        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, cellDates: true });
        if (!aoa.length) return;

        // Find header row by looking for Container_ID
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(aoa.length, 10); i++) {
            const row = aoa[i];
            if (!Array.isArray(row)) continue;
            if (row.some(cell => cell && String(cell).toLowerCase().trim() === 'container_id')) {
                headerRowIndex = i;
                break;
            }
        }

        const headerRow = aoa[headerRowIndex] || [];
        const dataRows = aoa.slice(headerRowIndex + 1);
        if (!dataRows.length) return;

        // Build row objects
        const rows = dataRows.map(rowArr => {
            const obj = {};
            headerRow.forEach((h, idx) => {
                if (h) obj[String(h).trim()] = rowArr[idx];
            });
            return obj;
        }).filter(row => Object.keys(row).length > 0);

        // Helper to find field by candidate names (case-insensitive, ignoring _ and spaces)
        const getField = (row, candidates) => {
            for (const key of Object.keys(row)) {
                let norm = key.toLowerCase().trim().replace(/[_ ]/g, '');
                norm = norm.replace(/\d+$/, ''); // strip XLSX duplicate suffixes
                if (candidates.some(c => c.toLowerCase().replace(/[_ ]/g, '') === norm)) {
                    return row[key];
                }
            }
            return undefined;
        };

        const inventory = [];
        rows.forEach(row => {
            const containerIdValue = getField(row, ['Container_ID']);
            if (containerIdValue === undefined || containerIdValue === null || containerIdValue === '') return;

            const rawId = parseInt(String(containerIdValue).trim(), 10);
            if (isNaN(rawId)) return;

            const containerId = String(rawId).padStart(6, '0');

            const strainName = getField(row, ['Strain_Name', 'Strain']) || getField(row, ['Strain_ID']);
            const ownerName = getField(row, ['Owner', 'Owner_Name']);
            const stage = getField(row, ['Stage']);
            const location = getField(row, ['Location', 'Room', 'Rack']);
            const media = getField(row, ['Media', 'Media_Type']);
            const quantity = getField(row, ['Quantity', 'TissueCount', 'Tissue_Count']);
            const dateCreated = getField(row, ['DateCreated', 'Date_Created', 'Date']);
            const notes = getField(row, ['Notes', 'Comment', 'Comments']);
            const status = getField(row, ['Status']);

            // Format date
            let formattedDate = '';
            if (dateCreated) {
                if (dateCreated instanceof Date) {
                    const y = dateCreated.getFullYear();
                    const m = String(dateCreated.getMonth() + 1).padStart(2, '0');
                    const d = String(dateCreated.getDate()).padStart(2, '0');
                    formattedDate = `${y}${m}${d}`;
                } else {
                    formattedDate = String(dateCreated);
                }
            }

            inventory.push({
                containerId: containerId,
                strain: strainName ? String(strainName) : '',
                owner: ownerName ? String(ownerName) : '',
                stage: stage ? String(stage) : '',
                location: location ? String(location) : '',
                media: media ? String(media) : '',
                tissueCount: quantity ? parseInt(quantity, 10) || 0 : 0,
                dateCreated: formattedDate,
                notes: notes ? String(notes) : '',
                status: status ? String(status) : 'Active',
                source: 'excel'
            });
        });

        if (inventory.length > 0) {
            window.appState.inventory = inventory;
            Logger.debug(`Active_Inventory loaded: ${inventory.length} entries`);

            // Dispatch event so dashboard auto-refreshes
            window.dispatchEvent(new Event('inventoryUpdated'));
        }
    },
    
    // Load strain-to-owner mapping data
    loadStrainOwnerMapping: function(sheet) {
        if (!sheet) {
            Logger.debug('No strain-owner mapping sheet found, using demo data');
            this.loadDemoStrainOwnerMapping();
            return;
        }
        
        Logger.debug('Loading strain-to-owner mapping from Excel sheet');
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
        
        Logger.debug('Strain-Owner mapping loaded:', window.appState.strainOwnerMapping);
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
                        Logger.debug('Strain-Owner mapping loaded from JSON:', Object.keys(data.strainOwnerMapping).length, 'entries');
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
                        Logger.debug('Strain-Owner mapping loaded from JSON:', Object.keys(data.strainOwnerMapping).length, 'entries');
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
