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

    // State
    refreshInterval: null,
    isRunning: false,
    lastSync: null,
    lastError: null,
    fromCloud: false,
    // Safety flag: full workbook overwrite via uploadFile is disabled
    // unless this is explicitly set to true in a controlled context.
    allowFullWorkbookOverwrite: false,
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
        if (options.strainMappingTableName) {
            this.strainMappingTableName = options.strainMappingTableName;
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
                window.NotificationSystem.warning(`Cloud sync failed: ${error.message}. Using local data.`);
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

            const strainName = getField(row, ['strain_name', 'strain', 'strain id']);
            const ownerName = getField(row, ['owner', 'owner_name', 'owner name']);
            const stage = getField(row, ['stage']);
            const location = getField(row, ['location', 'room', 'rack']);
            const media = getField(row, ['media', 'media_type', 'media type']);
            const quantity = getField(row, ['quantity', 'tissuecount', 'tissue_count', 'tissue count']);
            const dateCreated = getField(row, ['datecreated', 'date_created', 'date created', 'date']);
            const notes = getField(row, ['notes', 'comment', 'comments']);
            const lineage = getField(row, ['lineage', 'container_lineage', 'lineage_path', 'parent_lineage']);
            const statusField = getField(row, ['status']);

            // Skip pre-populated rows that have Container_ID/QRContainerID but no metadata yet
            const hasMetadata = strainName || ownerName || stage || media || dateCreated;
            if (!hasMetadata) {
                console.log(`OneDriveSync: Skipping pre-populated but incomplete row (Container_ID: ${containerId})`);
                return;
            }

            const invEntry = {
                containerId: containerId,
                strain: strainName || '',
                owner: ownerName || '',
                stage: stage || '',
                media: media || '',
                tissueCount: quantity ? parseInt(quantity, 10) || 1 : 1,
                date: dateCreated || '',
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
