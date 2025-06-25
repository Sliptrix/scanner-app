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
                mediaTypesTable: window.appState.mediaTypesTable
            };
            
            const metadata = {
                fileName: fileName,
                loadDate: new Date().toISOString(),
                recordCounts: {
                    strains: Object.keys(window.appState.strainsTable).length,
                    owners: Object.keys(window.appState.ownersTable).length,
                    stages: Object.keys(window.appState.stagesTable).length,
                    locations: window.appState.locationsTable.length,
                    mediaTypes: Object.keys(window.appState.mediaTypesTable).length
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
            
            window.appState.isDataLoaded = true;
            
            // Save to localStorage for future use
            this.saveExcelData(fileName);
            
            console.log('=== EXCEL DATA LOADED ===');
            console.log(`Strains: ${Object.keys(window.appState.strainsTable).length}`);
            console.log(`Owners: ${Object.keys(window.appState.ownersTable).length}`);
            console.log(`Stages: ${Object.keys(window.appState.stagesTable).length}`);
            
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
    }
};
