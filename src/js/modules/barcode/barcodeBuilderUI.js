/**
 * LONEWOLF BIOTECH - Barcode Builder UI
 * Phase 5: Enhanced Barcode Generation & Print Queue
 * 
 * Features:
 * - Batch barcode generation (multiple at once)
 * - Barcode preview before printing
 * - Custom label templates
 * - QR code option (in addition to Code128)
 * - Label size/format options
 * - Print queue management
 * - Duplicate detection
 * - Format validation
 */

window.BarcodeBuilderUI = (function() {
    'use strict';

    // Print queue
    let printQueue = [];
    const QUEUE_STORAGE_KEY = 'barcode_print_queue';
    const PRINT_HISTORY_KEY = 'barcode_print_history';

    // Label templates
    const LABEL_TEMPLATES = {
        standard: {
            name: 'Standard (2" x 1")',
            width: 2,
            height: 1,
            barcodeType: 'qr',
            showText: true,
            fontSize: 12
        },
        small: {
            name: 'Small (1.5" x 0.5")',
            width: 1.5,
            height: 0.5,
            barcodeType: 'qr',
            showText: true,
            fontSize: 10
        },
        large: {
            name: 'Large (3" x 1.5")',
            width: 3,
            height: 1.5,
            barcodeType: 'qr',
            showText: true,
            fontSize: 14
        },
        qrOnly: {
            name: 'QR Only (1" x 1")',
            width: 1,
            height: 1,
            barcodeType: 'qr',
            showText: false
        },
        code128: {
            name: 'Code128 (2.5" x 1")',
            width: 2.5,
            height: 1,
            barcodeType: 'code128',
            showText: true,
            fontSize: 12
        }
    };

    // Barcode format configurations
    const BARCODE_FORMATS = {
        qr: {
            name: 'QR Code',
            description: 'Square, scannable from any angle',
            generator: 'generateQRCode'
        },
        code128: {
            name: 'Code128',
            description: 'Linear barcode, high density',
            generator: 'generateCode128'
        }
    };

    /**
     * Initialize the builder
     */
    function initialize() {
        loadPrintQueue();
        console.log('BarcodeBuilderUI initialized');
    }

    /**
     * Show the barcode builder modal
     */
    function showModal() {
        const modal = createBuilderModal();
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    /**
     * Create the builder modal HTML
     */
    function createBuilderModal() {
        const modal = document.createElement('div');
        modal.className = 'modal barcode-builder-modal';
        modal.id = 'barcodeBuilderModal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>🏷️ Barcode Builder</h2>
                    <button class="modal-close" onclick="BarcodeBuilderUI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="builder-tabs">
                        <button class="tab-btn active" onclick="BarcodeBuilderUI.switchTab('generate')">
                            Generate Barcodes
                        </button>
                        <button class="tab-btn" onclick="BarcodeBuilderUI.switchTab('queue')">
                            Print Queue <span class="queue-badge" id="queueBadge">0</span>
                        </button>
                        <button class="tab-btn" onclick="BarcodeBuilderUI.switchTab('history')">
                            Print History
                        </button>
                    </div>

                    <!-- Generate Tab -->
                    <div class="tab-content active" id="tabGenerate">
                        <div class="builder-grid">
                            <div class="builder-form">
                                <h3>Create Labels</h3>
                                
                                <div class="form-section">
                                    <label>Generation Mode</label>
                                    <div class="mode-selector">
                                        <label class="radio-card">
                                            <input type="radio" name="genMode" value="single" checked 
                                                   onchange="BarcodeBuilderUI.setGenerationMode('single')">
                                            <span class="card-content">
                                                <span class="card-icon">📋</span>
                                                <span class="card-title">Single</span>
                                                <span class="card-desc">One container</span>
                                            </span>
                                        </label>
                                        <label class="radio-card">
                                            <input type="radio" name="genMode" value="batch"
                                                   onchange="BarcodeBuilderUI.setGenerationMode('batch')">
                                            <span class="card-content">
                                                <span class="card-icon">📦</span>
                                                <span class="card-title">Batch</span>
                                                <span class="card-desc">Multiple at once</span>
                                            </span>
                                        </label>
                                        <label class="radio-card">
                                            <input type="radio" name="genMode" value="reprint"
                                                   onchange="BarcodeBuilderUI.setGenerationMode('reprint')">
                                            <span class="card-content">
                                                <span class="card-icon">🔄</span>
                                                <span class="card-title">Reprint</span>
                                                <span class="card-desc">Existing containers</span>
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Single/Batch Container Input -->
                                <div id="singleBatchInputs">
                                    <div class="form-section">
                                        <label for="containerIdInput">Container ID(s)</label>
                                        <input type="text" id="containerIdInput" 
                                               placeholder="Enter container ID or range (e.g., 100-105)"
                                               onchange="BarcodeBuilderUI.validateContainerInput()">
                                        <small class="form-help">
                                            Single: "123" | Range: "100-105" | Multiple: "100,101,102"
                                        </small>
                                        <div id="containerValidation" class="validation-message"></div>
                                    </div>

                                    <div class="form-row" id="batchCountRow" style="display: none;">
                                        <div class="form-section">
                                            <label for="batchCount">Number of Labels</label>
                                            <input type="number" id="batchCount" min="1" max="100" value="5">
                                        </div>
                                        <div class="form-section">
                                            <label for="batchStartId">Starting ID</label>
                                            <input type="number" id="batchStartId" placeholder="Auto">
                                        </div>
                                    </div>
                                </div>

                                <!-- Reprint Container Selector -->
                                <div id="reprintInputs" style="display: none;">
                                    <div class="form-section">
                                        <label>Select Containers to Reprint</label>
                                        <input type="text" id="reprintSearch" 
                                               placeholder="Search containers..."
                                               oninput="BarcodeBuilderUI.filterReprintList()">
                                        <div class="reprint-container-list" id="reprintContainerList">
                                            <!-- Populated dynamically -->
                                        </div>
                                    </div>
                                </div>

                                <div class="form-section">
                                    <label for="labelTemplate">Label Template</label>
                                    <select id="labelTemplate" onchange="BarcodeBuilderUI.updatePreview()">
                                        ${Object.entries(LABEL_TEMPLATES).map(([key, tmpl]) => 
                                            `<option value="${key}">${tmpl.name}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="form-section">
                                    <label for="barcodeFormat">Barcode Format</label>
                                    <select id="barcodeFormat" onchange="BarcodeBuilderUI.updatePreview()">
                                        ${Object.entries(BARCODE_FORMATS).map(([key, fmt]) => 
                                            `<option value="${key}">${fmt.name} - ${fmt.description}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="form-section">
                                    <label>
                                        <input type="checkbox" id="includeMetadata" checked>
                                        Include container metadata in barcode
                                    </label>
                                </div>

                                <div class="builder-actions">
                                    <button class="btn btn-primary" onclick="BarcodeBuilderUI.generateLabels()">
                                        🏷️ Generate Labels
                                    </button>
                                    <button class="btn btn-secondary" onclick="BarcodeBuilderUI.addToQueue()">
                                        ➕ Add to Queue
                                    </button>
                                </div>
                            </div>

                            <div class="builder-preview">
                                <h3>Preview</h3>
                                <div class="preview-container" id="labelPreview">
                                    <div class="preview-placeholder">
                                        <span>📋</span>
                                        <p>Enter container ID to preview</p>
                                    </div>
                                </div>
                                <div class="preview-info" id="previewInfo"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Queue Tab -->
                    <div class="tab-content" id="tabQueue">
                        <div class="queue-header">
                            <h3>Print Queue</h3>
                            <div class="queue-actions">
                                <button class="btn btn-primary" onclick="BarcodeBuilderUI.printQueue()" 
                                        id="printQueueBtn" disabled>
                                    🖨️ Print All
                                </button>
                                <button class="btn btn-secondary" onclick="BarcodeBuilderUI.clearQueue()">
                                    🗑️ Clear Queue
                                </button>
                            </div>
                        </div>
                        <div class="queue-list" id="printQueueList">
                            <div class="queue-empty">Queue is empty</div>
                        </div>
                    </div>

                    <!-- History Tab -->
                    <div class="tab-content" id="tabHistory">
                        <div class="history-header">
                            <h3>Print History</h3>
                            <button class="btn btn-secondary" onclick="BarcodeBuilderUI.clearHistory()">
                                🗑️ Clear History
                            </button>
                        </div>
                        <div class="history-list" id="printHistoryList">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize after DOM is ready
        setTimeout(() => {
            updateQueueDisplay();
            updateHistoryDisplay();
            populateReprintList();
        }, 100);

        return modal;
    }

    /**
     * Close the modal
     */
    function closeModal() {
        const modal = document.getElementById('barcodeBuilderModal');
        if (modal) modal.remove();
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`.tab-btn[onclick*="${tabName}"]`)?.classList.add('active');
        document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');

        if (tabName === 'queue') updateQueueDisplay();
        if (tabName === 'history') updateHistoryDisplay();
    }

    /**
     * Set generation mode (single/batch/reprint)
     */
    function setGenerationMode(mode) {
        const singleBatch = document.getElementById('singleBatchInputs');
        const reprint = document.getElementById('reprintInputs');
        const batchCount = document.getElementById('batchCountRow');

        if (mode === 'reprint') {
            singleBatch.style.display = 'none';
            reprint.style.display = 'block';
            populateReprintList();
        } else {
            singleBatch.style.display = 'block';
            reprint.style.display = 'none';
            batchCount.style.display = mode === 'batch' ? 'flex' : 'none';
        }
    }

    /**
     * Validate container input
     */
    function validateContainerInput() {
        const input = document.getElementById('containerIdInput');
        const validation = document.getElementById('containerValidation');
        const value = input.value.trim();

        if (!value) {
            validation.innerHTML = '';
            return { valid: false, ids: [] };
        }

        const result = parseContainerInput(value);
        
        if (result.error) {
            validation.innerHTML = `<span class="error">❌ ${result.error}</span>`;
            return { valid: false, ids: [] };
        }

        // Check for duplicates in inventory
        const duplicates = checkForDuplicates(result.ids);
        
        if (duplicates.length > 0) {
            validation.innerHTML = `
                <span class="warning">⚠️ ${duplicates.length} container(s) already exist: ${duplicates.join(', ')}</span>
            `;
        } else {
            validation.innerHTML = `
                <span class="success">✅ ${result.ids.length} container(s) will be generated</span>
            `;
        }

        updatePreview();
        return { valid: true, ids: result.ids, duplicates };
    }

    /**
     * Parse container input (single, range, or list)
     */
    function parseContainerInput(value) {
        const ids = [];
        
        // Check for range format (100-105)
        if (value.includes('-') && !value.includes(',')) {
            const [start, end] = value.split('-').map(s => parseInt(s.trim()));
            if (isNaN(start) || isNaN(end)) {
                return { error: 'Invalid range format' };
            }
            if (end < start) {
                return { error: 'End must be greater than start' };
            }
            if (end - start > 99) {
                return { error: 'Range too large (max 100 labels)' };
            }
            for (let i = start; i <= end; i++) {
                ids.push(i);
            }
        }
        // Check for list format (100,101,102)
        else if (value.includes(',')) {
            const parts = value.split(',').map(s => s.trim());
            for (const part of parts) {
                const num = parseInt(part);
                if (isNaN(num)) {
                    return { error: `Invalid ID: ${part}` };
                }
                ids.push(num);
            }
        }
        // Single ID
        else {
            const num = parseInt(value);
            if (isNaN(num)) {
                return { error: 'Invalid container ID' };
            }
            ids.push(num);
        }

        return { ids };
    }

    /**
     * Check for duplicate container IDs
     */
    function checkForDuplicates(ids) {
        const inventory = window.appState?.inventory || [];
        const existingIds = new Set(inventory.map(item => parseInt(item.containerId)));
        
        return ids.filter(id => existingIds.has(id));
    }

    /**
     * Update the barcode preview
     */
    function updatePreview() {
        const preview = document.getElementById('labelPreview');
        const previewInfo = document.getElementById('previewInfo');
        const input = document.getElementById('containerIdInput');
        const template = LABEL_TEMPLATES[document.getElementById('labelTemplate').value];
        const format = document.getElementById('barcodeFormat').value;

        if (!input.value.trim()) {
            preview.innerHTML = `
                <div class="preview-placeholder">
                    <span>📋</span>
                    <p>Enter container ID to preview</p>
                </div>
            `;
            previewInfo.innerHTML = '';
            return;
        }

        const result = parseContainerInput(input.value.trim());
        if (result.error) return;

        const containerId = result.ids[0];
        
        // Generate preview barcode
        const barcodeData = generateBarcodeData(containerId, format);
        
        preview.innerHTML = `
            <div class="label-preview" style="
                width: ${template.width * 96}px; 
                height: ${template.height * 96}px;
                padding: 8px;
                border: 2px dashed #e2e8f0;
                display: flex;
                align-items: center;
                gap: 12px;
                background: white;
            ">
                <div class="barcode-image">
                    ${barcodeData.svg}
                </div>
                ${template.showText ? `
                    <div class="barcode-text" style="font-size: ${template.fontSize}px; font-weight: bold;">
                        ${containerId}
                    </div>
                ` : ''}
            </div>
        `;

        previewInfo.innerHTML = `
            <div class="preview-details">
                <span><strong>Template:</strong> ${template.name}</span>
                <span><strong>Format:</strong> ${BARCODE_FORMATS[format].name}</span>
                <span><strong>Labels:</strong> ${result.ids.length}</span>
            </div>
        `;
    }

    /**
     * Generate barcode data
     */
    function generateBarcodeData(containerId, format = 'qr') {
        const container = findContainer(containerId);
        let dataString = String(containerId);

        // Include metadata if checkbox is checked
        if (document.getElementById('includeMetadata')?.checked && container) {
            dataString = buildMetadataString(container);
        }

        if (format === 'qr') {
            return {
                svg: generateQRSVG(dataString),
                data: dataString
            };
        } else {
            return {
                svg: generateCode128SVG(dataString),
                data: dataString
            };
        }
    }

    /**
     * Build metadata string for barcode
     */
    function buildMetadataString(container) {
        // Use the same format as Code128BarcodeGenerator
        const owner = (container.owner || 'LAB').toUpperCase().substring(0, 3);
        const strain = String(container.strain || '00000').padStart(5, '0');
        const media = (container.media || 'M1').toUpperCase().substring(0, 3);
        const stage = String(container.stage || '1').charAt(0);
        const tissue = String(container.tissueCount || 1).padStart(2, '0');
        const date = formatDateForBarcode(container.date || new Date());

        return `${owner}${strain}${media}${stage}${tissue}${date}`;
    }

    /**
     * Format date for barcode (YYYYMMDD)
     */
    function formatDateForBarcode(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            const now = new Date();
            return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        }
        return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    }

    /**
     * Generate simple QR code SVG
     */
    function generateQRSVG(data) {
        // Use existing QRCodeService if available
        if (window.QRCodeService && window.QRCodeService._generateQrClientSide) {
            // Return a placeholder - actual QR would be async
            return createQRPlaceholder(data);
        }
        return createQRPlaceholder(data);
    }

    /**
     * Create QR placeholder with pattern
     */
    function createQRPlaceholder(data) {
        const size = 80;
        const moduleSize = 4;
        const hash = simpleHash(data);
        
        let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${size}" height="${size}" fill="white"/>`;
        
        // Draw finder patterns
        svg += drawFinderPattern(2, 2, 14);
        svg += drawFinderPattern(size - 16, 2, 14);
        svg += drawFinderPattern(2, size - 16, 14);
        
        // Draw data pattern
        for (let y = 0; y < (size - 4) / moduleSize; y++) {
            for (let x = 0; x < (size - 4) / moduleSize; x++) {
                // Skip finder pattern areas
                if ((x < 5 && y < 5) || (x >= 14 && y < 5) || (x < 5 && y >= 14)) continue;
                
                const bitIndex = (y * 20 + x) % 32;
                const shouldFill = ((hash >> bitIndex) & 1) === 1;
                
                if (shouldFill) {
                    const px = 2 + x * moduleSize;
                    const py = 2 + y * moduleSize;
                    svg += `<rect x="${px}" y="${py}" width="${moduleSize - 1}" height="${moduleSize - 1}" fill="black"/>`;
                }
            }
        }
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Draw QR finder pattern
     */
    function drawFinderPattern(x, y, size) {
        const outer = size;
        const middle = size - 4;
        const inner = size - 8;
        
        return `
            <rect x="${x}" y="${y}" width="${outer}" height="${outer}" fill="black"/>
            <rect x="${x + 2}" y="${y + 2}" width="${middle}" height="${middle}" fill="white"/>
            <rect x="${x + 4}" y="${y + 4}" width="${inner}" height="${inner}" fill="black"/>
        `;
    }

    /**
     * Generate Code128 SVG
     */
    function generateCode128SVG(data) {
        // Use existing Code128BarcodeGenerator if available
        if (window.Code128BarcodeGenerator) {
            const result = Code128BarcodeGenerator.generateSVGBarcode(data);
            // Scale down for preview
            return result.replace(/width="\d+"/, 'width="150"').replace(/height="\d+"/, 'height="60"');
        }
        
        // Fallback simple barcode
        const width = 150;
        const height = 60;
        const barWidth = 2;
        
        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
        svg += `<rect width="${width}" height="${height}" fill="white"/>`;
        
        for (let i = 0; i < data.length * 6; i++) {
            if (i % 2 === 0) {
                const x = 10 + i * barWidth;
                svg += `<rect x="${x}" y="5" width="${barWidth}" height="40" fill="black"/>`;
            }
        }
        
        svg += `<text x="${width/2}" y="${height - 5}" text-anchor="middle" font-size="10" font-family="monospace">${data}</text>`;
        svg += '</svg>';
        
        return svg;
    }

    /**
     * Simple hash function
     */
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * Find container in inventory
     */
    function findContainer(containerId) {
        const inventory = window.appState?.inventory || [];
        return inventory.find(item => 
            String(item.containerId) === String(containerId)
        );
    }

    /**
     * Populate reprint container list
     */
    function populateReprintList() {
        const list = document.getElementById('reprintContainerList');
        if (!list) return;

        const inventory = window.appState?.inventory || [];
        
        if (inventory.length === 0) {
            list.innerHTML = '<div class="empty-list">No containers in inventory</div>';
            return;
        }

        list.innerHTML = inventory.slice(0, 50).map(item => `
            <label class="container-checkbox">
                <input type="checkbox" value="${item.containerId}" 
                       data-container='${JSON.stringify(item).replace(/'/g, "&apos;")}'>
                <span class="checkbox-label">
                    <strong>${item.containerId}</strong>
                    <span>${item.strain || 'Unknown'} - ${item.stage || 'N/A'}</span>
                </span>
            </label>
        `).join('');
    }

    /**
     * Filter reprint list
     */
    function filterReprintList() {
        const search = document.getElementById('reprintSearch').value.toLowerCase();
        const items = document.querySelectorAll('#reprintContainerList .container-checkbox');
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(search) ? 'flex' : 'none';
        });
    }

    /**
     * Generate labels and show preview
     */
    function generateLabels() {
        const mode = document.querySelector('input[name="genMode"]:checked').value;
        let containers = [];

        if (mode === 'reprint') {
            const checked = document.querySelectorAll('#reprintContainerList input:checked');
            checked.forEach(cb => {
                try {
                    containers.push(JSON.parse(cb.dataset.container.replace(/&apos;/g, "'")));
                } catch (e) {
                    containers.push({ containerId: cb.value });
                }
            });
        } else {
            const validation = validateContainerInput();
            if (!validation.valid) {
                NotificationSystem?.error('Invalid container input');
                return;
            }
            containers = validation.ids.map(id => ({ containerId: id }));
        }

        if (containers.length === 0) {
            NotificationSystem?.error('No containers selected');
            return;
        }

        // Generate and print
        printLabels(containers);
    }

    /**
     * Add labels to print queue
     */
    function addToQueue() {
        const mode = document.querySelector('input[name="genMode"]:checked').value;
        let containers = [];

        if (mode === 'reprint') {
            const checked = document.querySelectorAll('#reprintContainerList input:checked');
            checked.forEach(cb => {
                try {
                    containers.push(JSON.parse(cb.dataset.container.replace(/&apos;/g, "'")));
                } catch (e) {
                    containers.push({ containerId: cb.value });
                }
            });
        } else {
            const validation = validateContainerInput();
            if (!validation.valid) {
                NotificationSystem?.error('Invalid container input');
                return;
            }
            containers = validation.ids.map(id => ({ containerId: id }));
        }

        if (containers.length === 0) {
            NotificationSystem?.error('No containers to add');
            return;
        }

        const template = document.getElementById('labelTemplate').value;
        const format = document.getElementById('barcodeFormat').value;

        containers.forEach(container => {
            printQueue.push({
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                containerId: container.containerId,
                container,
                template,
                format,
                addedAt: new Date().toISOString()
            });
        });

        savePrintQueue();
        updateQueueDisplay();
        switchTab('queue');
        NotificationSystem?.success(`Added ${containers.length} label(s) to queue`);
    }

    /**
     * Print labels
     */
    function printLabels(containers) {
        if (!containers || containers.length === 0) return;

        const template = LABEL_TEMPLATES[document.getElementById('labelTemplate').value];
        const format = document.getElementById('barcodeFormat').value;

        // Use LabelPrintService if available
        if (window.LabelPrintService) {
            const printContainers = containers.map(c => ({
                containerId: c.containerId,
                qrUrl: c.qrExcelUrl || String(c.containerId)
            }));

            LabelPrintService.printLabels(printContainers).then(success => {
                if (success) {
                    addToPrintHistory(containers);
                }
            });
        } else {
            // Fallback: show printable preview
            showPrintPreview(containers, template, format);
        }
    }

    /**
     * Show print preview window
     */
    function showPrintPreview(containers, template, format) {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        // SECURITY: Sanitize function for print preview content
        const sanitizeForPrint = (str) => {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(str);
            return div.innerHTML;
        };
        
        const labelsHtml = containers.map(container => {
            // SECURITY: Sanitize container ID before inserting into HTML
            const safeContainerId = sanitizeForPrint(container.containerId);
            const barcodeData = generateBarcodeData(container.containerId, format);
            return `
                <div class="print-label" style="
                    width: ${template.width}in;
                    height: ${template.height}in;
                    border: 1px dashed #ccc;
                    margin: 4px;
                    padding: 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    page-break-inside: avoid;
                ">
                    <div class="barcode">${barcodeData.svg}</div>
                    ${template.showText ? `
                        <div style="font-size: ${template.fontSize}pt; font-weight: bold;">
                            ${safeContainerId}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Labels</title>
                <style>
                    @media print {
                        .no-print { display: none; }
                        .print-label { border: none !important; margin: 2px !important; }
                    }
                    body { font-family: sans-serif; padding: 20px; }
                    .print-actions { margin-bottom: 20px; }
                    .btn { padding: 10px 20px; margin-right: 10px; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="print-actions no-print">
                    <button class="btn" onclick="window.print()">🖨️ Print</button>
                    <button class="btn" onclick="window.close()">Close</button>
                </div>
                <div class="labels-container">
                    ${labelsHtml}
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        addToPrintHistory(containers);
    }

    /**
     * Print entire queue
     */
    function printQueue() {
        if (printQueue.length === 0) return;

        const containers = printQueue.map(item => item.container);
        printLabels(containers);
        
        // Clear queue after printing
        printQueue = [];
        savePrintQueue();
        updateQueueDisplay();
    }

    /**
     * Remove item from queue
     */
    function removeFromQueue(itemId) {
        printQueue = printQueue.filter(item => item.id !== itemId);
        savePrintQueue();
        updateQueueDisplay();
    }

    /**
     * Clear entire queue
     */
    function clearQueue() {
        printQueue = [];
        savePrintQueue();
        updateQueueDisplay();
    }

    /**
     * Update queue display
     */
    function updateQueueDisplay() {
        const list = document.getElementById('printQueueList');
        const badge = document.getElementById('queueBadge');
        const printBtn = document.getElementById('printQueueBtn');

        if (badge) badge.textContent = printQueue.length;
        if (printBtn) printBtn.disabled = printQueue.length === 0;

        if (!list) return;

        if (printQueue.length === 0) {
            list.innerHTML = '<div class="queue-empty">Queue is empty</div>';
            return;
        }

        list.innerHTML = printQueue.map(item => `
            <div class="queue-item">
                <div class="queue-item-info">
                    <strong>Container ${item.containerId}</strong>
                    <span class="queue-item-meta">
                        ${LABEL_TEMPLATES[item.template]?.name || item.template} | 
                        ${BARCODE_FORMATS[item.format]?.name || item.format}
                    </span>
                </div>
                <button class="btn-icon" onclick="BarcodeBuilderUI.removeFromQueue('${item.id}')" title="Remove">
                    🗑️
                </button>
            </div>
        `).join('');
    }

    /**
     * Save queue to localStorage
     */
    function savePrintQueue() {
        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(printQueue));
        } catch (e) {
            console.warn('Failed to save print queue:', e);
        }
    }

    /**
     * Load queue from localStorage
     */
    function loadPrintQueue() {
        try {
            const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
            printQueue = saved ? JSON.parse(saved) : [];
        } catch (e) {
            printQueue = [];
        }
    }

    /**
     * Add to print history
     */
    function addToPrintHistory(containers) {
        try {
            const history = JSON.parse(localStorage.getItem(PRINT_HISTORY_KEY) || '[]');
            
            history.unshift({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                containerCount: containers.length,
                containerIds: containers.map(c => c.containerId)
            });

            // Keep only last 50 entries
            if (history.length > 50) history.splice(50);

            localStorage.setItem(PRINT_HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.warn('Failed to save print history:', e);
        }
    }

    /**
     * Update history display
     */
    function updateHistoryDisplay() {
        const list = document.getElementById('printHistoryList');
        if (!list) return;

        try {
            const history = JSON.parse(localStorage.getItem(PRINT_HISTORY_KEY) || '[]');

            if (history.length === 0) {
                list.innerHTML = '<div class="history-empty">No print history</div>';
                return;
            }

            list.innerHTML = history.map(entry => `
                <div class="history-item">
                    <div class="history-item-info">
                        <strong>${entry.containerCount} label(s) printed</strong>
                        <span class="history-date">${formatDateTime(entry.timestamp)}</span>
                        <span class="history-ids">IDs: ${entry.containerIds.slice(0, 5).join(', ')}${entry.containerIds.length > 5 ? '...' : ''}</span>
                    </div>
                    <button class="btn-small" onclick="BarcodeBuilderUI.reprintFromHistory(${entry.id})">
                        🔄 Reprint
                    </button>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<div class="history-empty">Error loading history</div>';
        }
    }

    /**
     * Reprint from history
     */
    function reprintFromHistory(entryId) {
        try {
            const history = JSON.parse(localStorage.getItem(PRINT_HISTORY_KEY) || '[]');
            const entry = history.find(h => h.id === entryId);
            
            if (entry) {
                const containers = entry.containerIds.map(id => ({ containerId: id }));
                printLabels(containers);
            }
        } catch (e) {
            NotificationSystem?.error('Failed to reprint');
        }
    }

    /**
     * Clear print history
     */
    function clearHistory() {
        localStorage.removeItem(PRINT_HISTORY_KEY);
        updateHistoryDisplay();
        NotificationSystem?.success('Print history cleared');
    }

    /**
     * Format date/time
     */
    function formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Public API
    return {
        initialize,
        showModal,
        closeModal,
        switchTab,
        setGenerationMode,
        validateContainerInput,
        updatePreview,
        generateLabels,
        addToQueue,
        removeFromQueue,
        clearQueue,
        printQueue,
        filterReprintList,
        reprintFromHistory,
        clearHistory
    };

})();
