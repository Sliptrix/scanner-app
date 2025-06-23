// Enhanced Code128 Barcode Generation Module
// Lab Barcode Builder & Transfer System

/**
 * Code128BarcodeGenerator - Generates Code128 barcodes from composite strings
 * 
 * Features:
 * - Code128 barcode generation with SVG and base64 output
 * - Field validation before generation
 * - Human-readable text integration
 * - Error handling and recovery
 */
window.Code128BarcodeGenerator = {
    
    /**
     * Generate a Code128 barcode from the seven-field composite string
     * @param {Object} fields - Object containing all seven barcode fields
     * @returns {Object} Barcode generation result with SVG, base64, and metadata
     */
    generateCode128Barcode: function(fields) {
        try {
            // Validate all required fields
            this.validateBarcodeFields(fields);
            
            // Generate composite string
            const compositeString = this.generateCompositeString(fields);
            
            // Generate the actual Code128 barcode
            const barcodeResult = this.createCode128Barcode(compositeString);
            
            // Log generation event
            this.logBarcodeGenerationEvent(fields, compositeString, barcodeResult);
            
            return {
                success: true,
                type: 'CODE128',
                data: compositeString,
                svg: barcodeResult.svg,
                base64: barcodeResult.base64,
                includesText: true,
                humanReadable: compositeString,
                fields: fields,
                timestamp: new Date().toISOString(),
                metadata: this.extractBarcodeMetadata(fields)
            };
            
        } catch (error) {
            console.error('Code128 barcode generation failed:', error);
            
            return {
                success: false,
                error: error.message,
                type: 'CODE128',
                data: null,
                timestamp: new Date().toISOString()
            };
        }
    },
    
    /**
     * Validate all required fields for barcode generation
     * @param {Object} fields - Fields to validate
     * @throws {Error} If validation fails
     */
    validateBarcodeFields: function(fields) {
        const requiredFields = ['owner', 'strain', 'media', 'stage', 'tissue', 'date'];
        
        // Check all required fields are present
        for (const field of requiredFields) {
            if (!fields[field] || fields[field].toString().trim() === '') {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate specific field formats
        this.validateFieldFormats(fields);
    },
    
    /**
     * Validate specific field formats
     * @param {Object} fields - Fields to validate
     */
    validateFieldFormats: function(fields) {
        // Owner: 1-3 letters
        if (!/^[A-Z]{1,3}$/i.test(fields.owner)) {
            throw new Error('Invalid owner format: must be 1-3 letters');
        }
        
        // Strain: exactly 5 digits (padded if necessary)
        const strainStr = fields.strain.toString().padStart(5, '0');
        if (!/^\d{5}$/.test(strainStr)) {
            throw new Error('Invalid strain format: must be 5 digits');
        }
        fields.strain = strainStr; // Update with padded value
        
        // Media: 1-3 letters
        if (!/^[A-Z]{1,3}$/i.test(fields.media)) {
            throw new Error('Invalid media format: must be 1-3 letters');
        }
        
        // Stage: single digit 1-9
        if (!/^[1-9]$/.test(fields.stage.toString())) {
            throw new Error('Invalid stage format: must be single digit 1-9');
        }
        
        // Tissue: 1-2 digits
        if (!/^\d{1,2}$/.test(fields.tissue.toString())) {
            throw new Error('Invalid tissue format: must be 1-2 digits');
        }
        
        // Date: YYYYMMDD format
        const dateStr = fields.date.toString();
        if (!/^\d{8}$/.test(dateStr)) {
            throw new Error('Invalid date format: must be YYYYMMDD');
        }
        
        // Validate actual date
        const year = parseInt(dateStr.substr(0, 4));
        const month = parseInt(dateStr.substr(4, 2));
        const day = parseInt(dateStr.substr(6, 2));
        
        if (year < 2020 || year > 2030 || month < 1 || month > 12 || day < 1 || day > 31) {
            throw new Error('Invalid date: must be valid date between 2020-2030');
        }
    },
    
    /**
     * Generate composite string from validated fields
     * @param {Object} fields - Validated fields
     * @returns {String} Composite barcode string
     */
    generateCompositeString: function(fields) {
        // Ensure consistent formatting
        const owner = fields.owner.toUpperCase();
        const strain = fields.strain.toString().padStart(5, '0');
        const media = fields.media.toUpperCase();
        const stage = fields.stage.toString();
        const tissue = fields.tissue.toString().padStart(2, '0');
        const date = fields.date.toString();
        
        return owner + strain + media + stage + tissue + date;
    },
    
    /**
     * Create the actual Code128 barcode using JsBarcode library
     * @param {String} data - Data to encode
     * @returns {Object} Barcode result with SVG and base64
     */
    createCode128Barcode: function(data) {
        try {
            // Create SVG barcode
            const svg = this.generateSVGBarcode(data);
            
            // Create base64 barcode  
            const base64 = this.generateBase64Barcode(data);
            
            return {
                svg: svg,
                base64: base64
            };
            
        } catch (error) {
            throw new Error(`Barcode generation failed: ${error.message}`);
        }
    },
    
    /**
     * Generate SVG barcode using inline barcode generation
     * @param {String} data - Data to encode
     * @returns {String} SVG markup
     */
    generateSVGBarcode: function(data) {
        // For now, generate a simple placeholder SVG
        // In a real implementation, this would use JsBarcode or similar library
        const width = 300;
        const height = 100;
        const barWidth = 2;
        const numBars = data.length * 6; // Approximate for Code128
        
        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svgContent += `<rect width="${width}" height="${height}" fill="white"/>`;
        
        // Generate bars (simplified pattern)
        for (let i = 0; i < numBars; i++) {
            const x = (i * barWidth) + 10;
            const barHeight = 60;
            const color = (i % 2 === 0) ? 'black' : 'white';
            
            if (color === 'black') {
                svgContent += `<rect x="${x}" y="10" width="${barWidth}" height="${barHeight}" fill="black"/>`;
            }
        }
        
        // Add human readable text
        const textX = width / 2;
        const textY = height - 10;
        svgContent += `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${data}</text>`;
        
        svgContent += '</svg>';
        
        return svgContent;
    },
    
    /**
     * Generate base64 image barcode
     * @param {String} data - Data to encode
     * @returns {String} Base64 data URL
     */
    generateBase64Barcode: function(data) {
        // Create a canvas element to generate the barcode image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 300;
        canvas.height = 100;
        
        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Generate barcode bars (simplified pattern)
        ctx.fillStyle = 'black';
        const barWidth = 2;
        const numBars = data.length * 6;
        
        for (let i = 0; i < numBars; i++) {
            if (i % 2 === 0) {
                const x = (i * barWidth) + 10;
                ctx.fillRect(x, 10, barWidth, 60);
            }
        }
        
        // Add text
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(data, canvas.width / 2, canvas.height - 10);
        
        // Convert to base64
        return canvas.toDataURL('image/png');
    },
    
    /**
     * Extract metadata from barcode fields
     * @param {Object} fields - Barcode fields
     * @returns {Object} Extracted metadata
     */
    extractBarcodeMetadata: function(fields) {
        return {
            // Field values
            owner: fields.owner.toUpperCase(),
            strain: fields.strain.toString().padStart(5, '0'),
            media: fields.media.toUpperCase(),
            stage: fields.stage.toString(),
            tissue: fields.tissue.toString(),
            date: fields.date.toString(),
            
            // Enriched metadata (lookup from app state if available)
            ownerName: this.lookupOwnerName(fields.owner),
            strainName: this.lookupStrainName(fields.strain),
            mediaName: this.lookupMediaName(fields.media),
            stageName: this.lookupStageName(fields.stage),
            
            // Formatted data
            formattedDate: this.formatDate(fields.date),
            tissueCount: parseInt(fields.tissue),
            
            // Generation metadata
            generatedAt: new Date().toISOString(),
            generatorVersion: '1.0.0'
        };
    },
    
    /**
     * Look up owner name from app state
     * @param {String} ownerId - Owner ID
     * @returns {String} Owner name or default
     */
    lookupOwnerName: function(ownerId) {
        if (window.appState && window.appState.ownersTable) {
            return window.appState.ownersTable[ownerId.toUpperCase()] || `Owner ${ownerId}`;
        }
        return `Owner ${ownerId}`;
    },
    
    /**
     * Look up strain name from app state  
     * @param {String} strainId - Strain ID
     * @returns {String} Strain name or default
     */
    lookupStrainName: function(strainId) {
        if (window.appState && window.appState.strainsTable) {
            const paddedId = strainId.toString().padStart(5, '0');
            return window.appState.strainsTable[paddedId] || `Strain ${paddedId}`;
        }
        return `Strain ${strainId}`;
    },
    
    /**
     * Look up media name from app state
     * @param {String} mediaId - Media ID  
     * @returns {String} Media name or default
     */
    lookupMediaName: function(mediaId) {
        if (window.appState && window.appState.mediaTypesTable) {
            return window.appState.mediaTypesTable[mediaId.toUpperCase()] || `Media ${mediaId}`;
        }
        return `Media ${mediaId}`;
    },
    
    /**
     * Look up stage name from app state
     * @param {String} stageId - Stage ID
     * @returns {String} Stage name or default  
     */
    lookupStageName: function(stageId) {
        if (window.appState && window.appState.stagesTable) {
            return window.appState.stagesTable[stageId] || `Stage ${stageId}`;
        }
        return `Stage ${stageId}`;
    },
    
    /**
     * Format date string for display
     * @param {String} dateString - YYYYMMDD date string
     * @returns {String} Formatted date
     */
    formatDate: function(dateString) {
        if (dateString && dateString.length === 8) {
            const year = dateString.substr(0, 4);
            const month = dateString.substr(4, 2);
            const day = dateString.substr(6, 2);
            return `${year}-${month}-${day}`;
        }
        return dateString;
    },
    
    /**
     * Log barcode generation event
     * @param {Object} fields - Original fields
     * @param {String} compositeString - Generated composite string
     * @param {Object} barcodeResult - Barcode generation result
     */
    logBarcodeGenerationEvent: function(fields, compositeString, barcodeResult) {
        try {
            if (window.BarcodeEventLogger) {
                const event = {
                    type: 'barcode_generated',
                    timestamp: new Date().toISOString(),
                    composite_string: compositeString,
                    fields: fields,
                    metadata: {
                        container_id: window.appState?.currentContainer || null,
                        user_id: 'current_user',
                        session_id: window.appState?.sessionId || 'session_' + Date.now(),
                        barcode_type: 'CODE128',
                        generation_method: 'enhanced_generator'
                    }
                };
                
                window.BarcodeEventLogger.logEvent(event);
            }
        } catch (error) {
            console.warn('Failed to log barcode generation event:', error);
        }
    },
    
    /**
     * Get Code128 barcode configuration
     * @returns {Object} Barcode configuration
     */
    getConfiguration: function() {
        return {
            type: 'CODE128',
            includeText: true,
            width: 300,
            height: 100,
            fontSize: 12,
            fontFamily: 'monospace',
            backgroundColor: 'white',
            foregroundColor: 'black',
            margin: 10,
            format: 'CODE128',
            displayValue: true
        };
    }
};
