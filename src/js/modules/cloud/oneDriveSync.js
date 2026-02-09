/**
 * OneDrive/SharePoint Excel Sync Module
 * Integrates cloud-based Excel files as primary data source for strain-owner mapping
 * Uses Microsoft Graph API via MSAL for authenticated access
 */

window.OneDriveSync = {
    // Configuration
    authManager: null,
    shareUrl: null,
    refreshIntervalMs: 300000, // 5 minutes default
    statusElementId: null,
    buttonElementId: null,
    allowInteractiveAuth: true,
    // Excel table names (configurable via init options)
    inventoryTableName: 'tblActiveInventory',      // Active_Inventory table
    strainMappingTableName: 'tblStrainMapping',    // Reference strain/owner table
    recipeTableName: 'tblRecipes',                 // Media recipes table
    batchTableName: 'tblMediaBatches',             // Media batch tracking table

    // State
    refreshInterval: null,
    isRunning: false,
    lastSync: null,
    lastError: null,
    fromCloud: false,
    // Safety flag: full workbook overwrite via uploadFile is disabled
    // unless this is explicitly set to true in a controlled context.
    allowFullWorkbookOverwrite: false,
    
    // CRITICAL SAFETY: Global read-only mode blocks ALL write operations
    // Set to true by default to protect production cloud workbooks
    // Must be explicitly set to false only in controlled export/test contexts
    readOnlyMode: true,
    hasShownErrorThisSession: false,
    driveId: null,
    itemId: null,

    // Cache keys
    CACHE_KEYS: {
        META: 'cloud:onedrive:meta',
        LAST_SYNC: 'cloud:onedrive:lastSync',
        LAST_ERROR: 'cloud:onedrive:lastError',
        WORKBOOK_ETAG: 'cloud:onedrive:workbookEtag'
    },
    
    // PERF: Request deduplication - track in-flight requests
    _pendingRequests: new Map(),
    
    // PERF: Workbook ETag for conditional requests
    _workbookEtag: null,
    
    // PERF: Minimum sync interval to prevent API hammering (30 seconds)
    _minSyncIntervalMs: 30000,
    _lastSyncAttempt: 0,

    /**
     * Initialize the OneDriveSync module
     * @param {Object} authManager - AuthManager instance
     * @param {Object} options - Configuration options
     */
    init(authManager, options = {}) {
        console.log('Initializing OneDriveSync...');

        this.authManager = authManager;
        this.shareUrl = options.shareUrl || this.shareUrl;
        this.refreshIntervalMs = options.refreshIntervalMs || this.refreshIntervalMs;
        this.statusElementId = options.statusElementId || this.statusElementId;
        this.buttonElementId = options.buttonElementId || this.buttonElementId;
        this.allowInteractiveAuth = options.allowInteractiveAuth !== false;
        if (options.inventoryTableName) {
            this.inventoryTableName = options.inventoryTableName;
        }
        if (options.strainMappingTableName) {
            this.strainMappingTableName = options.strainMappingTableName;
        }
        if (options.recipeTableName) {
            this.recipeTableName = options.recipeTableName;
        }
        if (options.batchTableName) {
            this.batchTableName = options.batchTableName;
        }

        if (!this.shareUrl) {
            console.warn('OneDriveSync: No shareUrl provided. Cloud sync disabled.');
            return;
        }

        // Restore cached metadata
        this.restoreCachedMetadata();

        // Wire up UI if elements are provided
        if (this.buttonElementId) {
            this.wireUpButton();
        }

        if (this.statusElementId) {
            this.updateStatusUI();
        }

        console.log('OneDriveSync initialized successfully');
    },

    /**
     * Restore cached metadata from localStorage
     */
    restoreCachedMetadata() {
        try {
            const metaStr = localStorage.getItem(this.CACHE_KEYS.META);
            if (metaStr) {
                const meta = JSON.parse(metaStr);

                // Check if cache is still valid (TTL: 24 hours)
                const now = Date.now();
                const age = now - (meta.ts || 0);
                const ttl = meta.ttl || 24 * 60 * 60 * 1000; // 24 hours

                if (age < ttl) {
                    this.driveId = meta.driveId;
                    this.itemId = meta.itemId;
                    console.log('OneDriveSync: Restored cached driveId/itemId');
                } else {
                    console.log('OneDriveSync: Cached metadata expired');
                    localStorage.removeItem(this.CACHE_KEYS.META);
                }
            }

            const lastSyncStr = localStorage.getItem(this.CACHE_KEYS.LAST_SYNC);
            if (lastSyncStr) {
                this.lastSync = lastSyncStr;
            }

            const lastErrorStr = localStorage.getItem(this.CACHE_KEYS.LAST_ERROR);
            if (lastErrorStr) {
                this.lastError = lastErrorStr;
            }
        } catch (error) {
            console.warn('Failed to restore cached metadata:', error);
        }
    },

    /**
     * Wire up the sync button
     */
    wireUpButton() {
        const button = document.getElementById(this.buttonElementId);
        if (!button) {
            console.warn(`OneDriveSync: Button element #${this.buttonElementId} not found`);
            return;
        }

        button.addEventListener('click', async () => {
            await this.manualSync();
        });

        console.log('OneDriveSync: Button wired up');
    },

    /**
     * Manually trigger a sync operation
     * @returns {Promise<Object>} Sync result
     */
    async manualSync() {
        // Debounce: prevent concurrent syncs
        if (this.isRunning) {
            console.log('OneDriveSync: Sync already in progress, skipping');
            return { success: false, error: 'Sync already in progress' };
        }

        console.log('OneDriveSync: Starting manual sync...');
        this.isRunning = true;
        this.updateButtonState(true);

        try {
            // Check authentication
            if (!this.authManager || !this.authManager.isSignedIn()) {
                throw new Error('User not authenticated');
            }

            // Resolve driveId/itemId if not cached
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            // Download Excel file
            const arrayBuffer = await this.downloadExcelArrayBuffer(this.driveId, this.itemId);

            // Parse Excel to mapping
            const mapping = await this.parseMappingFromWorkbook(arrayBuffer);

            // Update app state
            this.updateAppState(mapping);

            // Parse dedicated reference sheets (Ref_Strains, Ref_Owners, etc.)
            // Note: Config sheet parsing removed as HQ workbook uses Ref_ sheets instead
            try {
                this.parseReferenceSheets(arrayBuffer);
            } catch (refError) {
                console.warn('OneDriveSync: Could not parse reference sheets:', refError.message);
            }

            // Rebuild InventoryLookupService with updated strain data
            if (window.InventoryLookupService) {
                if (window.InventoryLookupService.isInitialized()) {
                    window.InventoryLookupService.rebuild();
                    console.log('OneDriveSync: InventoryLookupService rebuilt after manual sync');
                } else {
                    window.InventoryLookupService.initialize();
                    console.log('OneDriveSync: InventoryLookupService initialized after manual sync');
                }
            }

            // FIX: Save fresh cloud data to localStorage to persist it across page refreshes
            if (window.DataUtils && typeof window.DataUtils.saveExcelData === 'function') {
                try {
                    window.DataUtils.saveExcelData('Cloud HQ Workbook');
                    console.log('OneDriveSync: Saved fresh cloud reference data to localStorage');
                } catch (saveErr) {
                    console.warn('OneDriveSync: Could not save to localStorage:', saveErr.message);
                }
            }

            // Record success
            this.lastSync = new Date().toISOString();
            this.lastError = null;
            this.fromCloud = true;
            localStorage.setItem(this.CACHE_KEYS.LAST_SYNC, this.lastSync);
            localStorage.removeItem(this.CACHE_KEYS.LAST_ERROR);

            // Show success notification with strain count
            const strainCount = window.appState.strainsTable ? Object.keys(window.appState.strainsTable).length : 0;
            if (window.NotificationSystem) {
                window.NotificationSystem.success(`✅ Synced from cloud successfully - ${strainCount} strains loaded`);
            }

            console.log(`OneDriveSync: Manual sync completed successfully - ${strainCount} strains in strainsTable`);
            return { success: true, source: 'cloud', mapping, strainCount };

        } catch (error) {
            console.error('OneDriveSync: Manual sync failed:', error);

            // Record error
            this.lastError = error.message;
            localStorage.setItem(this.CACHE_KEYS.LAST_ERROR, this.lastError);

            // Show error notification (once per session)
            if (window.NotificationSystem && !this.hasShownErrorThisSession) {
                window.NotificationSystem.warning(`Cloud sync failed: ${error.message}. Using local data.`);
                this.hasShownErrorThisSession = true;
            }

            // Fall back to local data
            await this.loadLocalJsonFallback();

            return { success: false, error: error.message };

        } finally {
            // FIX: Set isRunning to false BEFORE calling updateStatusUI
            // This ensures the status shows "Connected" instead of "Syncing..."
            this.isRunning = false;
            this.updateButtonState(false);
            
            // Update status UI AFTER isRunning is set to false
            this.updateStatusUI();
        }
    },

    /**
     * Start automatic refresh on an interval
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            console.log('OneDriveSync: Auto-refresh already started');
            return;
        }

        console.log(`OneDriveSync: Starting auto-refresh every ${this.refreshIntervalMs / 1000}s`);

        this.refreshInterval = setInterval(async () => {
            // Only sync if authenticated and not already running
            if (this.authManager && this.authManager.isSignedIn() && !this.isRunning) {
                console.log('OneDriveSync: Auto-refresh triggered');
                await this.manualSync();
            }
        }, this.refreshIntervalMs);
    },

    /**
     * Stop automatic refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('OneDriveSync: Auto-refresh stopped');
        }
    },

    /**
     * Get current sync status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            lastSync: this.lastSync,
            lastError: this.lastError,
            isRunning: this.isRunning,
            fromCloud: this.fromCloud
        };
    },

    /**
     * Backwards‑compat helper used by older modules
     * Some callers (e.g. EnhancedDataLayerBridge.startAutoSync) expect
     * OneDriveSync.isAuthenticated() to exist.
     */
    isAuthenticated() {
        try {
            return !!(this.authManager && typeof this.authManager.isSignedIn === 'function' && this.authManager.isSignedIn());
        } catch (e) {
            console.warn('OneDriveSync.isAuthenticated check failed:', e);
            return false;
        }
    },

    /**
     * Acquire access token for Microsoft Graph API
     * @returns {Promise<string>} Access token
     */
    async acquireToken() {
        if (!this.authManager) {
            throw new Error('AuthManager not initialized');
        }

        // Prefer AuthManager.getAccessToken so we reuse the active account and scopes
        if (typeof this.authManager.getAccessToken === 'function') {
            try {
                const token = await this.authManager.getAccessToken();
                if (token) {
                    return token;
                }
            } catch (error) {
                console.warn('AuthManager.getAccessToken failed, falling back to direct MSAL token acquisition:', error);
            }
        }

        try {
            // Fallback: try silent token acquisition using MSAL directly
            const tokenResponse = await this.authManager.msalInstance.acquireTokenSilent({
                scopes: this.authManager.loginRequest.scopes,
                account: this.authManager.currentUser || (this.authManager.msalInstance.getAllAccounts()[0] || undefined)
            });
            return tokenResponse.accessToken;

        } catch (error) {
            console.warn('Silent token acquisition failed in OneDriveSync.acquireToken:', error);

            // Fall back to interactive popup if allowed
            if (this.allowInteractiveAuth) {
                try {
                    const tokenResponse = await this.authManager.msalInstance.acquireTokenPopup({
                        scopes: this.authManager.loginRequest.scopes,
                        account: this.authManager.currentUser || (this.authManager.msalInstance.getAllAccounts()[0] || undefined)
                    });
                    return tokenResponse.accessToken;
                } catch (interactiveError) {
                    console.error('Interactive token acquisition failed in OneDriveSync.acquireToken:', interactiveError);
                    throw new Error('Failed to acquire access token');
                }
            } else {
                throw new Error('Silent token acquisition failed and interactive auth is disabled');
            }
        }
    },

    /**
     * Resolve driveId and itemId from SharePoint sharing URL
     * @param {string} shareUrl - SharePoint sharing URL
     * @returns {Promise<void>}
     */
    async resolveDriveItemFromShareUrl(shareUrl) {
        console.log('OneDriveSync: Resolving driveId/itemId from share URL...');

        const token = await this.acquireToken();

        // Encode the sharing URL for the Graph API
        // Use base64url encoding (remove padding, replace +/ with -_)
        const encodedUrl = btoa(shareUrl)
            .replace(/=/g, '')
            .replace(/\//g, '_')
            .replace(/\+/g, '-');

        const graphUrl = `https://graph.microsoft.com/v1.0/shares/u!${encodedUrl}/driveItem`;

        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to resolve share URL: ${response.status} ${errorText}`);
        }

        const driveItem = await response.json();

        this.driveId = driveItem.parentReference.driveId;
        this.itemId = driveItem.id;

        // Cache the metadata with TTL
        const metadata = {
            driveId: this.driveId,
            itemId: this.itemId,
            ts: Date.now(),
            ttl: 24 * 60 * 60 * 1000 // 24 hours
        };
        localStorage.setItem(this.CACHE_KEYS.META, JSON.stringify(metadata));

        console.log(`OneDriveSync: Resolved driveId=${this.driveId}, itemId=${this.itemId}`);
    },

    /**
     * Download Excel file from OneDrive/SharePoint
     * @param {string} driveId - Drive ID
     * @param {string} itemId - Item ID
     * @returns {Promise<ArrayBuffer>} Excel file as ArrayBuffer
     */
    async downloadExcelArrayBuffer(driveId, itemId) {
        console.log('OneDriveSync: Downloading Excel file...');

        const token = await this.acquireToken();
        const graphUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;

        // FIX: Add cache: 'no-store' to ensure fresh data from cloud, not browser cache
        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to download Excel file: ${response.status} ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`OneDriveSync: Downloaded ${arrayBuffer.byteLength} bytes`);

        return arrayBuffer;
    },

    /**
     * Parse Excel workbook to strain-owner mapping
     * NOTE: This currently expects either a dedicated strain_owner_mapping sheet
     * or falls back to the first sheet. It is separate from Active_Inventory parsing.
     * @param {ArrayBuffer} arrayBuffer - Excel file data
     * @returns {Promise<Object>} Strain-owner mapping
     */
    async parseMappingFromWorkbook(arrayBuffer) {
        console.log('OneDriveSync: Parsing Excel workbook for strain-owner mapping...');

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        // Read workbook
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });

        // Find target sheet - look for strain_owner_mapping or similar sheets
        // Do NOT fall back to first sheet as it may have incompatible structure
        const sheetNameOptions = ['strain_owner_mapping', 'strains', 'strain_mapping'];
        let targetSheetName = workbook.SheetNames.find(name =>
            sheetNameOptions.includes(name.toLowerCase())
        );

        if (!targetSheetName) {
            console.log('OneDriveSync: No strain_owner_mapping sheet found. Available sheets:', workbook.SheetNames);
            console.log('OneDriveSync: Skipping strain-owner mapping parsing (will rely on Ref_Strains sheet instead)');
            return {}; // Return empty mapping instead of using incompatible first sheet
        }

        console.log(`OneDriveSync: Using sheet "${targetSheetName}" for strain-owner mapping`);

        const sheet = workbook.Sheets[targetSheetName];
        if (!sheet) {
            throw new Error(`Sheet "${targetSheetName}" not found in workbook`);
        }

        // Convert sheet to JSON
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            throw new Error('Excel sheet is empty');
        }

        // Parse rows into mapping object
        const mapping = {};
        const headerSynonyms = {
            strain: ['strain', 'strain_id', 'strainid', 'strain id', 'id'],
            owner: ['owner', 'owner_name', 'ownername', 'owner name', 'owner email', 'email', 'owner_code']
        };

        // Log available columns for debugging
        if (rows.length > 0) {
            console.log('OneDriveSync: Available columns in sheet:', Object.keys(rows[0]));
        }

        let foundValidRow = false;
        rows.forEach((row, index) => {
            // Find strain value using synonyms (case-insensitive)
            let strainValue = null;
            for (const key of Object.keys(row)) {
                const normalizedKey = key.toLowerCase().trim();
                if (headerSynonyms.strain.includes(normalizedKey)) {
                    strainValue = row[key];
                    break;
                }
            }

            // Find owner value using synonyms (case-insensitive)
            let ownerValue = null;
            for (const key of Object.keys(row)) {
                const normalizedKey = key.toLowerCase().trim();
                if (headerSynonyms.owner.includes(normalizedKey)) {
                    ownerValue = row[key];
                    break;
                }
            }

            // Validate and add to mapping
            if (strainValue && ownerValue) {
                const strain = String(strainValue).trim();
                const owner = String(ownerValue).trim();

                if (strain && owner) {
                    mapping[strain] = owner;
                    foundValidRow = true;
                }
            }
            // Skip rows without both columns - don't throw error
        });

        if (!foundValidRow && rows.length > 0) {
            console.warn('OneDriveSync: No valid strain-owner mappings found in sheet. Expected columns: strain/strain_id AND owner/owner_name');
            console.warn('OneDriveSync: Found columns:', Object.keys(rows[0]));
        }

        console.log(`OneDriveSync: Parsed ${Object.keys(mapping).length} strain-owner mappings`);

        return mapping;
    },

    /**
     * Parse Active_Inventory sheet into app inventory objects
     * Treats the HQ workbook as source of truth for active inventory.
     * @param {ArrayBuffer} arrayBuffer - Excel file data
     * @returns {Array<Object>} Inventory entries
     */
    parseActiveInventoryFromWorkbook(arrayBuffer) {
        console.log('OneDriveSync: Parsing Active_Inventory sheet...');

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        // FIX: Add cellDates: true to properly parse Excel dates instead of serial numbers
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });

        // Locate Active_Inventory sheet (case-insensitive)
        // Accept both "Active_Inventory" and "Active Inventory" to match common naming patterns
        const preferredSheetNames = ['active_inventory', 'active inventory'];
        let targetSheetName = workbook.SheetNames.find(name =>
            preferredSheetNames.includes(name.toLowerCase())
        );

        if (!targetSheetName) {
            throw new Error('Active_Inventory sheet not found in workbook');
        }

        const sheet = workbook.Sheets[targetSheetName];
        if (!sheet) {
            throw new Error(`Sheet "${targetSheetName}" not found in workbook`);
        }

        // Use header:1 to get an array-of-arrays so we can handle templates
        // where the first row is a title and the second row contains actual headers.
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        if (!aoa.length) {
            console.warn('OneDriveSync: Active_Inventory sheet is empty');
            return [];
        }

        // Find the header row by looking for a cell that equals "Container_ID" (case-insensitive)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(aoa.length, 10); i++) {
            const rowArr = aoa[i];
            if (!Array.isArray(rowArr)) continue;
            const hasContainerId = rowArr.some(cell =>
                cell && String(cell).toLowerCase().trim() === 'container_id'
            );
            if (hasContainerId) {
                headerRowIndex = i;
                break;
            }
        }

        const headerRow = aoa[headerRowIndex] || [];
        const dataRows = aoa.slice(headerRowIndex + 1);

        if (!dataRows.length) {
            console.warn('OneDriveSync: Active_Inventory has header row but no data rows');
            return [];
        }

        // Build row objects keyed by the header row values
        const rows = dataRows.map(rowArr => {
            const obj = {};
            headerRow.forEach((headerCell, colIdx) => {
                if (!headerCell) return;
                const key = String(headerCell).trim();
                if (!key) return;
                obj[key] = rowArr[colIdx];
            });
            return obj;
        }).filter(row => Object.keys(row).length > 0);

        // Debug: log the header row and keys from the first data row
        try {
            console.log('OneDriveSync: Active_Inventory header row values:', headerRow);
            const sampleKeys = Object.keys(rows[0] || {});
            console.log('OneDriveSync: Active_Inventory sample data keys:', sampleKeys);
        } catch (e) {
            console.warn('OneDriveSync: Unable to log Active_Inventory debug info:', e);
        }

        // Normalize header keys and map to app inventory objects
        const inventory = [];

        // FIX: Enhanced getField that strips XLSX's _1, _2 suffix for duplicate columns
        const getField = (row, candidates) => {
            for (const key of Object.keys(row)) {
                // Normalize: lowercase, trim, and strip _N suffix from duplicate columns
                let normalizedKey = key.toLowerCase().trim();
                // Strip trailing _1, _2, etc. (XLSX adds these for duplicate column names)
                normalizedKey = normalizedKey.replace(/_\d+$/, '');
                if (candidates.includes(normalizedKey)) {
                    return row[key];
                }
            }
            return undefined;
        };

        rows.forEach(row => {
            // Prefer explicit Container_ID / Raw_ID / BarcodeValue if present
            const containerIdValue = getField(row, ['container_id', 'containerid', 'container id']);
            const rawIdValue = getField(row, ['raw_id', 'rawid', 'raw id']);
            const barcodeValue = getField(row, ['barcodevalue', 'barcode_value', 'barcode value']);
            const batchIdValue = getField(row, ['batch_id', 'batchid', 'batch id']);
            const qrUrlValue = getField(row, [
                'qr_url', 'qr link', 'qr', 'qr_destination',
                'qr code url', 'qr code link', 'qr_url_link',
                // HQ Workbook: QRContainerID column should be treated as the QR destination URL
                'qrcontainerid', 'qr_container_id', 'qr container id'
            ]);

            let prefix = null;
            let rawIdNumeric = null;

            // If Container_ID exists, prefer it first. It may be a pure number or a code like "LWG120021".
            if (containerIdValue !== undefined && containerIdValue !== null && containerIdValue !== '') {
                const asString = String(containerIdValue).trim();
                let num = parseInt(asString, 10);
                if (!isNaN(num)) {
                    rawIdNumeric = num;
                } else {
                    const parsedFromContainer = this.parseBatchId(asString);
                    if (parsedFromContainer) {
                        prefix = parsedFromContainer.prefix;
                        rawIdNumeric = parsedFromContainer.rawIdNumeric;
                    }
                }
            }

            // If Raw_ID exists, prefer it (after Container_ID)
            if (!rawIdNumeric && rawIdValue !== undefined && rawIdValue !== null && rawIdValue !== '') {
                const num = parseInt(rawIdValue, 10);
                if (!isNaN(num)) {
                    rawIdNumeric = num;
                }
            }

            // Fallback: try to parse from BarcodeValue if numeric
            if (!rawIdNumeric && barcodeValue) {
                const num = parseInt(barcodeValue, 10);
                if (!isNaN(num)) {
                    rawIdNumeric = num;
                }
            }

            // Last resort: try to parse from Batch_ID if needed
            if (!rawIdNumeric && batchIdValue) {
                const parsed = this.parseBatchId(String(batchIdValue));
                if (parsed) {
                    prefix = parsed.prefix;
                    rawIdNumeric = parsed.rawIdNumeric;
                }
            }

            if (!rawIdNumeric) {
                // If we can't derive a numeric ID, skip this row to avoid corrupt state
                console.warn('OneDriveSync: Skipping row with no numeric Container_ID / Raw_ID / BarcodeValue / Batch_ID:', row);
                return;
            }

            const containerId = String(rawIdNumeric).padStart(6, '0');

            // Extract strain ID and name separately (HQ workbook may have both columns)
            // Include common variations with underscores, spaces, and different capitalizations
            const strainIdValue = getField(row, ['strain_id', 'strainid', 'strain id', 'strain-id']);
            const strainNameValue = getField(row, ['strain_name', 'strain name', 'strainname', 'strain']);
            // Use strain name if available, otherwise fall back to strain ID
            const strainName = strainNameValue || strainIdValue;

            // DEBUG: Log first few rows to see strain data extraction
            if (inventory.length < 3) {
                console.log(`OneDriveSync: Row ${inventory.length} strain debug:`, {
                    rawRowKeys: Object.keys(row),
                    strainIdValue,
                    strainNameValue,
                    resolvedStrainName: strainName,
                    rawRow: row
                });
            }
            const ownerName = getField(row, ['owner', 'owner_name', 'owner name']);
            const stage = getField(row, ['stage']);
            const location = getField(row, ['location', 'room', 'rack']);
            const media = getField(row, ['media', 'media_type', 'media type']);
            const quantity = getField(row, ['quantity', 'tissuecount', 'tissue_count', 'tissue count']);
            const dateCreated = getField(row, ['datecreated', 'date_created', 'date created', 'date']);
            const notes = getField(row, ['notes', 'comment', 'comments']);
            const lineage = getField(row, ['lineage', 'container_lineage', 'lineage_path', 'parent_lineage']);
            const statusField = getField(row, ['status']);

            // FIX: Don't skip rows that have valid Container_ID - they may be legitimate entries
            // Only skip if the row is COMPLETELY empty (no data at all beyond the ID)
            const hasAnyData = strainName || ownerName || stage || media || dateCreated || quantity || location || notes;
            // Changed: Only skip if truly empty AND has a QR URL (indicating pre-populated template row)
            const isPrepopulatedTemplateRow = !hasAnyData && qrUrlValue && !strainName && !ownerName;
            if (isPrepopulatedTemplateRow) {
                console.log(`OneDriveSync: Skipping pre-populated template row (Container_ID: ${containerId}) - has QR URL but no metadata`);
                return;
            }

            // FIX: Properly format date - XLSX with cellDates:true returns Date objects
            let formattedDate = '';
            if (dateCreated) {
                if (dateCreated instanceof Date) {
                    // Format as ISO string or MM/DD/YYYY
                    formattedDate = dateCreated.toLocaleDateString('en-US');
                } else if (typeof dateCreated === 'number') {
                    // Excel serial date number - convert to Date
                    const excelEpoch = new Date(1899, 11, 30);
                    const jsDate = new Date(excelEpoch.getTime() + dateCreated * 86400000);
                    formattedDate = jsDate.toLocaleDateString('en-US');
                } else {
                    formattedDate = String(dateCreated);
                }
            }

            const invEntry = {
                containerId: containerId,
                strain: strainName || '',
                strainId: strainIdValue ? String(strainIdValue).trim() : null,
                owner: ownerName || '',
                stage: stage || '',
                media: media || '',
                tissueCount: quantity ? parseInt(quantity, 10) || 1 : 1,
                date: formattedDate,
                status: statusField || 'Active',
                location: location || '',
                containerLineage: lineage || ''
            };

            // Generate barcode from container ID so it displays in the UI
            if (barcodeValue) {
                invEntry.barcode = String(barcodeValue);
                invEntry.sampleBarcode = String(barcodeValue);
            } else {
                // Use container ID as the barcode value
                invEntry.barcode = String(containerId);
                invEntry.sampleBarcode = String(containerId);
            }

            // Preserve Batch_ID and prefix as optional metadata
            if (batchIdValue) {
                invEntry.batchId = String(batchIdValue);
            }
            if (prefix) {
                invEntry.containerPrefix = prefix;
            }

            // If the workbook has an explicit QR URL column, treat that as source of truth
            if (qrUrlValue) {
                invEntry.qrDestinationUrl = String(qrUrlValue);
            }

            inventory.push(invEntry);
        });

        console.log(`OneDriveSync: Parsed ${inventory.length} inventory rows from Active_Inventory`);
        return inventory;
    },

    /**
     * Parse dedicated reference sheets (Strains, Owners, Stages, Media_Types) if they exist
     * NOTE: Config sheet parsing was removed - HQ workbooks use Ref_ sheets exclusively
     * @param {ArrayBuffer} arrayBuffer - Excel file data
     */
    parseReferenceSheets(arrayBuffer) {
        console.log('OneDriveSync: Looking for dedicated reference sheets...');

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });

        // Log all available sheet names for debugging
        console.log('OneDriveSync: Available sheets in workbook:', workbook.SheetNames);

        // Ensure appState exists
        if (!window.appState) {
            window.appState = {};
        }

        // FIX: Check if we have Ref_ sheets - if so, these are the source of truth
        // and we should CLEAR existing tables to rebuild fresh from cloud
        const hasRefStrains = workbook.SheetNames.some(n => n.toLowerCase().trim() === 'ref_strains');
        const hasRefOwners = workbook.SheetNames.some(n => n.toLowerCase().trim() === 'ref_owners');
        const hasRefStages = workbook.SheetNames.some(n => n.toLowerCase().trim() === 'ref_stages');

        console.log('OneDriveSync: Ref_ sheet detection:', { hasRefStrains, hasRefOwners, hasRefStages });

        // FIX: ALWAYS clear tables when syncing from cloud to ensure fresh data
        // This prevents stale localStorage data from persisting
        console.log('OneDriveSync: Clearing ALL cached reference tables for fresh cloud sync');
        console.log('  Previous counts - strains:', Object.keys(window.appState.strainsTable || {}).length,
                    'owners:', Object.keys(window.appState.ownersTable || {}).length,
                    'stages:', Object.keys(window.appState.stagesTable || {}).length);

        // ALWAYS start fresh when parsing from cloud
        const strainsTable = {};

        // FIX: Enhanced getField that strips XLSX's _1, _2 suffix for duplicate columns
        const getField = (row, candidates) => {
            for (const key of Object.keys(row)) {
                // Normalize: lowercase, trim, and strip _N suffix from duplicate columns
                let normalizedKey = key.toLowerCase().trim();
                // Strip trailing _1, _2, etc. (XLSX adds these for duplicate column names)
                normalizedKey = normalizedKey.replace(/_\d+$/, '');
                if (candidates.includes(normalizedKey)) {
                    return row[key];
                }
            }
            return undefined;
        };

        // Try to find and parse a Strains reference sheet (expanded matching)
        // Added 'ref_strains' for HQ workbook format
        const strainsSheetNames = ['strains', 'strain', 'strain_reference', 'strains_ref', 'strain_list', 'varieties', 'cultivars', 'genetics', 'ref_strains'];
        const strainsSheetName = workbook.SheetNames.find(name =>
            strainsSheetNames.includes(name.toLowerCase()) ||
            name.toLowerCase().includes('strain') ||
            name.toLowerCase().includes('variet')
        );

        if (strainsSheetName) {
            console.log(`OneDriveSync: Found Strains reference sheet: ${strainsSheetName}`);
            const sheet = workbook.Sheets[strainsSheetName];

            // HQ workbook Ref_ sheets have a title row (e.g., "STRAIN REFERENCE") in row 0
            // followed by column headers in row 1. We need to skip the title row.
            const isRefSheet = strainsSheetName.toLowerCase().startsWith('ref_');
            let rows;
            
            // FIX: Log the sheet range to debug strain loading issues
            const sheetRef = sheet['!ref'] || 'A1';
            console.log(`OneDriveSync: Strains sheet reference range: ${sheetRef}`);
            
            if (isRefSheet) {
                // Get the sheet range and skip the first row (title row)
                const range = XLSX.utils.decode_range(sheetRef);
                console.log(`OneDriveSync: Decoded range - Start row: ${range.s.r}, End row: ${range.e.r}, Columns: ${range.s.c}-${range.e.c}`);
                
                range.s.r = 1; // Start from row 1 (0-indexed), skipping title row
                const newRange = XLSX.utils.encode_range(range);
                console.log(`OneDriveSync: Adjusted range for Ref_ sheet: ${newRange}`);
                
                // FIX: Use defval to handle empty cells and ensure all rows are captured
                rows = XLSX.utils.sheet_to_json(sheet, { range: newRange, defval: '' });
                console.log(`OneDriveSync: Ref_ sheet detected, skipped title row. Parsing from row 2.`);
            } else {
                // FIX: Use defval to handle empty cells
                rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            }

            console.log(`OneDriveSync: ========================================`);
            console.log(`OneDriveSync: STRAIN LOADING SUMMARY`);
            console.log(`OneDriveSync: Total rows parsed from Strains sheet: ${rows.length}`);
            console.log(`OneDriveSync: ========================================`);
            console.log('OneDriveSync: Strains sheet sample row:', rows[0]);

            // Initialize strain abbreviations table if not exists
            if (!window.appState.strainAbbreviations) {
                window.appState.strainAbbreviations = {};
            }

            // Initialize strain-owner mappings (strain ID → array of owner codes)
            if (!window.appState.strainOwners) {
                window.appState.strainOwners = {};
            }
            // Clear existing strain-owner mappings for fresh cloud sync
            window.appState.strainOwners = {};

            // Log the first row's column names to help debug
            if (rows.length > 0) {
                console.log('OneDriveSync: Ref_Strains column names:', Object.keys(rows[0]));
            }

            let count = 0;
            let skippedCount = 0;
            let ownerMappingsCount = 0;
            
            // FIX: Log all column names from the first row for debugging
            if (rows.length > 0) {
                const allColumns = Object.keys(rows[0]);
                console.log(`OneDriveSync: All column names in Strains sheet: ${JSON.stringify(allColumns)}`);
            }
            
            rows.forEach((row, rowIndex) => {
                // Expanded column matching for strain ID, name, abbreviation, and owner
                const id = getField(row, ['strain_id', 'strainid', 'strain id', 'id', 'strain-id', 'variety_id', 'varietyid', 'cultivar_id', 'genetic_id', '#', 'no', 'number']);
                const name = getField(row, ['strain_name', 'strain name', 'strainname', 'strain', 'name', 'variety', 'cultivar', 'genetic', 'variety_name', 'cultivar_name']);
                const abbreviation = getField(row, ['abr', 'abbr', 'abbreviation', 'code', 'short_name', 'shortname', 'short']);
                // Expanded owner column matching - include variations with spaces, underscores, and different cases
                const ownerCode = getField(row, ['owner_code', 'ownercode', 'owner code', 'owner', 'owner_id', 'ownerid', 'owner id', 'owners', 'owned_by', 'ownedby']);

                // FIX: Handle numeric IDs including 0
                const hasValidId = id !== undefined && id !== null && String(id).trim() !== '';
                
                if (hasValidId) {
                    const strainId = String(id).trim();
                    const strainName = name ? String(name).trim() : strainId;
                    const strainAbbr = abbreviation ? String(abbreviation).trim() : null;

                    if (!strainsTable[strainId]) {
                        strainsTable[strainId] = strainName;
                        count++;
                        // Log every 10th strain to avoid flooding console, but log first 5 for debugging
                        if (count <= 5 || count % 10 === 0) {
                            console.log(`OneDriveSync: Added strain #${count}: ID=${strainId}, Name="${strainName}", ABR=${strainAbbr || 'none'}`);
                        }
                    }

                    // Store abbreviation separately for InventoryLookupService
                    if (strainAbbr) {
                        window.appState.strainAbbreviations[strainId] = strainAbbr;
                    }

                    // Store strain-owner mapping (handles comma-separated owners)
                    if (ownerCode !== undefined && ownerCode !== null && ownerCode !== '') {
                        const ownerStr = String(ownerCode).trim();
                        // Split by comma to handle multiple owners (e.g., "LW, JR")
                        const owners = ownerStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
                        window.appState.strainOwners[strainId] = owners;
                        ownerMappingsCount++;
                    }
                } else {
                    // Log skipped rows to help debug missing strains
                    skippedCount++;
                    if (skippedCount <= 5) {
                        console.log(`OneDriveSync: Skipped row ${rowIndex + 1} - no valid ID. Row data:`, JSON.stringify(row).substring(0, 200));
                    }
                }
            });

            console.log(`OneDriveSync: ========================================`);
            console.log(`OneDriveSync: STRAIN LOADING RESULTS`);
            console.log(`OneDriveSync: Total rows in sheet: ${rows.length}`);
            console.log(`OneDriveSync: Strains added: ${count}`);
            console.log(`OneDriveSync: Rows skipped (no ID): ${skippedCount}`);
            console.log(`OneDriveSync: Strain abbreviations: ${Object.keys(window.appState.strainAbbreviations).length}`);
            console.log(`OneDriveSync: Strain-owner mappings: ${ownerMappingsCount}`);
            console.log(`OneDriveSync: ========================================`);

            // Log sample of strain-owner mappings for debugging
            const sampleMappings = Object.entries(window.appState.strainOwners).slice(0, 5);
            if (sampleMappings.length > 0) {
                console.log('OneDriveSync: Sample strain-owner mappings:', sampleMappings);
            } else {
                console.warn('OneDriveSync: WARNING - No strain-owner mappings found! Check if Owner column exists in Ref_Strains');
            }
        } else {
            console.log('OneDriveSync: No dedicated Strains reference sheet found');
        }

        // Parse Ref_Owners sheet
        // FIX: ALWAYS clear table when syncing from cloud
        const ownersTable = {};
        const ownersSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'ref_owners' ||
            name.toLowerCase() === 'owners' ||
            name.toLowerCase().includes('owner')
        );

        if (ownersSheetName) {
            console.log(`OneDriveSync: Found Owners reference sheet: ${ownersSheetName}`);
            const sheet = workbook.Sheets[ownersSheetName];
            const isRefSheet = ownersSheetName.toLowerCase().startsWith('ref_');
            let rows;
            if (isRefSheet) {
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
                range.s.r = 1;
                const newRange = XLSX.utils.encode_range(range);
                rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
            } else {
                rows = XLSX.utils.sheet_to_json(sheet);
            }

            let count = 0;
            rows.forEach(row => {
                const id = getField(row, ['owner_id', 'ownerid', 'owner id', 'owner_code', 'ownercode', 'owner code', 'id', 'owner-id', '#']);
                const name = getField(row, ['owner_name', 'owner name', 'ownername', 'owner', 'name']);

                if (id !== undefined && id !== null && id !== '') {
                    const ownerId = String(id).trim();
                    const ownerName = name ? String(name).trim() : ownerId;
                    if (!ownersTable[ownerId]) {
                        ownersTable[ownerId] = ownerName;
                        count++;
                    }
                }
            });
            console.log(`OneDriveSync: Added ${count} owners from ${ownersSheetName} sheet`);
        }
        window.appState.ownersTable = ownersTable;

        // Parse Ref_Stages sheet
        // FIX: ALWAYS clear table when syncing from cloud
        const stagesTable = {};
        const stagesSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'ref_stages' ||
            name.toLowerCase() === 'stages' ||
            name.toLowerCase().includes('stage')
        );

        if (stagesSheetName) {
            console.log(`OneDriveSync: Found Stages reference sheet: ${stagesSheetName}`);
            const sheet = workbook.Sheets[stagesSheetName];
            const isRefSheet = stagesSheetName.toLowerCase().startsWith('ref_');
            let rows;
            if (isRefSheet) {
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
                range.s.r = 1;
                const newRange = XLSX.utils.encode_range(range);
                rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
            } else {
                rows = XLSX.utils.sheet_to_json(sheet);
            }

            let count = 0;
            rows.forEach(row => {
                // FIX: Add 'propogation stages id' (common misspelling in HQ workbooks)
                const id = getField(row, [
                    'stage_id', 'stageid', 'stage id', 'id', 'stage-id', '#', 'code',
                    'propogation stages id', 'propagation stages id',
                    'propogation_stages_id', 'propagation_stages_id'
                ]);
                // FIX: Add 'propogation stages' (common misspelling in HQ workbooks)
                const name = getField(row, [
                    'stage_name', 'stage name', 'stagename', 'stage', 'name', 'description',
                    'propogation stages', 'propagation stages',
                    'propogation_stages', 'propagation_stages'
                ]);

                if (id !== undefined && id !== null && id !== '') {
                    const stageId = String(id).trim();
                    const stageName = name ? String(name).trim() : stageId;
                    if (!stagesTable[stageId]) {
                        stagesTable[stageId] = stageName;
                        count++;
                    }
                }
            });
            console.log(`OneDriveSync: Added ${count} stages from ${stagesSheetName} sheet`);
        }
        window.appState.stagesTable = stagesTable;

        // Parse Ref_Locations sheet
        // FIX: ALWAYS clear table when syncing from cloud
        const locationsTable = [];
        const locationsSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'ref_locations' ||
            name.toLowerCase() === 'locations' ||
            name.toLowerCase().includes('location')
        );

        if (locationsSheetName) {
            console.log(`OneDriveSync: Found Locations reference sheet: ${locationsSheetName}`);
            const sheet = workbook.Sheets[locationsSheetName];
            const isRefSheet = locationsSheetName.toLowerCase().startsWith('ref_');
            let rows;
            if (isRefSheet) {
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
                range.s.r = 1;
                const newRange = XLSX.utils.encode_range(range);
                rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
            } else {
                rows = XLSX.utils.sheet_to_json(sheet);
            }

            rows.forEach(row => {
                // FIX: Add 'locations' pattern for HQ workbooks (some have just "Locations" as header)
                const name = getField(row, [
                    'location_name', 'location name', 'locationname', 'location', 
                    'locations', 'name', 'room', 'area', 'rack', 'shelf'
                ]);
                if (name && !locationsTable.includes(String(name).trim())) {
                    locationsTable.push(String(name).trim());
                }
            });
            console.log(`OneDriveSync: Added locations from ${locationsSheetName} sheet. Total: ${locationsTable.length}`);
        }
        window.appState.locationsTable = locationsTable;

        // Parse Ref_Media_Types sheet
        // FIX: ALWAYS clear table when syncing from cloud
        const mediaTypesTable = {};
        const mediaSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'ref_media_types' ||
            name.toLowerCase() === 'media_types' ||
            name.toLowerCase() === 'mediatypes' ||
            name.toLowerCase().includes('media')
        );

        if (mediaSheetName) {
            console.log(`OneDriveSync: Found Media Types reference sheet: ${mediaSheetName}`);
            const sheet = workbook.Sheets[mediaSheetName];
            const isRefSheet = mediaSheetName.toLowerCase().startsWith('ref_');
            let rows;
            if (isRefSheet) {
                const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
                range.s.r = 1;
                const newRange = XLSX.utils.encode_range(range);
                rows = XLSX.utils.sheet_to_json(sheet, { range: newRange });
            } else {
                rows = XLSX.utils.sheet_to_json(sheet);
            }

            let count = 0;
            rows.forEach(row => {
                // FIX: Add 'media id', 'media_id' patterns for HQ workbooks
                const code = getField(row, [
                    'media_code', 'mediacode', 'media code', 'code', 
                    'media_id', 'mediaid', 'media id',
                    'type_id', 'typeid', 'id', '#'
                ]);
                // FIX: Add 'media type', 'media_type' patterns
                const name = getField(row, [
                    'media_name', 'media name', 'medianame', 'media', 
                    'media_type', 'mediatype', 'media type',
                    'name', 'type', 'description'
                ]);

                if (code !== undefined && code !== null && code !== '') {
                    const mediaCode = String(code).trim();
                    const mediaName = name ? String(name).trim() : mediaCode;
                    if (!mediaTypesTable[mediaCode]) {
                        mediaTypesTable[mediaCode] = mediaName;
                        count++;
                    }
                }
            });
            console.log(`OneDriveSync: Added ${count} media types from ${mediaSheetName} sheet`);
        }
        window.appState.mediaTypesTable = mediaTypesTable;

        // Update appState
        window.appState.strainsTable = strainsTable;
        window.appState.isDataLoaded = true;

        console.log(`OneDriveSync: ==========================================`);
        console.log(`OneDriveSync: REFERENCE DATA SYNC COMPLETE`);
        console.log(`OneDriveSync: ==========================================`);
        console.log(`OneDriveSync: Strains loaded: ${Object.keys(strainsTable).length}`);
        console.log(`OneDriveSync: Owners loaded: ${Object.keys(ownersTable).length}`);
        console.log(`OneDriveSync: Stages loaded: ${Object.keys(stagesTable).length}`);
        console.log(`OneDriveSync: Locations loaded: ${locationsTable.length}`);
        console.log(`OneDriveSync: Media Types loaded: ${Object.keys(mediaTypesTable).length}`);
        if (window.appState.strainOwners) {
            console.log(`OneDriveSync: Strain-Owner mappings: ${Object.keys(window.appState.strainOwners).length}`);
        }
        console.log(`OneDriveSync: ==========================================`);

        // Dispatch event to notify listeners that reference data has been updated
        const event = new CustomEvent('referenceData:updated', {
            detail: {
                source: 'cloud',
                ts: Date.now(),
                counts: {
                    strains: Object.keys(strainsTable).length,
                    owners: Object.keys(ownersTable).length,
                    stages: Object.keys(stagesTable).length,
                    locations: locationsTable.length,
                    mediaTypes: Object.keys(mediaTypesTable).length
                }
            }
        });
        window.dispatchEvent(event);
        console.log('OneDriveSync: Dispatched referenceData:updated event');
    },

    /**
     * Extract unique strains from inventory data and populate window.appState.strainsTable
     * This allows InventoryLookupService to resolve strains by ID or name
     * @param {Array<Object>} inventory - Parsed inventory entries
     */
    populateStrainsTableFromInventory(inventory) {
        console.log('=== populateStrainsTableFromInventory DEBUG ===');
        console.log('Inventory array length:', inventory?.length);

        if (!inventory || !Array.isArray(inventory)) {
            console.warn('OneDriveSync: No inventory data to extract strains from');
            return;
        }

        // DEBUG: Log sample inventory items to see strain data structure
        console.log('Sample inventory items (first 5):');
        inventory.slice(0, 5).forEach((item, idx) => {
            console.log(`  Item ${idx}:`, {
                strain: item.strain,
                strainId: item.strainId,
                containerId: item.containerId
            });
        });

        // Ensure appState exists
        if (!window.appState) {
            window.appState = {};
        }

        // Add to existing strainsTable (Ref_ sheets are parsed first via parseReferenceSheets)
        // This adds any strains found in inventory that weren't in the Ref_Strains sheet
        const strainsTable = window.appState.strainsTable || {};
        console.log('Adding to strainsTable - current count:', Object.keys(strainsTable).length);
        let newStrainsCount = 0;

        // Also build strain-owner mappings from inventory data
        // This is the primary source since Ref_Strains may not have owner info
        if (!window.appState.strainOwners) {
            window.appState.strainOwners = {};
        }
        const strainOwners = window.appState.strainOwners;
        let strainOwnerMappingsCount = 0;

        inventory.forEach(item => {
            // Get strain name (required)
            const strainValue = item.strain ? String(item.strain).trim() : '';
            if (!strainValue) return;

            let strainId = null;
            let strainName = strainValue;

            // Priority 1: Use explicit strainId field if available
            if (item.strainId) {
                const idValue = String(item.strainId).trim();
                const idNum = parseInt(idValue, 10);
                if (!isNaN(idNum)) {
                    strainId = String(idNum);
                    // If strainValue is different from strainId, use it as the name
                    if (strainValue !== idValue) {
                        strainName = strainValue;
                    }
                }
            }

            // Priority 2: Try to parse strain value if no explicit ID
            // Could be: "82", "Blue Dream", or "82 - Blue Dream"
            if (!strainId) {
                const numberMatch = strainValue.match(/^(\d+)(?:\s*[-:]\s*(.+))?$/);
                if (numberMatch) {
                    strainId = numberMatch[1];
                    strainName = numberMatch[2] ? numberMatch[2].trim() : strainValue;
                }
            }

            // Add to strainsTable
            if (strainId) {
                // Have an ID - map ID to name
                if (!strainsTable[strainId]) {
                    strainsTable[strainId] = strainName;
                    newStrainsCount++;
                    console.log(`OneDriveSync: Discovered strain ID ${strainId} = "${strainName}"`);
                }
                // Also add name as key for name-based lookups
                const nameLower = strainName.toLowerCase();
                if (!strainsTable[nameLower] && nameLower !== strainId) {
                    strainsTable[nameLower] = strainName;
                }
            } else {
                // No ID found - use the name as both key and value
                const nameKey = strainValue.toLowerCase();
                if (!strainsTable[nameKey]) {
                    strainsTable[nameKey] = strainValue;
                    newStrainsCount++;
                    console.log(`OneDriveSync: Discovered strain by name: "${strainValue}"`);
                }
            }

            // Build strain-owner mapping from this inventory item
            // Get the owner from the inventory item (could be owner code or name)
            const ownerValue = item.owner || item.ownerId || item.ownerCode;
            if (strainId && ownerValue) {
                const ownerStr = String(ownerValue).trim();
                if (ownerStr) {
                    // Initialize the strain's owners array if needed
                    if (!strainOwners[strainId]) {
                        strainOwners[strainId] = [];
                    }
                    // Add owner if not already present (case-insensitive check)
                    const ownerLower = ownerStr.toLowerCase();
                    const alreadyHasOwner = strainOwners[strainId].some(
                        o => o.toLowerCase() === ownerLower
                    );
                    if (!alreadyHasOwner) {
                        strainOwners[strainId].push(ownerStr);
                        strainOwnerMappingsCount++;
                    }
                }
            }
        });

        // Update appState
        window.appState.strainsTable = strainsTable;
        window.appState.strainOwners = strainOwners;

        console.log(`OneDriveSync: Built ${strainOwnerMappingsCount} strain-owner mappings from inventory`);
        console.log(`OneDriveSync: Strain-owner mappings sample:`, Object.entries(strainOwners).slice(0, 10));
        window.appState.isDataLoaded = true;

        console.log(`OneDriveSync: Strains table now has ${Object.keys(strainsTable).length} entries (${newStrainsCount} new from inventory)`);
        console.log('Final strainsTable:', strainsTable);
        console.log('StrainsTable keys:', Object.keys(strainsTable));
	// po added this to code:
	//Dispatch event to notify InventoryLookupService to rebuild its lookup maps
        // This ensures autocomplete works correctly after new containers are created
        const event = new CustomEvent('referenceData:updated', {
            detail: { source: 'inventory-sync', ts: Date.now() }
        });
        window.dispatchEvent(event);
        console.log('OneDriveSync: Dispatched referenceData:updated event for lookup service');
    },

    /**
     * Parse a Batch_ID like "LWG120021" into prefix + numeric ID
     * @param {string} batchId
     * @returns {{prefix: string, rawIdNumeric: number} | null}
     */
    parseBatchId(batchId) {
        if (!batchId) return null;

        const str = String(batchId).trim();
        // Match leading letters + trailing digits
        const match = str.match(/^([A-Za-z]+)(\d{1,})$/);
        if (!match) {
            console.warn('OneDriveSync: Batch_ID did not match expected pattern [letters][digits]:', batchId);
            return null;
        }

        const prefix = match[1];
        const digitPart = match[2];
        // Use last 6 digits as numeric ID
        const lastSix = digitPart.slice(-6);
        const rawIdNumeric = parseInt(lastSix, 10);
        if (isNaN(rawIdNumeric)) {
            console.warn('OneDriveSync: Unable to parse numeric portion from Batch_ID:', batchId);
            return null;
        }

        return { prefix, rawIdNumeric };
    },

    /**
     * Update app state with new mapping
     * @param {Object} mapping - Strain-owner mapping
     */
    updateAppState(mapping) {
        console.log('OneDriveSync: Updating app state...');

        if (!window.StateManager) {
            console.warn('StateManager not found, updating window.appState directly');
            if (!window.appState) {
                window.appState = {};
            }
            if (!window.appState.reference) {
                window.appState.reference = {};
            }
            window.appState.reference.strainOwnerMapping = mapping;
        } else {
            window.StateManager.setState('reference.strainOwnerMapping', mapping);
        }

        // Also update legacy path if it exists
        if (window.appState && window.appState.strainOwnerMapping !== undefined) {
            window.appState.strainOwnerMapping = mapping;
        }

        // Dispatch event for reactive updates
        const event = new CustomEvent('strainOwnerMapping:updated', {
            detail: { source: 'cloud', ts: Date.now() }
        });
        window.dispatchEvent(event);

        console.log('OneDriveSync: App state updated');
    },

    /**
     * Sync Active_Inventory sheet from cloud workbook into app inventory state
     * Treats the workbook as source of truth for active inventory.
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async syncActiveInventoryToApp() {
        console.log('OneDriveSync: Syncing Active_Inventory to app state...');

        // Ensure we have drive/item IDs
        if (!this.driveId || !this.itemId) {
            if (!this.shareUrl) {
                throw new Error('No shareUrl configured for OneDriveSync');
            }
            await this.resolveDriveItemFromShareUrl(this.shareUrl);
        }

        const arrayBuffer = await this.downloadExcelArrayBuffer(this.driveId, this.itemId);
        const inventory = this.parseActiveInventoryFromWorkbook(arrayBuffer);

        if (!Array.isArray(inventory) || inventory.length === 0) {
            console.warn('OneDriveSync: No inventory rows parsed from Active_Inventory');
            return { success: false, count: 0 };
        }

        if (!window.StateManager) {
            throw new Error('StateManager not initialized');
        }

        // FIX: Implement merge strategy to prevent sync conflicts
        // Cloud data is source of truth, but we preserve local-only entries
        const existingInventory = window.StateManager.getState('inventory') || [];
        const cloudContainerIds = new Set(inventory.map(item => item.containerId));

        // Find local-only entries (created locally but not yet synced to cloud)
        const localOnlyEntries = existingInventory.filter(item => {
            if (!item.containerId) return false;
            // Keep entry if it doesn't exist in cloud AND was created recently (within last hour)
            // OR if it has a localOnly flag
            if (cloudContainerIds.has(item.containerId)) return false;
            if (item.localOnly) return true;
            // Check if created within the last hour
            if (item.date) {
                const created = new Date(item.date);
                const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                if (created > hourAgo) return true;
            }
            return false;
        });

        // Merge: cloud data + local-only entries
        const mergedInventory = [...inventory];
        if (localOnlyEntries.length > 0) {
            console.log(`OneDriveSync: Preserving ${localOnlyEntries.length} local-only entries during sync`);
            mergedInventory.push(...localOnlyEntries);
        }

        window.StateManager.setState('inventory', mergedInventory);

        // Update highestContainerId based on numeric portion from MERGED inventory
        const maxId = mergedInventory.reduce((max, item) => {
            const num = parseInt(item.containerId, 10);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        window.StateManager.setState('highestContainerId', maxId);

        // Parse reference sheets for strain data (Ref_Strains, Ref_Owners, etc.)
        // Note: Config sheet parsing removed as HQ workbook uses Ref_ sheets instead
        try {
            this.parseReferenceSheets(arrayBuffer);
        } catch (err) {
            console.warn('OneDriveSync: Could not parse reference sheets:', err.message);
        }

        // THEN: Extract strains from inventory (adds any strains not in reference sheets)
        this.populateStrainsTableFromInventory(inventory);

        // Save the updated strain data to localStorage for persistence
        if (window.DataUtils && typeof window.DataUtils.saveExcelData === 'function') {
            try {
                window.DataUtils.saveExcelData('Cloud HQ Workbook');
                console.log('OneDriveSync: Saved updated strain data to localStorage');
            } catch (err) {
                console.warn('OneDriveSync: Could not save to localStorage:', err.message);
            }
        }

        // Rebuild InventoryLookupService with updated strain data
        if (window.InventoryLookupService) {
            if (window.InventoryLookupService.isInitialized()) {
                window.InventoryLookupService.rebuild();
                console.log('OneDriveSync: InventoryLookupService rebuilt with cloud strain data');
            } else {
                window.InventoryLookupService.initialize();
                console.log('OneDriveSync: InventoryLookupService initialized with cloud strain data');
            }
        }

        // Rebuild UI
        if (window.InventoryTableManager) {
            window.InventoryTableManager.rebuildTable();
        }
        if (window.UIUtils && typeof window.UIUtils.updateStats === 'function') {
            window.UIUtils.updateStats();
        }

        if (window.NotificationSystem) {
            window.NotificationSystem.success(`📥 Loaded ${inventory.length} inventory rows from cloud Active_Inventory`);
        }

        return { success: true, count: inventory.length };
    },

    /**
     * Upload a workbook blob to the configured cloud Excel file.
     * This is a thin wrapper used by newer modules (e.g., DataLayerBridge.syncToCloud)
     * that expect OneDriveSync.uploadFile(fileName, blob).
     * It overwrites the existing workbook content referenced by shareUrl.
     * @param {string} fileName - Logical file name (for logging only)
     * @param {Blob} blob - Excel workbook blob
     * @returns {Promise<{success: boolean}>}
     */
    async uploadFile(fileName, blob) {
        console.log(`OneDriveSync: uploadFile called for ${fileName}`);

        // SAFETY GUARD: prevent accidental overwrites of the primary workbook.
        // This must be explicitly enabled by setting allowFullWorkbookOverwrite = true
        // in a controlled context pointing at a non-production/export workbook.
        if (!this.allowFullWorkbookOverwrite) {
            console.warn('OneDriveSync.uploadFile blocked: allowFullWorkbookOverwrite is false.');
            throw new Error('Full workbook overwrite is disabled to protect the primary inventory workbook.');
        }

        if (!this.shareUrl) {
            throw new Error('OneDriveSync: No shareUrl configured for uploadFile');
        }

        // Ensure drive/item IDs
        if (!this.driveId || !this.itemId) {
            await this.resolveDriveItemFromShareUrl(this.shareUrl);
        }

        const token = await this.acquireToken();
        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/content`;

        // Convert blob to ArrayBuffer for fetch body
        const arrayBuffer = await blob.arrayBuffer();

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: arrayBuffer
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to upload Excel workbook: ${response.status} ${text}`);
        }

        this.lastSync = new Date().toISOString();
        this.lastError = null;
        localStorage.setItem(this.CACHE_KEYS.LAST_SYNC, this.lastSync);
        localStorage.removeItem(this.CACHE_KEYS.LAST_ERROR);

        this.updateStatusUI();
        console.log('OneDriveSync: Workbook uploaded successfully via uploadFile');
        return { success: true };
    },

    /**
     * Download the configured cloud Excel file as an ArrayBuffer.
     * Wrapper used by newer modules expecting OneDriveSync.downloadFile(fileName).
     * @param {string} fileName - Logical file name (ignored, kept for API compatibility)
     * @returns {Promise<ArrayBuffer>}
     */
    async downloadFile(fileName) {
        console.log(`OneDriveSync: downloadFile called for ${fileName}`);

        if (!this.shareUrl) {
            throw new Error('OneDriveSync: No shareUrl configured for downloadFile');
        }

        // Ensure drive/item IDs
        if (!this.driveId || !this.itemId) {
            await this.resolveDriveItemFromShareUrl(this.shareUrl);
        }

        return await this.downloadExcelArrayBuffer(this.driveId, this.itemId);
    },

    /**
     * Append new inventory rows from app state to the cloud Active_Inventory table
     * This is append-only: existing rows (by Raw_ID) are never modified.
     * Requires the Active_Inventory range to be an Excel table (e.g., tblActiveInventory).
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async appendNewInventoryRowsToCloud() {
        console.log('OneDriveSync: Appending new inventory rows to cloud Active_Inventory table...');

        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.appendNewInventoryRowsToCloud BLOCKED: readOnlyMode is enabled');
            return { success: false, count: 0, blocked: true, reason: 'Read-only mode enabled' };
        }

        if (!this.inventoryTableName) {
            throw new Error('OneDriveSync: inventoryTableName not configured');
        }

        // Ensure drive/item IDs
        if (!this.driveId || !this.itemId) {
            if (!this.shareUrl) {
                throw new Error('No shareUrl configured for OneDriveSync');
            }
            await this.resolveDriveItemFromShareUrl(this.shareUrl);
        }

        const token = await this.acquireToken();
        const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const normalize = (name) => name ? name.toLowerCase().trim() : '';

        // 1) Fetch table columns to determine column order and Raw_ID column index
        const columnsResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/columns`, {
            headers: { 'Authorization': headers.Authorization }
        });
        if (!columnsResp.ok) {
            const text = await columnsResp.text();
            throw new Error(`Failed to fetch inventory table columns: ${columnsResp.status} ${text}`);
        }
        const columnsJson = await columnsResp.json();
        const columns = columnsJson.value || [];
        if (!columns.length) {
            throw new Error('OneDriveSync: No columns returned for inventory table');
        }

        const rawIdIndex = columns.findIndex(col => {
            const n = normalize(col.name);
            return [
                'raw_id', 'rawid', 'raw id',
                'container_id', 'containerid', 'container id',
                'barcodevalue', 'barcode_value', 'barcode value'
            ].includes(n);
        });
        if (rawIdIndex === -1) {
            throw new Error('OneDriveSync: Could not locate Raw_ID/Container_ID/BarcodeValue column in inventory table');
        }

        const batchIdIndex = columns.findIndex(col => {
            const n = normalize(col.name);
            return ['batch_id', 'batchid', 'batch id'].includes(n);
        });

        // 2) Fetch existing rows to build a set of Raw_IDs already present
        const rowsResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/rows`, {
            headers: { 'Authorization': headers.Authorization }
        });
        if (!rowsResp.ok) {
            const text = await rowsResp.text();
            throw new Error(`Failed to fetch inventory table rows: ${rowsResp.status} ${text}`);
        }
        const rowsJson = await rowsResp.json();
        const rows = rowsJson.value || [];

        const existingRawIds = new Set();
        rows.forEach(row => {
            const valuesArray = row.values && row.values[0];
            if (!Array.isArray(valuesArray)) return;
            if (rawIdIndex >= 0 && rawIdIndex < valuesArray.length) {
                const v = valuesArray[rawIdIndex];
                if (v === null || v === undefined || v === '') return;
                const asString = String(v).trim();
                let num = parseInt(asString, 10);
                if (isNaN(num)) {
                    const parsed = this.parseBatchId(asString);
                    if (parsed) {
                        num = parsed.rawIdNumeric;
                    }
                }
                if (!isNaN(num)) {
                    existingRawIds.add(String(num));
                }
            }
        });

        console.log(`OneDriveSync: Found ${existingRawIds.size} existing inventory IDs in cloud inventory table`);

        // 3) Determine new rows from app inventory
        let inventory = [];
        if (window.StateManager) {
            inventory = window.StateManager.getState('inventory') || [];
        } else if (window.appState && Array.isArray(window.appState.inventory)) {
            inventory = window.appState.inventory;
        }

        if (!inventory.length) {
            console.warn('OneDriveSync: No inventory data in app state, nothing to append');
            return { success: true, count: 0 };
        }

        const rowsToAdd = [];

        let prePopulatedUpdated = 0;
        const prePopulatedToUpdate = [];

        inventory.forEach(item => {
            if (!item || !item.containerId) return;

            const rawNum = parseInt(item.containerId, 10);
            if (isNaN(rawNum)) return;

            const rawKey = String(rawNum);
            if (existingRawIds.has(rawKey)) {
                // Row exists in workbook. If this container came from a
                // pre-populated QR row, PATCH its metadata into the existing row.
                if (item.qrExcelRow) {
                    prePopulatedToUpdate.push(item);
                }
                return;
            }

            // Build a row in the same column order as the table
            const rowValues = columns.map(col => {
                const nameNorm = normalize(col.name);

                // ID column: may be Raw_ID, Container_ID, or BarcodeValue
                if (['raw_id', 'rawid', 'raw id'].includes(nameNorm)) {
                    return rawNum;
                }

                if (['container_id', 'containerid', 'container id'].includes(nameNorm)) {
                    // Write numeric-only Container_ID (zero-padded) instead of prefixed codes like "LWG120022".
                    return String(rawNum).padStart(6, '0');
                }

                if (['barcodevalue', 'barcode_value', 'barcode value'].includes(nameNorm)) {
                    return rawNum;
                }

                if (['batch_id', 'batchid', 'batch id'].includes(nameNorm)) {
                    // If an explicit batchId is present, preserve it; otherwise use numeric-only ID.
                    if (item.batchId) return item.batchId;
                    return String(rawNum).padStart(6, '0');
                }

                if (['strain_name', 'strain', 'strain id'].includes(nameNorm)) {
                    return item.strain || '';
                }

                if (['owner', 'owner_name', 'owner name'].includes(nameNorm)) {
                    return item.owner || '';
                }

                if (nameNorm === 'stage') {
                    return item.stage || '';
                }

                if (['location', 'room', 'rack'].includes(nameNorm)) {
                    return item.location || '';
                }

                if (['media', 'media_type', 'media type'].includes(nameNorm)) {
                    return item.media || '';
                }

                if (['quantity', 'tissuecount', 'tissue_count', 'tissue count'].includes(nameNorm)) {
                    return item.tissueCount || 1;
                }

                if (['datecreated', 'date_created', 'date created', 'date'].includes(nameNorm)) {
                    return item.date || '';
                }

                if (['notes', 'comment', 'comments'].includes(nameNorm)) {
                    return item.notes || '';
                }

                if (['lineage', 'container_lineage', 'lineage_path', 'parent_lineage'].includes(nameNorm)) {
                    return item.containerLineage || '';
                }

                if (nameNorm === 'status') {
                    return item.status || '';
                }

                // QR URL column (optional): store explicit QR destination URL if available,
                // otherwise derive it from barcode/sampleBarcode/containerId using current scheme.
                if ([
                    'qr_url', 'qr link', 'qr', 'qr_destination',
                    'qr code url', 'qr code link', 'qr_url_link',
                    // HQ Workbook: QRContainerID column should receive the generated QR destination URL
                    'qrcontainerid', 'qr_container_id', 'qr container id'
                ].includes(nameNorm)) {
                    if (item.qrDestinationUrl) {
                        return item.qrDestinationUrl;
                    }
                    const code = item.barcode || item.sampleBarcode || item.containerId;
                    if (!code) return '';
                    return `https://scanner.lonewolfbiotech.com/container?code=${encodeURIComponent(code)}`;
                }

                // Default: empty cell
                return '';
            });

            rowsToAdd.push(rowValues);
        });

        // PATCH pre-populated rows with metadata
        if (prePopulatedToUpdate.length > 0) {
            console.log(`OneDriveSync: Updating ${prePopulatedToUpdate.length} pre-populated row(s) with metadata...`);
            for (const item of prePopulatedToUpdate) {
                try {
                    await this.updateRowByContainerId(item.containerId, {
                        strain: item.strain || '',
                        owner: item.owner || '',
                        stage: item.stage || '',
                        media: item.media || '',
                        tissueCount: item.tissueCount || 1,
                        date: item.date || ''
                    });
                    prePopulatedUpdated++;
                    console.log(`OneDriveSync: Updated pre-populated row for container ${item.containerId}`);
                } catch (err) {
                    console.warn(`OneDriveSync: Failed to update pre-populated row for container ${item.containerId}:`, err);
                }
            }
        }

        if (!rowsToAdd.length) {
            if (prePopulatedUpdated > 0) {
                console.log(`OneDriveSync: ${prePopulatedUpdated} container(s) updated in pre-populated Excel rows`);
                if (window.NotificationSystem) {
                    window.NotificationSystem.success(`${prePopulatedUpdated} container(s) synced to pre-populated Excel rows`);
                }
            } else {
                console.log('OneDriveSync: No new inventory rows to append (all Raw_IDs already present)');
                if (window.NotificationSystem) {
                    window.NotificationSystem.info('No new inventory rows to sync to cloud');
                }
            }
            return { success: true, count: prePopulatedUpdated };
        }

        // 4) Write rows into empty slots first, then append any overflow
        // Find empty rows in the existing table (rows where the ID column is blank)
        const emptyRowIndices = [];
        rows.forEach((row, idx) => {
            const valuesArray = row.values && row.values[0];
            if (!Array.isArray(valuesArray)) {
                emptyRowIndices.push(idx);
                return;
            }
            const idVal = rawIdIndex >= 0 && rawIdIndex < valuesArray.length
                ? valuesArray[rawIdIndex]
                : null;
            if (idVal === null || idVal === undefined || idVal === '' || String(idVal).trim() === '') {
                emptyRowIndices.push(idx);
            }
        });

        let filledCount = 0;
        const overflowRows = [];

        for (let i = 0; i < rowsToAdd.length; i++) {
            if (i < emptyRowIndices.length) {
                // Write into the empty row using range PATCH
                // Table data row index → Excel row = index + 3 (row 1 title, row 2 header)
                const excelRowNum = emptyRowIndices[i] + 3;
                const colLetter = String.fromCharCode(65 + columns.length - 1); // last column letter
                const rangeAddress = `Active_Inventory!A${excelRowNum}:${colLetter}${excelRowNum}`;
                const patchResp = await fetch(`${baseUrl}/worksheets('Active_Inventory')/range(address='${rangeAddress}')`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ values: [rowsToAdd[i]] })
                });
                if (!patchResp.ok) {
                    const text = await patchResp.text();
                    console.warn(`Failed to write row into empty slot at Excel row ${excelRowNum}: ${patchResp.status} ${text}`);
                    overflowRows.push(rowsToAdd[i]);
                } else {
                    filledCount++;
                }
            } else {
                overflowRows.push(rowsToAdd[i]);
            }
        }

        // Append any remaining rows that didn't fit into empty slots
        if (overflowRows.length > 0) {
            const addResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/rows/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ values: overflowRows })
            });
            if (!addResp.ok) {
                const text = await addResp.text();
                throw new Error(`Failed to append inventory rows: ${addResp.status} ${text}`);
            }
        }

        const totalAdded = filledCount + overflowRows.length;
        if (filledCount > 0) {
            console.log(`OneDriveSync: Filled ${filledCount} empty rows, appended ${overflowRows.length} new rows`);
        }

        console.log(`OneDriveSync: Synced ${totalAdded} new inventory rows to cloud (${filledCount} filled empty slots, ${overflowRows.length} appended)`);
        if (window.NotificationSystem) {
            window.NotificationSystem.success(`Synced ${totalAdded} new inventory rows to cloud Active_Inventory`);
        }

        return { success: true, count: totalAdded };
    },

    /**
     * Append a strain/owner reference row to the tblStrainMapping table based on intake form data.
     * Part of the hybrid Option C workflow: keep reference data in Excel while intake also drives inventory.
     * @param {Object} intakeData - object from IntakeFormManager.collectFormData()
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async appendStrainReferenceRow(intakeData) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.appendStrainReferenceRow BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true, reason: 'Read-only mode enabled' };
        }

        try {
            if (!intakeData) {
                throw new Error('No intake data provided');
            }

            if (!this.shareUrl) {
                throw new Error('No shareUrl configured for OneDriveSync');
            }

            if (!this.strainMappingTableName) {
                throw new Error('OneDriveSync: strainMappingTableName not configured');
            }

            // Ensure drive/item IDs are resolved
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;

            const servicesText = Array.isArray(intakeData.services)
                ? intakeData.services.join(', ')
                : (intakeData.services || '');

            const onboardedDate = intakeData.timestamp
                ? new Date(intakeData.timestamp).toLocaleDateString()
                : new Date().toLocaleDateString();

            // Matches Excel headers: Strain Name, Owner, Genetics, Date Onboarded, Notes
            const rowPayload = {
                values: [[
                    intakeData.strainName || 'Unknown',
                    intakeData.customerName || intakeData.ownerID || 'Unknown',
                    intakeData.genetics || '',
                    onboardedDate,
                    servicesText ? `Intake Services: ${servicesText}` : ''
                ]]
            };

            const resp = await fetch(`${baseUrl}/tables('${this.strainMappingTableName}')/rows/add`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(rowPayload)
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Failed to append strain reference row: ${resp.status} ${text}`);
            }

            console.log('OneDriveSync: Appended strain reference row to tblStrainMapping');
            if (window.NotificationSystem) {
                window.NotificationSystem.success('📚 Synced intake strain/owner reference to cloud');
            }

            return { success: true };
        } catch (error) {
            console.error('OneDriveSync: Failed to append strain reference row:', error);
            if (window.NotificationSystem) {
                window.NotificationSystem.warning('Intake saved locally but failed to sync reference data to cloud.');
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * Append or update a media recipe to the tblRecipes table in the cloud workbook.
     * Syncs recipe data including ingredients, preparation steps, and metadata.
     * @param {Object} recipeData - Recipe object from RecipeStorage
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async appendRecipeToCloud(recipeData) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.appendRecipeToCloud BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true, reason: 'Read-only mode enabled' };
        }

        try {
            if (!recipeData) {
                throw new Error('No recipe data provided');
            }

            if (!this.shareUrl) {
                throw new Error('No shareUrl configured for OneDriveSync');
            }

            if (!this.recipeTableName) {
                console.warn('OneDriveSync: recipeTableName not configured, skipping recipe sync');
                return { success: false, error: 'Recipe table not configured' };
            }

            // Ensure drive/item IDs are resolved
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            // Format pre-autoclave ingredients as a string
            const preAutoclaveStr = [
                recipeData.preAutoclave?.gamborgVitamin ? `Gamborg Vitamin: ${recipeData.preAutoclave.gamborgVitamin}g` : '',
                recipeData.preAutoclave?.sucrose ? `Sucrose: ${recipeData.preAutoclave.sucrose}g` : '',
                recipeData.preAutoclave?.ppm ? `PPM: ${recipeData.preAutoclave.ppm}mL` : ''
            ].filter(Boolean).join('; ');

            // Format post-autoclave ingredients as a string
            const postAutoclaveStr = Array.isArray(recipeData.postAutoclave)
                ? recipeData.postAutoclave.map(item =>
                    `${item.name || 'Unknown'}: ${item.amount || 0}${item.unit || ''}`
                ).join('; ')
                : '';

            // Format the row data - columns should match Excel table headers
            // Expected columns: Recipe_ID, Recipe_Name, Media_Type, Volume, Basal_Salt_Type, Basal_Salt_Amount,
            //                   Gelling_Agent_Type, Gelling_Agent_Amount, Pre_Autoclave, Post_Autoclave,
            //                   Target_pH, Created_Date, Created_By, Notes
            const rowPayload = {
                values: [[
                    recipeData.id || '',
                    recipeData.name || 'Unnamed Recipe',
                    recipeData.mediaType || '',
                    recipeData.volume || '1L',
                    recipeData.basalSalt?.type || '',
                    recipeData.basalSalt?.amount || 0,
                    recipeData.gellingAgent?.type || '',
                    recipeData.gellingAgent?.amount || 0,
                    preAutoclaveStr,
                    postAutoclaveStr,
                    recipeData.targetPh || '5.7-6.0',
                    recipeData.createdAt ? new Date(recipeData.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
                    recipeData.createdBy || '',
                    recipeData.notes || ''
                ]]
            };

            // First, check if recipe already exists (by Recipe_ID) and update instead of append
            try {
                const existingRow = await this.findRecipeRowById(recipeData.id);
                if (existingRow) {
                    // Update existing row
                    const updateResult = await this.updateRecipeRow(existingRow, rowPayload.values[0]);
                    if (updateResult.success) {
                        console.log(`OneDriveSync: Updated existing recipe row for ${recipeData.name}`);
                        if (window.NotificationSystem) {
                            NotificationSystem.success(`📤 Recipe "${recipeData.name}" synced to cloud`);
                        }
                        return { success: true, updated: true };
                    }
                }
            } catch (findError) {
                console.log('OneDriveSync: Recipe not found, will append new row');
            }

            // Append new row
            const resp = await fetch(`${baseUrl}/tables('${this.recipeTableName}')/rows/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify(rowPayload)
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Failed to append recipe row: ${resp.status} ${text}`);
            }

            console.log(`OneDriveSync: Appended recipe "${recipeData.name}" to cloud`);
            if (window.NotificationSystem) {
                NotificationSystem.success(`📤 Recipe "${recipeData.name}" synced to cloud`);
            }

            return { success: true };
        } catch (error) {
            console.error('OneDriveSync: Failed to sync recipe to cloud:', error);
            if (window.NotificationSystem) {
                NotificationSystem.warning(`Recipe saved locally but failed to sync to cloud: ${error.message}`);
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * Find a recipe row by Recipe_ID in the cloud workbook
     * @param {string} recipeId - The recipe ID to find
     * @returns {Promise<number|null>} Excel row number or null if not found
     */
    async findRecipeRowById(recipeId) {
        if (!recipeId || !this.recipeTableName) return null;

        const token = await this.acquireToken();
        const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch table columns
        const colResp = await fetch(`${baseUrl}/tables('${this.recipeTableName}')/columns`, { headers });
        if (!colResp.ok) return null;
        const colJson = await colResp.json();
        const columns = colJson.value || [];

        const normalize = (name) => name ? name.toLowerCase().trim().replace(/[_\s]/g, '') : '';
        const idColIndex = columns.findIndex(col => {
            const n = normalize(col.name);
            return ['recipeid', 'recipe_id', 'id'].includes(n);
        });
        if (idColIndex === -1) return null;

        // Fetch rows
        const rowsResp = await fetch(`${baseUrl}/tables('${this.recipeTableName}')/rows`, { headers });
        if (!rowsResp.ok) return null;
        const rowsJson = await rowsResp.json();
        const rows = rowsJson.value || [];

        for (let i = 0; i < rows.length; i++) {
            const cellValue = rows[i].values && rows[i].values[0] ? String(rows[i].values[0][idColIndex]) : '';
            if (cellValue === recipeId) {
                return i + 3; // Account for title + header rows
            }
        }

        return null;
    },

    /**
     * Update an existing recipe row in the cloud workbook
     * @param {number} excelRow - The Excel row number to update
     * @param {Array} rowValues - The values to write
     * @returns {Promise<{success: boolean}>}
     */
    async updateRecipeRow(excelRow, rowValues) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.updateRecipeRow BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true };
        }

        const token = await this.acquireToken();
        const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Get column count
        const colResp = await fetch(`${baseUrl}/tables('${this.recipeTableName}')/columns`, { headers });
        if (!colResp.ok) return { success: false };
        const colJson = await colResp.json();
        const columns = colJson.value || [];
        const colLetter = String.fromCharCode(65 + columns.length - 1);

        // PATCH the row
        const rangeAddress = `Recipes!A${excelRow}:${colLetter}${excelRow}`;
        const patchResp = await fetch(`${baseUrl}/worksheets('Recipes')/range(address='${rangeAddress}')`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ values: [rowValues] })
        });

        return { success: patchResp.ok };
    },

    /**
     * Append or update a media batch to the tblMediaBatches table in the cloud workbook.
     * Syncs batch data including recipe reference, prep details, and container tracking.
     * @param {Object} batchData - Batch object from MediaBatchManager
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async appendBatchToCloud(batchData) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.appendBatchToCloud BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true, reason: 'Read-only mode enabled' };
        }

        try {
            if (!batchData) {
                throw new Error('No batch data provided');
            }

            if (!this.shareUrl) {
                throw new Error('No shareUrl configured for OneDriveSync');
            }

            if (!this.batchTableName) {
                console.warn('OneDriveSync: batchTableName not configured, skipping batch sync');
                return { success: false, error: 'Batch table not configured' };
            }

            // Ensure drive/item IDs are resolved
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            // Format completed prep steps
            const completedSteps = batchData.prepSteps
                ? batchData.prepSteps.filter(s => s.completed).map(s => s.name).join('; ')
                : '';

            // Format the row data - columns should match Excel table headers
            // Expected columns: Batch_ID, Recipe_ID, Recipe_Name, Media_Type, Volume,
            //                   Prepared_By, Prep_Date, Expiry_Date, Total_Containers,
            //                   Available_Containers, Status, Completed_Steps, Notes
            const rowPayload = {
                values: [[
                    batchData.id || '',
                    batchData.recipeId || '',
                    batchData.recipeName || '',
                    batchData.mediaType || '',
                    batchData.volume || '',
                    batchData.preparedBy || '',
                    batchData.prepDate ? new Date(batchData.prepDate).toLocaleDateString() : '',
                    batchData.expiryDate ? new Date(batchData.expiryDate).toLocaleDateString() : '',
                    batchData.totalContainers || 0,
                    batchData.availableContainers || 0,
                    batchData.status || 'in_prep',
                    completedSteps,
                    batchData.notes || ''
                ]]
            };

            // Check if batch already exists (by Batch_ID) and update instead of append
            try {
                const existingRow = await this.findBatchRowById(batchData.id);
                if (existingRow) {
                    // Update existing row
                    const updateResult = await this.updateBatchRow(existingRow, rowPayload.values[0]);
                    if (updateResult.success) {
                        console.log(`OneDriveSync: Updated existing batch row for ${batchData.id}`);
                        return { success: true, updated: true };
                    }
                }
            } catch (findError) {
                console.log('OneDriveSync: Batch not found, will append new row');
            }

            // Append new row
            const resp = await fetch(`${baseUrl}/tables('${this.batchTableName}')/rows/add`, {
                method: 'POST',
                headers,
                body: JSON.stringify(rowPayload)
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Failed to append batch row: ${resp.status} ${text}`);
            }

            console.log(`OneDriveSync: Appended batch "${batchData.id}" to cloud`);
            return { success: true };
        } catch (error) {
            console.error('OneDriveSync: Failed to sync batch to cloud:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Find a batch row by Batch_ID in the cloud workbook
     * @param {string} batchId - The batch ID to find
     * @returns {Promise<number|null>} Excel row number or null if not found
     */
    async findBatchRowById(batchId) {
        if (!batchId || !this.batchTableName) return null;

        const token = await this.acquireToken();
        const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch table columns
        const colResp = await fetch(`${baseUrl}/tables('${this.batchTableName}')/columns`, { headers });
        if (!colResp.ok) return null;
        const colJson = await colResp.json();
        const columns = colJson.value || [];

        const normalize = (name) => name ? name.toLowerCase().trim().replace(/[_\s]/g, '') : '';
        const idColIndex = columns.findIndex(col => {
            const n = normalize(col.name);
            return ['batchid', 'batch_id', 'id'].includes(n);
        });
        if (idColIndex === -1) return null;

        // Fetch rows
        const rowsResp = await fetch(`${baseUrl}/tables('${this.batchTableName}')/rows`, { headers });
        if (!rowsResp.ok) return null;
        const rowsJson = await rowsResp.json();
        const rows = rowsJson.value || [];

        for (let i = 0; i < rows.length; i++) {
            const cellValue = rows[i].values && rows[i].values[0] ? String(rows[i].values[0][idColIndex]) : '';
            if (cellValue === batchId) {
                return i + 3; // Account for title + header rows
            }
        }

        return null;
    },

    /**
     * Update an existing batch row in the cloud workbook
     * @param {number} excelRow - The Excel row number to update
     * @param {Array} rowValues - The values to write
     * @returns {Promise<{success: boolean}>}
     */
    async updateBatchRow(excelRow, rowValues) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.updateBatchRow BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true };
        }

        const token = await this.acquireToken();
        const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Get column count
        const colResp = await fetch(`${baseUrl}/tables('${this.batchTableName}')/columns`, { headers });
        if (!colResp.ok) return { success: false };
        const colJson = await colResp.json();
        const columns = colJson.value || [];
        const colLetter = String.fromCharCode(65 + columns.length - 1);

        // PATCH the row
        const rangeAddress = `MediaBatches!A${excelRow}:${colLetter}${excelRow}`;
        const patchResp = await fetch(`${baseUrl}/worksheets('MediaBatches')/range(address='${rangeAddress}')`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ values: [rowValues] })
        });

        return { success: patchResp.ok };
    },

    /**
     * Update status UI element
     */
    updateStatusUI() {
        // Update the main status element (if configured)
        if (this.statusElementId) {
            const statusElement = document.getElementById(this.statusElementId);
            if (statusElement) {
                let statusText = '';
                let statusClass = '';

                if (this.isRunning) {
                    statusText = '⏳ Syncing...';
                    statusClass = 'syncing';
                } else if (this.lastError) {
                    statusText = `❌ Error: ${this.lastError}`;
                    statusClass = 'error';

                    if (this.lastSync) {
                        const syncDate = new Date(this.lastSync);
                        statusText += ` (Last success: ${syncDate.toLocaleString()})`;
                    }
                } else if (this.lastSync) {
                    const syncDate = new Date(this.lastSync);
                    statusText = `✅ Last synced: ${syncDate.toLocaleString()}`;
                    statusClass = 'success';
                } else {
                    statusText = 'Last synced: —';
                    statusClass = '';
                }

                statusElement.textContent = statusText;
                statusElement.className = `cloud-sync-status ${statusClass}`.trim();
            }
        }

        // Update the header connection indicator
        this.updateConnectionIndicator();
    },

    /**
     * Update the header connection status indicator
     * Shows connected/syncing/error/offline status
     */
    updateConnectionIndicator() {
        const indicator = document.getElementById('cloud-connection-indicator');
        if (!indicator) return;

        const iconEl = document.getElementById('cloud-status-icon');
        const textEl = document.getElementById('cloud-status-text');
        const lastSyncEl = document.getElementById('cloud-last-sync');

        // Remove all state classes
        indicator.classList.remove('connected', 'syncing', 'error', 'offline');

        let icon = '⚪';
        let text = 'Offline';
        let stateClass = 'offline';

        if (this.isRunning) {
            icon = '🔄';
            text = 'Syncing';
            stateClass = 'syncing';
        } else if (this.lastError) {
            icon = '🔴';
            text = 'Error';
            stateClass = 'error';
        } else if (this.lastSync && this.fromCloud) {
            icon = '🟢';
            text = 'Connected';
            stateClass = 'connected';
        } else if (this.authManager && this.authManager.isSignedIn()) {
            icon = '🟡';
            text = 'Ready';
            stateClass = 'connected';
        }

        if (iconEl) iconEl.textContent = icon;
        if (textEl) textEl.textContent = text;
        indicator.classList.add(stateClass);

        // Update last sync timestamp
        if (lastSyncEl) {
            if (this.lastSync) {
                const syncDate = new Date(this.lastSync);
                const now = new Date();
                const diffMs = now - syncDate;
                const diffMins = Math.floor(diffMs / 60000);
                
                let relativeTime = '';
                if (diffMins < 1) {
                    relativeTime = 'just now';
                } else if (diffMins < 60) {
                    relativeTime = `${diffMins}m ago`;
                } else if (diffMins < 1440) {
                    relativeTime = `${Math.floor(diffMins / 60)}h ago`;
                } else {
                    relativeTime = syncDate.toLocaleDateString();
                }
                
                lastSyncEl.textContent = relativeTime;
                lastSyncEl.style.display = 'inline';
                lastSyncEl.title = `Last synced: ${syncDate.toLocaleString()}`;
            } else {
                lastSyncEl.style.display = 'none';
            }
        }

        // Make indicator clickable to trigger manual sync
        if (!indicator._clickHandlerAttached) {
            indicator.addEventListener('click', async () => {
                if (!this.isRunning && this.authManager && this.authManager.isSignedIn()) {
                    await this.manualSync();
                } else if (!this.authManager || !this.authManager.isSignedIn()) {
                    if (window.NotificationSystem) {
                        window.NotificationSystem.warning('Please sign in to sync with cloud');
                    }
                }
            });
            indicator._clickHandlerAttached = true;
        }
    },

    /**
     * Update button state (enabled/disabled)
     * @param {boolean} isSyncing - Whether sync is in progress
     */
    updateButtonState(isSyncing) {
        if (!this.buttonElementId) return;

        const button = document.getElementById(this.buttonElementId);
        if (!button) return;

        if (isSyncing) {
            button.disabled = true;
            button.textContent = '⏳ Syncing...';
        } else {
            button.disabled = false;
            button.textContent = '🔄 Sync from Cloud';
        }
    },

    /**
     * Load local JSON fallback data
     * @returns {Promise<void>}
     */
    async loadLocalJsonFallback() {
        console.log('OneDriveSync: Loading local JSON fallback...');

        try {
            if (window.DataUtils && typeof window.DataUtils.loadJSONFallbackData === 'function') {
                await window.DataUtils.loadJSONFallbackData();
                console.log('OneDriveSync: Local JSON fallback loaded');
            } else {
                console.warn('OneDriveSync: DataUtils.loadJSONFallbackData not available');
                await this.loadMinimalFallback();
            }
        } catch (error) {
            console.error('OneDriveSync: Local JSON fallback failed:', error);
            await this.loadMinimalFallback();
        }
    },

    /**
     * Load minimal fallback data
     * @returns {Promise<void>}
     */
    async loadMinimalFallback() {
        console.log('OneDriveSync: Loading minimal fallback...');

        try {
            if (window.DataUtils && typeof window.DataUtils.loadMinimalFallbackData === 'function') {
                window.DataUtils.loadMinimalFallbackData();
                console.log('OneDriveSync: Minimal fallback loaded');
            } else {
                console.warn('OneDriveSync: DataUtils.loadMinimalFallbackData not available');

                // Ultra-minimal fallback: set empty mapping
                const emptyMapping = {};
                this.updateAppState(emptyMapping);

                if (window.NotificationSystem) {
                    window.NotificationSystem.info('Using empty data. Please load Excel file manually.');
                }
            }
        } catch (error) {
            console.error('OneDriveSync: Minimal fallback failed:', error);
        }
    },

    /**
     * Get workbook identity (driveId + itemId) for the configured shareUrl.
     * Ensures they are resolved and cached.
     * @returns {Promise<{driveId: string, itemId: string}>}
     */
    async getWorkbookIdentity() {
        if (!this.shareUrl) {
            throw new Error('OneDriveSync: No shareUrl configured for getWorkbookIdentity');
        }

        if (!this.driveId || !this.itemId) {
            await this.resolveDriveItemFromShareUrl(this.shareUrl);
        }

        if (!this.driveId || !this.itemId) {
            throw new Error('OneDriveSync: Failed to resolve driveId/itemId from shareUrl');
        }

        return {
            driveId: this.driveId,
            itemId: this.itemId
        };
    },

    /**
     * Find the Excel row number for a given Container_ID in the Active_Inventory table.
     * Queries the table via MS Graph and searches the Container_ID column.
     * @param {string|number} containerId - The container ID to find
     * @returns {Promise<number|null>} Excel row number (1-based, accounts for title+header rows), or null if not found
     */
    /**
     * Update an existing Excel row (identified by Container_ID) with metadata.
     * Used when rows are pre-populated with Container_ID and QRContainerID,
     * and the user fills in metadata later via the app.
     * @param {string|number} containerId - The Container_ID of the row to update
     * @param {Object} fieldValues - Metadata fields to write (e.g. {strain, owner, stage, media, tissueCount, date, notes})
     * @returns {Promise<{success: boolean, excelRow?: number}>}
     */
    async updateRowByContainerId(containerId, fieldValues) {
        // CRITICAL SAFETY: Block all writes when in read-only mode
        if (this.readOnlyMode) {
            console.warn('OneDriveSync.updateRowByContainerId BLOCKED: readOnlyMode is enabled');
            return { success: false, blocked: true, reason: 'Read-only mode enabled' };
        }

        if (!this.shareUrl) return { success: false };

        try {
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            // Fetch table columns
            const colResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/columns`, { headers });
            if (!colResp.ok) throw new Error(`Failed to fetch columns: ${colResp.status}`);
            const colJson = await colResp.json();
            const columns = colJson.value || [];

            const normalize = (name) => name ? name.toLowerCase().trim() : '';

            // Find the Container_ID column index
            const idColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['container_id', 'containerid', 'container id', 'raw_id', 'rawid'].includes(n);
            });
            if (idColIndex === -1) throw new Error('Container_ID column not found');

            // Fetch table rows to find the target row
            const rowsResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/rows`, { headers });
            if (!rowsResp.ok) throw new Error(`Failed to fetch rows: ${rowsResp.status}`);
            const rowsJson = await rowsResp.json();
            const rows = rowsJson.value || [];

            const searchId = String(containerId);
            let targetRowIndex = -1;
            let existingValues = null;

            for (let i = 0; i < rows.length; i++) {
                const cellValue = rows[i].values && rows[i].values[0] ? String(rows[i].values[0][idColIndex]) : '';
                if (cellValue === searchId || cellValue === String(parseInt(searchId))) {
                    targetRowIndex = i;
                    existingValues = rows[i].values[0];
                    break;
                }
            }

            if (targetRowIndex === -1) {
                console.warn(`OneDriveSync.updateRowByContainerId: Container_ID ${containerId} not found in Excel`);
                return { success: false };
            }

            // Build updated row values — preserve existing values, only overwrite metadata fields
            const updatedRow = columns.map((col, idx) => {
                const nameNorm = normalize(col.name);

                // Preserve Container_ID and QRContainerID columns (already pre-populated)
                if (['container_id', 'containerid', 'container id', 'raw_id', 'rawid',
                     'barcodevalue', 'barcode_value', 'barcode value',
                     'batch_id', 'batchid', 'batch id',
                     'qrcontainerid', 'qr_container_id', 'qr container id',
                     'qr_url', 'qr link', 'qr', 'qr_destination',
                     'qr code url', 'qr code link', 'qr_url_link'].includes(nameNorm)) {
                    return existingValues[idx] !== undefined ? existingValues[idx] : '';
                }

                // Map metadata fields from fieldValues
                if (['strain_name', 'strain', 'strain id'].includes(nameNorm) && fieldValues.strain !== undefined) {
                    return fieldValues.strain;
                }
                if (['owner', 'owner_name', 'owner name'].includes(nameNorm) && fieldValues.owner !== undefined) {
                    return fieldValues.owner;
                }
                if (nameNorm === 'stage' && fieldValues.stage !== undefined) {
                    return fieldValues.stage;
                }
                if (['location', 'room', 'rack'].includes(nameNorm) && fieldValues.location !== undefined) {
                    return fieldValues.location;
                }
                if (['media', 'media_type', 'media type'].includes(nameNorm) && fieldValues.media !== undefined) {
                    return fieldValues.media;
                }
                if (['quantity', 'tissuecount', 'tissue_count', 'tissue count'].includes(nameNorm) && fieldValues.tissueCount !== undefined) {
                    return fieldValues.tissueCount;
                }
                if (['datecreated', 'date_created', 'date created', 'date'].includes(nameNorm) && fieldValues.date !== undefined) {
                    return fieldValues.date;
                }
                if (['notes', 'comment', 'comments'].includes(nameNorm) && fieldValues.notes !== undefined) {
                    return fieldValues.notes;
                }
                if (['lineage', 'container_lineage', 'lineage_path', 'parent_lineage'].includes(nameNorm) && fieldValues.containerLineage !== undefined) {
                    return fieldValues.containerLineage;
                }
                if (nameNorm === 'status' && fieldValues.status !== undefined) {
                    return fieldValues.status;
                }

                // Preserve any other existing values
                return existingValues[idx] !== undefined ? existingValues[idx] : '';
            });

            // PATCH the row
            const excelRowNum = targetRowIndex + 3; // title + header offset
            const colLetter = String.fromCharCode(65 + columns.length - 1);
            const rangeAddress = `Active_Inventory!A${excelRowNum}:${colLetter}${excelRowNum}`;

            const patchResp = await fetch(`${baseUrl}/worksheets('Active_Inventory')/range(address='${rangeAddress}')`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ values: [updatedRow] })
            });

            if (!patchResp.ok) {
                const text = await patchResp.text();
                throw new Error(`PATCH failed: ${patchResp.status} ${text}`);
            }

            console.log(`OneDriveSync: Updated row ${excelRowNum} for Container_ID ${containerId}`);
            return { success: true, excelRow: excelRowNum };

        } catch (err) {
            console.error('OneDriveSync.updateRowByContainerId error:', err);
            return { success: false };
        }
    },

    /**
     * Read the Container_ID values from specific table rows.
     * Used by QRCodeService to fetch pre-populated IDs for batch entries.
     * @param {number} startRow - Starting Excel row number (1-based)
     * @param {number} count - Number of rows to read
     * @returns {Promise<Array<{excelRow: number, containerId: string}>>}
     */
    async readContainerIdsForRows(startRow, count) {
        if (!this.shareUrl) return [];

        try {
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            // Fetch table columns to find Container_ID and QRContainerID indices
            const colResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/columns`, { headers });
            if (!colResp.ok) return [];
            const colJson = await colResp.json();
            const columns = colJson.value || [];

            const normalize = (name) => name ? name.toLowerCase().trim() : '';
            const idColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['container_id', 'containerid', 'container id', 'raw_id', 'rawid'].includes(n);
            });
            if (idColIndex === -1) return [];

            const qrColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['qrcontainerid', 'qr_container_id', 'qr container id',
                        'qr_url', 'qr link', 'qr', 'qr_destination',
                        'qr code url', 'qr code link', 'qr_url_link'].includes(n);
            });

            // Also find metadata columns to determine if a row has been filled
            const strainColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['strain_name', 'strain', 'strain id'].includes(n);
            });
            const ownerColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['owner', 'owner_name', 'owner name'].includes(n);
            });

            // Read the range of rows
            const endRow = startRow + count - 1;
            const colLetter = String.fromCharCode(65 + columns.length - 1);
            const rangeAddress = `Active_Inventory!A${startRow}:${colLetter}${endRow}`;

            const rangeResp = await fetch(`${baseUrl}/worksheets('Active_Inventory')/range(address='${rangeAddress}')`, { headers });
            if (!rangeResp.ok) return [];
            const rangeJson = await rangeResp.json();
            const values = rangeJson.values || [];

            const results = [];
            for (let i = 0; i < values.length; i++) {
                const row = values[i];
                const id = row[idColIndex];
                if (id !== null && id !== undefined && String(id).trim() !== '') {
                    const entry = {
                        excelRow: startRow + i,
                        containerId: String(id).trim()
                    };

                    // Include QRContainerID URL if available
                    if (qrColIndex >= 0 && row[qrColIndex]) {
                        const qrVal = String(row[qrColIndex]).trim();
                        if (qrVal) entry.qrContainerUrl = qrVal;
                    }

                    // Flag whether metadata is already filled (not blank/pre-populated only)
                    const hasStrain = strainColIndex >= 0 && row[strainColIndex] && String(row[strainColIndex]).trim();
                    const hasOwner = ownerColIndex >= 0 && row[ownerColIndex] && String(row[ownerColIndex]).trim();
                    entry.hasMetadata = !!(hasStrain || hasOwner);

                    results.push(entry);
                }
            }

            return results;
        } catch (err) {
            console.warn('OneDriveSync.readContainerIdsForRows error:', err);
            return [];
        }
    },

    async findContainerRow(containerId) {
        if (!this.shareUrl) return null;

        try {
            if (!this.driveId || !this.itemId) {
                await this.resolveDriveItemFromShareUrl(this.shareUrl);
            }

            const token = await this.acquireToken();
            const baseUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.itemId}/workbook`;
            const authHeader = { 'Authorization': `Bearer ${token}` };

            // Fetch table columns to find Container_ID column index
            const colResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/columns`, { headers: authHeader });
            if (!colResp.ok) return null;
            const colJson = await colResp.json();
            const columns = colJson.value || [];

            const normalize = (name) => name ? name.toLowerCase().trim() : '';
            const idColIndex = columns.findIndex(col => {
                const n = normalize(col.name);
                return ['container_id', 'containerid', 'container id', 'raw_id', 'rawid'].includes(n);
            });
            if (idColIndex === -1) return null;

            // Fetch table rows
            const rowsResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/rows`, { headers: authHeader });
            if (!rowsResp.ok) return null;
            const rowsJson = await rowsResp.json();
            const rows = rowsJson.value || [];

            // Search for matching Container_ID
            const searchId = String(containerId);
            for (let i = 0; i < rows.length; i++) {
                const cellValue = rows[i].values && rows[i].values[0] ? String(rows[i].values[0][idColIndex]) : '';
                if (cellValue === searchId || cellValue === String(parseInt(searchId))) {
                    // Row 1 = title, Row 2 = headers, data starts at row 3
                    // Table row index i (0-based) → Excel row = i + 3
                    return i + 3;
                }
            }

            // Not found — return next available row (append position)
            return rows.length + 3;
        } catch (err) {
            console.warn('OneDriveSync.findContainerRow error:', err);
            return null;
        }
    }
};
