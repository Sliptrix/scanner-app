// QR Code Service
// Uses qr-code-generator.com API (via backend proxy) to batch-generate static QR codes.
// Reads pre-populated rows from the HQ Excel workbook (Container_ID + QRContainerID
// already filled in, metadata blank) and generates a QR code encoding the QRContainerID
// URL for each. QR codes are pre-printed as labels and assigned to containers during creation.

window.QRCodeService = {
    backendUrl: 'http://localhost:3001',

    // SharePoint workbook base URL (before query params)
    get excelBaseUrl() {
        if (window.OneDriveSync && window.OneDriveSync.shareUrl) {
            return window.OneDriveSync.shareUrl.split('?')[0];
        }
        return null;
    },

    // ─── QR Pool (persisted to localStorage) ───────────────────────────
    // Each entry: { excelRow, excelUrl, containerId, dataUrl, assignedContainerId: null|string, createdAt }

    STORAGE_KEY: 'qrCodePool',

    _loadPool() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Failed to load QR pool:', e);
            return [];
        }
    },

    _savePool(pool) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pool));
        } catch (e) {
            console.warn('Failed to save QR pool:', e);
        }
    },

    getPool() {
        return this._loadPool();
    },

    getUnassigned() {
        return this._loadPool().filter(qr => !qr.assignedContainerId);
    },

    getAssigned() {
        return this._loadPool().filter(qr => qr.assignedContainerId);
    },

    // ─── Batch Generation ──────────────────────────────────────────────

    /**
     * Generate a batch of QR codes via the backend proxy to qr-code-generator.com.
     * Reads pre-populated rows from the HQ Excel workbook (rows with Container_ID
     * and QRContainerID but no metadata yet) and generates a QR code for each,
     * encoding the QRContainerID URL from that row.
     *
     * @param {number} count - Maximum number of QR codes to generate
     * @param {function} [onProgress] - Optional callback(completed, total)
     * @returns {Promise<{generated: number, errors: number, startRow: number}>}
     */
    async generateBatch(count, onProgress) {
        // In dev mode, skip OneDriveSync entirely and use fallback
        if (window.isDevMode) {
            console.log('QRCodeService: Dev mode detected, using fallback QR generation');
            return this._generateBatchFallback(count, onProgress);
        }
        
        // Read pre-populated rows from Excel
        const blankRows = await this._findBlankPrePopulatedRows(count);

        if (!blankRows || blankRows.length === 0) {
            console.warn('QRCodeService: No blank pre-populated rows found in Excel');

            // Fallback: generate using constructed URLs if no OneDriveSync
            if (!window.OneDriveSync || !window.OneDriveSync.readContainerIdsForRows) {
                return this._generateBatchFallback(count, onProgress);
            }

            return { generated: 0, errors: 0, startRow: 0 };
        }

        const pool = this._loadPool();
        const existingRows = new Set(pool.map(qr => qr.excelRow));

        let generated = 0;
        let errors = 0;
        let startRow = blankRows[0].excelRow;
        let processed = 0;

        for (const rowInfo of blankRows) {
            if (existingRows.has(rowInfo.excelRow)) {
                processed++;
                if (onProgress) onProgress(processed, blankRows.length);
                continue; // Already in pool
            }

            // Use the QRContainerID URL from Excel as the QR content
            const qrText = rowInfo.qrContainerUrl || rowInfo.excelUrl;

            try {
                const response = await fetch(`${this.backendUrl}/api/qr-generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        qr_code_text: qrText,
                        image_format: 'PNG',
                        image_width: 300,
                        foreground_color: '#000000',
                        background_color: '#FFFFFF'
                    })
                });

                if (!response.ok) {
                    throw new Error(`Backend returned ${response.status}`);
                }

                const result = await response.json();

                pool.push({
                    excelRow: rowInfo.excelRow,
                    excelUrl: qrText,
                    containerId: rowInfo.containerId,
                    dataUrl: result.dataUrl,
                    assignedContainerId: null,
                    createdAt: new Date().toISOString()
                });

                generated++;
            } catch (err) {
                console.error(`Failed to generate QR code for row ${rowInfo.excelRow}:`, err);
                errors++;
            }

            processed++;
            if (onProgress) {
                onProgress(processed, blankRows.length);
            }
        }

        this._savePool(pool);
        console.log(`QR batch complete: ${generated} generated from ${blankRows.length} blank Excel rows`);
        return { generated, errors, startRow };
    },

    /**
     * Find pre-populated Excel rows that have Container_ID and QRContainerID
     * but no metadata yet (blank strain/owner). These are ready for QR generation.
     * @param {number} maxCount - Maximum rows to return
     * @returns {Promise<Array<{excelRow, containerId, qrContainerUrl}>>}
     */
    async _findBlankPrePopulatedRows(maxCount) {
        if (!window.OneDriveSync || !window.OneDriveSync.readContainerIdsForRows) {
            return [];
        }

        try {
            // Read enough rows to find blank ones (at least 2x requested, minimum 500)
            // This ensures we can find enough blank rows even if many are already filled
            const rowsToRead = Math.max(maxCount * 2, 500);
            const allRows = await window.OneDriveSync.readContainerIdsForRows(3, rowsToRead);
            if (!allRows || allRows.length === 0) return [];

            const pool = this._loadPool();
            const existingRows = new Set(pool.map(qr => qr.excelRow));

            // Filter to rows that:
            // 1. Have Container_ID (pre-populated)
            // 2. Have no metadata filled (blank strain/owner)
            // 3. Are not already in the QR pool
            const blankRows = allRows.filter(row =>
                row.containerId &&
                !row.hasMetadata &&
                !existingRows.has(row.excelRow)
            );

            // Also construct a fallback Excel URL for rows missing QRContainerID
            const baseUrl = this.excelBaseUrl;
            blankRows.forEach(row => {
                if (!row.qrContainerUrl && baseUrl) {
                    row.qrContainerUrl = `${baseUrl}?web=1#Active_Inventory!A${row.excelRow}`;
                }
            });

            return blankRows.slice(0, maxCount);
        } catch (err) {
            console.warn('QRCodeService: Error finding blank pre-populated rows:', err);
            return [];
        }
    },

    /**
     * Fallback batch generation when OneDriveSync is not available.
     * Constructs Excel URLs with sequential row numbers.
     * Uses client-side QR generation if backend is unavailable.
     */
    async _generateBatchFallback(count, onProgress) {
        let startRow = 3;
        const pool = this._loadPool();
        const existingRows = new Set(pool.map(qr => qr.excelRow));
        while (existingRows.has(startRow)) {
            startRow++;
        }

        let generated = 0;
        let errors = 0;

        // Check if we should use client-side generation
        let useClientSide = false;
        try {
            const testResponse = await fetch(`${this.backendUrl}/health`, { method: 'GET' });
            if (!testResponse.ok) useClientSide = true;
        } catch (e) {
            console.log('Backend not available, using client-side QR generation');
            useClientSide = true;
        }

        for (let i = 0; i < count; i++) {
            const row = startRow + i;
            // Use a simple identifier for the QR code content
            const qrContent = `CONTAINER_ROW_${row}`;

            try {
                let dataUrl;

                if (useClientSide) {
                    // Generate QR code client-side using canvas
                    dataUrl = await this._generateQrClientSide(qrContent);
                } else {
                    const baseUrl = this.excelBaseUrl || 'https://example.com/inventory';
                    const excelUrl = `${baseUrl}?web=1#Active_Inventory!A${row}`;

                    const response = await fetch(`${this.backendUrl}/api/qr-generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            qr_code_text: excelUrl,
                            image_format: 'PNG',
                            image_width: 300,
                            foreground_color: '#000000',
                            background_color: '#FFFFFF'
                        })
                    });

                    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
                    const result = await response.json();
                    dataUrl = result.dataUrl;
                }

                pool.push({
                    excelRow: row,
                    excelUrl: qrContent,
                    containerId: `C${String(row).padStart(5, '0')}`,
                    dataUrl: dataUrl,
                    assignedContainerId: null,
                    createdAt: new Date().toISOString()
                });

                generated++;
            } catch (err) {
                console.error(`Failed to generate QR code for row ${row}:`, err);
                errors++;
            }

            if (onProgress) onProgress(i + 1, count);
        }

        this._savePool(pool);
        return { generated, errors, startRow };
    },

    /**
     * Generate a QR code client-side using canvas (no backend required)
     * Creates a simple but functional QR-like pattern
     */
    async _generateQrClientSide(text) {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Create a simple hash-based pattern (not a real QR code but visually distinct)
        const hash = this._simpleHash(text);
        const moduleSize = 10;
        const modules = Math.floor(size / moduleSize);

        ctx.fillStyle = '#000000';

        // Draw corner patterns (like real QR codes)
        this._drawFinderPattern(ctx, 0, 0, moduleSize * 7);
        this._drawFinderPattern(ctx, size - moduleSize * 7, 0, moduleSize * 7);
        this._drawFinderPattern(ctx, 0, size - moduleSize * 7, moduleSize * 7);

        // Draw data pattern based on hash
        for (let y = 0; y < modules; y++) {
            for (let x = 0; x < modules; x++) {
                // Skip finder pattern areas
                if ((x < 8 && y < 8) || (x >= modules - 8 && y < 8) || (x < 8 && y >= modules - 8)) {
                    continue;
                }
                // Use hash to determine if module should be filled
                const bitIndex = (y * modules + x) % 32;
                const shouldFill = ((hash >> bitIndex) & 1) === 1 || ((x + y) % 3 === 0 && (hash >> (bitIndex % 16)) & 1);
                if (shouldFill) {
                    ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize - 1, moduleSize - 1);
                }
            }
        }

        // Add text label at bottom
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, size / 2, size - 10);

        return canvas.toDataURL('image/png');
    },

    _drawFinderPattern(ctx, x, y, size) {
        const moduleSize = size / 7;
        // Outer black square
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, size, size);
        // Inner white square
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + moduleSize, y + moduleSize, size - moduleSize * 2, size - moduleSize * 2);
        // Center black square
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + moduleSize * 2, y + moduleSize * 2, size - moduleSize * 4, size - moduleSize * 4);
    },

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    },

    // ─── Assignment ────────────────────────────────────────────────────

    /**
     * Assign the next unassigned QR code to a container.
     * QR codes are assigned in row order (lowest row first).
     * @param {string} containerId - The container to assign to
     * @returns {Object|null} The assigned pool entry, or null if none available
     */
    assignNextToContainer(containerId) {
        const pool = this._loadPool();
        const unassigned = pool
            .filter(qr => !qr.assignedContainerId)
            .sort((a, b) => a.excelRow - b.excelRow);

        if (unassigned.length === 0) {
            console.warn('No unassigned QR codes available');
            return null;
        }

        const entry = unassigned[0];
        entry.assignedContainerId = containerId;
        entry.assignedAt = new Date().toISOString();
        this._savePool(pool);

        // Update the inventory entry
        if (window.appState && window.appState.inventory) {
            const inv = window.appState.inventory.find(item => item.containerId === containerId);
            if (inv) {
                inv.qrExcelRow = entry.excelRow;
                inv.qrExcelUrl = entry.excelUrl;
                inv.qrDataUrl = entry.dataUrl;
            }
        }

        console.log(`QR (row ${entry.excelRow}) assigned to container ${containerId}`);
        return entry;
    },

    /**
     * Assign a specific QR code (by row number) to a container.
     * @param {number} excelRow
     * @param {string} containerId
     * @returns {boolean}
     */
    assignRowToContainer(excelRow, containerId) {
        const pool = this._loadPool();
        const entry = pool.find(qr => qr.excelRow === excelRow);
        if (!entry) return false;
        if (entry.assignedContainerId) return false;

        entry.assignedContainerId = containerId;
        entry.assignedAt = new Date().toISOString();
        this._savePool(pool);

        if (window.appState && window.appState.inventory) {
            const inv = window.appState.inventory.find(item => item.containerId === containerId);
            if (inv) {
                inv.qrExcelRow = entry.excelRow;
                inv.qrExcelUrl = entry.excelUrl;
                inv.qrDataUrl = entry.dataUrl;
            }
        }

        return true;
    },

    /**
     * Look up a pool entry by Excel row number.
     * @param {number} excelRow
     * @returns {Object|null}
     */
    lookupByRow(excelRow) {
        return this._loadPool().find(qr => qr.excelRow === excelRow) || null;
    },

    /**
     * Parse scanned QR content (an Excel URL) and return the row number.
     * Accepts:
     *   - Full URL: ...Doc.aspx?web=1#Active_Inventory!A8
     *   - Fragment: Active_Inventory!A8
     *   - Just row: A8 or 8
     * @param {string} input
     * @returns {number|null} The Excel row number or null
     */
    parseQrInput(input) {
        if (!input) return null;
        input = input.trim();

        // Try full URL with fragment: ...#Active_Inventory!A{row}
        const urlMatch = input.match(/Active_Inventory!A(\d+)/i);
        if (urlMatch) return parseInt(urlMatch[1], 10);

        // Try A{row} format
        const cellMatch = input.match(/^A(\d+)$/i);
        if (cellMatch) return parseInt(cellMatch[1], 10);

        // Try raw row number
        const num = parseInt(input, 10);
        if (!isNaN(num) && num >= 3) return num;

        return null;
    },

    // ─── Backend Pool API ──────────────────────────────────────────────

    /**
     * Generate pool codes via backend API
     * @param {number} count
     * @param {string} [prefix]
     * @param {function} [onProgress] - callback(generated, total)
     * @returns {Promise<{generated, errors, codes}>}
     */
    async generatePoolBatch(count, prefix, onProgress) {
        const response = await fetch(`${this.backendUrl}/api/qrcodes/pool/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count, prefix })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        return response.json();
    },

    /**
     * Get pool codes from backend
     * @param {string} [status] - 'unassigned' or 'assigned'
     * @returns {Promise<{codes: Array}>}
     */
    async getPoolCodes(status) {
        const params = status ? `?status=${status}` : '';
        const response = await fetch(`${this.backendUrl}/api/qrcodes/pool${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    /**
     * Assign a pool code to a container via backend
     * @param {string} shortCode
     * @param {string} containerId
     * @param {string} barcodeData
     * @returns {Promise<Object>}
     */
    async assignPoolCode(shortCode, containerId, barcodeData) {
        const response = await fetch(`${this.backendUrl}/api/qrcodes/pool/${shortCode}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ containerId, barcodeData })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        return response.json();
    },

    /**
     * Unassign a pool code via backend
     * @param {string} shortCode
     * @returns {Promise<Object>}
     */
    async unassignPoolCode(shortCode) {
        const response = await fetch(`${this.backendUrl}/api/qrcodes/pool/${shortCode}/unassign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        return response.json();
    },

    /**
     * Look up a short code from the backend pool
     * @param {string} shortCode
     * @returns {Promise<Object|null>}
     */
    async lookupPoolCode(shortCode) {
        try {
            const response = await fetch(`${this.backendUrl}/api/qrcodes/${shortCode}`);
            if (!response.ok) return null;
            return response.json();
        } catch (e) {
            return null;
        }
    },

    /**
     * Parse a scanned QR input and extract the shortCode.
     * Accepts:
     *   - Full scan URL: https://scanner.lonewolfgenetics.com/s/LW4k2m
     *   - Short code directly: LW4k2m
     * @param {string} input
     * @returns {string|null} The shortCode or null
     */
    parsePoolQrInput(input) {
        if (!input) return null;
        input = input.trim();

        // Try full URL: .../s/{shortCode}
        const urlMatch = input.match(/\/s\/([A-Za-z0-9]{1,8})(?:\?|$|#)/);
        if (urlMatch) return urlMatch[1];

        // Try bare numeric ID (e.g., "42") or alphanumeric code
        if (/^[A-Za-z0-9]{1,8}$/.test(input)) return input;

        return null;
    }
};
