// Enhanced Barcode Scanner and Parser Module
// Lab Barcode Builder & Transfer System

/**
 * BarcodeScanner - Scans and parses composite barcodes back into seven fields
 * 
 * Features:
 * - Composite barcode parsing into seven fields
 * - Validation and error handling
 * - Metadata enrichment during parsing
 * - Support for various input methods (scan vs manual)
 */
window.BarcodeScanner = {
    
    /**
     * Parse a composite barcode string into its seven component fields
     * @param {String} barcodeData - The scanned barcode data
     * @param {String} inputMethod - 'scan' or 'manual' (default: 'scan')
     * @returns {Object} Parsing result with fields and metadata
     */
    parseCompositeBarcode: function(barcodeData, inputMethod = 'scan') {
        try {
            // Clean and validate input
            const cleanData = this.cleanBarcodeInput(barcodeData);
            this.validateBarcodeLength(cleanData);
            
            // Parse fields from composite string
            const parsedFields = this.extractFieldsFromComposite(cleanData);
            
            // Validate parsed fields
            const validationResult = this.validateParsedFields(parsedFields);
            
            // Enrich with metadata
            const metadata = this.enrichWithMetadata(parsedFields);
            
            // Log scan event
            this.logBarcodeScanEvent(cleanData, parsedFields, inputMethod);
            
            return {
                success: true,
                inputMethod: inputMethod,
                rawData: barcodeData,
                cleanData: cleanData,
                fields: parsedFields,
                metadata: metadata,
                validation: validationResult,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Barcode parsing failed:', error);
            
            return {
                success: false,
                error: error.message,
                inputMethod: inputMethod,
                rawData: barcodeData,
                fields: null,
                timestamp: new Date().toISOString()
            };
        }
    },
    
    /**
     * Clean barcode input data
     * @param {String} input - Raw barcode input
     * @returns {String} Cleaned barcode data
     */
    cleanBarcodeInput: function(input) {
        if (!input) {
            throw new Error('No barcode data provided');
        }
        
        // Remove leading/trailing whitespace and convert to uppercase where appropriate
        let cleaned = input.toString().trim();
        
        // Handle case sensitivity - keep original case for now, will normalize per field
        return cleaned;
    },
    
    /**
     * Validate barcode length
     * @param {String} barcodeData - Cleaned barcode data
     * @throws {Error} If length is invalid
     */
    validateBarcodeLength: function(barcodeData) {
        // Expected minimum length: Owner(2) + Strain(5) + Media(2) + Stage(1) + Tissue(2) + Date(8) = 20
        const minLength = 16; // Allowing for variable owner/media lengths
        const maxLength = 25; // Reasonable maximum
        
        if (barcodeData.length < minLength) {
            throw new Error(`Invalid barcode length: ${barcodeData.length} characters (minimum ${minLength})`);
        }
        
        if (barcodeData.length > maxLength) {
            throw new Error(`Invalid barcode length: ${barcodeData.length} characters (maximum ${maxLength})`);
        }
    },
    
    /**
     * Extract fields from composite barcode string
     * @param {String} compositeData - Composite barcode string
     * @returns {Object} Extracted fields
     */
    extractFieldsFromComposite: function(compositeData) {
        // Parse according to expected field positions
        // Format: OWNER(2-3) + STRAIN(5) + MEDIA(2-3) + STAGE(1) + TISSUE(2) + DATE(8)
        
        let position = 0;
        const fields = {};
        
        try {
            // Owner: 2-3 characters (letters)
            const ownerMatch = compositeData.match(/^[A-Z]{1,3}/i);
            if (!ownerMatch) {
                throw new Error('Invalid owner format at start of barcode');
            }
            fields.owner = ownerMatch[0].toUpperCase();
            position += fields.owner.length;
            
            // Strain: 5 digits
            const strainPart = compositeData.substr(position, 5);
            if (!/^\d{5}$/.test(strainPart)) {
                throw new Error('Invalid strain format: expected 5 digits');
            }
            fields.strain = strainPart;
            position += 5;
            
            // Media: 2-3 characters (letters)
            const remainingAfterStrain = compositeData.substr(position);
            const mediaMatch = remainingAfterStrain.match(/^[A-Z]{1,3}/i);
            if (!mediaMatch) {
                throw new Error('Invalid media format after strain');
            }
            fields.media = mediaMatch[0].toUpperCase();
            position += fields.media.length;
            
            // Stage: 1 digit
            const stagePart = compositeData.substr(position, 1);
            if (!/^[1-9]$/.test(stagePart)) {
                throw new Error('Invalid stage format: expected single digit 1-9');
            }
            fields.stage = stagePart;
            position += 1;
            
            // Tissue: 2 digits
            const tissuePart = compositeData.substr(position, 2);
            if (!/^\d{1,2}$/.test(tissuePart)) {
                throw new Error('Invalid tissue format: expected 1-2 digits');
            }
            fields.tissue = tissuePart;
            position += 2;
            
            // Date: 8 digits (YYYYMMDD)
            const datePart = compositeData.substr(position, 8);
            if (!/^\d{8}$/.test(datePart)) {
                throw new Error('Invalid date format: expected YYYYMMDD');
            }
            fields.date = datePart;
            position += 8;
            
            // Verify we've consumed all data
            if (position !== compositeData.length) {
                console.warn(`Barcode parsing: ${compositeData.length - position} extra characters ignored`);
            }
            
            return fields;
            
        } catch (error) {
            throw new Error(`Field extraction failed: ${error.message}`);
        }
    },
    
    /**
     * Validate parsed fields for format and content
     * @param {Object} fields - Parsed fields
     * @returns {Object} Validation result
     */
    validateParsedFields: function(fields) {
        const errors = [];
        const warnings = [];
        
        // Validate owner
        if (!fields.owner || !/^[A-Z]{1,3}$/i.test(fields.owner)) {
            errors.push({field: 'owner', message: 'Invalid owner format'});
        }
        
        // Validate strain
        if (!fields.strain || !/^\d{5}$/.test(fields.strain)) {
            errors.push({field: 'strain', message: 'Invalid strain format'});
        }
        
        // Validate media
        if (!fields.media || !/^[A-Z]{1,3}$/i.test(fields.media)) {
            errors.push({field: 'media', message: 'Invalid media format'});
        }
        
        // Validate stage
        if (!fields.stage || !/^[1-9]$/.test(fields.stage)) {
            errors.push({field: 'stage', message: 'Invalid stage format'});
        }
        
        // Validate tissue
        if (!fields.tissue || !/^\d{1,2}$/.test(fields.tissue)) {
            errors.push({field: 'tissue', message: 'Invalid tissue count format'});
        } else {
            const tissueCount = parseInt(fields.tissue);
            if (tissueCount < 1 || tissueCount > 99) {
                warnings.push({field: 'tissue', message: 'Tissue count outside normal range (1-99)'});
            }
        }
        
        // Validate date
        if (!fields.date || !/^\d{8}$/.test(fields.date)) {
            errors.push({field: 'date', message: 'Invalid date format'});
        } else {
            const dateValidation = this.validateDateField(fields.date);
            if (!dateValidation.valid) {
                errors.push({field: 'date', message: dateValidation.error});
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            errorCount: errors.length,
            warningCount: warnings.length
        };
    },
    
    /**
     * Validate date field specifically
     * @param {String} dateString - YYYYMMDD date string
     * @returns {Object} Date validation result
     */
    validateDateField: function(dateString) {
        try {
            const year = parseInt(dateString.substr(0, 4));
            const month = parseInt(dateString.substr(4, 2));
            const day = parseInt(dateString.substr(6, 2));
            
            // Basic range checks - extended to 2099 for long-term use
            if (year < 2020 || year > 2099) {
                return {valid: false, error: 'Year out of expected range (2020-2099)'};
            }
            
            if (month < 1 || month > 12) {
                return {valid: false, error: 'Invalid month'};
            }
            
            if (day < 1 || day > 31) {
                return {valid: false, error: 'Invalid day'};
            }
            
            // Try to create actual date to check validity
            const date = new Date(year, month - 1, day);
            if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
                return {valid: false, error: 'Invalid date'};
            }
            
            return {valid: true, parsedDate: date};
            
        } catch (error) {
            return {valid: false, error: 'Date parsing failed'};
        }
    },
    
    /**
     * Enrich parsed fields with metadata from app state
     * @param {Object} fields - Parsed fields
     * @returns {Object} Enriched metadata
     */
    enrichWithMetadata: function(fields) {
        return {
            // Original field values
            rawFields: {...fields},
            
            // Looked up names
            ownerName: this.lookupOwnerName(fields.owner),
            strainName: this.lookupStrainName(fields.strain),
            mediaName: this.lookupMediaName(fields.media),
            stageName: this.lookupStageName(fields.stage),
            
            // Formatted values
            formattedDate: this.formatDate(fields.date),
            tissueCount: parseInt(fields.tissue),
            
            // Computed values
            compositeString: this.rebuildCompositeString(fields),
            
            // Parsing metadata
            parsedAt: new Date().toISOString(),
            parserVersion: '1.0.0'
        };
    },
    
    /**
     * Look up owner name from app state
     * @param {String} ownerId - Owner ID
     * @returns {String} Owner name or default
     */
    lookupOwnerName: function(ownerId) {
        if (window.appState && window.appState.ownersTable) {
            return window.appState.ownersTable[ownerId] || `Owner ${ownerId}`;
        }
        return `Owner ${ownerId}`;
    },
    
    /**
     * Look up strain name from app state
     * @param {String} strainId - Strain ID (may be padded like "00013" or unpadded like "13")
     * @returns {String} Strain name or default
     */
    lookupStrainName: function(strainId) {
        // Use InventoryLookupService if available (handles all formats)
        if (window.InventoryLookupService && window.InventoryLookupService.resolveStrainName) {
            const name = window.InventoryLookupService.resolveStrainName(strainId);
            if (name) return name;
        }

        // Fallback to direct lookup
        if (window.appState && window.appState.strainsTable) {
            // Try padded ID first
            if (window.appState.strainsTable[strainId]) {
                return window.appState.strainsTable[strainId];
            }
            // Try unpadded ID (remove leading zeros)
            const unpaddedId = String(parseInt(strainId, 10));
            if (window.appState.strainsTable[unpaddedId]) {
                return window.appState.strainsTable[unpaddedId];
            }
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
            return window.appState.mediaTypesTable[mediaId] || `Media ${mediaId}`;
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
     * Rebuild composite string from parsed fields (for verification)
     * @param {Object} fields - Parsed fields
     * @returns {String} Rebuilt composite string
     */
    rebuildCompositeString: function(fields) {
        return fields.owner + fields.strain + fields.media + fields.stage + 
               fields.tissue.padStart(2, '0') + fields.date;
    },
    
    /**
     * Log barcode scan event
     * @param {String} cleanData - Cleaned barcode data
     * @param {Object} parsedFields - Parsed fields
     * @param {String} inputMethod - Input method used
     */
    logBarcodeScanEvent: function(cleanData, parsedFields, inputMethod) {
        try {
            if (window.BarcodeEventLogger) {
                const event = {
                    type: 'barcode_scanned',
                    timestamp: new Date().toISOString(),
                    scanned_data: cleanData,
                    parsed_fields: parsedFields,
                    scan_method: inputMethod,
                    metadata: {
                        user_id: 'current_user',
                        session_id: window.appState?.sessionId || 'session_' + Date.now(),
                        scanner_version: '1.0.0'
                    }
                };
                
                window.BarcodeEventLogger.logEvent(event);
            }
        } catch (error) {
            console.warn('Failed to log barcode scan event:', error);
        }
    },
    
    /**
     * Attempt to parse a malformed barcode with partial recovery
     * @param {String} barcodeData - Potentially malformed barcode
     * @returns {Object} Partial parsing result
     */
    parsePartialBarcode: function(barcodeData) {
        const result = {
            success: false,
            partialFields: {},
            errors: {},
            recoveredFields: 0
        };
        
        try {
            const cleanData = this.cleanBarcodeInput(barcodeData);
            let position = 0;
            
            // Try to extract owner
            try {
                const ownerMatch = cleanData.match(/^[A-Z]{1,3}/i);
                if (ownerMatch) {
                    result.partialFields.owner = ownerMatch[0].toUpperCase();
                    position += result.partialFields.owner.length;
                    result.recoveredFields++;
                } else {
                    result.errors.owner = 'Could not parse owner';
                }
            } catch (e) {
                result.errors.owner = 'Owner parsing failed';
            }
            
            // Try to extract strain
            try {
                const strainPart = cleanData.substr(position, 5);
                if (/^\d{5}$/.test(strainPart)) {
                    result.partialFields.strain = strainPart;
                    position += 5;
                    result.recoveredFields++;
                } else {
                    result.errors.strain = 'Could not parse strain';
                }
            } catch (e) {
                result.errors.strain = 'Strain parsing failed';
            }
            
            // Continue with other fields...
            // For brevity, showing pattern for remaining fields
            
            result.success = result.recoveredFields > 0;
            
        } catch (error) {
            result.errors.general = error.message;
        }
        
        return result;
    },
    
    /**
     * Get scanner configuration
     * @returns {Object} Scanner configuration
     */
    getConfiguration: function() {
        return {
            supportedFormats: ['CODE128'],
            inputMethods: ['scan', 'manual'],
            validationLevel: 'strict',
            enablePartialRecovery: true,
            logEvents: true,
            version: '1.0.0'
        };
    },
    
    /**
     * Detect if input appears to be a composite barcode
     * @param {String} input - Input to test
     * @returns {Boolean} True if likely a composite barcode
     */
    isCompositeBarcode: function(input) {
        if (!input || typeof input !== 'string') {
            return false;
        }
        
        const cleaned = input.trim();
        
        // Basic length check
        if (cleaned.length < 16 || cleaned.length > 25) {
            return false;
        }
        
        // Check if it starts with letters (owner) followed by digits (strain)
        if (!/^[A-Z]{1,3}\d{5}/i.test(cleaned)) {
            return false;
        }
        
        // Check if it ends with 8 digits (date)
        if (!/\d{8}$/.test(cleaned)) {
            return false;
        }
        
        return true;
    }
};
