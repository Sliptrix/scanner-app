// QR Code Service
// Integrates frontend with backend /api/qrcodes endpoint for QR Code Generator
// Generates QR codes with qrco.de-style short links (e.g., http://localhost:8000?c=bgYvMK)

window.QRCodeService = {
    backendUrl: 'http://localhost:3001',
    appUrl: window.location.origin, // Use current app URL

    /**
     * Create a QR code for a given barcode result + container
     * @param {Object} barcodeResult - Result from Code128BarcodeGenerator.generateCode128Barcode
     * @param {string} containerId - Current container ID
     * @returns {Promise<Object>} QR metadata (dataUrl, destinationUrl, shortCode, imageFormat)
     */
    async createForBarcode(barcodeResult, containerId) {
        try {
            if (!barcodeResult || !barcodeResult.data) {
                throw new Error('Missing barcode data for QR generation');
            }

            const compositeBarcode = barcodeResult.data;

            const response = await fetch(`${this.backendUrl}/api/qrcodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    containerId,
                    barcodeData: compositeBarcode,
                    appUrl: this.appUrl
                })
            });

            if (!response.ok) {
                let errorMessage = 'Failed to generate QR code';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) {
                        errorMessage = errData.error;
                    }
                } catch (e) {
                    // ignore JSON parse errors
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();

            console.log(`✅ QR code generated for container ${containerId}: ${result.shortCode}`);
            console.log(`   Scan URL: ${result.destinationUrl}`);

            return {
                dataUrl: result.dataUrl,
                destinationUrl: result.destinationUrl,
                shortCode: result.shortCode,
                imageFormat: result.imageFormat || 'PNG'
            };
        } catch (error) {
            console.error('QR code generation error:', error);
            // Don't throw - let the caller handle the missing QR gracefully
            return null;
        }
    },

    /**
     * Lookup container information from a short code
     * @param {string} shortCode - The short code from the QR URL
     * @returns {Promise<Object>} Container data (containerId, barcodeData)
     */
    async lookupShortCode(shortCode) {
        try {
            const response = await fetch(`${this.backendUrl}/api/qrcodes/${shortCode}`);

            if (!response.ok) {
                throw new Error(`Short code ${shortCode} not found`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Short code lookup error:', error);
            return null;
        }
    }
};
