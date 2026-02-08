/**
 * Cloud HQ Workbook Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to cloud-hq-config.js
 * 2. Replace the placeholder values with your SharePoint/OneDrive workbook details
 * 3. Include cloud-hq-config.js BEFORE main.js in your HTML:
 *    <script src="config/cloud-hq-config.js"></script>
 *    <script src="src/js/main.js"></script>
 * 
 * SECURITY NOTE:
 * - cloud-hq-config.js should be added to .gitignore
 * - Never commit real SharePoint URLs to version control
 * - For production, these values should come from environment variables
 */

window.CLOUD_HQ_CONFIG = {
    // =====================================================================
    // WORKBOOK CONNECTION
    // =====================================================================
    
    /**
     * SharePoint sharing URL for the HQ Excel workbook
     * 
     * How to get this URL:
     * 1. Open the Excel file in SharePoint/OneDrive
     * 2. Click Share → Copy link → "People with existing access"
     * 3. Paste the full URL here
     * 
     * Example format:
     * https://yourtenant-my.sharepoint.com/:x:/r/personal/user_company_com/_layouts/15/Doc.aspx?sourcedoc=...
     */
    shareUrl: 'YOUR_SHAREPOINT_WORKBOOK_SHARE_URL_HERE',
    
    /**
     * Refresh interval in milliseconds
     * Default: 300000 (5 minutes)
     * Set to 0 to disable auto-refresh
     */
    refreshIntervalMs: 300000,
    
    // =====================================================================
    // EXCEL TABLE NAMES
    // These must match the actual Excel Table names in your workbook
    // (Not sheet names - the named Tables defined in Excel)
    // =====================================================================
    
    tables: {
        /**
         * Active Inventory table name
         * Contains all active containers and their metadata
         */
        activeInventory: 'tblActiveInventory',
        
        /**
         * Strain/Owner mapping table (optional)
         * Used for strain-to-owner lookups
         */
        strainMapping: 'tblStrainMapping',
        
        /**
         * Recipes table (optional)
         * Stores media recipes synced from the app
         */
        recipes: 'tblRecipes',
        
        /**
         * Media batches table (optional)
         * Tracks prepared media batches
         */
        batches: 'tblMediaBatches'
    },
    
    // =====================================================================
    // SHEET NAME MAPPINGS
    // Map sheet names in your workbook to their purpose
    // This allows flexibility if your workbook uses different naming
    // =====================================================================
    
    sheets: {
        /**
         * Main inventory sheet containing active containers
         * Default: 'Active_Inventory' or 'Active Inventory'
         */
        activeInventory: 'Active_Inventory',
        
        /**
         * Reference sheets for dropdowns and lookups
         * Prefix 'Ref_' is standard but can be customized
         */
        refStrains: 'Ref_Strains',
        refOwners: 'Ref_Owners',
        refStages: 'Ref_Stages',
        refLocations: 'Ref_Locations',
        refMediaTypes: 'Ref_Media_Types',
        
        /**
         * Optional sheets (set to null if not present)
         */
        strainOwnerMapping: 'Strain_Owner_Mapping',  // or null
        recipes: 'Recipes',  // or null
        mediaBatches: 'MediaBatches'  // or null
    },
    
    // =====================================================================
    // COLUMN MAPPINGS
    // Map your workbook's column names to the app's expected field names
    // This allows flexibility if your columns are named differently
    // =====================================================================
    
    columns: {
        // Active Inventory columns
        activeInventory: {
            containerId: ['Container_ID', 'ContainerID', 'container_id'],
            rawId: ['Raw_ID', 'RawID', 'raw_id'],
            barcodeValue: ['BarcodeValue', 'Barcode_Value', 'barcode'],
            batchId: ['Batch_ID', 'BatchID', 'batch_id'],
            strainId: ['Strain_ID', 'StrainID', 'strain_id'],
            strainName: ['Strain_Name', 'Strain', 'strain_name', 'strain'],
            owner: ['Owner', 'Owner_Name', 'owner_name'],
            stage: ['Stage', 'stage'],
            location: ['Location', 'Room', 'location'],
            media: ['Media', 'Media_Type', 'media_type'],
            quantity: ['Quantity', 'TissueCount', 'Tissue_Count'],
            dateCreated: ['DateCreated', 'Date_Created', 'Date', 'date'],
            status: ['Status', 'status'],
            lineage: ['Lineage', 'Container_Lineage', 'lineage_path'],
            notes: ['Notes', 'Comment', 'comments'],
            qrUrl: ['QR_URL', 'QRContainerID', 'QR_Destination']
        },
        
        // Reference sheet columns
        refStrains: {
            id: ['Strain_ID', 'ID', '#'],
            name: ['Strain_Name', 'Strain', 'Name'],
            abbreviation: ['ABR', 'Abbr', 'Abbreviation', 'Code'],
            ownerCode: ['Owner_Code', 'Owner', 'Owners']
        },
        
        refOwners: {
            id: ['Owner_ID', 'Owner_Code', 'ID', '#'],
            name: ['Owner_Name', 'Owner', 'Name']
        },
        
        refStages: {
            id: ['Stage_ID', 'ID', '#', 'Propogation Stages ID'],
            name: ['Stage_Name', 'Stage', 'Name', 'Propogation Stages']
        },
        
        refLocations: {
            name: ['Location_Name', 'Location', 'Locations', 'Room', 'Area']
        },
        
        refMediaTypes: {
            id: ['Media_ID', 'Media_Code', 'ID', '#'],
            name: ['Media_Name', 'Media_Type', 'Media', 'Type']
        }
    },
    
    // =====================================================================
    // SYNC BEHAVIOR
    // =====================================================================
    
    sync: {
        /**
         * READ-ONLY MODE (STRONGLY RECOMMENDED)
         * When true, blocks ALL write operations to the cloud workbook
         * Set to false ONLY for controlled local export contexts
         */
        readOnlyMode: true,
        
        /**
         * Allow full workbook overwrite via PUT
         * Keep false to protect against accidental data loss
         */
        allowFullOverwrite: false,
        
        /**
         * Auto-sync on authentication
         * When true, automatically syncs when user logs in
         */
        autoSyncOnAuth: true,
        
        /**
         * Show sync notifications
         * Display user notifications on sync success/failure
         */
        showNotifications: true,
        
        /**
         * Cache metadata TTL (milliseconds)
         * How long to cache driveId/itemId before re-resolving
         * Default: 24 hours
         */
        metadataCacheTTL: 24 * 60 * 60 * 1000,
        
        /**
         * Retry failed syncs
         * Number of times to retry a failed sync operation
         */
        maxRetries: 3,
        
        /**
         * Retry delay (milliseconds)
         * Wait time between retry attempts
         */
        retryDelayMs: 5000
    },
    
    // =====================================================================
    // UI CONFIGURATION
    // =====================================================================
    
    ui: {
        /**
         * DOM element IDs for sync status display
         */
        statusElementId: 'cloud-sync-status',
        buttonElementId: 'cloud-sync-btn',
        lastSyncElementId: 'cloud-last-sync',
        connectionIndicatorId: 'cloud-connection-indicator',
        
        /**
         * Status display format
         */
        dateFormat: 'short',  // 'short', 'long', 'iso', 'relative'
        
        /**
         * Show sync errors as notifications
         */
        showErrorNotifications: true
    }
};

// =========================================================================
// VALIDATION HELPER
// Validates configuration on load
// =========================================================================

(function validateCloudConfig() {
    const config = window.CLOUD_HQ_CONFIG;
    const warnings = [];
    
    // Check required fields
    if (!config.shareUrl || config.shareUrl === 'YOUR_SHAREPOINT_WORKBOOK_SHARE_URL_HERE') {
        warnings.push('CLOUD_HQ_CONFIG.shareUrl is not configured');
    }
    
    // Check table names
    if (!config.tables.activeInventory) {
        warnings.push('CLOUD_HQ_CONFIG.tables.activeInventory is required');
    }
    
    // Log warnings
    if (warnings.length > 0) {
        console.warn('Cloud HQ Configuration Warnings:');
        warnings.forEach(w => console.warn('  - ' + w));
    } else if (config.shareUrl !== 'YOUR_SHAREPOINT_WORKBOOK_SHARE_URL_HERE') {
        console.log('Cloud HQ Configuration loaded successfully');
    }
})();
