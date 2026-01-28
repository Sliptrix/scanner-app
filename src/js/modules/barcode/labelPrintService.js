// Label Print Service - Zebra GX420T ZPL Label Printing
// Generates ZPL for 2"W x 1"H stickers with 2 QR codes per label
// Each QR code has its Container ID printed underneath

window.LabelPrintService = (function() {
    'use strict';

    const config = {
        // Zebra GX420T at 203 DPI
        dpi: 203,
        labelWidthDots: 406,   // 2" x 203
        labelHeightDots: 203,  // 1" x 203
        qrSize: 4,             // ZPL QR magnification (4 = ~0.6" at 203dpi)
        fontSize: 20,          // Font size in dots for container ID text
        backendUrl: 'http://localhost:3001'
    };

    // Build ZPL for a label with 2 QR codes side by side
    // Each QR encodes the container's QR URL, with Container ID text below
    function buildZPL(container1, container2) {
        const qr1Text = container1.qrUrl || container1.containerId.toString();
        const qr1Label = String(container1.containerId);
        const qr2Text = container2 ? (container2.qrUrl || container2.containerId.toString()) : null;
        const qr2Label = container2 ? String(container2.containerId) : null;

        // Layout: two QR codes centered in each half of the 2" label
        // Left QR: x=30, Right QR: x=220
        // QR codes at y=10, text at y=150
        const leftX = 30;
        const rightX = 220;
        const qrY = 10;
        const textY = 150;

        let zpl = '^XA\n';
        // Label size
        zpl += `^PW${config.labelWidthDots}\n`;
        zpl += `^LL${config.labelHeightDots}\n`;
        // Print speed (2 = slow/quality)
        zpl += '^PR2,2\n';

        // Left QR code
        zpl += `^FO${leftX},${qrY}\n`;
        zpl += `^BQN,2,${config.qrSize}\n`;
        zpl += `^FDMA,${qr1Text}^FS\n`;

        // Left label text (centered under QR)
        zpl += `^FO${leftX},${textY}\n`;
        zpl += `^A0N,${config.fontSize},${config.fontSize}\n`;
        zpl += `^FD${qr1Label}^FS\n`;

        // Right QR code (only if second container provided)
        if (qr2Text) {
            zpl += `^FO${rightX},${qrY}\n`;
            zpl += `^BQN,2,${config.qrSize}\n`;
            zpl += `^FDMA,${qr2Text}^FS\n`;

            // Right label text
            zpl += `^FO${rightX},${textY}\n`;
            zpl += `^A0N,${config.fontSize},${config.fontSize}\n`;
            zpl += `^FD${qr2Label}^FS\n`;
        }

        zpl += '^XZ\n';
        return zpl;
    }

    // Print labels for an array of containers (paired 2 per label)
    // Each container: { containerId, qrUrl }
    async function printLabels(containers) {
        if (!containers || containers.length === 0) {
            NotificationSystem.error('No containers selected for printing');
            return false;
        }

        // Pair containers (2 per label)
        const labels = [];
        for (let i = 0; i < containers.length; i += 2) {
            labels.push(buildZPL(containers[i], containers[i + 1] || null));
        }

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
        printNewAssignments,
        copyZPL,
        downloadZPL,
        showZPLPreview
    };

})();
