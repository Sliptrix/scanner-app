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
    inventoryTableName: 'tblActiveInventory', // Excel table name for Active_Inventory

    // State
    refreshInterval: null,
    isRunning: false,
    lastSync: null,
    lastError: null,
    fromCloud: false,
    hasShownErrorThisSession: false,
    driveId: null,
    itemId: null,

    // Cache keys
    CACHE_KEYS: {
        META: 'cloud:onedrive:meta',
        LAST_SYNC: 'cloud:onedrive:lastSync',
        LAST_ERROR: 'cloud:onedrive:lastError'
    },

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

            // Record success
            this.lastSync = new Date().toISOString();
            this.lastError = null;
            this.fromCloud = true;
            localStorage.setItem(this.CACHE_KEYS.LAST_SYNC, this.lastSync);
            localStorage.removeItem(this.CACHE_KEYS.LAST_ERROR);

            // Update UI
            this.updateStatusUI();

            // Show success notification
            if (window.NotificationSystem) {
                window.NotificationSystem.success('✅ Synced from cloud successfully');
            }

            console.log('OneDriveSync: Manual sync completed successfully');
            return { success: true, source: 'cloud', mapping };

        } catch (error) {
            console.error('OneDriveSync: Manual sync failed:', error);

            // Record error
            this.lastError = error.message;
            localStorage.setItem(this.CACHE_KEYS.LAST_ERROR, this.lastError);

            // Update UI
            this.updateStatusUI();

            // Show error notification (once per session)
            if (window.NotificationSystem && !this.hasShownErrorThisSession) {
                window.NotificationSystem.warn(`Cloud sync failed: ${error.message}. Using local data.`);
                this.hasShownErrorThisSession = true;
            }

            // Fall back to local data
            await this.loadLocalJsonFallback();

            return { success: false, error: error.message };

        } finally {
            this.isRunning = false;
            this.updateButtonState(false);
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
     * Acquire access token for Microsoft Graph API
     * @returns {Promise<string>} Access token
     */
    async acquireToken() {
        if (!this.authManager) {
            throw new Error('AuthManager not initialized');
        }

        try {
            // Try silent token acquisition first
            const tokenResponse = await this.authManager.msalInstance.acquireTokenSilent(
                this.authManager.loginRequest
            );
            return tokenResponse.accessToken;

        } catch (error) {
            console.warn('Silent token acquisition failed:', error);

            // Fall back to interactive if allowed
            if (this.allowInteractiveAuth) {
                try {
                    const tokenResponse = await this.authManager.msalInstance.acquireTokenPopup(
                        this.authManager.loginRequest
                    );
                    return tokenResponse.accessToken;
                } catch (interactiveError) {
                    console.error('Interactive token acquisition failed:', interactiveError);
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

        const response = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
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
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        // Find target sheet (prefer "strain_owner_mapping", else first sheet)
        let targetSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'strain_owner_mapping'
        );

        if (!targetSheetName) {
            targetSheetName = workbook.SheetNames[0];
            console.log(`OneDriveSync: Sheet "strain_owner_mapping" not found, using first sheet: ${targetSheetName}`);
        }

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
            strain: ['strain', 'strain_id', 'id'],
            owner: ['owner', 'owner_name', 'owner email', 'email']
        };

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
                }
            } else if (index === 0) {
                // Only throw error on first row (header mismatch)
                throw new Error('Excel schema error: Missing required columns. Expected "strain" and "owner" (or synonyms)');
            }
            // Otherwise, silently skip empty rows
        });

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

        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        // Locate Active_Inventory sheet (case-insensitive)
        let targetSheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() === 'active_inventory'
        );

        if (!targetSheetName) {
            throw new Error('Active_Inventory sheet not found in workbook');
        }

        const sheet = workbook.Sheets[targetSheetName];
        if (!sheet) {
            throw new Error(`Sheet "${targetSheetName}" not found in workbook`);
        }

        // Header row is row 2, data starts row 3 → use range: 1 (0-based index)
        const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 });
        if (rows.length === 0) {
            console.warn('OneDriveSync: Active_Inventory sheet is empty');
            return [];
        }

        // Normalize header keys and map to app inventory objects
        const inventory = [];

        const getField = (row, candidates) => {
            for (const key of Object.keys(row)) {
                const normalizedKey = key.toLowerCase().trim();
                if (candidates.includes(normalizedKey)) {
                    return row[key];
                }
            }
            return undefined;
        };

        rows.forEach(row => {
            // Prefer explicit Raw_ID / BarcodeValue if present
            const rawIdValue = getField(row, ['raw_id', 'rawid', 'raw id']);
            const barcodeValue = getField(row, ['barcodevalue', 'barcode_value', 'barcode value']);
            const batchIdValue = getField(row, ['batch_id', 'batchid', 'batch id']);

            let prefix = null;
            let rawIdNumeric = null;

            // Try to parse from Batch_ID if needed
            if (!rawIdValue && batchIdValue) {
                const parsed = this.parseBatchId(String(batchIdValue));
                if (parsed) {
                    prefix = parsed.prefix;
                    rawIdNumeric = parsed.rawIdNumeric;
                }
            }

            // If Raw_ID exists, prefer it
            if (rawIdValue !== undefined && rawIdValue !== null && rawIdValue !== '') {
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

            if (!rawIdNumeric) {
                // If we can't derive a numeric ID, skip this row to avoid corrupt state
                console.warn('OneDriveSync: Skipping row with no numeric Raw_ID / BarcodeValue:', row);
                return;
            }

            const containerId = String(rawIdNumeric).padStart(6, '0');

            const strainName = getField(row, ['strain_name', 'strain', 'strain id']);
            const ownerName = getField(row, ['owner', 'owner_name', 'owner name']);
            const stage = getField(row, ['stage']);
            const location = getField(row, ['location', 'room', 'rack']);
            const media = getField(row, ['media', 'media_type', 'media type']);
            const quantity = getField(row, ['quantity', 'tissuecount', 'tissue_count', 'tissue count']);
            const dateCreated = getField(row, ['datecreated', 'date_created', 'date created', 'date']);
            const notes = getField(row, ['notes', 'comment', 'comments']);

            const invEntry = {
                containerId: containerId,
                strain: strainName || '',
                owner: ownerName || '',
                stage: stage || '',
                media: media || '',
                tissueCount: quantity ? parseInt(quantity, 10) || 1 : 1,
                date: dateCreated || '',
                status: 'Active',
                location: location || ''
            };

            // Preserve Batch_ID and prefix as optional metadata
            if (batchIdValue) {
                invEntry.batchId = String(batchIdValue);
            }
            if (prefix) {
                invEntry.containerPrefix = prefix;
            }

            inventory.push(invEntry);
        });

        console.log(`OneDriveSync: Parsed ${inventory.length} inventory rows from Active_Inventory`);
        return inventory;
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

        window.StateManager.setState('inventory', inventory);

        // Update highestContainerId based on numeric portion
        const maxId = inventory.reduce((max, item) => {
            const num = parseInt(item.containerId, 10);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        window.StateManager.setState('highestContainerId', maxId);

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
     * Append new inventory rows from app state to the cloud Active_Inventory table
     * This is append-only: existing rows (by Raw_ID) are never modified.
     * Requires the Active_Inventory range to be an Excel table (e.g., tblActiveInventory).
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async appendNewInventoryRowsToCloud() {
        console.log('OneDriveSync: Appending new inventory rows to cloud Active_Inventory table...');

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
            return ['raw_id', 'rawid', 'raw id', 'barcodevalue', 'barcode_value', 'barcode value'].includes(n);
        });
        if (rawIdIndex === -1) {
            throw new Error('OneDriveSync: Could not locate Raw_ID/BarcodeValue column in inventory table');
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
                const num = parseInt(v, 10);
                if (!isNaN(num)) {
                    existingRawIds.add(String(num));
                }
            }
        });

        console.log(`OneDriveSync: Found ${existingRawIds.size} existing Raw_IDs in cloud inventory table`);

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

        inventory.forEach(item => {
            if (!item || !item.containerId) return;

            const rawNum = parseInt(item.containerId, 10);
            if (isNaN(rawNum)) return;

            const rawKey = String(rawNum);
            if (existingRawIds.has(rawKey)) {
                // Already present in workbook; skip
                return;
            }

            // Build a row in the same column order as the table
            const rowValues = columns.map(col => {
                const nameNorm = normalize(col.name);

                if (['raw_id', 'rawid', 'raw id', 'barcodevalue', 'barcode_value', 'barcode value'].includes(nameNorm)) {
                    return rawNum;
                }

                if (['batch_id', 'batchid', 'batch id'].includes(nameNorm)) {
                    if (item.batchId) return item.batchId;
                    const prefix = item.containerPrefix || 'LWG';
                    return `${prefix}${String(rawNum).padStart(6, '0')}`;
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

                // Default: empty cell
                return '';
            });

            rowsToAdd.push(rowValues);
        });

        if (!rowsToAdd.length) {
            console.log('OneDriveSync: No new inventory rows to append (all Raw_IDs already present)');
            if (window.NotificationSystem) {
                window.NotificationSystem.info('No new inventory rows to sync to cloud');
            }
            return { success: true, count: 0 };
        }

        // 4) Append rows via Graph table rows/add endpoint
        const addResp = await fetch(`${baseUrl}/tables('${this.inventoryTableName}')/rows/add`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ values: rowsToAdd })
        });

        if (!addResp.ok) {
            const text = await addResp.text();
            throw new Error(`Failed to append inventory rows: ${addResp.status} ${text}`);
        }

        console.log(`OneDriveSync: Appended ${rowsToAdd.length} new inventory rows to cloud`);
        if (window.NotificationSystem) {
            window.NotificationSystem.success(`📤 Synced ${rowsToAdd.length} new inventory rows to cloud Active_Inventory`);
        }

        return { success: true, count: rowsToAdd.length };
    },

    /**
     * Update status UI element
     */
    updateStatusUI() {
        if (!this.statusElementId) return;

        const statusElement = document.getElementById(this.statusElementId);
        if (!statusElement) return;

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
    }
};
