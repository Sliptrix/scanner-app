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
     * @param {ArrayBuffer} arrayBuffer - Excel file data
     * @returns {Promise<Object>} Strain-owner mapping
     */
    async parseMappingFromWorkbook(arrayBuffer) {
        console.log('OneDriveSync: Parsing Excel workbook...');

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
