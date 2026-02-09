/**
 * Intake Data Manager
 * Handles strain_owner_mapping.json operations
 */

window.IntakeDataManager = {
    strainOwnerData: null,
    
    /**
     * Load strain owner mapping data from JSON file
     */
    async loadStrainOwnerMapping() {
        try {
            const response = await fetch('strain_owner_mapping.json');
            if (!response.ok) {
                throw new Error('Failed to load strain owner mapping');
            }
            this.strainOwnerData = await response.json();
            console.log('Strain owner mapping loaded:', this.strainOwnerData);
            return this.strainOwnerData;
        } catch (error) {
            console.error('Error loading strain owner mapping:', error);
            showNotification('Error loading strain data. Using empty dataset.', 'error');
            // Initialize empty structure if file doesn't exist
            this.strainOwnerData = {
                strainOwnerMapping: {},
                strainNameMapping: {},
                ownerCounts: {}
            };
            return this.strainOwnerData;
        }
    },
    
    /**
     * Get unique list of owners
     */
    getUniqueOwners() {
        if (!this.strainOwnerData) return [];
        
        const owners = new Set();
        Object.values(this.strainOwnerData.strainOwnerMapping || {}).forEach(owner => {
            owners.add(owner);
        });
        
        return Array.from(owners).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    },
    
    /**
     * Get next available strain ID
     */
    getNextStrainID() {
        if (!this.strainOwnerData || !this.strainOwnerData.strainOwnerMapping) return '1';
        
        const strainIDs = Object.keys(this.strainOwnerData.strainOwnerMapping).map(id => parseInt(id));
        const maxID = strainIDs.length > 0 ? Math.max(...strainIDs) : 0;
        return String(maxID + 1);
    },
    
    /**
     * Generate owner ID from customer name
     * Creates 3-letter abbreviation or uses existing owner ID
     */
    generateOwnerID(customerName, isExisting = false) {
        if (!customerName) return '';
        
        // If existing customer, return the name as-is
        if (isExisting) {
            return customerName;
        }
        
        // For new customer, create abbreviation
        const cleaned = customerName.trim();
        const words = cleaned.split(/\s+/);
        
        if (words.length === 1) {
            // Single word: take first 3 letters
            return cleaned.substring(0, 3).toLowerCase();
        } else if (words.length === 2) {
            // Two words: first 2 letters of first + first letter of second
            return (words[0].substring(0, 2) + words[1].substring(0, 1)).toLowerCase();
        } else {
            // Three or more words: first letter of each of first 3 words
            return (words[0][0] + words[1][0] + words[2][0]).toLowerCase();
        }
    },
    
    /**
     * Check if owner ID already exists
     */
    ownerIDExists(ownerID) {
        if (!this.strainOwnerData) return false;
        const owners = this.getUniqueOwners();
        return owners.some(owner => owner.toLowerCase() === ownerID.toLowerCase());
    },
    
    /**
     * Add new strain and owner to the mapping
     */
    addStrainOwner(strainID, strainName, ownerID) {
        if (!this.strainOwnerData) {
            this.strainOwnerData = {
                strainOwnerMapping: {},
                strainNameMapping: {},
                ownerCounts: {}
            };
        }
        
        // Ensure sub-objects exist
        if (!this.strainOwnerData.strainOwnerMapping) this.strainOwnerData.strainOwnerMapping = {};
        if (!this.strainOwnerData.strainNameMapping) this.strainOwnerData.strainNameMapping = {};
        if (!this.strainOwnerData.ownerCounts) this.strainOwnerData.ownerCounts = {};
        
        // Add to mappings
        this.strainOwnerData.strainOwnerMapping[strainID] = ownerID;
        this.strainOwnerData.strainNameMapping[strainID] = strainName;
        
        // Update owner counts
        if (!this.strainOwnerData.ownerCounts[ownerID]) {
            this.strainOwnerData.ownerCounts[ownerID] = 0;
        }
        this.strainOwnerData.ownerCounts[ownerID]++;
        
        console.log('Added strain/owner:', { strainID, strainName, ownerID });
    },
    
    /**
     * Export updated strain owner mapping as JSON
     */
    exportAsJSON() {
        const dataStr = JSON.stringify(this.strainOwnerData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `strain_owner_mapping_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    /**
     * Get current data
     */
    getData() {
        return this.strainOwnerData;
    }
};
