// Label Print Service - Zebra GX420T ZPL Label Printing
// Generates ZPL for 2"W x 1"H stickers with 1 QR code per label
// QR code on the left, Container ID text on the right

window.LabelPrintService = (function() {
    'use strict';

    const config = {
        // Zebra GX420T at 203 DPI
        dpi: 203,
        labelWidthDots: 406,   // 2" x 203
        labelHeightDots: 203,  // 1" x 203
        qrSize: 3,             // ZPL QR magnification (3 = ~0.45" at 203dpi, keeps clear gap from text)
        fontSize: 20,          // Font size in dots for container ID text
        backendUrl: 'http://localhost:3001'
    };

    // Build ZPL for a single label: QR code on the left, Container ID on the right
    function buildZPL(container) {
        const qrText = container.qrUrl || container.containerId.toString();
        const labelText = String(container.containerId);

        // Layout: QR on left side, Container ID vertically centered on right
        // QR at mag 3 is ~130 dots wide max. Starting at x=15, right edge ≤ ~145 dots.
        // Text starts at x=165, leaving a 20-dot (~0.1") gap to avoid overlap.
        const qrX = 15;
        const qrY = 15;
        const textX = 165;
        const textFontH = 45;  // ~0.22" tall - clearly readable
        const textFontW = 35;
        // Center text vertically: (labelHeight - fontHeight) / 2
        const textY = Math.round((config.labelHeightDots - textFontH) / 2);

        let zpl = '^XA\n';
        // Label size
        zpl += `^PW${config.labelWidthDots}\n`;
        zpl += `^LL${config.labelHeightDots}\n`;
        // Print speed (2 = slow/quality)
        zpl += '^PR2,2\n';

        // QR code on the left
        zpl += `^FO${qrX},${qrY}\n`;
        zpl += `^BQN,2,${config.qrSize}\n`;
        zpl += `^FDMA,${qrText}^FS\n`;

        // Container ID text on the right - large, bold, vertically centered
        zpl += `^FO${textX},${textY}\n`;
        zpl += `^A0N,${textFontH},${textFontW}\n`;
        zpl += `^FD${labelText}^FS\n`;

        zpl += '^XZ\n';
        return zpl;
    }

    // Print labels for an array of containers (1 per label)
    // Each container: { containerId, qrUrl }
    async function printLabels(containers) {
        if (!containers || containers.length === 0) {
            NotificationSystem.error('No containers selected for printing');
            return false;
        }

        // One label per container
        const labels = containers.map(c => buildZPL(c));
        const fullZPL = labels.join('');

        // Try backend print endpoint first
        try {
            const response = await fetch(`${config.backendUrl}/api/print/zpl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zpl: fullZPL, copies: 1 })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    NotificationSystem.success(`Printed ${containers.length} label(s) (${labels.length} sticker${labels.length > 1 ? 's' : ''})`);
                    return true;
                }
            }
            // If backend print fails, fall through to browser preview
            console.warn('Backend print failed, falling back to browser preview');
        } catch (e) {
            console.warn('Backend print endpoint not available:', e.message);
        }

        // Fallback: open ZPL preview / download
        showZPLPreview(fullZPL, containers.length);
        return true;
    }

    // Print labels for containers from the QR pool
    async function printFromPool(containerIds) {
        const pool = window.QRCodeService ? QRCodeService.getPool() : [];
        const containers = [];

        containerIds.forEach(id => {
            const poolEntry = pool.find(q =>
                String(q.assignedContainerId) === String(id) ||
                String(q.containerId) === String(id)
            );
            containers.push({
                containerId: id,
                qrUrl: poolEntry ? poolEntry.excelUrl : String(id)
            });
        });

        return printLabels(containers);
    }

    // Print all unassigned QR codes from the pool (pre-print before container assignment)
    async function printUnassigned() {
        const pool = window.QRCodeService ? QRCodeService.getUnassigned() : [];
        if (pool.length === 0) {
            NotificationSystem.info('No unassigned QR codes to print');
            return false;
        }

        const containers = pool.map(entry => ({
            containerId: entry.containerId || `Row ${entry.excelRow}`,
            qrUrl: entry.excelUrl || String(entry.containerId)
        }));

        return printLabels(containers);
    }

    // Print all unprinted/newly assigned containers
    async function printNewAssignments() {
        const pool = window.QRCodeService ? QRCodeService.getAssigned() : [];
        if (pool.length === 0) {
            NotificationSystem.info('No assigned QR codes to print');
            return false;
        }

        const containers = pool.map(entry => ({
            containerId: entry.assignedContainerId || entry.containerId,
            qrUrl: entry.excelUrl || String(entry.containerId)
        }));

        return printLabels(containers);
    }

    // Show ZPL in a preview window for manual copy/download
    function showZPLPreview(zpl, count) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:white;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow:auto;">
                <h3 style="margin:0 0 12px;">Print Labels (${count} container${count > 1 ? 's' : ''})</h3>
                <p style="color:#666;font-size:0.9rem;margin:0 0 12px;">
                    Copy the ZPL below and send to your Zebra GX420T, or configure the backend print endpoint.
                </p>
                <textarea id="zplOutput" style="width:100%;height:200px;font-family:monospace;font-size:12px;border:1px solid #ddd;border-radius:6px;padding:8px;" readonly>${zpl.replace(/</g, '&lt;')}</textarea>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <button onclick="LabelPrintService.copyZPL()" style="flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                        Copy ZPL
                    </button>
                    <button onclick="LabelPrintService.downloadZPL()" style="flex:1;padding:10px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                        Download .zpl
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
                        Close
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.remove();
        });

        // Store ZPL for copy/download
        window._lastZPL = zpl;
    }

    function copyZPL() {
        if (window._lastZPL) {
            navigator.clipboard.writeText(window._lastZPL).then(() => {
                NotificationSystem.success('ZPL copied to clipboard');
            }).catch(() => {
                // Fallback: select textarea
                const ta = document.getElementById('zplOutput');
                if (ta) { ta.select(); document.execCommand('copy'); }
                NotificationSystem.success('ZPL copied');
            });
        }
    }

    function downloadZPL() {
        if (window._lastZPL) {
            const blob = new Blob([window._lastZPL], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `labels_${new Date().toISOString().slice(0, 10)}.zpl`;
            a.click();
            URL.revokeObjectURL(url);
            NotificationSystem.success('ZPL file downloaded');
        }
    }

    return {
        buildZPL,
        printLabels,
        printFromPool,
        printUnassigned,
        printNewAssignments,
        copyZPL,
        downloadZPL,
        showZPLPreview
    };

})();
