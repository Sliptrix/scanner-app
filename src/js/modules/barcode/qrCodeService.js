// QR Code Service
// Integrates frontend with backend /api/qrcodes endpoint for QR Code Generator

window.QRCodeService = {
    backendUrl: 'http://localhost:3001',

    /**
     * Create a QR code for a given barcode result + container
     * @param {Object} barcodeResult - Result from Code128BarcodeGenerator.generateCode128Barcode
     * @param {string} containerId - Current container ID
     * @returns {Promise<Object>} QR metadata (dataUrl, destinationUrl, imageFormat)
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
                    barcodeData: compositeBarcode
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

            return {
                dataUrl: result.dataUrl,
                destinationUrl: result.destinationUrl,
                imageFormat: result.imageFormat || 'PNG'
            };
        } catch (error) {
            console.error('QR code generation error:', error);
            throw error;
        }
    }
};
